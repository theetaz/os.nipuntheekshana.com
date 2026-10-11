import { useEffect, type RefObject } from 'react';
import { useStore } from 'jotai';
import { desktopAtom, geometryAtom, snapPreviewAtom } from '../state/atoms';
import { snapWindow } from '../wm/commands';
import { APP_META } from '../registry/meta';
import { clampMove, SNAP_DWELL_MS, zoneAt, zoneRect } from '../wm/geometry';
import type { Point, SnapZone, WindowId } from '../wm/types';
import { beginPointerInteraction, type FrameController } from './frame-controller';

export const NO_DRAG = 'button, a, input, select, textarea, [role="button"], [contenteditable="true"], [data-no-drag]';
let snapOrigin: Point | null = null;
export const getSnapPreviewOrigin = () => snapOrigin;

export function useWindowDrag(windowId: WindowId, frame: RefObject<FrameController | null>, enabled = true): void {
  const store = useStore();
  useEffect(() => {
    const controller = frame.current;
    const handle = controller?.el.querySelector<HTMLElement>('[data-window-titlebar]');
    if (!enabled || !controller || !handle) return;
    let cancelGesture: (() => void) | null = null;
    let gestureState: { seq: number; w: number; h: number } | null = null;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary || (event.target as Element).closest(NO_DRAG)
        || controller.el.hasAttribute('data-keyboard-move')) return;
      const state = store.get(desktopAtom); const win = state.windows[windowId];
      if (!win || win.closing || win.minimized) return;
      cancelGesture?.(); controller.stop();
      // Finish an interrupted entrance/zoom before measuring the gesture's logical bounds.
      controller.set(win.rect);
      gestureState = { seq: win.transition.seq, ...state.viewport };
      const original = { ...controller.rect }; const start = { x: event.clientX, y: event.clientY };
      let point = start; let started = false; let restored = false; let released = false;
      let raf = 0; let dwell: ReturnType<typeof setTimeout> | undefined;
      let candidate: SnapZone | null = null; let activeZone: SnapZone | null = null;
      let endInteraction: (() => void) | undefined;
      const viewport = state.viewport; const spec = APP_META[win.appId].window;
      const ratio = Math.max(0, Math.min(1, (start.x - win.rect.x) / win.rect.w));
      handle.setPointerCapture(event.pointerId);
      const preview = (zone: SnapZone | null) => {
        if (zone === activeZone) return;
        activeZone = zone;
        if (!zone) { store.set(snapPreviewAtom, null); return; }
        snapOrigin = { ...point };
        const rect = zoneRect(zone, viewport);
        store.set(snapPreviewAtom, { zone, rect, valid: spec.resizable && (zone !== 'max' || spec.zoomable)
          && rect.w >= spec.minWidth && rect.h >= spec.minHeight });
      };
      const updateZone = () => {
        const zone = zoneAt(point, viewport);
        if (candidate === zone) return;
        candidate = zone; clearTimeout(dwell); preview(null);
        if (zone) dwell = setTimeout(() => { if (candidate === zone && started) preview(zone); }, SNAP_DWELL_MS);
      };
      const cleanup = () => {
        cancelAnimationFrame(raf); clearTimeout(dwell); endInteraction?.(); preview(null);
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', abort); handle.removeEventListener('lostpointercapture', lostCapture);
        cancelGesture = null; gestureState = null;
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      const finish = () => {
        const rect = { ...controller.rect }; const snap = store.get(snapPreviewAtom);
        cleanup();
        if (!started) return;
        if (snap?.valid) snapWindow(windowId, snap.zone);
        else {
          // Restore state only on release; live unsnapping is local to the frame.
          if (restored) store.set(desktopAtom, { type: 'UNSNAP', id: windowId, pointer: start });
          store.set(desktopAtom, { type: 'MOVE', id: windowId, x: rect.x, y: rect.y });
          const remembered = store.get(desktopAtom).windows[windowId]?.restoreRect;
          if (remembered) store.set(geometryAtom, prev => ({ ...prev, [win.appId]: remembered }));
        }
      };
      const paint = () => {
        raf = 0;
        const dx = point.x - start.x; const dy = point.y - start.y;
        if (!started && Math.hypot(dx, dy) >= 3) {
          started = true; endInteraction = beginPointerInteraction(controller.el, 'dragging');
        }
        if (started) {
          if (win.mode !== 'normal') {
            const next = clampMove({ ...win.restoreRect, x: point.x - ratio * win.restoreRect.w, y: point.y - 20 }, viewport);
            if (!restored) { restored = true; void controller.animate('unsnap', next); }
            else controller.set(next);
          } else controller.set(clampMove({ ...original, x: original.x + dx, y: original.y + dy }, viewport));
          updateZone();
        }
        if (released) finish();
      };
      const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
      const move = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        point = { x: e.clientX, y: e.clientY }; schedule();
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        point = { x: e.clientX, y: e.clientY }; released = true; schedule();
      };
      const abort = () => { cleanup(); controller.set(original); };
      const lostCapture = () => { if (!released) abort(); };
      cancelGesture = abort;
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', abort); handle.addEventListener('lostpointercapture', lostCapture);
    };
    const unsubscribe = store.sub(desktopAtom, () => {
      if (!gestureState) return;
      const state = store.get(desktopAtom); const win = state.windows[windowId];
      if (!win || win.closing || win.minimized || state.focusedId !== windowId || win.transition.seq !== gestureState.seq
        || state.viewport.w !== gestureState.w || state.viewport.h !== gestureState.h) cancelGesture?.();
    });
    handle.addEventListener('pointerdown', down);
    return () => { unsubscribe(); cancelGesture?.(); handle.removeEventListener('pointerdown', down); };
  }, [enabled, frame, store, windowId]);
}
