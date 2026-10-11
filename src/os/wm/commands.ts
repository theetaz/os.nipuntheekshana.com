import { useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from 'jotai';
import { APP_META } from '../registry/meta';
import { loadApp } from '../registry/loader';
import { getStore, type OsStore } from '../state/store';
import { accentAtom, alertsAtom, announceAtom, bootPhaseAtom, contextMenuAtom, desktopAtom, geometryAtom,
  iconPositionsAtom, menuStateAtom, mochiPrefsAtom, openMenuAtom, overlayAtom, quickLookAtom, showWidgetsAtom,
  reducedMotionAtom, soundAtom, spotlightOpenAtom, themePrefAtom, toastsAtom, viewAtom, wallpaperAtom, WALLPAPERS,
  type AlertSpec, type AppMenuState, type Toast } from '../state/atoms';
import type { AppId, MenuItemSpec } from '../types/apps';
import { windowLink } from '../url/url';
import { placeWindow } from './placement';
import type { Point, Rect, SnapZone, WindowId, WMAction } from './types';
import type { SoundName } from '../lib/sound';
import * as mochi from '../mochi/api';
import { FEATURES } from '../config';
import { runDockCommand } from '../shell/DockItem';

export type CommandSource = 'menu' | 'shortcut' | 'spotlight' | 'terminal';
export type BeforeClose = () => Promise<boolean>;
interface Registrations {
  guards: Map<WindowId, Set<BeforeClose>>;
  handlers: Map<WindowId, (command: string) => boolean>;
  closing: Map<WindowId, Promise<boolean>>;
}
const registrations = new WeakMap<OsStore, Registrations>();
function registry(store: OsStore): Registrations {
  let entry = registrations.get(store);
  if (!entry) { entry = { guards: new Map(), handlers: new Map(), closing: new Map() }; registrations.set(store, entry); }
  return entry;
}
const dispatch = (action: WMAction) => getStore().set(desktopAtom, action);
// Keep the synthesiser outside the initial shell bundle and the muted path.
function playSound(name: SoundName): void {
  if (getStore().get(soundAtom)) void import('../lib/sound').then(sound => sound.playSound(name)).catch(() => {});
}
export function openApp(appId: AppId, opts: { route?: string; query?: Record<string, string>; origin?: Point; newInstance?: boolean } = {}): void {
  const store = getStore();
  const before = store.get(desktopAtom);
  store.set(desktopAtom, { type: 'OPEN', appId, ...opts,
    rect: placeWindow(APP_META[appId], before, store.get(geometryAtom)[appId] ?? null) });
  if (before === store.get(desktopAtom)) return;
  void loadApp(appId, store).catch(() => {});
  playSound('pop');
}
export function registerBeforeClose(store: OsStore, id: WindowId, guard: BeforeClose): () => void {
  const guards = registry(store).guards;
  const group = guards.get(id) ?? new Set<BeforeClose>();
  group.add(guard); guards.set(id, group);
  return () => { group.delete(guard); if (!group.size) guards.delete(id); };
}
/** Bind the captured window identity so an asynchronous guard cannot close a replacement window. */
export function closeWindow(id: WindowId): Promise<boolean> {
  const store = getStore();
  const entry = registry(store);
  const pending = entry.closing.get(id);
  if (pending) return pending;
  const win = store.get(desktopAtom).windows[id];
  if (!win || win.closing) return Promise.resolve(false);
  const closing = (async () => {
    let allowed = true;
    for (const guard of [...(entry.guards.get(id) ?? [])]) {
      try { if (!await guard()) allowed = false; }
      catch { allowed = false; }
    }
    if (!allowed) return false;
    if (store.get(desktopAtom).windows[id]?.createdSeq !== win.createdSeq) return false;
    store.set(desktopAtom, { type: 'CLOSE', id });
    playSound('tock');
    return true;
  })();
  entry.closing.set(id, closing);
  void closing.finally(() => entry.closing.delete(id));
  return closing;
}
export function minimizeWindow(id: WindowId): void { dispatch({ type: 'MINIMIZE', id }); playSound('swoosh'); }
export function restoreWindow(id: WindowId): void { dispatch({ type: 'RESTORE', id }); }
export function toggleMaximize(id: WindowId): void { dispatch({ type: 'TOGGLE_MAXIMIZE', id }); }
export function snapWindow(id: WindowId, zone: SnapZone): void { dispatch({ type: 'SNAP', id, zone }); }
export function focusWindow(id: WindowId): void { dispatch({ type: 'FOCUS', id }); }
export function cycleWindows(direction: 1 | -1): void { dispatch({ type: 'CYCLE', direction }); }
export async function quitApp(appId: AppId): Promise<void> {
  const store = getStore();
  for (const id of store.get(desktopAtom).order) if (store.get(desktopAtom).windows[id]?.appId === appId) await closeWindow(id);
}
export function showDesktop(): void { dispatch({ type: 'SHOW_DESKTOP' }); }
export function navigateWindow(id: WindowId, route: string,
  opts: { query?: Record<string, string>; title?: string; replace?: boolean } = {}): void {
  dispatch({ type: 'NAVIGATE', id, route, query: opts.query, title: opts.title, history: opts.replace ? 'replace' : 'push' });
}
export async function copyWindowLink(id: WindowId): Promise<void> {
  const win = getStore().get(desktopAtom).windows[id];
  if (!win) return;
  const link = windowLink(win, FEATURES.postcards ? { postcards: true } : {});
  if (!link) return;
  try { await navigator.clipboard.writeText(link); toast({ title: 'Link copied' }); }
  catch { toast({ title: "Couldn't copy the link", body: link }); }
}
export function useAppCommands(windowId: WindowId, handler: (command: string) => boolean): void {
  const store = useStore();
  const latest = useRef(handler); useLayoutEffect(() => { latest.current = handler; });
  useEffect(() => {
    const handlers = registry(store).handlers;
    const registered = (command: string) => latest.current(command);
    handlers.set(windowId, registered);
    return () => { if (handlers.get(windowId) === registered) handlers.delete(windowId); };
  }, [store, windowId]);
}
export function useAppMenuState(windowId: WindowId, state: AppMenuState): void {
  const store = useStore();
  useEffect(() => { store.set(menuStateAtom, prev => ({ ...prev, [windowId]: state })); }, [store, windowId, state]);
  useEffect(() => () => { store.set(menuStateAtom, prev => { const next = { ...prev }; delete next[windowId]; return next; }); }, [store, windowId]);
}
export function useBeforeClose(windowId: WindowId, guard: BeforeClose): void {
  const store = useStore(); const latest = useRef(guard);
  useLayoutEffect(() => { latest.current = guard; });
  useEffect(() => registerBeforeClose(store, windowId, () => latest.current()), [store, windowId]);
}
export function announce(text: string, politeness: 'polite' | 'assertive' = 'polite'): void {
  getStore().set(announceAtom, prev => ({ text, politeness, seq: prev.seq + 1 }));
}
let notificationSequence = 0;
export function toast(value: Toast): void {
  getStore().set(toastsAtom, prev => [...prev, { ...value, id: value.id ?? `toast-${++notificationSequence}` }].slice(-3));
}
export function alert(spec: AlertSpec): Promise<'primary' | 'cancel'> {
  const store = getStore();
  return new Promise(resolve => store.set(alertsAtom, prev => [...prev,
    { ...spec, id: spec.id ?? `alert-${++notificationSequence}`, resolve }]));
}
export function resolveAlert(id: string, result: 'primary' | 'cancel'): void {
  const store = getStore(); const spec = store.get(alertsAtom).find(value => value.id === id);
  store.set(alertsAtom, prev => prev.filter(value => value.id !== id)); spec?.resolve?.(result);
}
export function openContextMenu(spec: { x: number; y: number; items: readonly MenuItemSpec[]; target: string }): void {
  getStore().set(contextMenuAtom, spec);
}
export function openQuickLook({ slug, index, from }: { slug: string; index: number; from?: Rect | null }): void {
  if (!Number.isInteger(index) || index < 0) return;
  openApp('projects', { route: slug, query: { shot: String(index) } });
  getStore().set(quickLookAtom, { from: from ?? null });
}
export function closeQuickLook(): void {
  const store = getStore(); const desktop = store.get(desktopAtom);
  const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  if (win?.appId === 'projects') { const query = { ...win.query }; delete query.shot; store.set(desktopAtom, { type: 'SET_QUERY', id: win.id, query }); }
  store.set(quickLookAtom, null);
}
function focusRegion(selector: string): void {
  const region = document.querySelector<HTMLElement>(selector);
  if (!region) return;
  (region.querySelector<HTMLElement>('a[href], button, [tabindex="0"]') ?? region).focus();
}
async function power(action: 'restart' | 'shutdown'): Promise<void> {
  const store = getStore();
  const source = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (await alert({ title: action === 'restart' ? 'Restart Serendib?' : 'Shut down Serendib?',
    body: 'Open windows will close.', primary: action === 'restart' ? 'Restart' : 'Shut down' }) !== 'primary') return;
  const windows = [...store.get(desktopAtom).order].reverse();
  for (const [index, id] of windows.entries()) {
    if (!await closeWindow(id)) return;
    if (action === 'shutdown' && !store.get(reducedMotionAtom)) {
      await new Promise<void>(resolve => setTimeout(resolve, index === windows.length - 1 ? 140 : 60));
    }
  }
  store.set(desktopAtom, { type: 'CLOSE_ALL' });
  // Closing windows can temporarily return focus to their launchers. The power
  // overlay should remember the initiating control, independent of animation order.
  if (source?.isConnected && !source.closest('[inert], [hidden]')) source.focus({ preventScroll: true });
  if (action === 'restart') store.set(bootPhaseAtom, 'running');
  else store.set(overlayAtom, 'shutdown');
}
export function runCommand(command: string, _source: CommandSource): void {
  if (command.startsWith('dock.')) { runDockCommand(command); return; }
  const store = getStore(); const desktop = store.get(desktopAtom);
  const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  switch (command) {
    case 'window.close': if (win) void closeWindow(win.id); return;
    case 'window.minimize': if (win) minimizeWindow(win.id); return;
    case 'window.zoom': if (win) toggleMaximize(win.id); return;
    case 'window.snapLeft': if (win) snapWindow(win.id, 'left'); return;
    case 'window.snapRight': if (win) snapWindow(win.id, 'right'); return;
    case 'window.next': cycleWindows(1); return;
    case 'window.prev': cycleWindows(-1); return;
    case 'window.new': if (win && APP_META[win.appId].multiInstance) openApp(win.appId, { newInstance: true }); return;
    case 'window.copyLink': case 'window.copy-link': if (win) void copyWindowLink(win.id); return;
    case 'window.keyboardMove': if (win) document.dispatchEvent(new CustomEvent('window:keyboardMove', { detail: { windowId: win.id } })); return;
    case 'window.bringAllToFront': for (const id of desktop.order) focusWindow(id); return;
    case 'app.quit': if (win) void quitApp(win.appId); return;
    case 'app.hide': if (win) for (const value of Object.values(desktop.windows)) if (value.appId === win.appId) minimizeWindow(value.id); return;
    case 'app.about': if (win) void alert({ title: `About ${APP_META[win.appId].name}`, body: APP_META[win.appId].description, primary: 'OK' }); return;
    case 'desktop.show': showDesktop(); return;
    case 'desktop.cleanUp': store.set(iconPositionsAtom, {}); return;
    case 'desktop.wallpaper': openApp('settings', { query: { section: 'wallpaper' } }); return;
    case 'desktop.widgets': store.set(showWidgetsAtom, value => !value); return;
    case 'desktop.mochi': store.set(mochiPrefsAtom, value => ({ ...value, visible: !value.visible })); return;
    case 'os.spotlight': store.set(spotlightOpenAtom, true); return;
    case 'os.settings': openApp('settings'); return;
    case 'os.about': openApp('settings', { query: { section: 'about' } }); return;
    case 'os.readme': case 'os.shortcuts': openApp('readme'); return;
    case 'os.simpleView': store.set(viewAtom, 'simple'); return;
    case 'os.sleep': store.set(overlayAtom, 'screensaver'); return;
    case 'os.restart': void power('restart'); return;
    case 'os.shutdown': void power('shutdown'); return;
    case 'os.sound': store.set(soundAtom, value => !value); playSound('tick'); return;
    case 'os.escape':
      if (store.get(alertsAtom).length) { const spec = store.get(alertsAtom).at(-1)!; resolveAlert(spec.id!, 'cancel'); }
      else if (store.get(contextMenuAtom)) store.set(contextMenuAtom, null);
      else if (store.get(openMenuAtom)) store.set(openMenuAtom, null);
      else if (store.get(spotlightOpenAtom)) store.set(spotlightOpenAtom, false);
      else if (win?.appId === 'projects' && win.query.shot !== undefined) closeQuickLook();
      else if (store.get(overlayAtom) !== 'none') store.set(overlayAtom, 'none');
      return;
    case 'focus.menuBar': focusRegion('[data-shell="desktop"] [aria-label="Menu bar"]'); return;
    case 'focus.desktop': focusRegion('[data-shell="desktop"] [aria-label="Desktop"]'); return;
    case 'focus.dock': focusRegion('[data-shell] [aria-label="Dock"]'); return;
    case 'focus.window': if (win) focusRegion(`[data-window-id="${CSS.escape(win.id)}"]`); return;
    case 'focus.next': case 'focus.prev': return; // Window focus containment owns Tab.
    case 'os.contextMenu': document.activeElement?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return;
  }
  const [prefix, value] = command.split('.');
  if (prefix === 'theme' && ['auto', 'light', 'dark'].includes(value ?? '')) { store.set(themePrefAtom, value as 'auto' | 'light' | 'dark'); return; }
  if (prefix === 'wallpaper' && WALLPAPERS.includes(value as typeof WALLPAPERS[number])) { store.set(wallpaperAtom, value as typeof WALLPAPERS[number]); return; }
  if (prefix === 'accent' && ['thambili', 'lagoon', 'lotus', 'tea'].includes(value ?? '')) { store.set(accentAtom, value as 'thambili' | 'lagoon' | 'lotus' | 'tea'); return; }
  if (prefix === 'go' || prefix === 'open') {
    if (value === 'pin') openApp('maps', { route: 'play' });
    else if (Object.hasOwn(APP_META, value ?? '')) openApp(value as AppId);
    return;
  }
  if (prefix === 'mochi' && ['pet', 'sleep', 'wake', 'wave', 'hide', 'show'].includes(value ?? '')) {
    mochi[value as 'pet' | 'sleep' | 'wake' | 'wave' | 'hide' | 'show'](); return;
  }
  if (win && prefix === win.appId) registry(store).handlers.get(win.id)?.(command);
}
