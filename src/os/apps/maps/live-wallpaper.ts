import { fetchJson } from '../../lib/fetch-json';
import { supportsWebGL, type IslandData, type MapSurface } from './surface';
import './maps.css';
/** Cancellation is checked both before and after the independently lazy renderer. */
export async function mountLiveWallpaper(stage: HTMLElement, signal: AbortSignal, reducedMotion: boolean): Promise<MapSurface | null> {
  if (signal.aborted || !supportsWebGL()) return null;
  const island = await fetchJson<IslandData>('/data/island.json');
  if (signal.aborted || document.hidden) return null;
  const { createWebGLSurface } = await import('./webgl-surface');
  if (signal.aborted || document.hidden) return null;
  const surface = await createWebGLSurface({ stage, island, framing: 'wallpaper', reducedMotion, canMount: () => !signal.aborted && !document.hidden,
    onContextLost: () => { delete stage.dataset.liveReady; surface.destroy(); } });
  if (signal.aborted) { surface.destroy(); return null; }
  surface.setLabels(false); surface.setLayers({ labels: false, graticule: false, coastline: true });
  return surface;
}
