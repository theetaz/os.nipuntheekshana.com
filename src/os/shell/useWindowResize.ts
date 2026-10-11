import { useEffect, type RefObject } from 'react';
import { useStore } from 'jotai';
import { desktopAtom, geometryAtom } from '../state/atoms';
import { APP_META } from '../registry/meta';
import { clampMove, MENU_BAR, workArea } from '../wm/geometry';
import type { WindowSpec } from '../types/apps';
import type { Point, Rect, Viewport, WindowId } from '../wm/types';
import { beginPointerInteraction, type FrameController } from './frame-controller';

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
/** Keep the opposite edge anchored even when the dragged edge hits a size limit. */
export function resizeRect(from: Rect, edge: ResizeEdge, delta: Point, spec: WindowSpec, viewport: Viewport): Rect {
  if (!spec.resizable) return { ...from };
  const area = workArea(viewport);
  const left = edge.includes('w'); const top = edge.includes('n');
  const w = edge.includes('e') || left
    ? Math.round(Math.min(area.w, Math.max(spec.minWidth, from.w + (left ? -delta.x : delta.x)))) : from.w;
  const maxH = top ? Math.min(area.h, from.y + from.h - MENU_BAR) : area.h;
  const h = edge.includes('s') || top
    ? Math.round(Math.min(maxH, Math.max(spec.minHeight, from.h + (top ? -delta.y : delta.y)))) : from.h;
  return clampMove({ x: left ? from.x + from.w - w : from.x, y: top ? from.y + from.h - h : from.y, w, h }, viewport);
}

export function useWindowResize(windowId: WindowId, frame: RefObject<FrameController | null>, enabled = true): void {
  const store = useStore();
  useEffect(() => {
    const controller = frame.current;
    if (!enabled || !controller) return;
    const el = controller.el; let cancelGesture: (() => void) | null = null;
    let gestureState: { seq: number; w: number; h: number } | null = null;
    const down = (event: PointerEvent) => {
      const handle = (event.target as Element).closest<HTMLElement>('[data-resize-handle]');
      if (!handle || event.button !== 0 || !event.isPrimary || el.hasAttribute('data-keyboard-move')) return;
      const state = store.get(desktopAtom); const win = state.windows[windowId];
      if (!win || win.closing || win.minimized || !APP_META[win.appId].window.resizable) return;
      event.preventDefault(); cancelGesture?.(); controller.stop();
      controller.set(win.rect);
      gestureState = { seq: win.transition.seq, ...state.viewport };
      const original = { ...controller.rect }; const start = { x: event.clientX, y: event.clientY };
      let point = start; let raf = 0; let released = false; let moved = false;
      const edge = handle.dataset.resizeHandle as ResizeEdge;
      const endInteraction = beginPointerInteraction(el, 'resizing');
      handle.setPointerCapture(event.pointerId);
      const cleanup = () => {
        cancelAnimationFrame(raf); endInteraction();
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', abort); handle.removeEventListener('lostpointercapture', lostCapture);
        cancelGesture = null; gestureState = null;
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      };
      const paint = () => {
        raf = 0;
        controller.set(resizeRect(original, edge, { x: point.x - start.x, y: point.y - start.y }, APP_META[win.appId].window, state.viewport));
        if (released) {
          const rect = { ...controller.rect }; cleanup();
          if (moved) {
            store.set(desktopAtom, { type: 'RESIZE', id: windowId, rect });
            const remembered = store.get(desktopAtom).windows[windowId]?.restoreRect;
            if (remembered) store.set(geometryAtom, prev => ({ ...prev, [win.appId]: remembered }));
          }
        }
      };
      const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
      const move = (e: PointerEvent) => {
        if (e.pointerId !== event.pointerId) return;
        point = { x: e.clientX, y: e.clientY }; moved = true; schedule();
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
    el.addEventListener('pointerdown', down);
    return () => { unsubscribe(); cancelGesture?.(); el.removeEventListener('pointerdown', down); };
  }, [enabled, frame, store, windowId]);
}
