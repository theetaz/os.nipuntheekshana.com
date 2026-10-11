import type { AppId } from '../types/apps';
import { appLoadAtom } from '../state/atoms';
import { getStore, type OsStore } from '../state/store';
import { APPS, type AppModule } from './apps';

const cache = new Map<AppId, Promise<AppModule>>();
export function loadApp(id: AppId, store: OsStore = getStore()): Promise<AppModule> {
  let pending = cache.get(id);
  if (!pending) {
    pending = Promise.resolve().then(() => APPS[id].load()).catch(error => { cache.delete(id); throw error; });
    cache.set(id, pending);
  }
  store.set(appLoadAtom, state => ({ ...state, [id]: 'loading' }));
  // Track each requesting store independently even when the module promise is shared.
  void pending.then(() => store.set(appLoadAtom, state => ({ ...state, [id]: 'ready' })),
    () => store.set(appLoadAtom, state => ({ ...state, [id]: 'error' })));
  return pending;
}
export function canPrefetch(connection = typeof navigator === 'undefined' ? undefined
  : (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection): boolean {
  return !connection?.saveData && !/(^|-)2g$/.test(connection?.effectiveType ?? '');
}
export function prefetchApp(id: AppId, store: OsStore = getStore()): void {
  if (canPrefetch() && APPS[id].phase === 'v1') void loadApp(id, store).catch(() => {});
}
