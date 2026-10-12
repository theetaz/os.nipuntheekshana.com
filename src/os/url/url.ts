import { APP_META } from '../registry/meta';
import type { AppId } from '../types/apps';
import type { DesktopState, WindowState, WMFeatures } from '../wm/types';
import { matchRoute, pathFor } from './routes';

export interface Target { appId: AppId; route: string; query: Record<string, string> }
export interface ParsedLocation { focused: Target | null; others: Target[]; unknownPath: boolean }
export const TERMINAL_COMMANDS = ['neofetch', 'help', 'projects', 'now', 'whoami', 'ls', 'date', 'contact'] as const;
// Thin URL metadata: importing app implementations here would pull them into B1.
export const QUERY_SECTIONS: Partial<Record<AppId, readonly string[]>> = {
  readme: ['welcome', 'getting-around', 'shortcuts', 'plain-page', 'privacy', 'credits'],
  settings: ['appearance', 'wallpaper', 'accessibility', 'sound', 'mochi', 'desktop', 'about', 'developer'],
};

function enabled(appId: AppId, features: WMFeatures): boolean {
  return appId === 'guestbook' ? features.postcards === true : APP_META[appId].phase === 'v1';
}

/** Validate with the shared route policy; malformed external links never escape as RangeError. */
function targetFor(app: string, route: string, features: WMFeatures): Target | null {
  if (!Object.hasOwn(APP_META, app)) return null;
  const appId = app as AppId;
  if (!enabled(appId, features)) return null;
  try {
    pathFor(appId, route);
    return { appId, route, query: {} };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/** Only owned, valid query parameters can be shared or executed. */
export function queryFor(appId: AppId, query: Readonly<Record<string, string>>): Record<string, string> {
  if (appId === 'projects' && query.shot !== undefined && /^(0|[1-9][0-9]*)$/.test(query.shot) && !/[^0-9]/.test(query.shot)) {
    return { shot: query.shot };
  }
  if (appId === 'terminal' && TERMINAL_COMMANDS.some((cmd) => cmd === query.cmd)) return { cmd: query.cmd! };
  if (QUERY_SECTIONS[appId]?.includes(query.section ?? ''))
    return { section: query.section! };
  return {};
}

export function parseLocation(url: URL, features: WMFeatures = {}): ParsedLocation {
  const matched = matchRoute(url.pathname);
  const pathTarget = matched ? targetFor(matched.appId, matched.route, features) : null;
  const open = url.searchParams.get('open');
  const slash = open?.indexOf('/') ?? -1;
  const explicit = open === null || slash === open.length - 1 ? null
    : targetFor(slash < 0 ? open : open.slice(0, slash), slash < 0 ? '' : open.slice(slash + 1), features);
  const focused = explicit ?? pathTarget;
  const others: Target[] = [];
  const seen = new Set<AppId>(focused && !APP_META[focused.appId].multiInstance ? [focused.appId] : []);
  for (const entry of (url.searchParams.get('w') ?? '').split(',')) {
    const colon = entry.indexOf(':');
    if (colon === entry.length - 1) continue;
    const item = targetFor(colon < 0 ? entry : entry.slice(0, colon), colon < 0 ? '' : entry.slice(colon + 1), features);
    if (!item || (!APP_META[item.appId].multiInstance && seen.has(item.appId))) continue;
    seen.add(item.appId);
    others.push(item);
    if (others.length === 6) break;
  }
  if (focused) focused.query = queryFor(focused.appId, Object.fromEntries(['shot', 'cmd', 'section']
    .flatMap((key) => { const value = url.searchParams.get(key); return value === null ? [] : [[key, value]]; })));
  return { focused, others, unknownPath: url.pathname !== '/' && !pathTarget };
}

function pathOf(win: WindowState, features: WMFeatures): string | null {
  if (!enabled(win.appId, features)) return null;
  try { return pathFor(win.appId, win.route); }
  catch (error) { if (error instanceof RangeError) return null; throw error; }
}

export function serializeLocation(state: DesktopState, features: WMFeatures = {}): string {
  const visible = state.order.map((id) => state.windows[id])
    .filter((win): win is WindowState => !!win && !win.minimized && !win.closing && pathOf(win, features) !== null);
  const front = visible.find((win) => win.id === state.focusedId) ?? visible.at(-1);
  if (!front) return '/';
  const others = visible.filter((win) => win.id !== front.id)
    .map((win) => win.appId + (win.route ? `:${win.route}` : ''));
  const params: string[] = [];
  // App ids and sub-routes have already been validated; keep the list separators readable.
  if (others.length) params.push(`w=${others.join(',')}`);
  const query = queryFor(front.appId, front.query);
  for (const key of Object.keys(query).sort()) params.push(`${encodeURIComponent(key)}=${encodeURIComponent(query[key]!)}`);
  return pathOf(front, features)! + (params.length ? `?${params.join('&')}` : '');
}

export function windowLink(win: WindowState, features: WMFeatures = {}): string | null {
  if (pathOf(win, features) === null) return null;
  const visible = { ...win, minimized: false, closing: false };
  return 'https://os.nipuntheekshana.com' + serializeLocation({ windows: { [win.id]: visible }, order: [win.id],
    focusedId: win.id, viewport: { w: 1440, h: 900 }, seq: 0, showDesktopStash: null, history: 'none' }, features);
}
