import type { createStore } from 'jotai';
import type { RefObject } from 'react';
import type { AppId } from '../types/apps';
import type { Point } from '../wm/types';
import type { PointerGesture } from '../lib/deferred-pointer';
import { desktopAtom, iconPositionsAtom, reducedMotionAtom } from '../state/atoms';
import { desktopSelectionAtom } from './desktop-selection';
import { isOverKooda } from './dock-anchors';

const grid = { x: 96, y: 104 };
export function startIconDrag(store: ReturnType<typeof createStore>, element: HTMLAnchorElement, id: AppId, event: PointerEvent,
  nodes: RefObject<Map<AppId, HTMLAnchorElement>>, anchor: RefObject<AppId>, suppressClick: RefObject<boolean>,
  animations: RefObject<Set<Animation>>, setSelected: (ids: AppId[]) => void, focus: (id: AppId) => void,
  finished: () => void): PointerGesture {
  const pointerId = event.pointerId; const start = { x: event.clientX, y: event.clientY };
  const chosen = store.get(desktopSelectionAtom); const ids = chosen.includes(id) ? chosen : [id];
  const entries = ids.map(value => { const node = nodes.current.get(value)!; return { id: value, node, rect: node.getBoundingClientRect(), transform: node.style.transform }; });
  const viewport = { w: innerWidth, h: innerHeight }; let point = start; let frame = 0; let moving = false;
  const paint = () => {
    frame = 0;
    for (const entry of entries) entry.node.style.transform = `translate3d(${point.x - start.x}px, ${point.y - start.y}px, 0)`;
  };
  const move = (next: PointerEvent) => {
    if (next.pointerId !== pointerId) return;
    point = { x: next.clientX, y: next.clientY };
    if (!moving && Math.hypot(point.x - start.x, point.y - start.y) < 4) return;
    if (!moving) {
      moving = true; suppressClick.current = true;
      store.set(desktopAtom, { type: 'FOCUS_DESKTOP' }); setSelected(ids); anchor.current = id; focus(id);
      for (const entry of entries) { entry.node.dataset.dragging = ''; entry.node.style.willChange = 'transform'; }
    }
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const finish = (commit: boolean) => {
    cancelAnimationFrame(frame);
    element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', cancel); element.removeEventListener('lostpointercapture', cancel);
    window.removeEventListener('blur', cancel); document.removeEventListener('keydown', escape, true);
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    finished();
    const accept = moving && commit && !isOverKooda(point);
    const updates: Partial<Record<AppId, Point>> = {};
    for (const entry of entries) {
      const delta = { x: point.x - start.x, y: point.y - start.y };
      if (accept) {
        // Persist grid offsets from right=24/top=48, independent of the default 96px flow.
        updates[entry.id] = {
          x: Math.max(0, Math.min(Math.floor((viewport.w - 132) / grid.x), Math.round((viewport.w - 108 - entry.rect.x - delta.x) / grid.x))) * grid.x,
          y: Math.max(0, Math.min(Math.floor((viewport.h - 224) / grid.y), Math.round((entry.rect.y + delta.y - 48) / grid.y))) * grid.y,
        };
      }
      delete entry.node.dataset.dragging; entry.node.style.willChange = '';
      entry.node.style.transform = entry.transform;
      if (moving && !store.get(reducedMotionAtom)) {
        const target = updates[entry.id];
        const end = target ? { x: viewport.w - 108 - target.x - entry.rect.x, y: 48 + target.y - entry.rect.y } : { x: 0, y: 0 };
        const animation = entry.node.animate([{ transform: `translate(${delta.x - end.x}px, ${delta.y - end.y}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
        animations.current.add(animation);
        void animation.finished.then(() => animations.current.delete(animation), () => animations.current.delete(animation));
      }
    }
    if (accept) store.set(iconPositionsAtom, previous => ({ ...previous, ...updates }));
  };
  const up = (next: PointerEvent) => { if (next.pointerId === pointerId) { point = { x: next.clientX, y: next.clientY }; finish(true); } };
  const cancel = () => finish(false);
  const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel(); } };

  element.addEventListener('pointermove', move); element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel); element.addEventListener('lostpointercapture', cancel);
  window.addEventListener('blur', cancel); document.addEventListener('keydown', escape, true);
  return { move, up, cancel };
}
