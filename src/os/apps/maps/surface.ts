export interface GeoPoint { lon: number; lat: number }
export interface ScreenPoint { x: number; y: number }
export interface IslandData { source: string; bbox: number[]; rings: number[][][] }
export interface MapLayers { labels: boolean; graticule: boolean; coastline: boolean }
export const DEFAULT_LAYERS: MapLayers = { labels: true, graticule: true, coastline: true };
export interface MapSurface {
  readonly kind: 'webgl' | 'svg';
  readonly count: number;
  pick(clientX: number, clientY: number): GeoPoint | null;
  project(lon: number, lat: number): ScreenPoint;
  pulseAt(lon: number, lat: number): void;
  setLabels(visible: boolean): void;
  onFrame(callback: () => void): () => void;
  setActive(active: boolean): void;
  setFocus(focused: boolean): void;
  setLayers(layers: MapLayers): void;
  setReducedMotion(reduced: boolean): void;
  orbit(yaw: number, pitch: number): void;
  zoom(factor: number): void;
  recentre(): void;
  flyTo(lon: number, lat: number): void;
  destroy(): void;
}
export interface SurfaceOptions {
  stage: HTMLElement; island: IslandData; labels?: HTMLElement;
  framing?: 'centered' | 'wallpaper'; reducedMotion?: boolean;
  canMount?: () => boolean; onReady?: () => void; onContextLost?: () => void;
}
export function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '');
}
/** Probe without creating a long-lived context or downloading three.js. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}
