
import React, { useState } from 'react';
import { TowerData, TimeOption, SeasonOption, ViewMode, GridStats, WeatherState, VFXSettings, CameraSettings, ViewPreset } from '../types';

interface OverlayProps {
  hoveredId: number | null;
  selectedData: TowerData | null;
  aiAnalysis: string | null;
  isAnalyzing: boolean;
  onClearSelection: () => void;
  timeOption: TimeOption;
  setTimeOption: (t: TimeOption) => void;
  season: SeasonOption;
  setSeason: (s: SeasonOption) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  gridStats: GridStats;
  weather: WeatherState;
  vfxSettings: VFXSettings;
  setVfxSettings: (s: VFXSettings) => void;
  cameraSettings: CameraSettings;
  setCameraSettings: (c: CameraSettings) => void;
}

export const Overlay: React.FC<OverlayProps> = ({ 
  hoveredId, 
  selectedData, 
  aiAnalysis, 
  isAnalyzing,
  onClearSelection,
  timeOption,
  setTimeOption,
  season,
  setSeason,
  viewMode,
  setViewMode,
  gridStats,
  weather,
  vfxSettings,
  setVfxSettings,
  cameraSettings,
  setCameraSettings
}) => {
  const [activeTab, setActiveTab] = useState<'VFX' | 'CAMERA'>('VFX');

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-6">
      
      {/* Header / Grid Dashboard */}
      <header className="flex justify-between items-start pointer-events-auto w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
            AERO GRID
          </h1>
          <p className="text-xs text-blue-200 uppercase tracking-widest mt-1 opacity-70">
            Professional Energy Planner v2.0
          </p>
          
          <div className="mt-2 flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${weather.isRealData ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
             <span className="text-[10px] uppercase text-gray-300 font-mono">
                {weather.locationName}: {weather.windSpeed}m/s {weather.windDirection}°
             </span>
          </div>
        </div>
        
        {/* Real-time Stats Ticker */}
        <div className="flex gap-4">
             <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 min-w-[120px]">
                <div className="text-[10px] uppercase text-gray-400">Total Output</div>
                <div className="text-xl font-mono text-cyan-400 font-bold">{gridStats.totalOutputMW} MW</div>
             </div>
             <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 min-w-[120px]">
                <div className="text-[10px] uppercase text-gray-400">Grid Load</div>
                <div className="text-xl font-mono text-yellow-400 font-bold">{gridStats.gridLoad}%</div>
             </div>
             <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 min-w-[120px]">
                <div className="text-[10px] uppercase text-gray-400">Storage</div>
                <div className="text-xl font-mono text-green-400 font-bold">{gridStats.batteryLevel}%</div>
             </div>
        </div>
      </header>

      {/* Middle: Hover Analysis Tooltip */}
      {hoveredId !== null && !selectedData && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-2">
          <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 text-white text-xs tracking-widest animate-pulse border-blue-400 shadow-[0_0_15px_rgba(0,100,255,0.3)]">
            TURBINE {hoveredId}
          </div>
          {/* AI Preview Bubble */}
          {(isAnalyzing || aiAnalysis) && (
              <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 rounded-lg max-w-xs text-center animate-in fade-in slide-in-from-bottom-2">
                 {isAnalyzing ? (
                     <div className="text-[10px] text-blue-300 animate-pulse">Scanning Grid Node...</div>
                 ) : (
                     <div className="text-[11px] text-gray-200 italic leading-tight">
                         "{aiAnalysis}"
                     </div>
                 )}
              </div>
          )}
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex items-end justify-between w-full pointer-events-auto">
        
        {/* LEFT: View Mode & Environment Controls */}
        <div className="flex gap-4">
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-col gap-4 shadow-2xl">
                {/* View Modes */}
                <div>
                    <div className="text-[9px] uppercase text-gray-500 font-bold tracking-wider mb-2">Analysis Layer</div>
                    <div className="flex gap-1 bg-black/50 p-1 rounded-lg border border-white/5">
                        {(['Realistic', 'WindPotential', 'SolarIrradiance'] as ViewMode[]).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-1.5 text-[10px] uppercase rounded transition-all ${
                                    viewMode === mode 
                                    ? 'bg-blue-600 text-white shadow-lg' 
                                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {mode.replace(/([A-Z])/g, ' $1').trim()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-white/10 w-full"></div>

                {/* Time & Season */}
                <div className="flex gap-4">
                     <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">Time</label>
                        <select 
                          value={timeOption}
                          onChange={(e) => setTimeOption(e.target.value as TimeOption)}
                          className="bg-black/50 border border-white/20 text-white text-xs rounded px-2 py-1 outline-none hover:border-blue-400 focus:border-blue-400 transition-colors w-28"
                        >
                          <option value="Auto">Auto Cycle</option>
                          <option value="Dawn">Dawn (06:00)</option>
                          <option value="Noon">Noon (12:00)</option>
                          <option value="Dusk">Dusk (18:00)</option>
                          <option value="Midnight">Midnight (00:00)</option>
                        </select>
                     </div>
                     
                     <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase text-gray-500 font-bold tracking-wider">Season</label>
                        <select 
                          value={season}
                          onChange={(e) => setSeason(e.target.value as SeasonOption)}
                          className="bg-black/50 border border-white/20 text-white text-xs rounded px-2 py-1 outline-none hover:border-blue-400 focus:border-blue-400 transition-colors w-28"
                        >
                          <option value="Spring">Spring</option>
                          <option value="Summer">Summer</option>
                          <option value="Autumn">Autumn</option>
                          <option value="Winter">Winter</option>
                        </select>
                     </div>
                </div>
            </div>

            {/* TABBED PANEL: VFX & Camera */}
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col shadow-2xl min-w-[220px]">
                
                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button 
                        onClick={() => setActiveTab('VFX')}
                        className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase transition-colors ${activeTab === 'VFX' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        VFX Lab
                    </button>
                    <button 
                        onClick={() => setActiveTab('CAMERA')}
                        className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase transition-colors ${activeTab === 'CAMERA' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Camera
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-4">
                    {activeTab === 'VFX' ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[9px] text-gray-400">
                                    <span>Bloom</span>
                                    <span>{vfxSettings.bloomIntensity.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="4" step="0.1"
                                    value={vfxSettings.bloomIntensity}
                                    onChange={(e) => setVfxSettings({...vfxSettings, bloomIntensity: parseFloat(e.target.value)})}
                                    className="h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            <div className="flex flex-col gap-1 mt-1">
                                <div className="flex justify-between text-[9px] text-gray-400">
                                    <span>Radius</span>
                                    <span>{vfxSettings.bloomRadius.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1.5" step="0.1"
                                    value={vfxSettings.bloomRadius}
                                    onChange={(e) => setVfxSettings({...vfxSettings, bloomRadius: parseFloat(e.target.value)})}
                                    className="h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            <div className="flex flex-col gap-1 mt-1">
                                <div className="flex justify-between text-[9px] text-gray-400">
                                    <span>Vignette</span>
                                    <span>{vfxSettings.vignetteDarkness.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1"
                                    value={vfxSettings.vignetteDarkness}
                                    onChange={(e) => setVfxSettings({...vfxSettings, vignetteDarkness: parseFloat(e.target.value)})}
                                    className="h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            <div className="flex flex-col gap-1 mt-1">
                                <div className="flex justify-between text-[9px] text-gray-400">
                                    <span>Noise</span>
                                    <span>{vfxSettings.noiseOpacity.toFixed(2)}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="0.3" step="0.01"
                                    value={vfxSettings.noiseOpacity}
                                    onChange={(e) => setVfxSettings({...vfxSettings, noiseOpacity: parseFloat(e.target.value)})}
                                    className="h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {/* Auto Rotate Toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] uppercase text-gray-400 font-bold">Auto Rotate</span>
                                <div 
                                    className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${cameraSettings.autoRotate ? 'bg-blue-500' : 'bg-gray-700'}`}
                                    onClick={() => setCameraSettings({...cameraSettings, autoRotate: !cameraSettings.autoRotate})}
                                >
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${cameraSettings.autoRotate ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>

                             {/* Rotation Speed */}
                             <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-[9px] text-gray-400">
                                    <span>Speed</span>
                                    <span>{cameraSettings.autoRotateSpeed.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="5" step="0.1"
                                    value={cameraSettings.autoRotateSpeed}
                                    onChange={(e) => setCameraSettings({...cameraSettings, autoRotateSpeed: parseFloat(e.target.value)})}
                                    className="h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    disabled={!cameraSettings.autoRotate}
                                />
                            </div>

                            <div className="h-px bg-white/10 w-full my-1"></div>

                            {/* Camera Presets */}
                            <div>
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-2 block">Quick Views</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['Default', 'Top', 'Side', 'Grid'] as ViewPreset[]).map((preset) => (
                                        <button
                                            key={preset}
                                            onClick={() => setCameraSettings({...cameraSettings, viewPreset: preset})}
                                            className={`px-2 py-1 text-[9px] uppercase rounded border transition-all ${
                                                cameraSettings.viewPreset === preset
                                                ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                                                : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Selected Data Panel */}
        {selectedData && (
          <div className="bg-slate-900/90 backdrop-blur-xl border-l-4 border-blue-500 rounded-r-lg p-6 max-w-md w-full shadow-2xl animate-in slide-in-from-right-10 fade-in duration-300 ml-4">
            <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-2">
              <div>
                <h2 className="text-xl font-bold text-blue-100">TURBINE {selectedData.id}</h2>
                <div className="text-xs text-blue-400 font-mono">
                   {/* Access indices of position tuple */}
                   COORD: {selectedData.position[0].toFixed(0)}, {selectedData.position[2].toFixed(0)}
                </div>
              </div>
              <button 
                onClick={onClearSelection}
                className="text-gray-400 hover:text-white transition-colors text-xl"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/40 rounded p-2">
                <div className="text-[10px] uppercase text-gray-500">Hub Height</div>
                <div className="text-lg font-mono text-white">{selectedData.height.toFixed(1)}m</div>
                <div className="h-1 bg-gray-700 mt-1 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min(selectedData.height * 3, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-black/40 rounded p-2">
                <div className="text-[10px] uppercase text-gray-500">Output Efficiency</div>
                <div className="text-lg font-mono text-cyan-400">{selectedData.value}%</div>
                <div className="h-1 bg-gray-700 mt-1 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500" 
                    style={{ width: `${Math.min(selectedData.value, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-3 border border-white/5 min-h-[80px]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase tracking-widest text-purple-300 font-bold">
                  Grid AI Analysis
                </span>
                {isAnalyzing && (
                  <span className="text-[10px] animate-pulse text-purple-400">COMPUTING...</span>
                )}
              </div>
              
              <p className="text-sm text-gray-300 leading-relaxed italic">
                {isAnalyzing ? (
                  <span className="opacity-50">Reading atmospheric sensors...</span>
                ) : aiAnalysis ? (
                  `"${aiAnalysis}"`
                ) : (
                  <span className="opacity-50">Select for deep analysis...</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
