import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPS } from '../../src/os/registry/apps';
import { canPrefetch, loadApp, prefetchApp } from '../../src/os/registry/loader';
import { appLoadAtom } from '../../src/os/state/atoms';
import { createOsStore, registerStore } from '../../src/os/state/store';
const module = { default: () => null, menus: {} };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('app loader', () => {
  it('deduplicates imports, caches successful modules, and updates each requesting store', async () => {
    const load = vi.spyOn(APPS.projects, 'load').mockResolvedValue(module); const store = createOsStore(); const other = createOsStore();
    const first = loadApp('projects', store); expect(loadApp('projects', other)).toBe(first);
    expect(store.get(appLoadAtom).projects).toBe('loading'); expect(await first).toBe(module);
    expect(store.get(appLoadAtom).projects).toBe('ready'); expect(other.get(appLoadAtom).projects).toBe('ready');
    await loadApp('projects', store); expect(load).toHaveBeenCalledTimes(1);
  });
  it('evicts failed imports so retry can succeed', async () => {
    const load = vi.spyOn(APPS.writing, 'load').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(module);
    const store = createOsStore(); await expect(loadApp('writing', store)).rejects.toThrow('offline');
    expect(store.get(appLoadAtom).writing).toBe('error'); await expect(loadApp('writing', store)).resolves.toBe(module);
    expect(load).toHaveBeenCalledTimes(2); expect(store.get(appLoadAtom).writing).toBe('ready');
  });
  it('rejects a suppressed preload failure instead of caching an undefined module', async () => {
    const load = vi.spyOn(APPS.about, 'load').mockResolvedValueOnce(undefined as never).mockResolvedValue(module);
    const store = createOsStore(); await expect(loadApp('about', store)).rejects.toThrow('The app could not be loaded');
    expect(store.get(appLoadAtom).about).toBe('error');
    await expect(loadApp('about', store)).resolves.toBe(module);
    expect(load).toHaveBeenCalledTimes(2); expect(store.get(appLoadAtom).about).toBe('ready');
  });
  it('blocks intent prefetch on Save-Data/2G and does not enable later apps', () => {
    const load = vi.spyOn(APPS.maps, 'load').mockResolvedValue(module); const remove = registerStore(createOsStore());
    vi.stubGlobal('navigator', { connection: { saveData: true, effectiveType: '4g' } }); prefetchApp('maps'); expect(load).not.toHaveBeenCalled();
    for (const effectiveType of ['2g', 'slow-2g']) expect(canPrefetch({ effectiveType })).toBe(false);
    expect(canPrefetch({ effectiveType: '3g' })).toBe(true); const later = vi.spyOn(APPS.guestbook, 'load');
    vi.stubGlobal('navigator', {}); prefetchApp('guestbook'); expect(later).not.toHaveBeenCalled(); remove();
  });
});
