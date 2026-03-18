
import * as THREE from 'three';

// Use primitives for state to avoid React freezing mutable Three.js objects
export type Vector3Tuple = [number, number, number];

export interface TowerData {
  id: number;
  position: Vector3Tuple;
  height: number;
  baseY: number;
  value: number; // Represents traffic or activity
  color: string;
}

export interface FlowLine {
  id: string;
  points: Vector3Tuple[];
  speed: number;
  width: number;
}

export interface CityState {
  selectedTowerId: number | null;
  hoveredTowerId: number | null;
  aiAnalysis: string | null;
  isAnalyzing: boolean;
}

export enum GameState {
  INTRO = 'INTRO',
  EXPLORE = 'EXPLORE',
  FOCUSED = 'FOCUSED'
}

export type TimeOption = 'Auto' | 'Dawn' | 'Noon' | 'Dusk' | 'Midnight';
export type SeasonOption = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export type ViewMode = 'Realistic' | 'WindPotential' | 'SolarIrradiance';

export interface GridStats {
  totalOutputMW: number;
  gridLoad: number;
  batteryLevel: number;
}

export interface WeatherState {
  windSpeed: number; // m/s
  windDirection: number; // degrees
  cloudCover: number; // %
  locationName: string;
  isRealData: boolean;
}

export interface VFXSettings {
  bloomThreshold: number;
  bloomIntensity: number;
  bloomRadius: number;
  noiseOpacity: number;
  vignetteDarkness: number;
}

export type ViewPreset = 'Default' | 'Top' | 'Side' | 'Grid';

export interface CameraSettings {
  autoRotate: boolean;
  autoRotateSpeed: number;
  viewPreset: ViewPreset;
}
