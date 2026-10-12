import { APP_META, titleFor } from '../registry/meta';
import { clampMove, clampSize, zoneRect } from './geometry';
import { placeWindow } from './placement';
import type { AppId } from '../types/apps';
import type { ParsedLocation } from '../url/url';
import type { DesktopState, HistoryMode, Rect, TransitionKind, WindowId, WindowState, WMAction, WMFeatures } from './types';

export type { WMAction } from './types';

function sameQuery(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function validRoute(appId: AppId, route: string, features: WMFeatures): boolean {
  if (!Object.hasOwn(APP_META, appId)) return false;
  const meta = APP_META[appId];
  if (!meta || (appId === 'guestbook' ? !features.postcards : meta.phase === 'later')) return false;
  return route === '' || (meta.subRoutes === 'slug' ? !/[^a-z0-9-]/.test(route)
    : meta.subRoutes !== 'none' && meta.subRoutes.includes(route));
}

function defaultTitle(appId: AppId, route: string, instance: number): string {
  const meta = APP_META[appId];
  const title = titleFor(meta, route);
  return meta.multiInstance && instance > 1 ? `${title} ${instance}` : title;
}

function history(state: DesktopState, mode: HistoryMode): DesktopState {
  return state.history === mode ? state : { ...state, history: mode };
}

function topmost(state: DesktopState): WindowId | null {
  for (let i = state.order.length - 1; i >= 0; i--) {
    const id = state.order[i]!;
    const win = state.windows[id];
    if (win && !win.minimized && !win.closing) return id;
  }
  return null;
}

function update(state: DesktopState, win: WindowState, patch: Partial<WindowState>, mode: HistoryMode,
  kind?: TransitionKind): DesktopState {
  const seq = kind && kind !== 'none' ? state.seq + 1 : state.seq;
  const transition = kind ? { kind, seq: kind === 'none' ? win.transition.seq : seq, origin: null } : win.transition;
  const next = { ...win, ...patch, transition };
  if (Object.entries(patch).every(([key, value]) => {
    if (key === 'rect' || key === 'restoreRect') return sameRect(win[key], value as Rect);
    if (key === 'query') return sameQuery(win.query, value as WindowState['query']);
    return win[key as keyof WindowState] === value;
  }) && transition.kind === win.transition.kind && transition.seq === win.transition.seq
    && transition.origin === win.transition.origin) return history(state, mode);
  return { ...state, seq, history: mode,
    windows: { ...state.windows, [win.id]: next } };
}

function raise(state: DesktopState, id: WindowId): DesktopState {
  if (state.focusedId === id && state.order.at(-1) === id) return state;
  return { ...state, order: [...state.order.filter((item) => item !== id), id], focusedId: id };
}

function remove(state: DesktopState, id: WindowId): DesktopState {
  if (!state.windows[id]) return history(state, 'none');
  const windows = { ...state.windows };
  delete windows[id];
  const next = { ...state, windows, order: state.order.filter((item) => item !== id), history: 'none' as const,
    showDesktopStash: state.showDesktopStash?.filter((item) => item !== id) ?? null };
  return state.focusedId === id ? { ...next, focusedId: topmost(next) } : next;
}

/** URL entries describe app counts, not persistent instance identities. Reuse live windows before creating any. */
function syncFromUrl(state: DesktopState, target: ParsedLocation, features: WMFeatures): DesktopState {
  const desired = [...target.others, ...(target.focused ? [target.focused] : [])]
    .filter((item) => validRoute(item.appId, item.route, features));
  const used = new Set<WindowId>();
  const ids: WindowId[] = [];
  let next = state;
  let focusedId: WindowId | null = null;
  const singleApps = new Set<AppId>();
  for (const item of desired) {
    if (!APP_META[item.appId].multiInstance && singleApps.has(item.appId)) continue;
    singleApps.add(item.appId);
    const candidates = next.order.map((id) => next.windows[id]!)
      .filter((win) => win && !win.closing && !used.has(win.id) && win.appId === item.appId);
    const win = candidates.find((win) => win.route === item.route && sameQuery(win.query, item.query)) ?? candidates.at(-1);
    let id: WindowId;
    if (win) {
      id = win.id;
      if (win.route !== item.route || !sameQuery(win.query, item.query)) {
        next = wmReducer(next, { type: 'NAVIGATE', id, route: item.route, query: item.query,
          title: defaultTitle(win.appId, item.route, win.instance) }, features);
      }
      if (win.minimized) next = wmReducer(next, { type: 'RESTORE', id }, features);
    } else {
      next = wmReducer(next, { type: 'OPEN', appId: item.appId, route: item.route, query: item.query,
        newInstance: true, history: 'none' }, features);
      id = next.focusedId!;
    }
    used.add(id);
    ids.push(id);
    if (item === target.focused) focusedId = id;
  }
  // Unrepresented minimized windows survive Back; excess visible instances do not.
  for (const id of next.order) {
    const win = next.windows[id]!;
    if (!used.has(id) && (!win.minimized || win.closing)) next = remove(next, id);
  }
  const hidden = next.order.filter((id) => !used.has(id));
  return { ...next, order: [...hidden, ...ids], focusedId, showDesktopStash: null, history: 'none' };
}

/** Pure: all environment and feature availability are supplied by the caller. */
export function wmReducer(state: DesktopState, action: WMAction, features: WMFeatures = {}): DesktopState {
  switch (action.type) {
    case 'OPEN': {
      const route = action.route ?? '';
      if (!validRoute(action.appId, route, features)) return state;
      const meta = APP_META[action.appId];
      const query = action.query ?? {};
      const existing = [...state.order].reverse().map((id) => state.windows[id])
        .find((win) => win && win.appId === action.appId && !win.closing);
      if (existing && !(action.newInstance && meta.multiInstance)) {
        const navigated = route !== existing.route || !sameQuery(query, existing.query);
        const mode = action.history ?? (navigated ? 'push' : 'replace');
        let next = history(state, mode);
        if (navigated || existing.minimized) next = update(next, existing, {
          minimized: false, route, query: { ...query },
          title: navigated ? defaultTitle(action.appId, route, existing.instance) : existing.title,
        }, mode, existing.minimized ? 'restore' : 'none');
        return raise(next, existing.id);
      }
      let instance = 1;
      const used = new Set(Object.values(state.windows).filter((win) => win.appId === action.appId).map((win) => win.instance));
      while (used.has(instance)) instance++;
      const id = instance === 1 ? action.appId : `${action.appId}~${instance}`;
      const rect = action.rect ? { ...action.rect } : placeWindow(meta, state, null);
      const seq = state.seq + 1;
      const win: WindowState = { id, appId: action.appId, instance, route, query: { ...query },
        title: defaultTitle(action.appId, route, instance), rect, restoreRect: { ...rect }, mode: 'normal', snap: null,
        minimized: false, closing: false, adopted: action.adopted ?? false, createdSeq: seq,
        transition: { kind: action.adopted ? 'none' : 'open', seq, origin: action.origin ? { ...action.origin } : null } };
      return { ...state, windows: { ...state.windows, [id]: win }, order: [...state.order, id],
        focusedId: id, seq, history: action.history ?? 'push' };
    }
    case 'CLOSE_ALL':
      return { ...state, windows: {}, order: [], focusedId: null, showDesktopStash: null, history: 'replace' };
    case 'QUIT_APP': {
      let next = state;
      for (const id of state.order) {
        if (state.windows[id]?.appId === action.appId) next = wmReducer(next, { type: 'CLOSE', id }, features);
      }
      return history(next, 'replace');
    }
    case 'FINISH_CLOSE': return remove(state, action.id);
    case 'FOCUS_DESKTOP': return history({ ...state, focusedId: null }, 'replace');
    case 'CYCLE': {
      const visible = state.order.filter((id) => {
        const win = state.windows[id];
        return win && !win.minimized && !win.closing;
      });
      if (!visible.length) return history(state, 'replace');
      if (action.direction === 1) return raise(history(state, 'replace'), visible[0]!);
      const top = visible.at(-1)!;
      const next = { ...state, order: [top, ...state.order.filter((id) => id !== top)], history: 'replace' as const };
      return { ...next, focusedId: topmost(next) };
    }
    case 'SHOW_DESKTOP': {
      let next = state;
      if (state.showDesktopStash === null) {
        const stash = state.order.filter((id) => !state.windows[id]!.minimized && !state.windows[id]!.closing);
        for (const id of stash) next = update(next, next.windows[id]!, { minimized: true }, 'replace', 'minimize');
        return { ...next, showDesktopStash: stash, focusedId: null, history: 'replace' };
      }
      for (const id of state.showDesktopStash) {
        const win = next.windows[id];
        if (win && !win.closing) next = raise(update(next, win, { minimized: false }, 'replace', 'restore'), id);
      }
      return { ...next, showDesktopStash: null, focusedId: topmost(next), history: 'replace' };
    }
    case 'VIEWPORT': {
      const viewport = { ...action.viewport };
      const windows = { ...state.windows };
      let changed = false;
      for (const win of Object.values(windows)) {
        const rect = win.mode === 'normal' ? clampSize(win.rect, APP_META[win.appId].window, viewport)
          : zoneRect(win.snap!, viewport);
        if (!sameRect(rect, win.rect) || (win.mode === 'normal' && !sameRect(rect, win.restoreRect))) {
          windows[win.id] = { ...win, rect, ...(win.mode === 'normal' ? { restoreRect: { ...rect } } : {}) };
          changed = true;
        }
      }
      return { ...state, viewport, windows: changed ? windows : state.windows, history: 'none' };
    }
    case 'SYNC_FROM_URL': return syncFromUrl(state, action.target, features);
    default: {
      const win = state.windows[action.id];
      if (!win || win.closing) return state;
      switch (action.type) {
        case 'CLOSE': {
          const next = update(state, win, { closing: true }, 'replace', 'close');
          return { ...next, focusedId: topmost(next) };
        }
        case 'FOCUS':
          return win.minimized ? raise(update(state, win, { minimized: false }, 'replace', 'restore'), win.id)
            : raise(history(state, 'replace'), win.id);
        case 'MOVE': {
          const rect = clampMove({ ...win.rect, x: action.x, y: action.y }, state.viewport);
          return update(state, win, { rect, ...(win.mode === 'normal' ? { restoreRect: { ...rect } } : {}) }, 'none', 'none');
        }
        case 'RESIZE': {
          if (!APP_META[win.appId].window.resizable) return state;
          const rect = clampSize(action.rect, APP_META[win.appId].window, state.viewport);
          return update(state, win, { rect, restoreRect: { ...rect }, mode: 'normal', snap: null }, 'none', 'none');
        }
        case 'MINIMIZE': {
          if (win.minimized) return history(state, 'replace');
          const next = update(state, win, { minimized: true }, 'replace', 'minimize');
          return { ...next, focusedId: topmost(next) };
        }
        case 'RESTORE': return raise(update(state, win, { minimized: false }, 'replace', 'restore'), win.id);
        case 'TOGGLE_MAXIMIZE': {
          if (!APP_META[win.appId].window.zoomable) return state;
          if (win.mode === 'maximized') return update(state, win,
            { rect: { ...win.restoreRect }, mode: 'normal', snap: null }, 'none', 'zoom');
          return update(state, win, { rect: zoneRect('max', state.viewport), mode: 'maximized', snap: 'max',
            ...(win.mode === 'normal' ? { restoreRect: { ...win.rect } } : {}) }, 'none', 'zoom');
        }
        case 'SNAP': {
          const rect = zoneRect(action.zone, state.viewport);
          const spec = APP_META[win.appId].window;
          if (rect.w < spec.minWidth || rect.h < spec.minHeight) return state;
          return update(state, win, { rect, mode: action.zone === 'max' ? 'maximized' : 'snapped', snap: action.zone,
            ...(win.mode === 'normal' ? { restoreRect: { ...win.rect } } : {}) }, 'none', 'snap');
        }
        case 'UNSNAP': {
          if (win.mode === 'normal') return state;
          const ratio = (action.pointer.x - win.rect.x) / win.rect.w;
          const rect = clampMove({ ...win.restoreRect,
            x: Math.round(action.pointer.x - ratio * win.restoreRect.w), y: action.pointer.y - 20 }, state.viewport);
          return update(state, win, { rect, restoreRect: { ...rect }, mode: 'normal', snap: null }, 'none', 'unsnap');
        }
        case 'NAVIGATE':
          if (!validRoute(win.appId, action.route, features)) return state;
          return update(state, win, { route: action.route, query: { ...action.query },
            ...(action.title !== undefined ? { title: action.title } : {}) }, action.history ?? 'push');
        case 'SET_QUERY': return update(state, win, { query: { ...action.query } }, action.history ?? 'replace');
        case 'SET_TITLE': return update(state, win, { title: action.title }, 'none');
        default: {
          const exhaustive: never = action;
          return exhaustive;
        }
      }
    }
  }
}
