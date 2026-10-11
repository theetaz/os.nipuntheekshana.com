import { APP_META } from '../registry/meta';
import { desktopAtom, viewAtom } from '../state/atoms';
import { dispatchWithoutHistory, type OsStore } from '../state/store';
import type { AppId } from '../types/apps';
import type { WindowId } from '../wm/types';

interface Adoption { element: HTMLElement; windowId: WindowId; timer: ReturnType<typeof setTimeout>; completed: boolean }
const adoptions = new WeakMap<OsStore, Adoption>();
export function adoptStaticWindow(store: OsStore, document: Document): () => void {
  const element = document.getElementById('static-window');
  if (!element || !Object.hasOwn(APP_META, element.dataset.app ?? '')) return () => {};
  const appId = element.dataset.app as AppId;
  const adopt = () => {
    if (store.get(viewAtom) === 'simple' || adoptions.has(store)) return;
    let query: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(element.dataset.query ?? '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        query = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    } catch { /* Invalid metadata falls back to the app's default query. */ }
    const box = element.getBoundingClientRect();
    store.set(desktopAtom, { type: 'OPEN', appId, route: element.dataset.route ?? '', query,
      rect: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }, adopted: true, history: 'none' });
    const windowId = store.get(desktopAtom).focusedId;
    if (!windowId) return;
    const title = element.querySelector('.static-titlebar > span')?.textContent;
    if (title) store.set(desktopAtom, { type: 'SET_TITLE', id: windowId, title });
    const adoption: Adoption = { element, windowId, completed: false, timer: setTimeout(() => {
      if (adoption.completed) return;
      dispatchWithoutHistory(store, { type: 'FINISH_CLOSE', id: windowId });
      element.hidden = false; element.inert = false;
      console.warn(`[serendib] adoption timed out for ${appId}`);
    }, 3000) };
    adoptions.set(store, adoption);
  };
  const mirrorView = () => {
    if (store.get(viewAtom) === 'simple') { element.hidden = false; element.inert = false; }
    else { adopt(); if (adoptions.get(store)?.completed) { element.hidden = true; element.inert = true; } }
  };
  mirrorView();
  const unsubscribe = store.sub(viewAtom, mirrorView);
  return () => { unsubscribe(); const adoption = adoptions.get(store); if (adoption) clearTimeout(adoption.timer); adoptions.delete(store); };
}
export function completeAdoption(store: OsStore, windowId: WindowId, scrollRoot: HTMLElement | null): void {
  const adoption = adoptions.get(store);
  if (!adoption || adoption.windowId !== windowId || adoption.completed) return;
  const { element } = adoption;
  const managed = element.ownerDocument.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(windowId)}"]`);
  if (!managed) return;
  const hadFocus = element.contains(element.ownerDocument.activeElement);
  if (scrollRoot) scrollRoot.scrollTop = element.querySelector('[data-scroll-root]')?.scrollTop ?? 0;
  adoption.completed = true; clearTimeout(adoption.timer);
  element.hidden = true; element.inert = true; managed.removeAttribute('data-adopting');
  if (hadFocus) (scrollRoot ?? managed).focus();
}
