import { DOCK_REST_SIZE, MAGNIFY_STEP, magnify, magnifyAtRest, stepMagnifySpring, type MagnifySpring } from './magnify';

export function magnifyDock(nav: HTMLElement, list: HTMLUListElement, initialX: number): () => void {
  const fine = matchMedia('(pointer: fine)');
  const elements = Array.from(list.querySelectorAll<HTMLAnchorElement>('[data-dock-item]'));
  let centres: number[] = [];
  let springs: MagnifySpring[] = [];
  let frame = 0; let previous = 0; let remainder = 0;
  const visibility = new MutationObserver(() => measure());
  const reset = () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0; remainder = 0;
    for (const element of elements) { element.style.width = '48px'; element.style.height = '48px'; }
    springs = elements.map(() => ({ size: DOCK_REST_SIZE, target: DOCK_REST_SIZE, velocity: 0 }));
  };
  const measure = () => {
    reset();
    if (!nav.getClientRects().length) return;
    // Read once at rest (and on resize), never after a pointer update or an animation write.
    centres = elements.map(element => { const rect = element.getBoundingClientRect(); return rect.x + rect.width / 2; });
    visibility.disconnect();
  };
  const tick = (now: number) => {
    frame = 0;
    const elapsed = previous ? Math.min((now - previous) / 1000, 1 / 15) : MAGNIFY_STEP;
    previous = now; remainder += elapsed;
    const steps = Math.floor(remainder / MAGNIFY_STEP); remainder -= steps * MAGNIFY_STEP;
    for (let i = 0; i < steps; i++) springs = springs.map(stepMagnifySpring);
    for (let i = 0; i < elements.length; i++) {
      const size = `${springs[i]!.size}px`;
      elements[i]!.style.width = size; elements[i]!.style.height = size;
    }
    if (springs.some(spring => !magnifyAtRest(spring))) frame = requestAnimationFrame(tick);
    else { previous = 0; remainder = 0; }
  };
  const target = (x: number | null) => {
    springs = springs.map((spring, i) => ({ ...spring, target: x === null ? DOCK_REST_SIZE : magnify(x - centres[i]!) }));
    if (!frame && springs.some(spring => !magnifyAtRest(spring))) frame = requestAnimationFrame(tick);
  };
  const move = (event: PointerEvent) => { if (centres.length && fine.matches && event.pointerType !== 'touch') target(event.clientX); };
  const leave = () => target(null);
  const changed = () => measure();
  // The island starts hidden. Wait for the shell handoff before caching resting centres.
  visibility.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-mode'] });
  measure(); if (Number.isFinite(initialX)) target(initialX);
  nav.addEventListener('pointermove', move); nav.addEventListener('pointerleave', leave);
  window.addEventListener('resize', measure); window.addEventListener('blur', leave);
  fine.addEventListener('change', changed);
  return () => { visibility.disconnect(); reset(); nav.removeEventListener('pointermove', move); nav.removeEventListener('pointerleave', leave);
    window.removeEventListener('resize', measure); window.removeEventListener('blur', leave); fine.removeEventListener('change', changed); };
}
