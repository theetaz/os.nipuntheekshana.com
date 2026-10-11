import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { atom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { desktopAtom, menuStateAtom, mochiPrefsAtom, openMenuAtom, showWidgetsAtom, themePrefAtom, wallpaperAtom } from '../state/atoms';
import { APP_META } from '../registry/meta';
import { getItemState, windowItems, type ShellMenu } from '../registry/menus';
import { VERSION } from '../config';
import { alert, focusWindow, openApp, runCommand } from '../wm/commands';
import { Menu } from '../ui/Menu';

export interface MenuHostSpec {
  menus: readonly ShellMenu[]; anchors: ReadonlyMap<string, RefObject<HTMLButtonElement | null>>;
  version?: string; move(id: string, direction: 1 | -1): void;
}
const hostsAtom = atom<ReadonlyMap<object, MenuHostSpec>>(new Map());
export function useMenuHost(spec: MenuHostSpec): void {
  const setHosts = useSetAtom(hostsAtom); const store = useStore(); const owner = useRef({});
  useLayoutEffect(() => { setHosts(previous => new Map(previous).set(owner.current, spec)); }, [setHosts, spec]);
  useEffect(() => () => {
    setHosts(previous => { const next = new Map(previous); next.delete(owner.current); return next; });
    store.set(openMenuAtom, null);
  }, [setHosts, store]);
}

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
  const hosts = useAtomValue(hostsAtom); const spec = Array.from(hosts.values()).at(-1);
  const open = useAtomValue(openMenuAtom); const setOpen = useSetAtom(openMenuAtom);
  const desktop = useAtomValue(desktopAtom); const states = useAtomValue(menuStateAtom);
  const theme = useAtomValue(themePrefAtom); const wallpaper = useAtomValue(wallpaperAtom);
  const widgets = useAtomValue(showWidgetsAtom); const mochi = useAtomValue(mochiPrefsAtom);
  const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  const meta = win ? APP_META[win.appId] : undefined;
  const current = spec?.menus.find(menu => menu.id === open);
  const last = useRef<{ menu: ShellMenu; spec: MenuHostSpec } | null>(null);
  if (current && spec) last.current = { menu: current, spec };
  const shown = current && spec ? { menu: current, spec } : last.current;
  if (!shown) return null;
  const anchor = shown.spec.anchors.get(shown.menu.id);
  const state = (command: string) => getItemState(command, { desktop, appState: win ? states[win.id] : undefined,
    theme, wallpaper, widgets, mochi: mochi.visible, zoomable: meta?.window.zoomable ?? false,
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
