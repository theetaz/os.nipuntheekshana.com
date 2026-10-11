import { describe, expect, it } from 'vitest';
import { parseLocation, queryFor, serializeLocation, TERMINAL_COMMANDS, windowLink } from '../../src/os/url/url';
import { documentTitle, historyForAction, historyWrite, HOME_TITLE, subscribeHistory } from '../../src/os/url/history';
import type { HistoryPort, HistoryStore, HistoryWindow } from '../../src/os/url/history';
import { wmReducer } from '../../src/os/wm/reducer';
import { createDesktopState } from '../../src/os/wm/types';
import type { DesktopState, HistoryMode, WMAction } from '../../src/os/wm/types';

const url = (value: string) => new URL(value, 'https://os.nipuntheekshana.com');
function stateFrom(value: string): DesktopState {
  return wmReducer(createDesktopState(), { type: 'SYNC_FROM_URL', target: parseLocation(url(value)) });
}

const roundTrips: [string, string][] = [
  ['/', '/'], ['/projects', '/projects'], ['/projects/salli', '/projects/salli'], ['/writing', '/writing'],
  ['/writing/hello-world', '/writing/hello-world'], ['/about', '/about'], ['/cv', '/cv'], ['/now', '/now'],
  ['/activity', '/activity'], ['/maps', '/maps'], ['/maps/play', '/maps/play'], ['/terminal', '/terminal'],
  ['/messages', '/messages'], ['/readme', '/readme'], ['/settings', '/settings'], ['/kooda', '/kooda'],
  ...TERMINAL_COMMANDS.map((cmd): [string, string] => [`/terminal?cmd=${cmd}`, `/terminal?cmd=${cmd}`]),
  ['/projects/salli?shot=0', '/projects/salli?shot=0'], ['/projects/salli?shot=2', '/projects/salli?shot=2'],
  ['/projects/salli?shot=2&w=terminal', '/projects/salli?w=terminal&shot=2'],
  ['/projects/salli?w=terminal,writing:hello-world', '/projects/salli?w=terminal,writing:hello-world'],
  ['/writing?w=about,projects:salli', '/writing?w=about,projects:salli'],
  ['/maps/play?w=terminal,now', '/maps/play?w=terminal,now'],
  ['/terminal?w=terminal', '/terminal?w=terminal'],
  ['/terminal?w=terminal,terminal&cmd=help', '/terminal?w=terminal,terminal&cmd=help'],
  ['/projects?w=terminal,terminal', '/projects?w=terminal,terminal'],
  ['/?w=about,terminal', '/terminal?w=about'],
  ['/about?w=about,writing,writing:hello-world', '/about?w=writing'],
  ['/projects/salli?w=terminal%2Cwriting%3Ahello-world&unknown=x', '/projects/salli?w=terminal,writing:hello-world'],
  ['/writing/not-in-content', '/writing/not-in-content'],
  ['/?open=projects/salli', '/projects/salli'],
  ['/about?open=maps/play&w=terminal', '/maps/play?w=terminal'],
  ['/?open=terminal&cmd=neofetch#welcome', '/terminal?cmd=neofetch'],
];

describe('40-case URL round-trip contract', () => {
  it('contains exactly 40 cases', () => { expect(roundTrips).toHaveLength(40); });
  it.each(roundTrips)('normalizes %s to %s', (input, normalized) => {
    const state = stateFrom(input);
    expect(serializeLocation(state)).toBe(normalized);
    expect(serializeLocation(stateFrom(normalized))).toBe(normalized);
  });
});

describe('untrusted links and app query ownership', () => {
  it('marks unknown paths but does not mark the desktop unknown', () => {
    expect(parseLocation(url('/'))).toEqual({ focused: null, others: [], unknownPath: false });
    expect(parseLocation(url('/missing'))).toEqual({ focused: null, others: [], unknownPath: true });
    expect(parseLocation(url('/projects/unknown-slug')).unknownPath).toBe(false);
    expect(parseLocation(url('/missing?open=projects')).focused?.appId).toBe('projects');
    expect(parseLocation(url('/missing?open=projects')).unknownPath).toBe(true);
  });
  it.each(['missing', 'maps/unknown', 'projects/a/b', 'projects/', 'terminal/2', '/projects', 'projects/Salli',
    'projects/a%0A', 'projects/a_b', 'constructor', '__proto__', 'guestbook'])
    ('invalid open=%s falls back to the path without throwing', (open) => {
      const parsed = parseLocation(url(`/writing?open=${open}`));
      expect(parsed.focused).toEqual({ appId: 'writing', route: '', query: {} });
      expect(serializeLocation(stateFrom(`/writing?open=${open}`))).toBe('/writing');
    });
  it.each(['projects:a/b', 'writing:Hello', 'maps:nope', 'terminal:', 'missing', 'about:x', 'guestbook', 'projects:a%0A'])
    ('invalid w entry %s is skipped', (entry) => {
      expect(parseLocation(url(`/now?w=${entry},terminal`)).others).toEqual([{ appId: 'terminal', route: '', query: {} }]);
    });
  it('bounds others to six valid entries after skipping invalid entries and duplicates', () => {
    const parsed = parseLocation(url('/projects?w=nope,about,about,terminal,now,maps:play,writing:hello-world,readme,activity'));
    expect(parsed.others.map((item) => item.appId)).toEqual(['about', 'terminal', 'now', 'maps', 'writing', 'readme']);
    expect(serializeLocation(wmReducer(createDesktopState(), { type: 'SYNC_FROM_URL', target: parsed })))
      .toBe('/projects?w=about,terminal,now,maps:play,writing:hello-world,readme');
  });
  it('removes duplicate single-instance apps but preserves each additional Terminal', () => {
    expect(parseLocation(url('/projects/salli?w=projects:mochi,writing,writing:hello-world,terminal,terminal')).others)
      .toEqual([{ appId: 'writing', route: '', query: {} }, { appId: 'terminal', route: '', query: {} }, { appId: 'terminal', route: '', query: {} }]);
    expect(stateFrom('/terminal?w=terminal,terminal').order).toHaveLength(3);
  });
  it('gates Postcards in path, open and w forms by default', () => {
    expect(parseLocation(url('/postcards'))).toEqual({ focused: null, others: [], unknownPath: true });
    expect(parseLocation(url('/now?open=guestbook&w=guestbook')).focused?.appId).toBe('now');
    expect(parseLocation(url('/now?open=guestbook&w=guestbook')).others).toEqual([]);
    const features = { postcards: true };
    const parsed = parseLocation(url('/postcards?w=terminal'), features);
    const state = wmReducer(createDesktopState(), { type: 'SYNC_FROM_URL', target: parsed }, features);
    expect(serializeLocation(state, features)).toBe('/postcards?w=terminal');
    expect(serializeLocation(state)).toBe('/terminal');
  });
  it.each(['-1', '1.5', 'NaN', '', '02', '2%0A', '+2', 'Infinity', '2x'])('rejects invalid shot=%s', (shot) => {
    expect(parseLocation(url(`/projects/salli?shot=${shot}`)).focused?.query).toEqual({});
    expect(serializeLocation(stateFrom(`/projects/salli?shot=${shot}`))).toBe('/projects/salli');
  });
  it.each(['rm%20-rf', 'help%3Bdate', 'HELP', 'echo', '', 'help%0A'])('rejects non-whitelisted cmd=%s', (cmd) => {
    expect(parseLocation(url(`/terminal?cmd=${cmd}`)).focused?.query).toEqual({});
  });
  it('limits query ownership to the focused app and takes the first duplicate value', () => {
    expect(parseLocation(url('/projects/salli?w=terminal&shot=2&shot=3&cmd=help&foo=x')).focused?.query).toEqual({ shot: '2' });
    expect(parseLocation(url('/terminal?shot=2&cmd=help&cmd=date')).focused?.query).toEqual({ cmd: 'help' });
    expect(parseLocation(url('/writing?shot=2&cmd=help')).focused?.query).toEqual({});
    expect(queryFor('projects', { shot: '3', arbitrary: 'x', cmd: 'help' })).toEqual({ shot: '3' });
  });
  it('serialize uses a visible focus, falls back to topmost, and excludes closing/minimized windows', () => {
    let state = stateFrom('/projects/salli?w=terminal,about&shot=2');
    state = wmReducer(state, { type: 'FOCUS_DESKTOP' });
    expect(serializeLocation(state)).toBe('/projects/salli?w=terminal,about&shot=2');
    state = wmReducer(state, { type: 'MINIMIZE', id: 'projects' });
    expect(serializeLocation(state)).toBe('/about?w=terminal');
    state = wmReducer(state, { type: 'CLOSE', id: 'about' });
    expect(serializeLocation(state)).toBe('/terminal');
    state = wmReducer(state, { type: 'MINIMIZE', id: 'terminal' });
    expect(serializeLocation(state)).toBe('/');
  });
  it('serialize falls back if focusedId refers to a hidden window', () => {
    const state = wmReducer(stateFrom('/about?w=terminal'), { type: 'MINIMIZE', id: 'about' });
    expect(serializeLocation({ ...state, focusedId: 'about' })).toBe('/terminal');
    expect(serializeLocation({ ...state, focusedId: 'missing' })).toBe('/terminal');
  });
  it('serialize drops unsupported queries and handles malformed state routes gracefully', () => {
    const state = stateFrom('/projects/salli?w=terminal');
    const projects = state.windows.projects!;
    expect(serializeLocation({ ...state, windows: { ...state.windows, projects: { ...projects, query: { cmd: 'help', shot: '2', x: '<script>' } } } }))
      .toBe('/projects/salli?w=terminal&shot=2');
    expect(serializeLocation({ ...state, windows: { ...state.windows, projects: { ...projects, route: 'a/b' } } })).toBe('/terminal');
  });
  it('copies a canonical link for the specified window alone, including minimized windows', () => {
    const state = stateFrom('/projects/salli?w=terminal&shot=2');
    expect(windowLink(state.windows.projects!)).toBe('https://os.nipuntheekshana.com/projects/salli?shot=2');
    const minimized = wmReducer(state, { type: 'MINIMIZE', id: 'projects' });
    expect(windowLink(minimized.windows.projects!)).toBe('https://os.nipuntheekshana.com/projects/salli?shot=2');
    const guestbook = wmReducer(createDesktopState(), { type: 'OPEN', appId: 'guestbook' }, { postcards: true }).windows.guestbook!;
    expect(windowLink(guestbook)).toBeNull();
  });
});

describe('history policy for every reducer action', () => {
  const before = () => stateFrom('/about?w=terminal,projects');
  const policies: [WMAction, HistoryMode][] = [
    [{ type: 'OPEN', appId: 'now' }, 'push'], [{ type: 'CLOSE', id: 'terminal' }, 'replace'],
    [{ type: 'FINISH_CLOSE', id: 'terminal' }, 'none'], [{ type: 'QUIT_APP', appId: 'terminal' }, 'replace'],
    [{ type: 'CLOSE_ALL' }, 'replace'], [{ type: 'FOCUS', id: 'terminal' }, 'replace'],
    [{ type: 'FOCUS_DESKTOP' }, 'replace'], [{ type: 'CYCLE', direction: 1 }, 'replace'],
    [{ type: 'MOVE', id: 'terminal', x: 50, y: 60 }, 'none'],
    [{ type: 'RESIZE', id: 'terminal', rect: { x: 50, y: 60, w: 600, h: 400 } }, 'none'],
    [{ type: 'MINIMIZE', id: 'terminal' }, 'replace'], [{ type: 'RESTORE', id: 'terminal' }, 'replace'],
    [{ type: 'TOGGLE_MAXIMIZE', id: 'terminal' }, 'none'], [{ type: 'SNAP', id: 'terminal', zone: 'left' }, 'none'],
    [{ type: 'UNSNAP', id: 'terminal', pointer: { x: 300, y: 200 } }, 'none'],
    [{ type: 'NAVIGATE', id: 'projects', route: 'salli' }, 'push'],
    [{ type: 'SET_QUERY', id: 'projects', query: { shot: '2' } }, 'replace'],
    [{ type: 'SET_TITLE', id: 'terminal', title: 'Terminal 1' }, 'none'], [{ type: 'SHOW_DESKTOP' }, 'replace'],
    [{ type: 'VIEWPORT', viewport: { w: 1024, h: 640 } }, 'none'],
    [{ type: 'SYNC_FROM_URL', target: parseLocation(url('/now')) }, 'none'],
  ];
  it.each(policies)('$type uses %s', (action, expected) => {
    expect(historyForAction(action, before())).toBe(expected);
    const state = action.type === 'UNSNAP' ? wmReducer(before(), { type: 'SNAP', id: 'terminal', zone: 'left' }) : before();
    expect(wmReducer(state, action).history).toBe(expected);
  });
  it('distinguishes focus-only OPEN from navigation and new instances', () => {
    const state = before();
    expect(historyForAction({ type: 'OPEN', appId: 'terminal' }, state)).toBe('replace');
    expect(historyForAction({ type: 'OPEN', appId: 'terminal', newInstance: true }, state)).toBe('push');
    expect(historyForAction({ type: 'OPEN', appId: 'projects', route: 'salli' }, state)).toBe('push');
    expect(historyForAction({ type: 'OPEN', appId: 'terminal', query: { cmd: 'help' } }, state)).toBe('push');
    for (const history of ['push', 'replace', 'none'] as const) {
      expect(historyForAction({ type: 'OPEN', appId: 'terminal', history }, state)).toBe(history);
      expect(wmReducer(state, { type: 'OPEN', appId: 'terminal', history }).history).toBe(history);
    }
    expect(historyForAction({ type: 'NAVIGATE', id: 'projects', route: '', history: 'replace' }, state)).toBe('replace');
    expect(historyForAction({ type: 'SET_QUERY', id: 'projects', query: {}, history: 'push' }, state)).toBe('push');
  });
  it('maps none to replace and updates title from actual focus, including home', () => {
    expect(['push', 'replace', 'none'].map((value) => historyWrite(value as HistoryMode)))
      .toEqual(['pushState', 'replaceState', 'replaceState']);
    expect(documentTitle(before())).toBe('About — Nipun Theekshana');
    expect(documentTitle(wmReducer(before(), { type: 'FOCUS_DESKTOP' }))).toBe(HOME_TITLE);
    expect(documentTitle(createDesktopState(), 'Home override')).toBe('Home override');
  });
});

function harness(initialUrl: string, initialState = createDesktopState()) {
  let state = initialState;
  const subscribers = new Set<() => void>();
  const popstates = new Set<() => void>();
  const calls: { method: string; data: unknown; url: string }[] = [];
  const store: HistoryStore = {
    getState: () => state,
    dispatch: (action) => { state = wmReducer(state, action); for (const callback of subscribers) callback(); },
    subscribe: (callback) => { subscribers.add(callback); return () => { subscribers.delete(callback); }; },
  };
  const window: HistoryWindow = { location: url(initialUrl), document: { title: '' },
    addEventListener: (_type, listener) => { popstates.add(listener); },
    removeEventListener: (_type, listener) => { popstates.delete(listener); } };
  const history: HistoryPort = { state: { hostState: 'retained' },
    pushState: (data, _unused, value) => { calls.push({ method: 'push', data, url: value }); window.location = url(value); },
    replaceState: (data, _unused, value) => { calls.push({ method: 'replace', data, url: value }); window.location = url(value); } };
  return { store, window, history, calls, subscribers, popstates,
    pop: (value: string) => { window.location = url(value); for (const callback of popstates) callback(); } };
}

describe('injected history subscription', () => {
  it('normalizes open/w/query after adoption, preserving hash and host history data', () => {
    const h = harness('/?open=projects/salli&w=terminal&shot=2&foo=x#simple');
    const dispose = subscribeHistory(h.store, h.window, h.history);
    expect(h.store.getState().order).toEqual(['terminal', 'projects']);
    expect(h.calls).toEqual([{ method: 'replace', data: h.history.state, url: '/projects/salli?w=terminal&shot=2#simple' }]);
    expect(h.window.document.title).toBe('Projects — Nipun Theekshana');
    dispose();
    expect(h.subscribers.size).toBe(0);
    expect(h.popstates.size).toBe(0);
  });
  it('does not touch a plain route at bootstrap, since its window was already adopted', () => {
    const h = harness('/projects#chapter', stateFrom('/projects'));
    subscribeHistory(h.store, h.window, h.history);
    expect(h.calls).toEqual([]);
    expect(h.window.document.title).toBe('Projects — Nipun Theekshana');
  });
  it('pushes navigation, replaces focus/close/query, and avoids duplicate writes', () => {
    const h = harness('/');
    subscribeHistory(h.store, h.window, h.history);
    h.store.dispatch({ type: 'OPEN', appId: 'projects' });
    h.store.dispatch({ type: 'NAVIGATE', id: 'projects', route: 'salli' });
    h.store.dispatch({ type: 'SET_QUERY', id: 'projects', query: { shot: '2' } });
    h.store.dispatch({ type: 'MOVE', id: 'projects', x: 100, y: 100 });
    h.store.dispatch({ type: 'SET_TITLE', id: 'projects', title: 'Salli — Projects' });
    expect(h.window.document.title).toBe('Salli — Projects — Nipun Theekshana');
    h.store.dispatch({ type: 'OPEN', appId: 'terminal' });
    h.store.dispatch({ type: 'FOCUS', id: 'projects' });
    h.store.dispatch({ type: 'FOCUS', id: 'projects' });
    h.store.dispatch({ type: 'CLOSE', id: 'projects' });
    h.store.dispatch({ type: 'FINISH_CLOSE', id: 'projects' });
    expect(h.calls.map(({ method, url }) => [method, url])).toEqual([
      ['push', '/projects'], ['push', '/projects/salli'], ['replace', '/projects/salli?shot=2'],
      ['push', '/terminal?w=projects:salli'], ['replace', '/projects/salli?w=terminal&shot=2'], ['replace', '/terminal'],
    ]);
  });
  it('uses replace for a none action that actually changes the URL, preserving arbitrary hashes', () => {
    const h = harness('/#welcome');
    subscribeHistory(h.store, h.window, h.history);
    h.store.dispatch({ type: 'OPEN', appId: 'terminal', history: 'none' });
    expect(h.calls.map(({ method, url }) => [method, url])).toEqual([['replace', '/terminal#welcome']]);
  });
  it('Back restores the URL state without pushing or replacing an already normalized location', () => {
    const h = harness('/projects', stateFrom('/projects'));
    subscribeHistory(h.store, h.window, h.history);
    h.store.dispatch({ type: 'OPEN', appId: 'terminal' });
    const count = h.calls.length;
    h.pop('/projects#simple');
    expect(h.store.getState().order).toEqual(['projects']);
    expect(h.store.getState().focusedId).toBe('projects');
    expect(h.calls).toHaveLength(count);
    h.pop('/');
    expect(h.store.getState().order).toEqual([]);
    expect(h.window.document.title).toBe(HOME_TITLE);
    expect(h.calls).toHaveLength(count);
  });
  it('popstate normalizes bad/legacy URLs once with replace, never pushes', () => {
    const h = harness('/');
    subscribeHistory(h.store, h.window, h.history);
    h.pop('/?open=terminal&cmd=help&unknown=bad#simple');
    expect(h.calls.map(({ method, url }) => [method, url])).toEqual([['replace', '/terminal?cmd=help#simple']]);
    expect(h.store.getState().windows.terminal?.query).toEqual({ cmd: 'help' });
  });
  it('keeps minimized windows on Back and does not revive them on a home URL', () => {
    const h = harness('/terminal', stateFrom('/terminal'));
    subscribeHistory(h.store, h.window, h.history);
    h.store.dispatch({ type: 'MINIMIZE', id: 'terminal' });
    h.store.dispatch({ type: 'OPEN', appId: 'projects' });
    h.pop('/');
    expect(h.store.getState().windows.terminal?.minimized).toBe(true);
    expect(h.store.getState().windows.projects).toBeUndefined();
    expect(h.store.getState().focusedId).toBeNull();
  });
  it('drops unknown params on the next write and tears down both listeners', () => {
    const h = harness('/projects?unknown=x', stateFrom('/projects'));
    const dispose = subscribeHistory(h.store, h.window, h.history);
    expect(h.calls).toEqual([]);
    h.store.dispatch({ type: 'SET_TITLE', id: 'projects', title: 'Projects ready' });
    expect(h.calls.map(({ method, url }) => [method, url])).toEqual([['replace', '/projects']]);
    dispose(); dispose();
    const count = h.calls.length;
    h.store.dispatch({ type: 'OPEN', appId: 'terminal' });
    h.pop('/now');
    expect(h.calls).toHaveLength(count);
    expect(h.store.getState().windows.terminal).toBeDefined();
  });
});
