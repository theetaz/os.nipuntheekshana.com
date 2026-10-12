import { APP_META } from '../registry/meta';
import type { DesktopState, HistoryMode, WMAction, WMFeatures } from '../wm/types';
import { parseLocation, serializeLocation } from './url';

export const HOME_TITLE = 'Nipun Theekshana — Kottu OS';

/** Requested policy. Rejected reducer actions retain their previous state's history. */
export function historyForAction(action: WMAction, before: DesktopState): HistoryMode {
  switch (action.type) {
    case 'OPEN': {
      if (action.history !== undefined) return action.history;
      const win = [...before.order].reverse().map((id) => before.windows[id])
        .find((win) => win && win.appId === action.appId && !win.closing);
      const newInstance = action.newInstance && APP_META[action.appId].multiInstance;
      const query = action.query ?? {};
      const same = win && win.route === (action.route ?? '')
        && Object.keys(win.query).length === Object.keys(query).length
        && Object.keys(query).every((key) => win.query[key] === query[key]);
      return same && !newInstance ? 'replace' : 'push';
    }
    case 'NAVIGATE': return action.history ?? 'push';
    case 'SET_QUERY': return action.history ?? 'replace';
    case 'CLOSE': case 'QUIT_APP': case 'CLOSE_ALL': case 'FOCUS': case 'FOCUS_DESKTOP':
    case 'CYCLE': case 'MINIMIZE': case 'RESTORE': case 'SHOW_DESKTOP': return 'replace';
    case 'FINISH_CLOSE': case 'MOVE': case 'RESIZE': case 'TOGGLE_MAXIMIZE': case 'SNAP':
    case 'UNSNAP': case 'SET_TITLE': case 'VIEWPORT': case 'SYNC_FROM_URL': return 'none';
    default: { const exhaustive: never = action; return exhaustive; }
  }
}

export function historyWrite(mode: HistoryMode): 'pushState' | 'replaceState' {
  return mode === 'push' ? 'pushState' : 'replaceState';
}

export function documentTitle(state: DesktopState, homeTitle = HOME_TITLE): string {
  const focused = state.focusedId ? state.windows[state.focusedId] : undefined;
  return focused && !focused.minimized && !focused.closing ? `${focused.title} — Nipun Theekshana` : homeTitle;
}

/** P2-3 adapts its Jotai store to this small port; no atom or browser singleton is imported here. */
export interface HistoryStore {
  getState(): DesktopState;
  dispatch(action: WMAction): void;
  subscribe(listener: () => void): () => void;
}
export interface HistoryWindow {
  location: { href: string; pathname: string; search: string; hash: string };
  document: { title: string };
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
}
export interface HistoryPort {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url: string): void;
  replaceState(data: unknown, unused: string, url: string): void;
}
export interface HistoryOptions { features?: WMFeatures; homeTitle?: string }

/** Call after adoption. Initial normalization and popstate always replace, never push. */
export function subscribeHistory(store: HistoryStore, window: HistoryWindow, history: HistoryPort,
  options: HistoryOptions = {}): () => void {
  let syncing = false;
  const features = options.features ?? {};
  const write = (forceReplace = false) => {
    const state = store.getState();
    window.document.title = documentTitle(state, options.homeTitle);
    const next = serializeLocation(state, features);
    if (next !== window.location.pathname + window.location.search) {
      history[forceReplace ? 'replaceState' : historyWrite(state.history)](history.state, '', next + window.location.hash);
    }
  };
  const sync = () => {
    syncing = true;
    try {
      const target = parseLocation(new URL(window.location.href), features);
      // Keep desktop windows in the state/URL; a mobile shell only presents the focused one.
      store.dispatch({ type: 'SYNC_FROM_URL', target });
      write(true);
    } finally { syncing = false; }
  };
  const url = new URL(window.location.href);
  if (['open', 'w', 'shot', 'cmd', 'section'].some((key) => url.searchParams.has(key))) sync();
  else window.document.title = documentTitle(store.getState(), options.homeTitle);
  const unsubscribe = store.subscribe(() => { if (!syncing) write(); });
  window.addEventListener('popstate', sync);
  return () => { unsubscribe(); window.removeEventListener('popstate', sync); };
}
