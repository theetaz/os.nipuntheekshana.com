import type { MapSurface, SurfaceOptions } from './surface';
/** The renderer and three.js are reachable only after visible maps/wallpaper intent. */
export async function createWebGLSurface(options: SurfaceOptions): Promise<MapSurface> {
  const { mountIsland } = await import('../../scenes/island');
  if (options.canMount && !options.canMount()) throw new DOMException('Map is no longer visible.', 'AbortError');
  return mountIsland(options);
}
