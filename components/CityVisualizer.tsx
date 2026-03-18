
import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Instances,
  Instance,
  CatmullRomLine,
  Float,
  Stars,
  useCursor
} from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, DepthOfField, Vignette, Noise } from '@react-three/postprocessing';
import { TowerData, TimeOption, SeasonOption, ViewMode, WeatherState, VFXSettings, CameraSettings, Vector3Tuple } from '../types';
import { GestureController } from './GestureController';

// --- Constants ---
const TERRAIN_SIZE = { width: 420, height: 260 };
const TERRAIN_SEGMENTS = { x: 120, y: 80 };
const TURBINE_COUNT = 60;
const SOLAR_COUNT = 400;
const CYCLE_DURATION = 60; // seconds per day

// --- Helper Functions ---
function terrainHeightFn(x: number, z: number) {
  const s = 0.018;
  const h1 = Math.sin(x * s) * 22 + Math.cos(z * s) * 18;
  const h2 = Math.sin((x + z) * s * 0.6) * 12;
  const h3 = Math.cos((x - z) * s * 0.35) * 8;
  const h = h1 + h2 + h3;
  return h * 0.7;
}

function createNoiseTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 150 + 50;
    const intensity = Math.random() * 40 + 80; 
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${intensity}, ${intensity}, ${intensity}, 0.2)`);
    gradient.addColorStop(1, `rgba(${intensity}, ${intensity}, ${intensity}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 30; 
    data[i] = THREE.MathUtils.clamp(data[i] + grain, 0, 255);
    data[i+1] = THREE.MathUtils.clamp(data[i+1] + grain, 0, 255);
    data[i+2] = THREE.MathUtils.clamp(data[i+2] + grain, 0, 255);
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4); 
  texture.anisotropy = 16; 
  return texture;
}

function useCityData() {
  return useMemo(() => {
    const turbines: TowerData[] = [];
    
    const step = 20; 
    for (let x = -TERRAIN_SIZE.width/2 + 20; x < TERRAIN_SIZE.width/2 - 20; x += step) {
        for (let z = -TERRAIN_SIZE.height/2 + 20; z < TERRAIN_SIZE.height/2 - 20; z += step) {
            const h = terrainHeightFn(x, z);
            
            if (h > 5 && Math.random() > 0.6) {
                const jx = x + (Math.random() - 0.5) * 10;
                const jz = z + (Math.random() - 0.5) * 10;
                const finalH = terrainHeightFn(jx, jz);
                const hFactor = Math.max(0.5, (finalH + 20) / 40); 
                const id = turbines.length;
                if (id >= TURBINE_COUNT) break;

                const height = 18 + hFactor * 12;

                // STORE PRIMITIVES
                turbines.push({
                    id: id,
                    position: [jx, finalH, jz],
                    baseY: finalH,
                    height: height,
                    value: Math.round(hFactor * 100), 
                    color: new THREE.Color().setHSL(0.55, 0.2, 0.8).getHexString()
                });
            }
        }
        if (turbines.length >= TURBINE_COUNT) break;
    }

    while (turbines.length < TURBINE_COUNT) {
         const px = (Math.random() - 0.5) * TERRAIN_SIZE.width * 0.8;
         const pz = (Math.random() - 0.5) * TERRAIN_SIZE.height * 0.8;
         const py = terrainHeightFn(px, pz);
         turbines.push({
             id: turbines.length,
             position: [px, py, pz],
             baseY: py,
             height: 20 + Math.random() * 10,
             value: Math.floor(Math.random() * 80 + 20),
             color: new THREE.Color().setHSL(0.6, 0.2, 0.8).getHexString()
         });
    }

    if (turbines.length === 0) {
        return { turbines: [], hub: null, solarPositions: [], solarRotations: [] };
    }

    const hub = turbines.reduce((prev, current) => (prev.height > current.height) ? prev : current);

    const solarPositions: Vector3Tuple[] = [];
    const solarRotations: Vector3Tuple[] = [];
    
    let attempts = 0;
    while(solarPositions.length < SOLAR_COUNT && attempts < 2000) {
        attempts++;
        const sx = (Math.random() - 0.5) * TERRAIN_SIZE.width * 0.9;
        const sz = (Math.random() - 0.5) * TERRAIN_SIZE.height * 0.9;
        const sy = terrainHeightFn(sx, sz);

        let tooClose = false;
        for (const t of turbines) {
            // Reconstruct vector temporarily for distance check
            const tPos = new THREE.Vector3(...t.position);
            const sPos = new THREE.Vector3(sx, sy, sz);
            if (sPos.distanceTo(tPos) < 12) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;

        const delta = 1.0;
        const hL = terrainHeightFn(sx - delta, sz);
        const hR = terrainHeightFn(sx + delta, sz);
        const hU = terrainHeightFn(sx, sz - delta);
        const hD = terrainHeightFn(sx, sz + delta);
        
        const dx = hL - hR; 
        const dz = hU - hD; 
        
        const slopeMag = Math.sqrt(dx*dx + dz*dz);
        
        if (slopeMag < 1.5) {
             solarPositions.push([sx, sy, sz]);
             // Store rotation as Euler-like tuple [x, y, z]
             solarRotations.push([
                Math.atan2(dz, 2*delta) * -1, 
                0, 
                Math.atan2(dx, 2*delta)
            ]);
        }
    }

    return { turbines, hub, solarPositions, solarRotations };
  }, []);
}

// --- Components ---

const CloudLayer = ({ weather }: { weather: WeatherState }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Use a mutable ref for the dummy object. DO NOT use useMemo for this.
  const dummy = useRef(new THREE.Object3D());
  
  const cloudsData = useRef<Array<{x: number, y: number, z: number, scale: number, speedMod: number}>>([]);
  const initialized = useRef(false);

  useLayoutEffect(() => {
    if (!initialized.current) {
      cloudsData.current = Array.from({ length: 60 }).map(() => ({
        x: (Math.random() - 0.5) * TERRAIN_SIZE.width * 1.5,
        y: 100 + Math.random() * 40,
        z: (Math.random() - 0.5) * TERRAIN_SIZE.height * 1.5,
        scale: 25 + Math.random() * 35,
        speedMod: 0.5 + Math.random() * 0.5
      }));
      initialized.current = true;
    }
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || !initialized.current) return;

    const d = dummy.current;

    const rad = (weather.windDirection - 90) * (Math.PI / 180);
    const vx = Math.cos(rad) * weather.windSpeed * 0.5 * delta;
    const vz = Math.sin(rad) * weather.windSpeed * 0.5 * delta;

    const count = Math.floor((weather.cloudCover / 100) * 60);
    meshRef.current.count = count;

    cloudsData.current.forEach((data, i) => {
       if (i >= count) return;
       
       data.x += vx * data.speedMod;
       data.z += vz * data.speedMod;

       const boundX = TERRAIN_SIZE.width;
       const boundZ = TERRAIN_SIZE.height;
       
       if (data.x > boundX) data.x -= boundX * 2;
       if (data.x < -boundX) data.x += boundX * 2;
       if (data.z > boundZ) data.z -= boundZ * 2;
       if (data.z < -boundZ) data.z += boundZ * 2;

       d.position.set(data.x, data.y, data.z);
       d.scale.set(data.scale, data.scale * 0.3, data.scale);
       d.rotation.y = state.clock.elapsedTime * 0.02 * data.speedMod;
       d.updateMatrix();
       meshRef.current!.setMatrixAt(i, d.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 60]} castShadow>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial 
            color="#e0f2fe" 
            transparent 
            opacity={0.85} 
            roughness={0.9} 
            metalness={0.1} 
        />
    </instancedMesh>
  );
};

interface DayNightCycleProps {
    timeOption: TimeOption;
    season: SeasonOption;
    weather: WeatherState;
}

const DayNightCycle: React.FC<DayNightCycleProps> = ({ timeOption, season, weather }) => {
  const { scene } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const starsRef = useRef<THREE.Group>(null);

  const colors = useMemo(() => {
    let dayBg, sunDay;
    switch (season) {
        case 'Winter':
            dayBg = new THREE.Color('#8da3b9'); 
            sunDay = new THREE.Color('#e0f2fe'); 
            break;
        case 'Summer':
            dayBg = new THREE.Color('#4fa1c6'); 
            sunDay = new THREE.Color('#fff7ed'); 
            break;
        case 'Autumn':
            dayBg = new THREE.Color('#9f7868'); 
            sunDay = new THREE.Color('#fff1d0'); 
            break;
        case 'Spring':
        default:
            dayBg = new THREE.Color('#5a6e85'); 
            sunDay = new THREE.Color('#fffce6'); 
            break;
    }

    return {
      nightBg: new THREE.Color('#020408'),
      dawnBg: new THREE.Color('#2a2438'),
      dayBg, 
      sunDay,
      sunDawn: new THREE.Color('#ffaa00'),
    };
  }, [season]);

  useLayoutEffect(() => {
    scene.background = colors.nightBg.clone();
    scene.fog = new THREE.Fog(colors.nightBg, 80, 450);
  }, [scene, colors]);

  useFrame(({ clock }) => {
    let time = 0;
    
    if (timeOption === 'Auto') {
        time = (clock.elapsedTime % CYCLE_DURATION) / CYCLE_DURATION; 
    } else {
        switch (timeOption) {
            case 'Dawn': time = 0.25; break;
            case 'Noon': time = 0.5; break;
            case 'Dusk': time = 0.75; break;
            case 'Midnight': time = 0.0; break;
            default: time = 0.5;
        }
    }
    
    const sunAngle = (time * Math.PI * 2) - (Math.PI / 2);
    
    const radius = 300;
    const sunX = Math.cos(sunAngle) * radius;
    const sunY = Math.sin(sunAngle) * radius;
    const sunZ = Math.cos(sunAngle * 0.5) * 80; 

    const sunHeight = Math.sin(sunAngle); 
    const dayIntensity = THREE.MathUtils.clamp(sunHeight, 0, 1);
    
    const cloudFactor = weather.cloudCover / 100;
    const sunDimming = 1 - (cloudFactor * 0.75); 
    
    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, sunY, sunZ);
      dirLightRef.current.intensity = dayIntensity * 1.8 * sunDimming;
      
      if (dayIntensity < 0.3) {
        dirLightRef.current.color.lerpColors(colors.sunDawn, colors.sunDay, dayIntensity / 0.3);
      } else {
        dirLightRef.current.color.copy(colors.sunDay);
      }
    }

    if (ambientRef.current) {
      const seasonBoost = season === 'Winter' ? 0.2 : 0;
      const cloudAmbientBoost = cloudFactor * 0.4;
      ambientRef.current.intensity = 0.05 + seasonBoost + (dayIntensity * 0.4) + cloudAmbientBoost;
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.1 + (dayIntensity * 0.5);
    }

    if (starsRef.current) {
      starsRef.current.visible = dayIntensity < 0.1 && cloudFactor < 0.7;
    }

    let targetColor = colors.nightBg;
    if (sunHeight > 0.1) targetColor = colors.dayBg;
    else if (sunHeight > -0.2) targetColor = colors.dawnBg; 

    if (cloudFactor > 0.2) {
       targetColor = targetColor.clone().lerp(new THREE.Color('#556677'), cloudFactor * 0.8);
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(targetColor, 0.05);
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.lerp(targetColor, 0.05);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.1} color={season === 'Winter' ? "#dbeafe" : "#b0b7c4"} />
      <directionalLight 
        ref={dirLightRef}
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005} 
      >
        <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 10, 800]} />
      </directionalLight>
      <hemisphereLight ref={hemiRef} args={['#202530', '#101216', 0.2]} />
      <group ref={starsRef}>
        <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
      </group>
    </>
  );
};

const PostEffects = ({ settings }: { settings: VFXSettings }) => {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom 
        luminanceThreshold={settings.bloomThreshold} 
        mipmapBlur 
        intensity={settings.bloomIntensity} 
        radius={settings.bloomRadius}
      />
      <DepthOfField 
        focusDistance={0.5} 
        focalLength={0.02} 
        bokehScale={0} 
        height={480} 
      />
      <Noise opacity={settings.noiseOpacity} />
      <Vignette eskil={false} offset={0.1} darkness={settings.vignetteDarkness} />
    </EffectComposer>
  );
};

const Terrain = ({ season, viewMode }: { season: SeasonOption, viewMode: ViewMode }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const noiseTexture = useMemo(() => createNoiseTexture(), []);

  const { geometry } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE.width, 
      TERRAIN_SIZE.height, 
      TERRAIN_SEGMENTS.x, 
      TERRAIN_SEGMENTS.y
    );
    
    const count = geo.attributes.position.count;
    const colorsArr = new Float32Array(count * 3);
    const pos = geo.attributes.position;
    const color = new THREE.Color();
    
    let baseHex, peakHex;
    switch (season) {
        case 'Winter': baseHex = '#cbd5e1'; peakHex = '#f8fafc'; break;
        case 'Autumn': baseHex = '#78350f'; peakHex = '#d97706'; break;
        case 'Summer': baseHex = '#14532d'; peakHex = '#84cc16'; break;
        default:       baseHex = '#0f172a'; peakHex = '#1e293b'; break;
    }
    const baseColor = new THREE.Color(baseHex); 
    const peakColor = new THREE.Color(peakHex);
    const windLow = new THREE.Color('#0000ff');
    const windHigh = new THREE.Color('#ff0000');
    const solarBad = new THREE.Color('#333333');
    const solarGood = new THREE.Color('#ffff00');

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = terrainHeightFn(x, y); 
      pos.setZ(i, h);
      
      if (viewMode === 'Realistic') {
          const t = THREE.MathUtils.clamp((h + 20) / 60, 0, 1);
          color.copy(baseColor).lerp(peakColor, t);
      } else if (viewMode === 'WindPotential') {
          const t = THREE.MathUtils.clamp((h + 10) / 40, 0, 1);
          color.copy(windLow).lerp(windHigh, t);
      } else if (viewMode === 'SolarIrradiance') {
          const t = THREE.MathUtils.clamp((h + 5) / 30, 0, 1);
          color.copy(solarBad).lerp(solarGood, t);
      }

      colorsArr[i * 3] = color.r;
      colorsArr[i * 3 + 1] = color.g;
      colorsArr[i * 3 + 2] = color.b;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));
    geo.computeVertexNormals();
    return { geometry: geo };
  }, [season, viewMode]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial 
        vertexColors 
        roughness={0.9} 
        metalness={0.1}
        map={viewMode === 'Realistic' ? noiseTexture : null}
        bumpMap={noiseTexture}
        bumpScale={viewMode === 'Realistic' ? 2.5 : 0.5}
        roughnessMap={noiseTexture}
      />
    </mesh>
  );
};

interface WindTurbineProps {
    data: TowerData;
    isSelected: boolean;
    onHover: (id: number | null, data?: TowerData) => void;
    onSelect: (data: TowerData) => void;
    timeOption: TimeOption;
    weather: WeatherState;
}

const WindTurbine: React.FC<WindTurbineProps> = ({ 
    data, 
    isSelected, 
    onHover, 
    onSelect,
    timeOption,
    weather
}) => {
    const bladesRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const bulbMatRef = useRef<THREE.MeshStandardMaterial>(null);
    const bladeMeshesRef = useRef<(THREE.Group | null)[]>([]); 
    const [hovered, setHover] = useState(false);
    useCursor(hovered);

    const bladeLen = data.height * 0.45; 
    const towerTopR = 0.35;
    const towerBottomR = 0.9;

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;
        const maxWindSpeed = 12;
        const clampedWindSpeed = Math.min(Math.max(0, weather.windSpeed), maxWindSpeed);
        
        const rotationFactor = (clampedWindSpeed / maxWindSpeed) * 3.5;
        const windNoise = Math.sin(time * 0.5 + data.id) * 0.5 + Math.sin(time * 2.1) * 0.2; 
        const currentRotation = Math.max(0, rotationFactor + (windNoise * 0.2));

        if (bladesRef.current) {
            bladesRef.current.rotation.z -= delta * currentRotation; 
        }

        bladeMeshesRef.current.forEach((blade, i) => {
            if (blade) {
                const flutter = Math.sin(time * 20 + i) * 0.01; 
                const flex = (clampedWindSpeed / maxWindSpeed) * 0.25; 
                blade.rotation.x = 0.15 + flex + flutter; 
            }
        });

        let cycleTime = 0;
        if (timeOption === 'Auto') {
            cycleTime = (state.clock.elapsedTime % CYCLE_DURATION) / CYCLE_DURATION;
        } else {
            if (timeOption === 'Dawn') cycleTime = 0.25;
            else if (timeOption === 'Noon') cycleTime = 0.5;
            else if (timeOption === 'Dusk') cycleTime = 0.75;
            else if (timeOption === 'Midnight') cycleTime = 0.0;
        }

        const sunAngle = (cycleTime * Math.PI * 2) - (Math.PI / 2);
        const sunHeight = Math.sin(sunAngle);
        const isNight = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.2, 0.1);
        
        const mat = bulbMatRef.current;
        if (mat) {
            if (isNight > 0.5) {
                const t = state.clock.elapsedTime + (data.id * 0.05);
                const period = 1.5;
                const blinkDuration = 0.2;
                const phase = t % period;
                const isBlink = phase < blinkDuration;
                const intensity = isBlink ? 8.0 : 0;
                const finalIntensity = intensity * isNight;

                if (lightRef.current) {
                    lightRef.current.intensity = finalIntensity;
                    lightRef.current.color.setHex(0xff0000);
                }

                mat.emissiveIntensity = finalIntensity;
                mat.emissive.setHex(0xff0000);
                mat.color.setHex(0x000000);
            } else {
                const efficiency = clampedWindSpeed / maxWindSpeed;
                const dayIntensity = efficiency * 5.0;
                const lowColor = new THREE.Color("#0088ff");
                const highColor = new THREE.Color("#00ff00");
                const dayColor = lowColor.lerp(highColor, efficiency);

                if (lightRef.current) {
                    lightRef.current.intensity = dayIntensity;
                    lightRef.current.color.copy(dayColor);
                }

                mat.emissiveIntensity = dayIntensity;
                mat.emissive.copy(dayColor);
                mat.color.setHex(0x000000);
            }
        }
    });

    const glowColor = isSelected ? "#ffaa00" : (hovered ? "#00ffff" : "#445566");
    const windRotation = -THREE.MathUtils.degToRad(weather.windDirection);

    return (
        <group 
            position={data.position} 
            onClick={(e) => { e.stopPropagation(); onSelect(data); }}
            onPointerOver={(e) => { e.stopPropagation(); onHover(data.id, data); setHover(true); }}
            onPointerOut={(e) => { onHover(null); setHover(false); }}
            userData={{ isTurbine: true, id: data.id }} 
        >
            <mesh position={[0, data.height / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[towerTopR, towerBottomR, data.height, 16]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[towerBottomR + 0.4, towerBottomR + 0.6, 1, 16]} />
              <meshStandardMaterial color="#64748b" roughness={0.8} />
            </mesh>
            <group position={[0, data.height, 0]} rotation={[0, windRotation, 0]}>
                <group position={[0, 0, 0.5]} rotation={[0, 0, 0]}>
                    <mesh position={[0, 0, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
                         <cylinderGeometry args={[0.75, 0.8, 2.5, 16]} />
                         <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.4} />
                    </mesh>
                    <mesh position={[0, 0, -1.25]} castShadow>
                         <sphereGeometry args={[0.79, 16, 16]} />
                         <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.4} />
                    </mesh>
                    <mesh position={[0, 0.7, -0.5]} castShadow>
                        <boxGeometry args={[0.8, 0.4, 1.2]} />
                        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
                    </mesh>
                </group>
                <mesh position={[0, 0, 0]}>
                    <ringGeometry args={[0.85, 0.95, 32]} />
                    <meshBasicMaterial color={glowColor} toneMapped={false} side={THREE.DoubleSide} />
                </mesh>
                <group position={[0, 0.9, -1]}>
                    <mesh position={[0, -0.1, 0]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                    <mesh position={[0, 0.1, 0]}>
                       <sphereGeometry args={[0.12, 8, 8]} />
                       <meshStandardMaterial 
                          ref={bulbMatRef}
                          color="#220000" 
                          emissive="#ff0000" 
                          emissiveIntensity={0} 
                          toneMapped={false}
                       />
                    </mesh>
                    <pointLight 
                      ref={lightRef}
                      color="#ff0000"
                      distance={40}
                      decay={2}
                      position={[0, 0.2, 0]}
                    />
                </group>
                <group position={[0, 0, 1.8]} ref={bladesRef}>
                    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} castShadow>
                        <cylinderGeometry args={[0.1, 0.8, 1.2, 16]} /> 
                        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.1} />
                    </mesh>
                    <mesh position={[0, 0, 0.8]}>
                        <sphereGeometry args={[0.1, 8, 8]} />
                        <meshStandardMaterial color="#cbd5e1" />
                    </mesh>
                    {[0, 1, 2].map((i) => (
                        <group key={i} rotation={[0, 0, i * (Math.PI * 2) / 3]}>
                            <group 
                                ref={(el) => { bladeMeshesRef.current[i] = el; }}
                                position={[0, bladeLen / 2 + 0.6, 0]} 
                                rotation={[0.15, 0, 0]} 
                            > 
                                <mesh castShadow scale={[1, 1, 0.15]} rotation={[0, 0.15, 0]}>
                                    <cylinderGeometry args={[0.08, 0.45, bladeLen, 12]} />
                                    <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
                                </mesh>
                            </group>
                        </group>
                    ))}
                </group>
            </group>
        </group>
    );
};

// --- Solar Fields ---
const SolarFields = ({ positions, rotations }: { positions: Vector3Tuple[], rotations: Vector3Tuple[] }) => {
    return (
        <Instances range={positions.length} receiveShadow castShadow>
            <boxGeometry args={[2.5, 0.1, 4]} />
            <meshStandardMaterial 
                color="#1e3a8a" 
                roughness={0.2} 
                metalness={0.9} 
                emissive="#0c4a6e"
                emissiveIntensity={0.2}
            />
            {positions.map((pos, i) => (
                <Instance 
                    key={i} 
                    position={pos} 
                    rotation={rotations[i]} 
                />
            ))}
        </Instances>
    );
};

// --- Interactive Flow Lines ---
// Helper to reconstruct fresh vectors from primitive props
const EnergyPacket = ({ curve, color, visible, speed = 0.8 }: { curve: THREE.CatmullRomCurve3, color: string, visible: boolean, speed?: number }) => {
    const meshesRef = useRef<(THREE.Mesh | null)[]>([]);
    const lightRef = useRef<THREE.PointLight>(null);
    const count = 12;

    useFrame((state) => {
        if (!visible || !curve || meshesRef.current.length === 0) return;
        const tRaw = state.clock.elapsedTime * speed;
        
        meshesRef.current.forEach((mesh, i) => {
            if(!mesh) return;
            const offset = i * 0.015;
            let t = (tRaw - offset) % 1;
            if (t < 0) t += 1;
            
            try {
              const point = curve.getPoint(t);
              if (point) {
                mesh.position.copy(point);
                const tailFactor = 1 - (i / count);
                mesh.scale.setScalar(tailFactor * 1.5);
                
                if (mesh.material instanceof THREE.MeshBasicMaterial) {
                    mesh.material.opacity = tailFactor;
                }
              }
            } catch (e) {}
        });

        if (lightRef.current && meshesRef.current[0]) {
            lightRef.current.position.copy(meshesRef.current[0].position);
        }
    });

    if (!visible) return null;

    return (
        <group>
            <pointLight ref={lightRef} distance={20} decay={2} color={color} intensity={2} />
            {Array.from({ length: count }).map((_, i) => (
                <mesh key={i} ref={el => meshesRef.current[i] = el}>
                    <sphereGeometry args={[0.6, 8, 8]} />
                    <meshBasicMaterial color={color} toneMapped={false} transparent />
                </mesh>
            ))}
        </group>
    );
};

const InteractiveFlowLine: React.FC<{ points: Vector3Tuple[], isSelected: boolean }> = ({ points, isSelected }) => {
  const [hovered, setHover] = useState(false);
  const ref = useRef<any>(null);

  // Construct FRESH Vector3 objects for the curve so we don't freeze anything
  const curve = useMemo(() => {
    const vectors = points.map(p => new THREE.Vector3(...p));
    return new THREE.CatmullRomCurve3(vectors);
  }, [points]);

  const color = isSelected 
    ? '#ffcc00' 
    : hovered 
      ? '#44ff66' 
      : '#00ffff';

  const width = isSelected ? 8 : (hovered ? 8 : 1.5);
  const baseOpacity = isSelected ? 0.7 : (hovered ? 0.8 : 0.2);

  useFrame((state) => {
    if (ref.current) {
      let pulse = 0;
      if (isSelected) {
         pulse = Math.sin(state.clock.elapsedTime * 6) * 0.3 + 0.2; 
      } else if (hovered) {
         pulse = Math.sin(state.clock.elapsedTime * 20) * 0.2 + 0.2; 
      } else {
         pulse = Math.sin(state.clock.elapsedTime * 2) * 0.05;
      }

      if (ref.current.material && !Array.isArray(ref.current.material)) {
        ref.current.material.opacity = THREE.MathUtils.clamp(baseOpacity + pulse, 0.1, 1.0);
        ref.current.material.color.set(color);
        ref.current.material.linewidth = width;
      }
    }
  });

  return (
    <group>
        <CatmullRomLine
            ref={ref}
            points={points as any} // drei accepts tuples
            color={color}
            lineWidth={width}
            segments={40} 
            opacity={baseOpacity}
            transparent
            onPointerOver={(e) => {
                e.stopPropagation();
                setHover(true);
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                setHover(false);
                document.body.style.cursor = 'auto';
            }}
        />
        <EnergyPacket 
            curve={curve} 
            color={color} 
            visible={hovered || isSelected} 
            speed={isSelected ? 1.8 : 1.2}
        />
    </group>
  );
};

const FlowLines = ({ hub, targets, selectedId }: { hub: TowerData, targets: TowerData[], selectedId: number | null }) => {
  const lines = useMemo(() => {
    const l: Array<{ id: string, targetId: number, points: Vector3Tuple[] }> = [];
    targets.forEach(target => {
      if (target.id === hub.id) return;
      if (Math.random() > 0.25) return; 

      const start = new THREE.Vector3(...hub.position);
      start.y += hub.height;

      const end = new THREE.Vector3(...target.position);
      end.y += target.height;
      
      const mid = start.clone().lerp(end, 0.5);
      mid.y += start.distanceTo(end) * 0.3;

      l.push({
        id: `link-${hub.id}-${target.id}`,
        targetId: target.id,
        points: [[start.x, start.y, start.z], [mid.x, mid.y, mid.z], [end.x, end.y, end.z]]
      });
    });
    return l;
  }, [hub, targets]);

  return (
    <group>
      {lines.map(line => (
        <InteractiveFlowLine
          key={line.id}
          points={line.points}
          isSelected={selectedId === line.targetId}
        />
      ))}
    </group>
  );
};

const Particles = () => {
  const count = 300;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      pos[i*3] = (Math.random() - 0.5) * TERRAIN_SIZE.width;
      pos[i*3+1] = Math.random() * 40 + 10;
      pos[i*3+2] = (Math.random() - 0.5) * TERRAIN_SIZE.height;
    }
    return pos;
  }, []);

  const ref = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.05;
    ref.current.rotation.y = t;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position" 
          count={count} 
          array={positions} 
          itemSize={3} 
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.5} 
        color="#a5f3fc" 
        transparent 
        opacity={0.4} 
        sizeAttenuation 
      />
    </points>
  );
};

interface CityVisualizerProps {
  onHover: (id: number | null, data?: TowerData) => void;
  onSelect: (data: TowerData) => void;
  selectedId: number | null;
  timeOption: TimeOption;
  season: SeasonOption;
  viewMode: ViewMode;
  weather: WeatherState;
  vfxSettings: VFXSettings;
  cameraSettings: CameraSettings;
}

export const CityVisualizer: React.FC<CityVisualizerProps> = ({ 
    onHover, 
    onSelect, 
    selectedId,
    timeOption,
    season,
    viewMode,
    weather,
    vfxSettings,
    cameraSettings
}) => {
  const { turbines, hub, solarPositions, solarRotations } = useCityData();
  const orbitControlsRef = useRef<any>(null);

  useEffect(() => {
    if (orbitControlsRef.current && orbitControlsRef.current.object) {
      const controls = orbitControlsRef.current;
      controls.autoRotate = cameraSettings.autoRotate;
      controls.autoRotateSpeed = cameraSettings.autoRotateSpeed;

      switch (cameraSettings.viewPreset) {
        case 'Top':
          controls.object.position.set(0, 350, 0);
          controls.target.set(0, 0, 0);
          break;
        case 'Side':
          controls.object.position.set(0, 40, 250);
          controls.target.set(0, 40, 0);
          break;
        case 'Grid':
          controls.object.position.set(150, 80, 150);
          controls.target.set(0, 0, 0);
          break;
        case 'Default':
        default:
          controls.object.position.set(-180, 120, 180);
          controls.target.set(0, 0, 0);
          break;
      }
      controls.update();
    }
  }, [cameraSettings.viewPreset, cameraSettings.autoRotate, cameraSettings.autoRotateSpeed]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[-180, 120, 180]} fov={50} />
      <OrbitControls 
        ref={orbitControlsRef}
        autoRotate={cameraSettings.autoRotate}
        autoRotateSpeed={cameraSettings.autoRotateSpeed}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={50}
        maxDistance={400}
      />
      
      <GestureController orbitControlsRef={orbitControlsRef} onSelect={(id) => {
         const t = turbines.find(t => t.id === id);
         if(t) onSelect(t);
      }} />

      <DayNightCycle timeOption={timeOption} season={season} weather={weather} />
      
      <Terrain season={season} viewMode={viewMode} />
      
      <CloudLayer weather={weather} />
      
      <group>
          {turbines.map(data => (
              <WindTurbine 
                  key={data.id} 
                  data={data} 
                  isSelected={selectedId === data.id}
                  onHover={onHover}
                  onSelect={onSelect}
                  timeOption={timeOption}
                  weather={weather}
              />
          ))}
      </group>

      <SolarFields positions={solarPositions} rotations={solarRotations} />

      {hub && <FlowLines hub={hub} targets={turbines} selectedId={selectedId} />}
      
      <Float speed={1} rotationIntensity={0.1} floatIntensity={1}>
        <Particles />
      </Float>

      <PostEffects settings={vfxSettings} />
    </>
  );
};
