import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESET } from 'jotai/utils';
import { createOsStore } from '../../src/os/state/store';
import { modeAtom, resolvedThemeAtom, reducedMotionAtom, systemDarkAtom, systemReducedMotionAtom } from '../../src/os/state/atoms';
import { motionPrefAtom, propsAtom, WALLPAPERS, WALLPAPER_NAMES, preferenceAtoms, subscribePreferences, themePrefAtom, volumeAtom, wallpaperAtom } from '../../src/os/state/prefs';
import { isBoolean, oneOf, preferenceStorage, stringList } from '../../src/os/state/storage';

function storage(values: Record<string, string> = {}) {
  return { getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => { values[key] = value; }, removeItem: (key: string) => { delete values[key]; }, values };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('validated preference storage', () => {
  it('exports the four named wallpapers and rejects retired ids', () => {
    expect(WALLPAPERS).toEqual(['kottu', 'galle-face', 'pettah', 'paper']);
    expect(WALLPAPER_NAMES).toEqual({ kottu: 'Kottu', 'galle-face': 'Galle Face', pettah: 'Pettah', paper: 'Paper' });
    const saved = storage({ 'serendib:wallpaper': '"island-live"' }); vi.stubGlobal('window', { localStorage: saved });
    const store = createOsStore(); const cleanup = store.sub(wallpaperAtom, () => {});
    expect(store.get(wallpaperAtom)).toBe('kottu'); cleanup();
  });
  it.each([[], { 'bad key': { dx: 1, dy: 1 } }, { constructor: { dx: 1, dy: 1 } }, { tea: { dx: '1', dy: 1 } }, { tea: { dx: 1 } }, { tea: null }].map(positions => ({ positions })))('rejects malformed prop offsets $positions', ({ positions }) => {
    const saved = storage({ 'serendib:props:v1': JSON.stringify(positions) }); vi.stubGlobal('window', { localStorage: saved });
    const store = createOsStore(); const cleanup = store.sub(propsAtom, () => {});
    expect(store.get(propsAtom)).toEqual({}); cleanup();
  });
  it('loads and writes finite signed prop offsets on the existing storage prefix', () => {
    const saved = storage({ 'serendib:props:v1': '{"tuktuk":{"dx":10,"dy":-5}}' }); vi.stubGlobal('window', { localStorage: saved });
    const store = createOsStore(); const cleanup = store.sub(propsAtom, () => {});
    expect(store.get(propsAtom)).toEqual({ tuktuk: { dx: 10, dy: -5 } });
    store.set(propsAtom, { tea: { dx: -2, dy: 3 } }); expect(saved.values['serendib:props:v1']).toBe('{"tea":{"dx":-2,"dy":3}}'); cleanup();
  });
  it('keeps first-render defaults until subscriptions mount, then writes JSON and resets', () => {
    const saved = storage({ 'serendib:theme': '"dark"' }); vi.stubGlobal('window', { localStorage: saved });
    const store = createOsStore(); expect(store.get(themePrefAtom)).toBe('auto');
    const cleanup = store.sub(themePrefAtom, () => {}); expect(store.get(themePrefAtom)).toBe('dark');
    store.set(themePrefAtom, 'light'); expect(saved.values['serendib:theme']).toBe('"light"');
    store.set(themePrefAtom, RESET); expect(saved.values['serendib:theme']).toBeUndefined(); cleanup();
  });
  it('rejects malformed JSON, invalid enums, wrong types, and invalid bounded values', () => {
    const saved = storage({ 'serendib:theme': '"neon"', 'serendib:volume': '2', 'serendib:wallpaper': '{broken' });
    vi.stubGlobal('window', { localStorage: saved }); const store = createOsStore();
    const cleanup = [themePrefAtom, volumeAtom, wallpaperAtom].map(preference => store.sub(preference, () => {}));
    expect(store.get(themePrefAtom)).toBe('auto'); expect(store.get(volumeAtom)).toBe(0.6); expect(store.get(wallpaperAtom)).toBe('kottu');
    expect(stringList(5)(new Array(6).fill('x'))).toBe(false); cleanup.forEach(remove => remove());
  });
  it('tolerates inaccessible and full storage without losing in-memory settings', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('disabled'); } });
    const safe = preferenceStorage(isBoolean); expect(safe.getItem('key', false)).toBe(false);
    expect(() => safe.setItem('key', true)).not.toThrow(); expect(() => safe.removeItem('key')).not.toThrow();
    vi.stubGlobal('window', { localStorage: { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('disabled'); } } });
    const store = createOsStore(); store.set(themePrefAtom, 'dark'); expect(store.get(themePrefAtom)).toBe('dark');
    expect(preferenceStorage(oneOf(['light', 'dark'])).getItem('key', 'light')).toBe('light');
  });
  it('resolves environment preferences and mirrors atoms to html with bounded transition cleanup', () => {
    vi.useFakeTimers(); const store = createOsStore(); const classes = new Set<string>();
    const html = { dataset: { theme: 'light' }, classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } } as unknown as HTMLElement;
    const cleanup = subscribePreferences(store, html);
    store.set(systemDarkAtom, true); expect(store.get(resolvedThemeAtom)).toBe('dark'); expect(html.dataset.theme).toBe('dark');
    expect(classes.has('theme-changing')).toBe(true); vi.advanceTimersByTime(240); expect(classes.has('theme-changing')).toBe(false);
    store.set(themePrefAtom, 'light'); expect(html.dataset.theme).toBe('light'); store.set(modeAtom, 'mobile'); expect(html.dataset.mode).toBe('mobile');
    store.set(systemReducedMotionAtom, true); expect(store.get(reducedMotionAtom)).toBe(true);
    store.set(motionPrefAtom, 'full'); expect(store.get(reducedMotionAtom)).toBe(false); expect(html.dataset.motion).toBe('full');
    cleanup(); store.set(themePrefAtom, 'dark'); expect(html.dataset.theme).toBe('light'); expect(preferenceAtoms).toHaveLength(16);
    expect(preferenceAtoms.map(atom => String(atom))).toHaveLength(new Set(preferenceAtoms).size);
  });
  it('validates cross-tab storage events, ignores other areas, and removes its listener', () => {
    class BrowserStorage implements Storage {
      values = new Map<string, string>();
      get length() { return this.values.size; }
      clear() { this.values.clear(); }
      getItem(key: string) { return this.values.get(key) ?? null; }
      key(index: number) { return [...this.values.keys()][index] ?? null; }
      removeItem(key: string) { this.values.delete(key); }
      setItem(key: string, value: string) { this.values.set(key, value); }
    }
    const area = new BrowserStorage(); const events = new EventTarget();
    vi.stubGlobal('window', { Storage: BrowserStorage, localStorage: area,
      addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) });
    const safe = preferenceStorage(oneOf(['light', 'dark'])); const callback = vi.fn();
    const cleanup = safe.subscribe('theme', callback, 'light');
    const emit = (value: string, storageArea: Storage = area) => events.dispatchEvent(Object.assign(new Event('storage'), { key: 'theme', newValue: value, storageArea }));
    emit('"dark"'); expect(callback).toHaveBeenLastCalledWith('dark'); emit('"neon"'); expect(callback).toHaveBeenLastCalledWith('light');
    emit('"dark"', new BrowserStorage()); expect(callback).toHaveBeenCalledTimes(2);
    cleanup(); emit('"dark"'); expect(callback).toHaveBeenCalledTimes(2);
  });
});
