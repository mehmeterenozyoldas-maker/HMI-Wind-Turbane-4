
import React, { useState, Suspense, useCallback, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { CityVisualizer } from './components/CityVisualizer';
import { Overlay } from './components/Overlay';
import { TowerData, TimeOption, SeasonOption, ViewMode, GridStats, WeatherState, VFXSettings, CameraSettings } from './types';
import { generateCityAnalysis } from './services/geminiService';
import { fetchWeatherData } from './services/weatherService';

const App: React.FC = () => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedTower, setSelectedTower] = useState<TowerData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Environment & View State
  const [timeOption, setTimeOption] = useState<TimeOption>('Auto');
  const [season, setSeason] = useState<SeasonOption>('Spring');
  const [viewMode, setViewMode] = useState<ViewMode>('Realistic');

  // VFX Settings State
  const [vfxSettings, setVfxSettings] = useState<VFXSettings>({
    bloomThreshold: 0.6,
    bloomIntensity: 1.5,
    bloomRadius: 0.4,
    noiseOpacity: 0.05,
    vignetteDarkness: 0.5
  });

  // Camera Settings State
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
    autoRotate: true,
    autoRotateSpeed: 0.5,
    viewPreset: 'Default'
  });

  // Weather State
  const [weather, setWeather] = useState<WeatherState>({
    windSpeed: 10,
    windDirection: 0,
    cloudCover: 20,
    locationName: 'Simulation',
    isRealData: false
  });

  // Fetch Weather on Mount
  useEffect(() => {
    const loadWeather = async () => {
        // You can change "San Francisco" to any city you want to default to
        const data = await fetchWeatherData("San Francisco");
        setWeather({
            windSpeed: data.windSpeed,
            windDirection: data.windDeg,
            cloudCover: data.clouds,
            locationName: data.city,
            isRealData: data.isReal
        });
    };
    loadWeather();
    
    // Refresh every 10 minutes
    const interval = setInterval(loadWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  // Hover Debounce Logic
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle interaction with the 3D scene
  const handleHover = useCallback((id: number | null, data?: TowerData) => {
    setHoveredId(id);
    document.body.style.cursor = id !== null ? 'pointer' : 'auto';

    // Clear existing timeout
    if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
    }

    // If hovering over a valid turbine and not currently selected
    if (id !== null && data) {
        // Debounce API call for hover analysis
        hoverTimeoutRef.current = setTimeout(async () => {
            if (!selectedTower) {
                setIsAnalyzing(true);
                const analysis = await generateCityAnalysis(data.id, data.height, data.value);
                setAiAnalysis(analysis);
                setIsAnalyzing(false);
            }
        }, 800); // 800ms dwell time
    } else {
        // Mouse out logic
        if (!selectedTower) {
            setAiAnalysis(null);
            setIsAnalyzing(false);
        }
    }
  }, [selectedTower]);

  const handleSelect = useCallback(async (data: TowerData) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (selectedTower?.id === data.id) return;

    setSelectedTower(data);
    setAiAnalysis(null);
    setIsAnalyzing(true);

    const analysis = await generateCityAnalysis(data.id, data.height, data.value);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  }, [selectedTower]);

  const handleClearSelection = () => {
    setSelectedTower(null);
    setAiAnalysis(null);
  };

  // Calculate Grid Stats based on Weather
  // Formula: Power ~ v^3 (Wind speed cubed)
  const baseCapacity = 1000;
  // Normalize wind: 12m/s is rated power. 
  const windFactor = Math.min(Math.pow(weather.windSpeed, 3) / Math.pow(12, 3), 1.2); 
  const solarFactor = (100 - weather.cloudCover) / 100;
  
  const currentMW = (baseCapacity * 0.7 * windFactor) + (baseCapacity * 0.3 * solarFactor);
  
  const gridStats: GridStats = {
     totalOutputMW: Math.round(currentMW),
     gridLoad: 78,
     batteryLevel: Math.min(100, Math.round(40 + (windFactor * 40)))
  };

  return (
    <div className="relative w-full h-screen bg-[#050608]">
      
      {/* 3D Scene */}
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: false, 
          toneMapping: 1, // ACESFilmic
          toneMappingExposure: 1.2,
          powerPreference: 'high-performance',
          depth: true,
          stencil: false,
          alpha: false // Disabled alpha to ensure post-processing works correctly against background
        }}
        camera={{ position: [-180, 120, 180], fov: 50, near: 1, far: 2000 }}
      >
        <Suspense fallback={null}>
          <CityVisualizer 
            onHover={handleHover} 
            onSelect={handleSelect}
            selectedId={selectedTower?.id ?? null}
            timeOption={timeOption}
            season={season}
            viewMode={viewMode}
            weather={weather}
            vfxSettings={vfxSettings}
            cameraSettings={cameraSettings}
          />
        </Suspense>
      </Canvas>

      <Loader 
        containerStyles={{ background: '#050608' }}
        dataStyles={{ fontFamily: 'Space Grotesk', fontSize: '14px', letterSpacing: '0.2em' }}
        barStyles={{ background: '#ffffff', height: '2px' }}
      />

      {/* UI Overlay */}
      <Overlay 
        hoveredId={hoveredId}
        selectedData={selectedTower}
        aiAnalysis={aiAnalysis}
        isAnalyzing={isAnalyzing}
        onClearSelection={handleClearSelection}
        timeOption={timeOption}
        setTimeOption={setTimeOption}
        season={season}
        setSeason={setSeason}
        viewMode={viewMode}
        setViewMode={setViewMode}
        gridStats={gridStats}
        weather={weather}
        vfxSettings={vfxSettings}
        setVfxSettings={setVfxSettings}
        cameraSettings={cameraSettings}
        setCameraSettings={setCameraSettings}
      />
    </div>
  );
};

export default App;
