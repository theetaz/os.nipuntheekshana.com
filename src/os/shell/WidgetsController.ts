import type { OsStore } from '../state/store';
import { reducedMotionAtom, showWidgetsAtom } from '../state/atoms';

/** Enhance the Astro links in place; restore their static styles when the desktop unmounts. */
export function WidgetsController(store: OsStore): () => void {
  const column = document.querySelector<HTMLElement>('.desktop-widgets');
  if (!column) return () => {};
  const ticket = column.querySelector<HTMLElement>('.ticket-wrap');
  const sticky = column.querySelector<HTMLElement>('.now-sticky');
  const activity = column.querySelector<HTMLElement>('.activity-strip');
  const elements = [column, ticket, sticky, activity].filter((element): element is HTMLElement => !!element);
  const original = elements.map(element => ({ element, style: element.getAttribute('style') }));
  column.style.pointerEvents = 'none';
  for (const element of [ticket, sticky, activity]) if (element) element.style.pointerEvents = 'auto';
  let hovering = false; let frame = 0;
  const tilt = () => {
    if (!ticket) return;
    ticket.style.transform = hovering && !store.get(reducedMotionAtom) ? 'rotate(-1.2deg) translateY(-2px)' : 'rotate(-1.2deg)';
    ticket.style.transition = store.get(reducedMotionAtom) ? 'none' : 'transform 160ms var(--ease-out)';
  };
  const update = () => {
    frame = 0; column.style.display = store.get(showWidgetsAtom) ? '' : 'none';
    // Use untransformed heights: rotations must not change the column's spacing or hide thresholds.
    const ticketBottom = 72 + (innerWidth < 1280 ? 212 : 232);
    const stickyBottom = ticketBottom + 32 + 236;
    const showSticky = innerHeight >= 700 && stickyBottom <= innerHeight - 96;
    if (sticky) sticky.style.display = showSticky ? '' : 'none';
    const activityBottom = (showSticky && sticky ? stickyBottom : ticketBottom) + 32 + 112;
    if (activity) activity.style.display = innerHeight >= 860 && innerWidth >= 1180 && activityBottom <= innerHeight - 96 ? '' : 'none';
    tilt();
  };
  const resize = () => { if (!frame) frame = requestAnimationFrame(update); };
  const enter = (event: PointerEvent) => { if (event.pointerType !== 'touch') { hovering = true; tilt(); } };
  const leave = () => { hovering = false; tilt(); };
  const subscriptions = [store.sub(showWidgetsAtom, update), store.sub(reducedMotionAtom, tilt)];
  window.addEventListener('resize', resize); ticket?.addEventListener('pointerenter', enter); ticket?.addEventListener('pointerleave', leave);
  update();
  return () => {
    cancelAnimationFrame(frame); subscriptions.forEach(cleanup => cleanup());
    window.removeEventListener('resize', resize); ticket?.removeEventListener('pointerenter', enter); ticket?.removeEventListener('pointerleave', leave);
    for (const { element, style } of original) { if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style); }
  };
}
