import { useEffect, useRef, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { deferredPointer } from '../lib/deferred-pointer';
import { canPrefetch } from '../registry/loader';
import { useStore } from 'jotai';
import { desktopAtom } from '../state/atoms';
import { openContextMenu } from '../wm/commands';
import type { MenuItemSpec } from '../types/apps';
import { desktopSelectionAtom } from './desktop-selection';

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
    const element = event.currentTarget;
    const native = event.nativeEvent;
    cancelSelection.current = deferredPointer(element, native, () => import('./desktop-marquee').then(module =>
      () => module.startMarquee(store, element, marquee.current, native, previous, additive, () => { cancelSelection.current = null; })), undefined, () => store.set(desktopSelectionAtom, previous));
  };
  useEffect(() => () => cancelSelection.current?.(), []);
  return <div className="desktop-surface os-chrome" role="region" aria-label="Desktop surface" tabIndex={-1}
    style={{ position: 'fixed', inset: 0, zIndex: 9, touchAction: 'none', userSelect: 'none' }}
    onPointerEnter={() => { if (canPrefetch()) void import('./desktop-marquee').catch(() => {}); }} onPointerDown={start} onContextMenu={context}>
    <div ref={marquee} data-desktop-marquee hidden aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0,
      pointerEvents: 'none', border: '1px solid color-mix(in oklch, var(--os-accent) 60%, transparent)',
      borderRadius: 4, background: 'var(--os-accent-soft)' }} />
  </div>;
}
