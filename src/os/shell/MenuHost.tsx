import { postcardsAvailableAtom } from '../state/features';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { desktopAtom, menuStateAtom, mochiPrefsAtom, openMenuAtom, showWidgetsAtom, themePrefAtom, wallpaperAtom } from '../state/atoms';
import { APP_META } from '../registry/meta';
import { appMenus, desktopMenus, islandMenu, getItemState, windowItems, type ShellMenu } from '../registry/menus';
import { VERSION } from '../config';
import { alert, focusWindow, openApp, playSound, runCommand } from '../wm/commands';
import { Menu } from '../ui/Menu';

import { hostsAtom, type MenuHostSpec } from './menu-host-state';
export { useMenuHost, type MenuHostSpec } from './menu-host-state';

/** App-prefixed commands continue through the focused window's useAppCommands handler. */
function routeMenuCommand(command: string): void {
  if (command.startsWith('window.focus:')) {
    focusWindow(command.slice(13)); return;
  }
  if (command === 'os.shortcuts') { openApp('readme', { query: { section: 'shortcuts' } }); return; }
  if (command === 'help.source') { window.open('https://github.com/theetaz/os.nipuntheekshana.com', '_blank', 'noopener,noreferrer'); return; }
  if (command === 'help.report') { location.href = 'mailto:theekshana2@gmail.com?subject=Serendib%3A%20problem%20report'; return; }
  runCommand(command, 'menu');
}
export function MenuHost() {
  const postcards = useAtomValue(postcardsAvailableAtom);
  const hosts = useAtomValue(hostsAtom); const spec = Array.from(hosts.values()).at(-1);
  const open = useAtomValue(openMenuAtom); const setOpen = useSetAtom(openMenuAtom);
  const desktop = useAtomValue(desktopAtom); const states = useAtomValue(menuStateAtom);
  const theme = useAtomValue(themePrefAtom); const wallpaper = useAtomValue(wallpaperAtom);
  const widgets = useAtomValue(showWidgetsAtom); const mochi = useAtomValue(mochiPrefsAtom);
  const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  const meta = win ? APP_META[win.appId] : undefined;
  const outline = spec?.menus.find(menu => menu.id === open);
  const definitions = spec?.appId ? appMenus(APP_META[spec.appId], spec.definitions) : desktopMenus();
  const current = outline && { ...outline, items: outline.id === 'island' ? islandMenu()
    : outline.id === 'more' ? definitions.filter(menu => !spec?.menus.some(visible => visible.id === menu.id))
      .map(menu => ({ kind: 'submenu' as const, label: menu.label, items: menu.items }))
    : definitions.find(menu => menu.id === outline.id)?.items ?? outline.items };
  useEffect(() => { if (current) playSound('tick'); }, [current?.id]);
  const last = useRef<{ menu: ShellMenu; spec: MenuHostSpec } | null>(null);
  if (current && spec) last.current = { menu: current, spec };
  const shown = current && spec ? { menu: current, spec } : last.current;
  if (!shown) return null;
  const anchor = shown.spec.anchors.get(shown.menu.id);
  const state = (command: string) => getItemState(command, { desktop, appState: win ? states[win.id] : undefined,
    theme, wallpaper, widgets, postcards, mochi: mochi.visible, zoomable: meta?.window.zoomable ?? false,
    resizable: meta?.window.resizable ?? false });
  const horizontal = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[role="menu"]') !== event.currentTarget) return;
    if (event.key === 'ArrowRight' && (event.target as HTMLElement).getAttribute('aria-haspopup') === 'menu') return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault(); event.stopPropagation();
    shown.spec.move(shown.menu.id, event.key === 'ArrowRight' ? 1 : -1);
  };
  return <Menu key={shown.menu.id} id={`shell-menu-${shown.menu.id}`} items={shown.menu.items} label={shown.menu.label}
    open={!!current} anchorRef={anchor} getItemState={state} windowItems={windowItems(desktop)} onKeyDown={horizontal}
    onClose={() => setOpen(null)} onCommand={command => {
      if (state(command).disabled) return;
      anchor?.current?.focus();
      if (command === 'app.about' && meta) {
        void alert({ title: `About ${meta.name}`, body: `${meta.description}\nVersion ${spec?.version ?? VERSION}`, primary: 'OK' }); return;
      }
      routeMenuCommand(command);
    }} />;
}
