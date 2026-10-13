import type { OsStore } from '../state/store';

/** Preserve input while the event controller loads outside the critical bundle. */
export function subscribeEggs(store: OsStore): () => void {
  const types = ['keydown', 'ayubowan', 'about:avatar7', 'serendib:pin-perfect'];
  const queued: Event[] = [];
  let active = true; let cleanup: (() => void) | undefined;
  const capture = (event: Event) => { queued.push(event); if (queued.length > 16) queued.shift(); };
  const remove = () => { for (const type of types) document.removeEventListener(type, capture); };
  for (const type of types) document.addEventListener(type, capture);
  void import('./konami').then(module => {
    remove(); if (active) cleanup = module.subscribeEggs(store, queued);
    queued.length = 0;
  }).catch(() => { remove(); queued.length = 0; });
  return () => { active = false; remove(); cleanup?.(); queued.length = 0; };
}
