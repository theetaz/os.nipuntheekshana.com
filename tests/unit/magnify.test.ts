import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'jotai';
import { DOCK_MAX_SIZE, DOCK_REST_SIZE, MAGNIFY_STEP, magnify, magnifyAtRest, stepMagnifySpring } from '../../src/os/shell/magnify';
import { getDockAnchor, isOverKooda, registerDockAnchor } from '../../src/os/shell/dock-anchors';
import { DockItem, dockMenuItems } from '../../src/os/shell/DockItem';
import { createOsStore, registerStore, type OsStore } from '../../src/os/state/store';
import { alertsAtom, desktopAtom, koodaEmptyAtom, toastsAtom } from '../../src/os/state/atoms';
import { openApp, resolveAlert, runCommand } from '../../src/os/wm/commands';
import { APP_META } from '../../src/os/registry/meta';

vi.mock('../../src/os/registry/loader', () => ({ loadApp: vi.fn(async () => ({})) }));

describe('dock magnification', () => {
  it.each([[0, 72], [50, 69.17], [80, 64.97], [107, 59.93], [160, 48], [200, 48]])('target at distance %s is %s px', (distance, size) => {
    expect(magnify(distance)).toBeCloseTo(size, 1);
  });
  it('is symmetric and bounded over the whole influence range', () => {
    for (let distance = 0; distance <= 220; distance++) {
      expect(magnify(-distance)).toBe(magnify(distance));
      expect(magnify(distance)).toBeGreaterThanOrEqual(DOCK_REST_SIZE);
      expect(magnify(distance)).toBeLessThanOrEqual(DOCK_MAX_SIZE);
    }
    expect(magnify(Infinity)).toBe(48); expect(magnify(NaN)).toBe(48);
  });
  it('uses the specified fixed step and semi-implicit Euler order without mutating input', () => {
    const initial = { size: 48, velocity: 0, target: 72 };
    const next = stepMagnifySpring(initial);
    const velocity = (380 * 24 / .6) * MAGNIFY_STEP;
    expect(MAGNIFY_STEP).toBe(1 / 120);
    expect(next.velocity).toBe(velocity); expect(next.size).toBe(48 + velocity * MAGNIFY_STEP);
    expect(initial).toEqual({ size: 48, velocity: 0, target: 72 });
  });
  it('reaches the requested size within 500 ms and settles exactly in both directions', () => {
    let state = { size: 48, velocity: 0, target: 72 };
    for (let i = 0; i < 60; i++) state = stepMagnifySpring(state);
    expect(Math.abs(state.size - 72)).toBeLessThan(1);
    for (let i = 0; i < 180; i++) state = stepMagnifySpring(state);
    expect(state).toEqual({ size: 72, velocity: 0, target: 72 });
    state = { ...state, target: 48 };
    for (let i = 0; i < 240; i++) state = stepMagnifySpring(state);
    expect(state).toEqual({ size: 48, velocity: 0, target: 48 });
  });
  it('requires both displacement and velocity to be at rest', () => {
    expect(magnifyAtRest({ size: 72, target: 72, velocity: .2 })).toBe(false);
    expect(magnifyAtRest({ size: 71.8, target: 72, velocity: 0 })).toBe(false);
    expect(magnifyAtRest({ size: 71.95, target: 72, velocity: .05 })).toBe(true);
  });
  it('remains stable when the target reverses during animation', () => {
    let state = { size: 48, velocity: 0, target: 72 };
    for (let i = 0; i < 1200; i++) {
      state = stepMagnifySpring({ ...state, target: i % 24 < 12 ? 72 : 48 });
      expect(Number.isFinite(state.size)).toBe(true); expect(Math.abs(state.velocity)).toBeLessThan(700);
    }
    state = { ...state, target: 48 };
    for (let i = 0; i < 240; i++) state = stepMagnifySpring(state);
    expect(magnifyAtRest(state)).toBe(true);
  });
});

function anchor(x = 100, y = 200, width = 48, height = 48) {
  const state = { x, y, width, height, connected: true, visible: true, hidden: false };
  const element = { get isConnected() { return state.connected; }, closest: () => state.hidden ? {} : null,
    getClientRects: () => state.visible ? [{}] : [],
    getBoundingClientRect: () => ({ x: state.x, y: state.y, width: state.width, height: state.height,
      left: state.x, top: state.y, right: state.x + state.width, bottom: state.y + state.height }) } as unknown as HTMLElement;
  return { element, state };
}
describe('dock targets', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });
  it('returns null until registered and cleanup is idempotent', () => {
    expect(getDockAnchor('projects')).toBeNull();
    const cleanup = registerDockAnchor('projects', anchor().element); cleanups.push(cleanup);
    expect(getDockAnchor('projects')).toEqual({ x: 124, y: 224 }); cleanup(); cleanup();
    expect(getDockAnchor('projects')).toBeNull();
  });
  it('reads live geometry after magnification and viewport movement', () => {
    const entry = anchor(); cleanups.push(registerDockAnchor('projects', entry.element));
    entry.state.width = 72; entry.state.height = 72; entry.state.x = 130;
    expect(getDockAnchor('projects')).toEqual({ x: 166, y: 236 });
  });
  it('uses the visible shell and does not let old cleanup remove a replacement', () => {
    const desktop = anchor(); const mobile = anchor(20, 800); mobile.state.visible = false;
    const first = registerDockAnchor('terminal', desktop.element); cleanups.push(first, registerDockAnchor('terminal', mobile.element));
    expect(getDockAnchor('terminal')).toEqual({ x: 124, y: 224 });
    desktop.state.visible = false; mobile.state.visible = true;
    first(); expect(getDockAnchor('terminal')).toEqual({ x: 44, y: 824 });
    mobile.state.connected = false; expect(getDockAnchor('terminal')).toBeNull();
  });
  it('rejects hidden and inert ancestors', () => {
    const entry = anchor(); entry.state.hidden = true; cleanups.push(registerDockAnchor('maps', entry.element));
    expect(getDockAnchor('maps')).toBeNull();
  });
  it('keeps a repeated registration alive when an earlier cleanup runs', () => {
    const entry = anchor(); const first = registerDockAnchor('cv', entry.element);
    cleanups.push(first, registerDockAnchor('cv', entry.element));
    first(); expect(getDockAnchor('cv')).toEqual({ x: 124, y: 224 });
  });
  it('hit-tests the current Kooda bounds, including edges, and ignores absent targets', () => {
    expect(isOverKooda({ x: 100, y: 200 })).toBe(false);
    const entry = anchor(); cleanups.push(registerDockAnchor('trash', entry.element));
    for (const point of [{ x: 100, y: 200 }, { x: 148, y: 248 }, { x: 124, y: 224 }]) expect(isOverKooda(point)).toBe(true);
    expect(isOverKooda({ x: 149, y: 220 })).toBe(false); expect(isOverKooda({ x: NaN, y: 220 })).toBe(false);
    entry.state.visible = false; expect(isOverKooda({ x: 124, y: 224 })).toBe(false);
  });
});

describe('dock state and context actions', () => {
  let store: OsStore; let unregister: () => void;
  beforeEach(() => { store = createOsStore(); unregister = registerStore(store); });
  afterEach(() => { unregister(); vi.unstubAllGlobals(); });
  const markup = (app: keyof typeof APP_META) => renderToStaticMarkup(createElement(Provider, { store }, createElement(DockItem, { app: APP_META[app] })));
  it('renders real links and switches Kooda from full to empty using its atom', () => {
    expect(markup('trash')).toContain('href="/kooda"'); expect(markup('trash')).toContain('#app-trash-full');
    store.set(koodaEmptyAtom, true); expect(markup('trash')).toContain('href="#app-trash"');
  });
  it('reads running, minimised and focused states from the store', () => {
    expect(markup('terminal')).not.toContain('os-dock-indicator');
    openApp('terminal'); expect(markup('terminal')).toContain('Running'); expect(markup('terminal')).toContain('aria-current="page"');
    store.set(desktopAtom, { type: 'MINIMIZE', id: 'terminal' });
    expect(markup('terminal')).toContain('Minimised'); expect(markup('terminal')).toContain('data-minimized="true"');
    expect(markup('terminal')).not.toContain('aria-current');
  });
  it('provides launch and simple-view actions for apps that are not running', () => {
    expect(dockMenuItems(APP_META.projects)).toEqual([
      { kind: 'item', label: 'Open', command: 'dock.open.projects' },
      { kind: 'item', label: 'Open in simple view', command: 'dock.simple.projects' },
    ]);
    runCommand('dock.open.projects', 'menu'); expect(store.get(desktopAtom).windows.projects).toBeDefined();
    const assign = vi.fn(); vi.stubGlobal('location', { assign });
    runCommand('dock.simple.writing', 'menu'); expect(assign).toHaveBeenCalledWith('/writing#simple');
  });
  it('lists only the target app windows and marks the focused one', () => {
    openApp('terminal'); openApp('terminal', { newInstance: true }); openApp('projects');
    runCommand('dock.focus.terminal~2', 'menu');
    const items = dockMenuItems(APP_META.terminal);
    expect(items.slice(0, 2)).toEqual([
      { kind: 'item', label: '✓ Terminal 2', command: 'dock.focus.terminal~2' },
      { kind: 'item', label: 'Terminal', command: 'dock.focus.terminal' },
    ]);
    expect(items).toContainEqual({ kind: 'item', label: 'Show all windows', command: 'dock.show.terminal' });
  });
  it('hides, shows and quits the target app independently of another focused app', async () => {
    openApp('terminal'); openApp('terminal', { newInstance: true }); openApp('projects');
    runCommand('dock.hide.terminal', 'menu');
    expect(store.get(desktopAtom).windows['terminal~2']?.minimized).toBe(true);
    expect(store.get(desktopAtom).windows.projects?.minimized).toBe(false);
    runCommand('dock.show.terminal', 'menu');
    expect(store.get(desktopAtom).windows.terminal?.minimized).toBe(false);
    runCommand('dock.quit.terminal', 'menu');
    await vi.waitFor(() => expect(store.get(desktopAtom).windows['terminal~2']?.closing).toBe(true));
    expect(store.get(desktopAtom).windows.projects?.closing).toBe(false);
  });
  it('requires confirmation to empty Kooda, and cancellation keeps it full', async () => {
    expect(dockMenuItems(APP_META.trash).map(value => 'label' in value ? value.label : '')).toEqual(['Open', 'Empty Kooda']);
    runCommand('dock.empty.trash', 'menu'); resolveAlert(store.get(alertsAtom)[0]!.id!, 'cancel');
    await Promise.resolve(); expect(store.get(koodaEmptyAtom)).toBe(false);
    runCommand('dock.empty.trash', 'menu'); resolveAlert(store.get(alertsAtom)[0]!.id!, 'primary');
    await Promise.resolve(); expect(store.get(koodaEmptyAtom)).toBe(true);
  });
  it('opens and copies whitelisted external URLs with the expected toast', async () => {
    const open = vi.fn(); const writeText = vi.fn(async () => {});
    vi.stubGlobal('window', { open }); vi.stubGlobal('navigator', { clipboard: { writeText } });
    runCommand('dock.linkOpen.github', 'menu'); expect(open).toHaveBeenCalledWith('https://github.com/theetaz', '_blank', 'noopener,noreferrer');
    runCommand('dock.linkCopy.github', 'menu'); await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('https://github.com/theetaz'); expect(store.get(toastsAtom).at(-1)?.title).toBe('Link copied');
    runCommand('dock.linkOpen.unknown', 'menu'); expect(open).toHaveBeenCalledTimes(1);
  });
});
