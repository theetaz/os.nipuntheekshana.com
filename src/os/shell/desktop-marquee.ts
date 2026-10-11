import type { createStore } from 'jotai';
import { desktopSelectionAtom } from './desktop-selection';
import type { AppId } from '../types/apps';
import type { PointerGesture } from '../lib/deferred-pointer';

export function startMarquee(store: ReturnType<typeof createStore>, element: HTMLElement, marquee: HTMLElement | null,
  event: PointerEvent, previous: AppId[], additive: boolean, finished: () => void): PointerGesture {
  const pointerId = event.pointerId;
  const origin = { x: event.clientX, y: event.clientY }; let point = origin; let frame = 0; let moving = false;
  // Measure once, before any frame writes; widgets remain above this surface in the stack.
  const icons = [...document.querySelectorAll<HTMLElement>('[data-shell="desktop"] [data-desktop-icon]')]
    .map(node => ({ id: node.dataset.desktopIcon as AppId, rect: node.getBoundingClientRect() }));
  const paint = () => {
    frame = 0; const left = Math.min(origin.x, point.x); const top = Math.min(origin.y, point.y);
    const right = Math.max(origin.x, point.x); const bottom = Math.max(origin.y, point.y);
    const box = marquee;
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
    if (marquee) marquee.hidden = true;
    element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', cancel); element.removeEventListener('lostpointercapture', cancel);
    window.removeEventListener('blur', cancel); document.removeEventListener('keydown', escape, true);
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    finished();
  };
  const up = (next: PointerEvent) => { if (next.pointerId === pointerId) { point = { x: next.clientX, y: next.clientY }; finish(false); } };
  const cancel = () => finish(true);
  const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel(); } };

  element.addEventListener('pointermove', move); element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel); element.addEventListener('lostpointercapture', cancel);
  window.addEventListener('blur', cancel); document.addEventListener('keydown', escape, true);
  return { move, up, cancel };
}
