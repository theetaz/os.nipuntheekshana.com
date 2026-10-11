import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { desktopAtom, overlayAtom, reducedMotionAtom, viewAtom, wallpaperAtom } from '../state/atoms';
import type { MapSurface } from '../apps/maps/surface';
const coveredAtom = selectAtom(desktopAtom, desktop => Object.values(desktop.windows).some(win => win.mode === 'maximized' && !win.minimized && !win.closing));
export function LiveWallpaper() {
  const wallpaper = useAtomValue(wallpaperAtom); const reduced = useAtomValue(reducedMotionAtom);
  const overlay = useAtomValue(overlayAtom); const view = useAtomValue(viewAtom);
  const covered = useAtomValue(coveredAtom); const active = overlay === 'none' && view === 'desktop' && !covered;
  const wake = useRef<(() => void) | null>(null);
  const stage = useRef<HTMLDivElement>(null); const surface = useRef<MapSurface | null>(null);
  const latest = useRef({ reduced, active }); latest.current = { reduced, active };
  useEffect(() => {
    if (wallpaper !== 'island-live' || !stage.current) return;
    const el = stage.current; const controller = new AbortController(); let mounting = false;
    const mount = async () => {
      if (controller.signal.aborted || mounting || surface.current || document.hidden || !latest.current.active) return;
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '')) return;
      mounting = true;
      try {
        const { mountLiveWallpaper } = await import('../apps/maps/live-wallpaper');
        if (controller.signal.aborted) return;
        const next = await mountLiveWallpaper(el, controller.signal, latest.current.reduced);
        if (controller.signal.aborted) { next?.destroy(); return; }
        surface.current = next;
        next?.setReducedMotion(latest.current.reduced); next?.setActive(latest.current.active);
        if (next) el.dataset.liveReady = 'true';
      } catch { /* The CSS island remains visible if data, chunks or WebGL are unavailable. */ }
      finally { mounting = false; }
    };
    wake.current = () => { void mount(); };
    const visibility = () => { if (!document.hidden) void mount(); };
    document.addEventListener('visibilitychange', visibility); void mount();
    return () => { wake.current = null; controller.abort(); document.removeEventListener('visibilitychange', visibility); surface.current?.destroy(); surface.current = null; delete el.dataset.liveReady; };
  }, [wallpaper, view]);
  useEffect(() => { surface.current?.setReducedMotion(reduced); surface.current?.setActive(active); if (active) wake.current?.(); }, [reduced, active]);
  return wallpaper === 'island-live' ? <div ref={stage} className="island-live-wallpaper" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-wallpaper)', pointerEvents: 'none' }} /> : null;
}
