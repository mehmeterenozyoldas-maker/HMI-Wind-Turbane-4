
import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

interface GestureControllerProps {
  orbitControlsRef: React.MutableRefObject<any>;
  onSelect: (id: number) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ orbitControlsRef, onSelect }) => {
  const { camera, scene, size } = useThree();
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cursorRef = useRef<THREE.Mesh>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouseVector = useRef(new THREE.Vector2());
  
  const lastVideoTime = useRef(-1);
  const pinchCooldown = useRef(0);

  // Initialize MediaPipe & Video
  useEffect(() => {
    // Create video element safely in effect
    const video = document.createElement('video');
    // Mirror video for debug purposes if we were showing it, 
    // but here we just need to handle the coordinates correctly.
    videoRef.current = video;

    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
      );
      const newLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
      setLandmarker(newLandmarker);
      
      // Setup Webcam
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640,
                height: 480,
                facingMode: "user" 
            } 
        });
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
          video.play();
        });
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };
    init();

    // Cleanup
    return () => {
      if (video.srcObject) {
         const tracks = (video.srcObject as MediaStream).getTracks();
         tracks.forEach(track => track.stop());
      }
      if (landmarker) {
          landmarker.close();
      }
    };
  }, []);

  useFrame((state, delta) => {
    if (!landmarker || !videoRef.current || !videoRef.current.videoWidth) return;

    if (videoRef.current.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = videoRef.current.currentTime;
      
      try {
        const detections = landmarker.detectForVideo(videoRef.current, performance.now());
        
        if (detections.landmarks && detections.handedness) {
          if (pinchCooldown.current > 0) pinchCooldown.current -= delta;

          detections.handedness.forEach((hand, index) => {
            const landmarks = detections.landmarks[index];
            const label = hand[0].categoryName; 
            // NOTE: In "Selfie" mode (default webcam):
            // "Right" label usually corresponds to the user's PHYSICAL LEFT hand.
            // "Left" label usually corresponds to the user's PHYSICAL RIGHT hand.
            
            // --- USER'S LEFT HAND (Label: "Right"): Navigation ---
            if (label === 'Right') {
              const thumbTip = landmarks[4];
              const indexTip = landmarks[8];
              const wrist = landmarks[0];
              const middleTip = landmarks[12];
              const ringTip = landmarks[16];
              const pinkyTip = landmarks[20];

              // Fist Detection (Stop)
              const isFist = [indexTip, middleTip, ringTip, pinkyTip].every(tip => {
                 const d = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
                 return d < 0.15; 
              });

              if (isFist) {
                if (orbitControlsRef.current) {
                  orbitControlsRef.current.autoRotate = false;
                }
              } else {
                // Rotation Logic
                // dx: 0 is center. Left is negative, Right is positive.
                // Inverted X for mirror feel: (1 - x)
                const xMirrored = 1 - wrist.x;
                const dx = (xMirrored - 0.5) * 2; 
                const dy = (wrist.y - 0.5) * 2;
                
                if (orbitControlsRef.current) {
                  orbitControlsRef.current.setAzimuthalAngle(orbitControlsRef.current.getAzimuthalAngle() - dx * 0.05);
                  orbitControlsRef.current.setPolarAngle(Math.max(0.1, Math.min(Math.PI / 2, orbitControlsRef.current.getPolarAngle() + dy * 0.05)));
                  orbitControlsRef.current.update();
                }

                // Zoom Logic
                const zoomDist = Math.sqrt(
                  Math.pow(thumbTip.x - indexTip.x, 2) + 
                  Math.pow(thumbTip.y - indexTip.y, 2)
                );
                
                if (orbitControlsRef.current) {
                   if (zoomDist > 0.15) {
                      orbitControlsRef.current.dollyOut(1.02);
                   } else if (zoomDist < 0.05) {
                      orbitControlsRef.current.dollyIn(1.02);
                   }
                   orbitControlsRef.current.update();
                }
              }
            }

            // --- USER'S RIGHT HAND (Label: "Left"): Cursor/Interaction ---
            if (label === 'Left') {
              const indexTip = landmarks[8];
              const thumbTip = landmarks[4];

              // Coordinate Mapping:
              // X: 0 (Right in Camera) -> 1 (Left in Camera)
              // We want Mirror behavior: Moving hand Right (Physical) should move Cursor Right (Screen).
              // Physical Right is Camera Left (x ~ 0).
              // So x=0 should be Screen Left (-1). x=1 should be Screen Right (1).
              // BUT wait:
              // Camera Image: 0-----------1
              // Real World:   Right-------Left (Selfie View)
              // If I raise Right Hand, it appears at x=0 (Image Left).
              // I want cursor at Screen Left (-1).
              // So (0 * 2) - 1 = -1. Correct.
              // If I move hand to Center (x=0.5). (0.5 * 2) - 1 = 0. Correct.
              // So standard mapping (x * 2) - 1 IS correct for direct mapping, 
              // BUT users expect "Mirroring" where moving hand "Right" (to their right) moves cursor "Right".
              // My Right is the Camera's Left (x=0).
              // If I move my hand RIGHT (away from body), it goes to x=0.
              // I want cursor to go RIGHT (+1).
              // So x=0 needs to map to +1.
              // And x=1 (Camera Right/My Left) needs to map to -1.
              // Formula: -((x * 2) - 1) OR (1 - x) * 2 - 1.
              
              const ndsX = (1 - indexTip.x) * 2 - 1; 
              const ndsY = -(indexTip.y * 2) + 1; 

              if (cursorRef.current) {
                  const vector = new THREE.Vector3(ndsX, ndsY, 0.5);
                  vector.unproject(camera);
                  const dir = vector.sub(camera.position).normalize();
                  const distance = 100;
                  const pos = camera.position.clone().add(dir.multiplyScalar(distance));
                  cursorRef.current.position.copy(pos);
                  cursorRef.current.visible = true;
              }

              const pinchDist = Math.sqrt(
                  Math.pow(thumbTip.x - indexTip.x, 2) + 
                  Math.pow(thumbTip.y - indexTip.y, 2)
              );

              // Visual Feedback for Pinch
              if (cursorRef.current && cursorRef.current.material instanceof THREE.MeshBasicMaterial) {
                  cursorRef.current.material.color.set(pinchDist < 0.05 ? "#ffff00" : "#ff0000");
                  cursorRef.current.scale.setScalar(pinchDist < 0.05 ? 0.8 : 1);
              }

              if (pinchDist < 0.05 && pinchCooldown.current <= 0) {
                  pinchCooldown.current = 1.0; 

                  if (raycaster.current) {
                    mouseVector.current.set(ndsX, ndsY);
                    raycaster.current.setFromCamera(mouseVector.current, camera); 
                    
                    const intersects = raycaster.current.intersectObjects(scene.children, true);
                    
                    for (const hit of intersects) {
                        let obj: THREE.Object3D | null = hit.object;
                        while (obj) {
                            if (obj.userData && obj.userData.isTurbine) {
                                onSelect(obj.userData.id);
                                return; 
                            }
                            obj = obj.parent;
                        }
                    }
                  }
              }
            }
          });
        } else {
          if (cursorRef.current) cursorRef.current.visible = false;
        }
      } catch (err) {
        // Suppress transient mediapipe errors
      }
    }
  });

  return (
    <>
       <mesh ref={cursorRef} visible={false} renderOrder={999}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0.8} depthTest={false} />
       </mesh>
    </>
  );
};
