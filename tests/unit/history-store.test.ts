import { describe, expect, it, vi } from 'vitest';
import { createOsStore, dispatchWithoutHistory, historyStore } from '../../src/os/state/store';
import { desktopAtom } from '../../src/os/state/atoms';
import { subscribeHistory, type HistoryPort, type HistoryWindow } from '../../src/os/url/history';
function browser(href: string) {
  let url = new URL(href); const listeners = new Set<() => void>();
  const window: HistoryWindow = { get location() { return url; }, document: { title: '' },
    addEventListener: (_type, fn) => { listeners.add(fn); }, removeEventListener: (_type, fn) => { listeners.delete(fn); } };
  const history: HistoryPort = { state: { preserved: true }, pushState: vi.fn((_state, _unused, next) => { url = new URL(next, url); }),
    replaceState: vi.fn((_state, _unused, next) => { url = new URL(next, url); }) };
  return { window, history, pop(next: string) { url = new URL(next, url); listeners.forEach(fn => fn()); } };
}
describe('Jotai history adapter', () => {
  it('pushes launches, preserves hashes/state, removes visible windows on Back, and cleans subscriptions', () => {
    const store = createOsStore(); const port = browser('https://os.nipuntheekshana.com/#keep');
    const cleanup = subscribeHistory(historyStore(store), port.window, port.history);
    store.set(desktopAtom, { type: 'OPEN', appId: 'projects' });
    expect(port.history.pushState).toHaveBeenCalledWith({ preserved: true }, '', '/projects#keep');
    expect(port.window.document.title).toBe('Projects — Nipun Theekshana'); port.pop('/#keep');
    expect(store.get(desktopAtom).order).toEqual([]); expect(port.window.document.title).toBe('Nipun Theekshana — Kottu OS');
    cleanup(); store.set(desktopAtom, { type: 'OPEN', appId: 'writing' }); expect(port.history.pushState).toHaveBeenCalledTimes(1);
    port.pop('/'); expect(store.get(desktopAtom).order).toEqual(['writing']);
  });
  it('retains adopted geometry when normalizing additional windows and owned queries', () => {
    const store = createOsStore(); const rect = { x: 240, y: 68, w: 960, h: 640 };
    store.set(desktopAtom, { type: 'OPEN', appId: 'projects', route: 'salli', rect, adopted: true, history: 'none' });
    const port = browser('https://os.nipuntheekshana.com/projects/salli?w=terminal&shot=1');
    const cleanup = subscribeHistory(historyStore(store), port.window, port.history);
    expect(store.get(desktopAtom).windows.projects).toMatchObject({ adopted: true, rect, query: { shot: '1' } });
    expect(store.get(desktopAtom).order).toHaveLength(2); expect(port.history.pushState).not.toHaveBeenCalled(); cleanup();
  });
  it('replaces focus/minimize changes and prevents query execution for disabled apps', () => {
    const store = createOsStore(); const port = browser('https://os.nipuntheekshana.com/?open=guestbook');
    const cleanup = subscribeHistory(historyStore(store), port.window, port.history); expect(store.get(desktopAtom).order).toEqual([]);
    store.set(desktopAtom, { type: 'OPEN', appId: 'projects' }); store.set(desktopAtom, { type: 'MINIMIZE', id: 'projects' });
    expect(port.window.location.pathname).toBe('/'); expect(port.history.replaceState).toHaveBeenCalled(); cleanup();
  });
  it('rolls back failed adoption without replacing the static document URL', () => {
    const store = createOsStore(); store.set(desktopAtom, { type: 'OPEN', appId: 'projects', route: 'salli', adopted: true, history: 'none' });
    const port = browser('https://os.nipuntheekshana.com/projects/salli');
    const cleanup = subscribeHistory(historyStore(store), port.window, port.history);
    dispatchWithoutHistory(store, { type: 'FINISH_CLOSE', id: 'projects' });
    expect(port.history.replaceState).not.toHaveBeenCalled(); expect(port.window.location.pathname).toBe('/projects/salli'); cleanup();
  });
});
