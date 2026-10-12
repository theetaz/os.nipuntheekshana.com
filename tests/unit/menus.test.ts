import { afterEach, describe, expect, it, vi } from 'vitest';
import { appMenu, appMenus, desktopMenus, fileMenu, getItemState, goMenu, helpMenu, islandMenu,
  overflowMenus, viewMenu, windowItems, windowMenu, type MenuStateContext } from '../../src/os/registry/menus';
import { APP_META } from '../../src/os/registry/meta';
import type { MenuItemSpec } from '../../src/os/types/apps';
import { createDesktopState } from '../../src/os/wm/types';
import { wmReducer } from '../../src/os/wm/reducer';
import { clockText, nextMinuteDelay } from '../../src/os/shell/ClockPopover';
import { shortcutLabel } from '../../src/os/ui/MenuItem';
import { isMac } from '../../src/os/lib/platform';

const labels = (items: readonly MenuItemSpec[]) => items.map(item => 'label' in item ? item.label : item.kind);
const context = (): MenuStateContext => ({ desktop: createDesktopState(), theme: 'auto', wallpaper: 'galle-face',
  widgets: true, mochi: false, zoomable: true, resizable: true });
afterEach(() => vi.unstubAllGlobals());
describe('menu builders', () => {
  it('matches the island menu including separators and the settings shortcut', () => {
    expect(labels(islandMenu())).toEqual(['About Kottu OS', 'Settings…', 'Simple view',
      'Keyboard shortcuts', 'separator', 'Suspend', 'Reboot…', 'Power off…']);
    expect(islandMenu()[1]).toMatchObject({ command: 'os.settings', shortcut: { code: 'Comma', alt: true } });
  });
  it('builds desktop menus and every specified desktop View item', () => {
    expect(desktopMenus().map(menu => menu.label)).toEqual(['Kottu OS', 'File', 'View', 'Go', 'Window', 'Help']);
    expect(labels(viewMenu())).toEqual(['Wallpaper', 'Show Mochi', 'Clean up desktop', 'separator', 'Light', 'Dark', 'Automatic']);
    const wallpaper = viewMenu()[0]; expect(wallpaper?.kind).toBe('submenu');
    if (wallpaper?.kind === 'submenu') expect(labels(wallpaper.items)).toEqual(['Kottu', 'Galle Face', 'Pettah', 'Paper']);
  });
  it('builds app, File and app-specific menus without losing standard commands', () => {
    expect(labels(appMenu(APP_META.projects))).toEqual(['About Projects', 'Settings…', 'separator', 'Hide Projects', 'Quit Projects']);
    expect(labels(fileMenu(APP_META.projects))).toEqual(['Open…', 'separator', 'Copy link to window', 'Close window']);
    expect(labels(fileMenu(APP_META.terminal))).toEqual(['New window', 'Open…', 'separator', 'Copy link to window', 'Close window']);
    const extra: MenuItemSpec[] = [{ kind: 'item', label: 'Export', command: 'projects.export' }];
    const menus = appMenus(APP_META.projects, { view: extra, file: extra, extra: [{ label: 'Tools', items: extra }] });
    expect(menus.map(menu => menu.label)).toEqual(['Projects', 'File', 'View', 'Tools', 'Go', 'Window', 'Help']);
    expect(labels(menus[1]!.items)).toEqual(['Open…', 'Export', 'separator', 'Copy link to window', 'Close window']);
    expect(menus[2]!.items).toBe(extra); expect(viewMenu([])).toEqual([]);
  });
  it('matches Go, Window and Help and keeps region jumps out of Go', () => {
    expect(labels(goMenu())).toEqual(['Projects', 'Writing', 'About', 'CV', 'Now', 'Activity', 'Island', 'Terminal', 'Messages', 'Postcards', 'separator', 'Pin the city', 'Kooda']);
    expect(goMenu().some(item => item.kind === 'item' && item.shortcut)).toBe(false);
    expect(labels(windowMenu())).toEqual(['Minimise', 'Maximise', 'Snap left', 'Snap right', 'Move & resize with keyboard',
      'separator', 'Next window', 'Previous window', 'Bring all to front', 'separator', 'windows']);
    expect(labels(helpMenu())).toEqual(['Read me', 'Keyboard shortcuts', 'Simple view', 'separator', 'View source on GitHub ↗', 'Report a problem ↗']);
  });
  it('expands windows with instance titles, minimised markers and a focused check', () => {
    let desktop = wmReducer(createDesktopState(), { type: 'OPEN', appId: 'terminal' });
    desktop = wmReducer(desktop, { type: 'OPEN', appId: 'terminal', newInstance: true });
    desktop = wmReducer(desktop, { type: 'MINIMIZE', id: 'terminal' });
    expect(labels(windowItems(desktop))).toEqual(['◇ Terminal', 'Terminal 2']);
    expect(getItemState('window.focus:terminal~2', { ...context(), desktop })).toEqual({ checked: true });
    desktop = wmReducer(desktop, { type: 'CLOSE', id: 'terminal' });
    expect(labels(windowItems(desktop))).toEqual(['Terminal 2']);
  });
  it('resolves preference checks, window capabilities and focused app flags', () => {
    expect(getItemState('go.guestbook', context())).toEqual({ disabled: true });
    expect(getItemState('go.guestbook', { ...context(), postcards: true })).toEqual({ disabled: false });
    expect(getItemState('window.close', context())).toEqual({ disabled: true });
    expect(getItemState('window.next', context())).toEqual({ disabled: true });
    expect(getItemState('theme.auto', context())).toEqual({ checked: true });
    expect(getItemState('wallpaper.pettah', context())).toEqual({ checked: false });
    expect(getItemState('desktop.widgets', context())).toEqual({ checked: true });
    expect(getItemState('desktop.mochi', context())).toEqual({ checked: false });
    const state = { ...context(), desktop: wmReducer(createDesktopState(), { type: 'OPEN', appId: 'settings' }),
      zoomable: false, resizable: false, appState: { 'settings.export': { disabled: true }, 'settings.list': { checked: true } } };
    expect(getItemState('window.zoom', state)).toEqual({ disabled: true });
    expect(getItemState('window.keyboardMove', state)).toEqual({ disabled: true });
    expect(getItemState('window.close', state)).toEqual({ disabled: false });
    expect(getItemState('settings.export', state)).toEqual({ disabled: true });
    expect(getItemState('settings.list', state)).toEqual({ checked: true });
  });
  it('overflows trailing menus, retains every command and recovers at full width', () => {
    const menus = desktopMenus(); const widths = [90, 45, 55, 40, 80, 50];
    expect(overflowMenus(menus, widths, 500, 55)).toBe(menus);
    const collapsed = overflowMenus(menus, widths, 210, 55);
    expect(collapsed.map(menu => menu.label)).toEqual(['Kottu OS', 'File', 'More']);
    expect(labels(collapsed.at(-1)!.items)).toEqual(['View', 'Go', 'Window', 'Help']);
    expect(overflowMenus(menus, widths, 0, 55).map(menu => menu.label)).toEqual(['Kottu OS', 'More']);
  });
});
describe('clock and shortcut labels', () => {
  it.each([[0, 60_000], [1, 59_999], [59_999, 1], [60_001, 59_999], [-1, 1]])('aligns %i to the next minute', (timestamp, delay) => {
    expect(nextMinuteDelay(timestamp)).toBe(delay);
  });
  it('formats Colombo time using the actual weekday and half-hour offset', () => {
    expect(clockText(new Date('2026-10-11T17:41:00Z'), 'en-GB', true)).toBe('LK Sun 11 Oct  23:11');
  });
  it('uses navigator platform precedence and renders Mac/Alt hints including brackets', () => {
    vi.stubGlobal('navigator', { userAgentData: { platform: 'macOS' }, platform: 'Linux' }); expect(isMac()).toBe(true);
    vi.stubGlobal('navigator', { platform: 'Win32' }); expect(isMac()).toBe(false);
    for (const [code, key] of [['KeyW', 'W'], ['BracketLeft', '['], ['BracketRight', ']'], ['Comma', ',']]) {
      expect(shortcutLabel({ code: code!, alt: true }, true)).toBe(`⌥${key}`);
      expect(shortcutLabel({ code: code!, alt: true })).toBe(`Alt+${key}`);
    }
  });
});
