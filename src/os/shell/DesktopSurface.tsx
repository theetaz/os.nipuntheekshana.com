import { useEffect, useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from 'jotai';
import { desktopAtom } from '../state/atoms';
import { openContextMenu } from '../wm/commands';
import type { AppId, MenuItemSpec } from '../types/apps';
import { desktopSelectionAtom } from './DesktopIcons';

export const desktopMenuItems: readonly MenuItemSpec[] = [
  { kind: 'item', label: 'New Terminal window', command: 'open.terminal' },
  { kind: 'item', label: 'Change wallpaper…', command: 'desktop.wallpaper' },
  { kind: 'item', label: 'Clean up icons', command: 'desktop.cleanUp' },
  { kind: 'item', label: 'Show widgets', command: 'desktop.widgets', role: 'checkbox' },
  { kind: 'item', label: 'Show Mochi', command: 'desktop.mochi', role: 'checkbox' },
  { kind: 'separator' },
  { kind: 'item', label: 'About Serendib', command: 'os.about' },
];

export function DesktopSurface() {
  const store = useStore(); const marquee = useRef<HTMLDivElement>(null);
  const cancelSelection = useRef<(() => void) | null>(null);
  const focusDesktop = () => store.set(desktopAtom, { type: 'FOCUS_DESKTOP' });
  const context = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); focusDesktop(); store.set(desktopSelectionAtom, []);
    event.currentTarget.focus({ preventScroll: true });
    openContextMenu({ x: event.clientX || 24, y: event.clientY || 48, target: 'desktop', items: desktopMenuItems });
  };
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    cancelSelection.current?.(); focusDesktop(); event.currentTarget.focus({ preventScroll: true });
    const previous = store.get(desktopSelectionAtom); const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!additive) store.set(desktopSelectionAtom, []);
    const element = event.currentTarget; const pointerId = event.pointerId;
    const origin = { x: event.clientX, y: event.clientY }; let point = origin; let frame = 0; let moving = false;
    // Measure once, before any frame writes; widgets remain above this surface in the stack.
    const icons = [...document.querySelectorAll<HTMLElement>('[data-shell="desktop"] [data-desktop-icon]')]
      .map(node => ({ id: node.dataset.desktopIcon as AppId, rect: node.getBoundingClientRect() }));
    const paint = () => {
      frame = 0; const left = Math.min(origin.x, point.x); const top = Math.min(origin.y, point.y);
      const right = Math.max(origin.x, point.x); const bottom = Math.max(origin.y, point.y);
      const box = marquee.current;
      if (box) { box.hidden = false; box.style.transform = `translate3d(${left}px, ${top}px, 0)`; box.style.width = `${right - left}px`; box.style.height = `${bottom - top}px`; }
      const ids = icons.filter(({ rect }) => rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom).map(icon => icon.id);
      const next = additive ? [...new Set([...previous, ...ids])] : ids;
      const current = store.get(desktopSelectionAtom);
      if (next.length !== current.length || next.some(id => !current.includes(id))) store.set(desktopSelectionAtom, next);
    };
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      point = { x: next.clientX, y: next.clientY };
      if (!moving && Math.hypot(point.x - origin.x, point.y - origin.y) < 4) return;
      moving = true; if (!frame) frame = requestAnimationFrame(paint);
    };
    const finish = (cancelled: boolean) => {
      cancelAnimationFrame(frame); if (moving && !cancelled) paint();
      if (cancelled) store.set(desktopSelectionAtom, previous);
      if (marquee.current) marquee.current.hidden = true;
      element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel); element.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', cancel); document.removeEventListener('keydown', escape, true);
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      cancelSelection.current = null;
    };
    const up = (next: PointerEvent) => { if (next.pointerId === pointerId) { point = { x: next.clientX, y: next.clientY }; finish(false); } };
    const cancel = () => finish(true);
    const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel(); } };
    cancelSelection.current = cancel; element.setPointerCapture(pointerId);
    element.addEventListener('pointermove', move); element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel); element.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', cancel); document.addEventListener('keydown', escape, true);
  };
  useEffect(() => () => cancelSelection.current?.(), []);
  return <div className="desktop-surface os-chrome" role="region" aria-label="Desktop surface" tabIndex={-1}
    style={{ position: 'fixed', inset: 0, zIndex: 9, touchAction: 'none', userSelect: 'none' }}
    onPointerDown={start} onContextMenu={context}>
    <div ref={marquee} data-desktop-marquee hidden aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0,
      pointerEvents: 'none', border: '1px solid color-mix(in oklch, var(--os-accent) 60%, transparent)',
      borderRadius: 4, background: 'var(--os-accent-soft)' }} />
  </div>;
}
