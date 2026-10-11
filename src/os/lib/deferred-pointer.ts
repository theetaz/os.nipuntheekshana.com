export interface PointerGesture {
  move(event: PointerEvent): void; up(event: PointerEvent): void; cancel(): void;
}
/** Capture immediately and retain the latest input while a cold controller loads. */
export function deferredPointer(element: HTMLElement, event: PointerEvent,
  load: () => Promise<() => PointerGesture>, earlyMove?: (event: PointerEvent) => void, onCancel?: () => void): () => void {
  const pointerId = event.pointerId;
  let gesture: PointerGesture | undefined; let cancelled = false;
  let latest: PointerEvent | undefined; let ended: PointerEvent | undefined;
  const remove = () => {
    element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', cancel); element.removeEventListener('lostpointercapture', cancel);
    window.removeEventListener('blur', cancel); document.removeEventListener('keydown', escape, true);
  };
  const move = (next: PointerEvent) => { if (next.pointerId === pointerId) { latest = next; earlyMove?.(next); } };
  const up = (next: PointerEvent) => { if (next.pointerId === pointerId) { ended = next; remove(); } };
  const cancel = () => {
    cancelled = true; remove(); gesture?.cancel(); onCancel?.();
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  };
  const escape = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.preventDefault(); next.stopPropagation(); cancel(); } };
  element.setPointerCapture(pointerId);
  element.addEventListener('pointermove', move); element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel); element.addEventListener('lostpointercapture', cancel);
  window.addEventListener('blur', cancel); document.addEventListener('keydown', escape, true);
  void load().then(create => {
    remove(); if (cancelled) return;
    const value = create(); gesture = value;
    if (latest) value.move(latest);
    if (ended) value.up(ended);
  }).catch(cancel);
  return cancel;
}
