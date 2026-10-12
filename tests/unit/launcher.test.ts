import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'jotai';
import { getDockAnchor, isOverKooda, registerDockAnchor } from '../../src/os/shell/dock-anchors';
import { Dock } from '../../src/os/shell/Dock';
import { DockItem, DockExternalItem, dockMenuItems } from '../../src/os/shell/DockItem';
import { createOsStore, registerStore, type OsStore } from '../../src/os/state/store';
import { alertsAtom, desktopAtom, koodaEmptyAtom, toastsAtom } from '../../src/os/state/atoms';
import { openApp, resolveAlert, runCommand } from '../../src/os/wm/commands';
import { APP_META, DOCK_LINKS } from '../../src/os/registry/meta';

vi.mock('../../src/os/registry/loader', () => ({ loadApp: vi.fn(async () => ({})) }));

function anchor(x = 100, y = 200, width = 40, height = 40) {
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
    expect(getDockAnchor('projects')).toEqual({ x: 120, y: 220 }); cleanup(); cleanup();
    expect(getDockAnchor('projects')).toBeNull();
  });
  it('reads live geometry after the hover hop and viewport movement', () => {
    const entry = anchor(); cleanups.push(registerDockAnchor('projects', entry.element));
    entry.state.y = 193; entry.state.x = 130;
    expect(getDockAnchor('projects')).toEqual({ x: 150, y: 213 });
  });
  it('uses the visible shell and does not let old cleanup remove a replacement', () => {
    const desktop = anchor(); const mobile = anchor(20, 800); mobile.state.visible = false;
    const first = registerDockAnchor('terminal', desktop.element); cleanups.push(first, registerDockAnchor('terminal', mobile.element));
    expect(getDockAnchor('terminal')).toEqual({ x: 120, y: 220 });
    desktop.state.visible = false; mobile.state.visible = true;
    first(); expect(getDockAnchor('terminal')).toEqual({ x: 40, y: 820 });
    mobile.state.connected = false; expect(getDockAnchor('terminal')).toBeNull();
  });
  it('rejects hidden and inert ancestors', () => {
    const entry = anchor(); entry.state.hidden = true; cleanups.push(registerDockAnchor('maps', entry.element));
    expect(getDockAnchor('maps')).toBeNull();
  });
  it('keeps a repeated registration alive when an earlier cleanup runs', () => {
    const entry = anchor(); const first = registerDockAnchor('cv', entry.element);
    cleanups.push(first, registerDockAnchor('cv', entry.element));
    first(); expect(getDockAnchor('cv')).toEqual({ x: 120, y: 220 });
  });
  it('hit-tests the current Kooda bounds, including edges, and ignores absent targets', () => {
    expect(isOverKooda({ x: 100, y: 200 })).toBe(false);
    const entry = anchor(); cleanups.push(registerDockAnchor('trash', entry.element));
    for (const point of [{ x: 100, y: 200 }, { x: 140, y: 240 }, { x: 120, y: 220 }]) expect(isOverKooda(point)).toBe(true);
    expect(isOverKooda({ x: 141, y: 220 })).toBe(false); expect(isOverKooda({ x: NaN, y: 220 })).toBe(false);
    entry.state.visible = false; expect(isOverKooda({ x: 120, y: 220 })).toBe(false);
  });
});

describe('dock state and context actions', () => {
  let store: OsStore; let unregister: () => void;
  beforeEach(() => { store = createOsStore(); unregister = registerStore(store); });
  afterEach(() => { unregister(); vi.unstubAllGlobals(); });
  const markup = (app: keyof typeof APP_META) => renderToStaticMarkup(createElement(Provider, { store }, createElement(DockItem, { app: APP_META[app] })));
  it('keeps the launcher landmark, toolbar, thirteen real links and item order', () => {
    const html = renderToStaticMarkup(createElement(Provider, { store }, createElement(Dock)));
    expect(html).toContain('class="static-dock os-dock os-chrome k-launcher" aria-label="Dock"');
    expect(html).toContain('role="toolbar" aria-label="Apps" aria-orientation="horizontal"');
    expect([...html.matchAll(/data-dock-item="true"/g)]).toHaveLength(13);
    expect([...html.matchAll(/data-dock-app="([^"]+)"/g)].map(match => match[1])).toEqual([
      'projects', 'about', 'writing', 'messages', 'terminal', 'maps', 'activity', 'cv', 'settings', 'trash',
    ]);
    expect([...html.matchAll(/target="_blank" rel="noopener"/g)]).toHaveLength(3);
    expect([...html.matchAll(/class="dock-divider" aria-hidden="true"/g)]).toHaveLength(2);
  });
  it('preserves app and external item selectors, accessibility and symbol references', () => {
    expect(markup('projects')).toContain('data-dock-item="true" data-dock-app="projects" href="/projects"');
    expect(markup('projects')).toContain('width="40" height="40" viewBox="0 0 64 64" aria-hidden="true"');
    expect(markup('projects')).toContain('role="tooltip"');
    const external = renderToStaticMarkup(createElement(DockExternalItem, { link: DOCK_LINKS[0] }));
    expect(external).toContain('href="https://github.com/theetaz" aria-label="GitHub"');
    expect(external).toContain('target="_blank" rel="noopener"');
    expect(external).toContain('href="#link-github"');
  });
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
