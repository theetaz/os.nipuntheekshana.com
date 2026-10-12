import { WALLPAPERS, WALLPAPER_NAMES } from '../state/prefs';
import type { AppMenus, AppMeta, MenuItemSpec, Shortcut } from '../types/apps';
import type { DesktopState } from '../wm/types';
import type { AppMenuState } from '../state/atoms';

export interface ShellMenu { id: string; label: string; items: readonly MenuItemSpec[]; strong?: boolean }
const separator: MenuItemSpec = { kind: 'separator' };
const item = (label: string, command: string, shortcut?: Shortcut, role?: 'checkbox' | 'radio'): MenuItemSpec =>
  ({ kind: 'item', label, command, ...(shortcut && { shortcut }), ...(role && { role }) });
const alt = (code: string, shift?: boolean): Shortcut => ({ code, alt: true, ...(shift && { shift }) });

export function islandMenu(): readonly MenuItemSpec[] {
  return [item('About Kottu OS', 'os.about'), item('Settings…', 'os.settings', alt('Comma')),
    item('Simple view', 'os.simpleView'), item('Keyboard shortcuts', 'os.shortcuts'), separator,
    item('Suspend', 'os.sleep'), item('Reboot…', 'os.restart'), item('Power off…', 'os.shutdown')];
}
export function appMenu(meta: AppMeta): readonly MenuItemSpec[] {
  return [item(`About ${meta.name}`, 'app.about'), item('Settings…', 'os.settings', alt('Comma')), separator,
    item(`Hide ${meta.name}`, 'app.hide'), item(`Quit ${meta.name}`, 'app.quit', alt('KeyQ'))];
}
export function fileMenu(meta?: AppMeta, extra: readonly MenuItemSpec[] = []): readonly MenuItemSpec[] {
  return [...(meta?.multiInstance ? [item('New window', 'window.new', alt('KeyN'))] : []),
    item('Open…', 'os.spotlight', { code: 'KeyK', mod: true }), ...extra, separator,
    item('Copy link to window', 'window.copyLink'), item('Close window', 'window.close', alt('KeyW'))];
}
export const defaultView: readonly MenuItemSpec[] = [
  { kind: 'submenu', label: 'Wallpaper', items: WALLPAPERS.map(id => item(WALLPAPER_NAMES[id], `wallpaper.${id}`, undefined, 'radio')) },
  item('Show Mochi', 'desktop.mochi', undefined, 'checkbox'),
  item('Clean up desktop', 'desktop.cleanUp'), separator,
  item('Light', 'theme.light', undefined, 'radio'), item('Dark', 'theme.dark', undefined, 'radio'),
  item('Automatic', 'theme.auto', undefined, 'radio'),
];
export function viewMenu(items: readonly MenuItemSpec[] = defaultView): readonly MenuItemSpec[] { return items; }
export function goMenu(): readonly MenuItemSpec[] {
  return [item('Projects', 'go.projects'), item('Writing', 'go.writing'), item('About', 'go.about'), item('CV', 'go.cv'),
    item('Now', 'go.now'), item('Activity', 'go.activity'), item('Island', 'go.maps'), item('Terminal', 'go.terminal'),
    item('Messages', 'go.messages'), item('Postcards', 'go.guestbook'), separator, item('Pin the city', 'go.pin'), item('Kooda', 'go.trash')];
}
export function windowMenu(): readonly MenuItemSpec[] {
  return [item('Minimise', 'window.minimize', alt('KeyM')), item('Maximise', 'window.zoom', alt('KeyZ')),
    item('Snap left', 'window.snapLeft', alt('BracketLeft')), item('Snap right', 'window.snapRight', alt('BracketRight')),
    item('Move & resize with keyboard', 'window.keyboardMove'), separator, item('Next window', 'window.next', alt('Backquote')),
    item('Previous window', 'window.prev', alt('Backquote', true)), item('Bring all to front', 'window.bringAllToFront'),
    separator, { kind: 'windows' }];
}
export function helpMenu(): readonly MenuItemSpec[] {
  return [item('Read me', 'os.readme'), item('Keyboard shortcuts', 'os.shortcuts'), item('Simple view', 'os.simpleView'),
    separator, item('View source on GitHub ↗', 'help.source'), item('Report a problem ↗', 'help.report')];
}
export function desktopMenus(): readonly ShellMenu[] {
  return [{ id: 'app', label: 'Kottu OS', strong: true, items: islandMenu() },
    { id: 'file', label: 'File', items: fileMenu() }, { id: 'view', label: 'View', items: viewMenu() },
    { id: 'go', label: 'Go', items: goMenu() }, { id: 'window', label: 'Window', items: windowMenu() },
    { id: 'help', label: 'Help', items: helpMenu() }];
}
export function appMenus(meta: AppMeta, menus: AppMenus = {}): readonly ShellMenu[] {
  return [{ id: 'app', label: meta.name, strong: true, items: appMenu(meta) },
    { id: 'file', label: 'File', items: fileMenu(meta, menus.file) }, { id: 'view', label: 'View', items: viewMenu(menus.view) },
    ...(menus.extra ?? []).map((menu, index) => ({ ...menu, id: `extra-${index}` })),
    { id: 'go', label: 'Go', items: goMenu() }, { id: 'window', label: 'Window', items: windowMenu() },
    { id: 'help', label: 'Help', items: helpMenu() }];
}
export function windowItems(desktop: DesktopState): readonly MenuItemSpec[] {
  return desktop.order.flatMap(id => {
    const win = desktop.windows[id];
    const title = win?.appId === 'terminal' ? `Terminal${id.includes('~') ? ` ${id.split('~')[1]}` : ''}` : win?.title;
    return !win || win.closing ? [] : [item(`${win.minimized ? '◇ ' : ''}${title}`, `window.focus:${id}`, undefined, 'checkbox')];
  });
}
export interface MenuStateContext {
  desktop: DesktopState; appState?: AppMenuState; theme: 'light' | 'dark' | 'auto'; wallpaper: string;
  widgets: boolean; mochi: boolean; postcards?: boolean; zoomable: boolean; resizable: boolean;
}
export function getItemState(command: string, context: MenuStateContext): { disabled?: boolean; checked?: boolean } {
  if (command === 'go.guestbook') return { disabled: !context.postcards };
  const { desktop } = context;
  const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  if (command.startsWith('window.focus:')) return { checked: command.slice(13) === desktop.focusedId };
  if (command.startsWith('theme.')) return { checked: command.slice(6) === context.theme };
  if (command.startsWith('wallpaper.')) return { checked: command.slice(10) === context.wallpaper };
  if (command === 'desktop.widgets') return { checked: context.widgets };
  if (command === 'desktop.mochi') return { checked: context.mochi };
  if (['window.next', 'window.prev', 'window.bringAllToFront'].includes(command))
    return { disabled: !desktop.order.some(id => !desktop.windows[id]?.closing) };
  if (command.startsWith('window.') || command.startsWith('app.')) {
    const disabled = !win || win.closing || (command === 'window.zoom' && !context.zoomable)
      || (['window.snapLeft', 'window.snapRight', 'window.keyboardMove'].includes(command) && !context.resizable);
    return { disabled };
  }
  return context.appState?.[command] ?? {};
}

export { overflowMenus } from './menu-layout';
