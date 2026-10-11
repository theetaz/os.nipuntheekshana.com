import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { animate } from 'motion/mini';
import { rafThrottle } from '../lib/raf';
import { reducedMotion } from '../lib/motion-preferences';
export { reducedMotion } from '../lib/motion-preferences';
export type Anchor = RefObject<HTMLElement | null>;
let sharedHost: HTMLElement | null = null;
let hostUsers = 0;
export function useOverlayHost() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!sharedHost) {
      sharedHost = document.createElement('div');
      sharedHost.setAttribute('role', 'region');
      sharedHost.setAttribute('aria-label', 'Overlays');
      sharedHost.dataset.osUiOverlays = '';
      document.body.append(sharedHost);
    }
    hostUsers++; setHost(sharedHost);
    return () => { if (--hostUsers === 0) { sharedHost?.remove(); sharedHost = null; } };
  }, []);
  return host;
}
export type Placement = 'top' | 'bottom' | 'right';
/** Shared small WAAPI entrance/exit; no full Motion component bundle. */
export function useOverlayPresence(open: boolean, panel: RefObject<HTMLElement | null>, duration = 0.12, host?: HTMLElement | null) {
  const [present, setPresent] = useState(open);
  // Mount on the opening render so keyboard focus never trails the trigger.
  const visible = open || present;
  useEffect(() => { if (open) setPresent(true); }, [open]);
  useEffect(() => {
    if (!visible || !panel.current) return;
    const node = panel.current;
    const reduce = reducedMotion();
    if (reduce) node.style.transform = 'none';
    const controls = animate(node, {
      opacity: open ? [0, 1] : [1, 0],
      ...(reduce ? {} : { transform: open ? ['translateY(-4px)', 'translateY(0px)'] : ['translateY(0px)', 'translateY(-4px)'] }),
    }, { duration: open ? Math.min(duration, reduce ? 0.12 : duration) : 0.08, ease: open ? [0.22, 1, 0.36, 1] : [0.4, 0, 1, 1] });
    let active = true;
    if (!open) void controls.finished.then(() => { if (active) setPresent(false); });
    const stopSpatialMotion = () => {
      if (!reducedMotion()) return;
      controls.cancel(); node.style.transform = 'none'; node.style.opacity = open ? '1' : '0';
      if (!open) setPresent(false);
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', stopSpatialMotion);
    const observer = new MutationObserver(stopSpatialMotion);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { active = false; controls.stop(); observer.disconnect(); media.removeEventListener('change', stopSpatialMotion); };
  }, [open, visible, panel, duration, host]);
  return visible;
}
export function useFloatingPanel(panel: RefObject<HTMLElement | null>, open: boolean,
  anchor?: Anchor, placement: Placement = 'bottom', point?: { x: number; y: number }, gap = 4, host?: HTMLElement | null) {
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const update = () => {
      const node = panel.current; if (!node) return;
      const rect = anchor?.current?.getBoundingClientRect();
      const width = node.offsetWidth; const height = node.offsetHeight;
      const bounds = { width: window.innerWidth, height: window.innerHeight };
      let left = point?.x ?? rect?.left ?? 8;
      let top = point?.y ?? ((rect?.bottom ?? 4) + gap);
      if (rect && placement === 'top') {
        left = rect.left + (rect.width - width) / 2;
        top = rect.top - height - gap;
        if (top < 8) top = rect.bottom + gap;
      } else if (rect && placement === 'right') {
        left = rect.right + gap; top = rect.top - 5;
        if (left + width > bounds.width - 8) left = rect.left - width - gap;
      } else if (rect && !point && top + height > bounds.height - 8) top = rect.top - height - gap;
      setPosition({ left: Math.max(8, Math.min(left, bounds.width - width - 8)), top: Math.max(8, Math.min(top, bounds.height - height - 8)) });
    };
    update();
    const scheduled = rafThrottle(update);
    window.addEventListener('resize', scheduled);
    window.addEventListener('scroll', scheduled, true);
    const observer = new ResizeObserver(scheduled); observer.observe(panel.current);
    if (anchor?.current) observer.observe(anchor.current);
    return () => { scheduled.cancel(); observer.disconnect(); window.removeEventListener('resize', scheduled); window.removeEventListener('scroll', scheduled, true); };
  }, [open, panel, anchor, placement, point?.x, point?.y, gap, host]);
  return position;
}
export const panelMaterial = 'fixed rounded-menu border border-glass-border bg-menu-bg text-ink shadow-menu backdrop-filter-[var(--menu-filter)]';
