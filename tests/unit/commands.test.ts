import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOsStore, getStore, registerStore } from '../../src/os/state/store';
import { alertsAtom, announceAtom, desktopAtom, geometryAtom, propsAtom, overlayAtom, quickLookAtom,
  spotlightOpenAtom, themePrefAtom, toastsAtom, wallpaperAtom } from '../../src/os/state/atoms';
import { alert, announce, closeQuickLook, closeWindow, copyWindowLink, cycleWindows, focusWindow, minimizeWindow,
  navigateWindow, openApp, openQuickLook, quitApp, registerBeforeClose, resolveAlert, restoreWindow, runCommand,
  showDesktop, snapWindow, toast, toggleMaximize } from '../../src/os/wm/commands';
vi.mock('../../src/os/registry/loader', () => ({ loadApp: vi.fn(() => Promise.resolve({ default: () => null })) }));
let store: ReturnType<typeof createOsStore>; let cleanup: () => void;
beforeEach(() => { store = createOsStore(); cleanup = registerStore(store); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const windowState = (id = 'projects') => store.get(desktopAtom).windows[id]!;

describe('window commands', () => {
  it('routes all four wallpaper ids and ignores retired ids', () => {
    for (const id of ['kottu', 'galle-face', 'pettah', 'paper']) {
      runCommand(`wallpaper.${id}`, 'menu'); expect(store.get(wallpaperAtom)).toBe(id);
    }
    for (const id of ['monsoon', 'contours', 'island', 'island-live']) {
      runCommand(`wallpaper.${id}`, 'menu'); expect(store.get(wallpaperAtom)).toBe('paper');
    }
  });
  it('isolates stores and unregisters only its own active store', () => {
    openApp('projects'); const other = createOsStore(); const remove = registerStore(other);
    cleanup(); expect(getStore()).toBe(other); expect(other.get(desktopAtom).order).toEqual([]);
    remove(); expect(() => getStore()).toThrow('not been registered');
  });
  it('places remembered geometry and reuses single-instance apps', () => {
    store.set(geometryAtom, { projects: { x: 50, y: 60, w: 700, h: 500 } });
    openApp('projects'); expect(windowState().rect).toEqual({ x: 50, y: 60, w: 700, h: 500 });
    openApp('projects', { route: 'salli' }); expect(store.get(desktopAtom).order).toEqual(['projects']);
    expect(windowState().route).toBe('salli');
    openApp('terminal'); openApp('terminal', { newInstance: true }); expect(windowState('terminal~2').title).toBe('Terminal 2');
    openApp('guestbook'); expect(store.get(desktopAtom).windows.guestbook).toBeUndefined();
  });
  it('routes geometry, focus, navigation, and show-desktop actions', () => {
    openApp('projects'); openApp('writing'); minimizeWindow('writing'); expect(windowState('writing').minimized).toBe(true);
    restoreWindow('writing'); expect(store.get(desktopAtom).focusedId).toBe('writing');
    focusWindow('projects'); toggleMaximize('projects'); expect(windowState().mode).toBe('maximized');
    toggleMaximize('projects'); snapWindow('projects', 'left'); expect(windowState().snap).toBe('left');
    navigateWindow('projects', 'salli', { title: 'Salli', query: { shot: '1' }, replace: true });
    expect(windowState()).toMatchObject({ title: 'Salli', route: 'salli', query: { shot: '1' } });
    expect(store.get(desktopAtom).history).toBe('replace'); cycleWindows(1); showDesktop();
    expect(Object.values(store.get(desktopAtom).windows).every(win => win.minimized)).toBe(true);
    showDesktop(); expect(Object.values(store.get(desktopAtom).windows).every(win => !win.minimized)).toBe(true);
  });
  it('awaits close guards, coalesces concurrent closes, and honours cancellation and cleanup', async () => {
    openApp('projects'); let resolve!: (value: boolean) => void;
    const guard = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    const remove = registerBeforeClose(store, 'projects', guard);
    const first = closeWindow('projects'); const second = closeWindow('projects');
    expect(second).toBe(first); expect(windowState().closing).toBe(false); resolve(false);
    expect(await first).toBe(false); expect(guard).toHaveBeenCalledTimes(1); remove();
    const okay = vi.fn(async () => true); registerBeforeClose(store, 'projects', okay);
    expect(await closeWindow('projects')).toBe(true); expect(windowState().closing).toBe(true);
  });
  it('cancels rejected guards and refuses to close a new incarnation of a window', async () => {
    openApp('projects'); const remove = registerBeforeClose(store, 'projects', async () => { throw new Error('guard failed'); });
    expect(await closeWindow('projects')).toBe(false); remove();
    let resolve!: (value: boolean) => void; registerBeforeClose(store, 'projects', () => new Promise(done => { resolve = done; }));
    const pending = closeWindow('projects'); store.set(desktopAtom, { type: 'CLOSE_ALL' }); openApp('projects');
    resolve(true); expect(await pending).toBe(false); expect(windowState().closing).toBe(false);
  });
  it('quits each app instance through its guards', async () => {
    openApp('terminal'); openApp('terminal', { newInstance: true });
    registerBeforeClose(store, 'terminal', async () => false); await quitApp('terminal');
    expect(windowState('terminal').closing).toBe(false); expect(windowState('terminal~2').closing).toBe(true);
  });
  it('awaits every registered guard even when one cancels', async () => {
    openApp('projects'); const first = vi.fn(async () => false); const second = vi.fn(async () => true);
    registerBeforeClose(store, 'projects', first); registerBeforeClose(store, 'projects', second);
    expect(await closeWindow('projects')).toBe(false); expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
  });
  it('copies a standalone window link without other windows', async () => {
    const writeText = vi.fn(async () => {}); vi.stubGlobal('navigator', { clipboard: { writeText } });
    openApp('projects', { route: 'salli', query: { shot: '1' } }); openApp('terminal');
    await copyWindowLink('projects'); expect(writeText).toHaveBeenCalledWith('https://os.nipuntheekshana.com/projects/salli?shot=1');
    expect(store.get(toastsAtom).at(-1)?.title).toBe('Link copied');
  });
});
describe('shell command APIs', () => {
  it('opens the desktop wallpaper action in the Wallpaper settings section', () => {
    runCommand('desktop.wallpaper', 'menu');
    expect(windowState('settings').query).toEqual({ section: 'wallpaper' });
  });
  it('routes commands and scopes Quick Look to the Projects query', () => {
    runCommand('theme.dark', 'terminal'); expect(store.get(themePrefAtom)).toBe('dark');
    runCommand('os.spotlight', 'shortcut'); expect(store.get(spotlightOpenAtom)).toBe(true);
    runCommand('os.escape', 'shortcut'); expect(store.get(spotlightOpenAtom)).toBe(false);
    runCommand('os.sleep', 'menu'); expect(store.get(overlayAtom)).toBe('screensaver');
    store.set(propsAtom, { tuktuk: { dx: 3, dy: 4 } }); runCommand('desktop.cleanUp', 'menu'); expect(store.get(propsAtom)).toEqual({});
    openQuickLook({ slug: 'salli', index: 1, from: null }); expect(windowState().query).toEqual({ shot: '1' });
    expect(store.get(quickLookAtom)).toEqual({ from: null }); closeQuickLook(); expect(windowState().query).toEqual({});
    expect(store.get(quickLookAtom)).toBeNull();
  });
  it('limits toast stacks, sequences repeated announcements, and resolves alerts', async () => {
    for (let i = 0; i < 5; i++) toast({ title: String(i) }); expect(store.get(toastsAtom).map(value => value.title)).toEqual(['2', '3', '4']);
    announce('Opened'); announce('Opened', 'assertive'); expect(store.get(announceAtom)).toEqual({ text: 'Opened', politeness: 'assertive', seq: 2 });
    const result = alert({ title: 'Continue?' }); const spec = store.get(alertsAtom)[0]!;
    resolveAlert(spec.id!, 'primary'); expect(await result).toBe('primary'); expect(store.get(alertsAtom)).toEqual([]);
  });
});
