import { createStore } from 'jotai';
import { desktopAtom } from './atoms';
import { createDesktopState, type WMAction } from '../wm/types';
import type { DesktopProps } from '../Desktop';
import type { HistoryStore } from '../url/history';

export type OsStore = ReturnType<typeof createStore>;
export function createOsStore(_props?: DesktopProps): OsStore {
  const store = createStore();
  store.set(desktopAtom, { type: 'VIEWPORT', viewport: createDesktopState().viewport });
  return store;
}
let current: OsStore | null = null;
const silentStores = new WeakSet<OsStore>();
/** Adoption rollback removes an invisible window while retaining the static document's URL. */
export function dispatchWithoutHistory(store: OsStore, action: WMAction): void {
  silentStores.add(store);
  try { store.set(desktopAtom, action); } finally { silentStores.delete(store); }
}
export function registerStore(store: OsStore): () => void {
  current = store;
  return () => { if (current === store) current = null; };
}
export function getStore(): OsStore {
  if (!current) throw new Error('Kottu store has not been registered.');
  return current;
}
export function historyStore(store: OsStore): HistoryStore {
  return { getState: () => store.get(desktopAtom), dispatch: action => store.set(desktopAtom, action),
    subscribe: listener => store.sub(desktopAtom, () => { if (!silentStores.has(store)) listener(); }) };
}
