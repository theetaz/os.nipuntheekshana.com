import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useStore } from 'jotai';
import { AnimatePresence, m, useAnimationControls, useIsPresent } from 'motion/react';
import { alertsAtom, desktopAtom, quickLookAtom, reducedMotionAtom, resolvedThemeAtom, spotlightOpenAtom } from '../state/atoms';
import { closeQuickLook } from '../wm/commands';
import type { ClientProject, ClientScreen } from '../types/content';
import type { Rect, WindowState } from '../wm/types';
import { useAppData } from '../lib/fetch-json';
import { trapTab } from '../lib/focus';
import { springs } from '../lib/springs';
import { DeviceFrame } from '../ui/DeviceFrame';
import { Img } from '../ui/Img';
import { useOverlayHost } from '../ui/Overlay';
import { useModalFocus } from './Alerts';
import './p2-8-overlays.css';

function sourceTransform(from: Rect | null, target: DOMRect | null) {
  if (!from || !target || from.w <= 0 || from.h <= 0 || from.x + from.w <= 0 || from.y + from.h <= 0
    || from.x >= innerWidth || from.y >= innerHeight) return null;
  return { x: from.x - target.x, y: from.y - target.y, scaleX: from.w / target.width, scaleY: from.h / target.height };
}

function QuickLookPanel({ win }: { win: WindowState }) {
  const store = useStore(); const host = useOverlayHost(); const panel = useRef<HTMLDivElement>(null);
  const target = useRef<DOMRect | null>(null); const opened = useRef(false); const controls = useAnimationControls();
  const from = useRef(useAtomValue(quickLookAtom)?.from ?? null);
  const reduce = useAtomValue(reducedMotionAtom); const theme = useAtomValue(resolvedThemeAtom);
  const alerts = useAtomValue(alertsAtom); const spotlight = useAtomValue(spotlightOpenAtom); const present = useIsPresent();
  const { data, error, retry } = useAppData<{ projects: ClientProject[] }>('quicklook:projects', '/data/projects.json');
  const project = data?.projects.find(project => project.slug === win.route);
  const screens: ClientScreen[] = project ? project.screens.length ? project.screens : [{ ...project.cover, kind: 'bare', label: project.title }] : [];
  const index = screens.length ? Number(BigInt(win.query.shot!) % BigInt(screens.length)) : 0;
  const screen = screens[index]; const [brokenImage, setBrokenImage] = useState<string | null>(null);
  useModalFocus(panel, present && !alerts.length && !spotlight, host);
  useLayoutEffect(() => {
    if (!host || !panel.current || opened.current || !screen) return;
    opened.current = true; target.current = panel.current.getBoundingClientRect();
    const origin = reduce ? null : sourceTransform(from.current, target.current);
    controls.set({ opacity: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, ...origin });
    void controls.start({ opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 }, reduce ? { duration: 0.1 } : springs.popover);
  }, [host, screen, reduce, controls]);
  useLayoutEffect(() => {
    if (reduce && opened.current) { controls.stop(); controls.set({ opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 }); }
  }, [reduce, controls]);
  // Normalize a valid but out-of-range deep link once the screen count is known.
  useLayoutEffect(() => {
    if (screens.length && String(index) !== win.query.shot) store.set(desktopAtom,
      { type: 'SET_QUERY', id: win.id, query: { ...win.query, shot: String(index) } });
  }, [index, screens.length, store, win.id, win.query]);
  const go = (next: number) => {
    if (screens.length) store.set(desktopAtom, { type: 'SET_QUERY', id: win.id,
      query: { ...win.query, shot: String((next + screens.length) % screens.length) } });
  };
  const reverse = !reduce ? sourceTransform(from.current, target.current) : null;
  const viewport = store.get(desktopAtom).viewport;
  const bezel = screen?.kind === 'phone' ? 16 : 0;
  const chrome = screen?.kind === 'browser' ? 28 : bezel;
  const width = screen ? Math.min(screen.width + bezel, viewport.w * 0.86 - 96,
    (viewport.h * 0.82 - 180 - chrome) * screen.width / screen.height + bezel) : 400;
  const content = <m.div className="os-modal-layer os-quicklook-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
    onPointerDown={event => { if (event.target === event.currentTarget) closeQuickLook(); }}>
    <m.div ref={panel} className="os-quicklook" role="dialog" aria-modal="true" aria-label={`Quick Look${project ? ` — ${project.title}` : ''}`}
      aria-describedby={screen ? 'quicklook-caption' : undefined} tabIndex={-1} inert={!present || !!alerts.length || spotlight}
      initial={false} animate={screen ? controls : { opacity: 1 }} exit={{ opacity: 0, ...(reverse ?? {}) }}
      transition={reduce ? { duration: 0.1 } : springs.popover} style={{ transformOrigin: '0 0' }}
      onKeyDown={event => {
        event.stopPropagation(); trapTab(event, event.currentTarget);
        if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Escape' || event.key === ' ') { event.preventDefault(); closeQuickLook(); }
        else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); go(event.key === 'Home' ? 0 : event.key === 'End' ? screens.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1));
        }
      }}>
      <button type="button" className="os-quicklook-close os-overlay-control" data-autofocus aria-label="Close Quick Look" onClick={closeQuickLook}>×</button>
      {error ? <div className="os-quicklook-message"><p>Preview couldn’t load.</p><button type="button" onClick={retry}>Try again</button></div>
        : !data ? <p className="os-quicklook-message" role="status">Loading preview…</p>
          : !project ? <p className="os-quicklook-message">This project’s preview isn’t available.</p>
            : screen && <>
              <div className="os-quicklook-stage" style={{ background: project.brand?.backdrop[theme] ?? 'var(--os-sunken)' }}>
                <DeviceFrame kind={screen.kind} bar={screen.bar ?? project.brand?.address ?? project.brand?.domain} className="os-quicklook-device"
                  data-kind={screen.kind} style={{ width: Math.max(80, width) }}>
                  {brokenImage === screen.src ? <p className="os-quicklook-message">This image couldn’t load. <button type="button" onClick={() => setBrokenImage(null)}>Try again</button></p>
                    : <m.div key={screen.src} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }}>
                      <Img image={screen} loading="eager" sizes="86vw" onError={() => setBrokenImage(screen.src)} />
                    </m.div>}
                </DeviceFrame>
              </div>
              <div id="quicklook-caption" className="os-quicklook-caption">
                <div><h2 className="text-ui-strong">{screen.label}</h2><p className="text-ui text-ink-2">{screen.alt}</p></div>
                <p className="text-caption tabular-nums" role="status" aria-live="polite">{index + 1} of {screens.length}</p>
              </div>
              <div className="os-quicklook-navigation">
                <button type="button" className="os-overlay-control" aria-label="Previous image" disabled={screens.length < 2} onClick={() => go(index - 1)}>←</button>
                <a href={screen.src} target="_blank" rel="noopener noreferrer" className="text-ui">Open full size ↗</a>
                <button type="button" className="os-overlay-control" aria-label="Next image" disabled={screens.length < 2} onClick={() => go(index + 1)}>→</button>
              </div>
            </>}
    </m.div>
  </m.div>;
  return host ? createPortal(content, host) : null;
}

export function QuickLook() {
  const desktop = useAtomValue(desktopAtom);
  const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  const open = win?.appId === 'projects' && !win.closing && !win.minimized && /^\d+$/.test(win.query.shot ?? '');
  return <AnimatePresence>{open && <QuickLookPanel key={`${win.id}:${win.route}`} win={win} />}</AnimatePresence>;
}
