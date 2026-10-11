import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { useAtomValue, useStore } from 'jotai';
import type { AppId, AppMeta, MenuItemSpec } from '../types/apps';
import { APP_META, DOCK_LINKS } from '../registry/meta';
import { appLoadAtom, desktopAtom, focusedAppAtom, koodaEmptyAtom, reducedMotionAtom, runningAtom } from '../state/atoms';
import { getStore } from '../state/store';
import { alert, focusWindow, minimizeWindow, openApp, openContextMenu, quitApp, toast } from '../wm/commands';
import { registerDockAnchor } from './dock-anchors';

type DockLink = typeof DOCK_LINKS[number];
const item = (label: string, command: string): MenuItemSpec => ({ kind: 'item', label, command });
const originFor = (element: HTMLElement) => { const rect = element.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; };

export function dockMenuItems(app: AppMeta): MenuItemSpec[] {
  if (app.id === 'trash') return [item('Open', 'dock.open.trash'), item('Empty Kooda', 'dock.empty.trash')];
  const state = getStore().get(desktopAtom);
  const windows = [...state.order].reverse().map(id => state.windows[id]!).filter(win => win.appId === app.id && !win.closing);
  if (!windows.length) return [item('Open', `dock.open.${app.id}`), item('Open in simple view', `dock.simple.${app.id}`)];
  return [...windows.map(win => item(`${win.id === state.focusedId ? '✓ ' : ''}${win.title}`, `dock.focus.${win.id}`)),
    { kind: 'separator' }, item('Show all windows', `dock.show.${app.id}`), item('Hide', `dock.hide.${app.id}`), item('Quit', `dock.quit.${app.id}`)];
}

/** Scoped commands keep a context menu's target independent of the currently focused app. */
export function runDockCommand(command: string): void {
  const [, action, ...parts] = command.split('.'); const id = parts.join('.');
  const link = DOCK_LINKS.find(value => value.id === id);
  if (action === 'linkOpen' && link) { window.open(link.href, '_blank', 'noopener,noreferrer'); return; }
  if (action === 'linkCopy' && link) { void copyLink(link); return; }
  const store = getStore(); const state = store.get(desktopAtom);
  if (action === 'focus') { if (state.windows[id] && !state.windows[id].closing) focusWindow(id); return; }
  if (!Object.hasOwn(APP_META, id)) return;
  const appId = id as AppId;
  const windows = state.order.filter(windowId => state.windows[windowId]?.appId === appId && !state.windows[windowId]?.closing);
  switch (action) {
    case 'open': openApp(appId); return;
    case 'simple': location.assign(`${APP_META[appId].basePath}#simple`); return;
    case 'show': for (const windowId of windows) focusWindow(windowId); return;
    case 'hide': for (const windowId of windows) minimizeWindow(windowId); return;
    case 'quit': void quitApp(appId); return;
    case 'empty':
      if (appId === 'trash') void alert({ title: 'Empty Kooda?', body: 'Nothing here is really deleted. These are just jokes.',
        primary: 'Empty', cancel: 'Cancel' }).then(result => { if (result === 'primary') store.set(koodaEmptyAtom, true); });
      return;
  }
}

async function copyLink(link: DockLink): Promise<void> {
  try { await navigator.clipboard.writeText(link.href); toast({ title: 'Link copied' }); }
  catch { toast({ title: "Couldn't copy the link", body: link.href }); }
}

function context(event: MouseEvent<HTMLAnchorElement>, target: string, items: readonly MenuItemSpec[]): void {
  event.preventDefault();
  const rect = event.currentTarget.getBoundingClientRect();
  // Keyboard contextmenu events carry a zero point; place them above the focused icon.
  const pointer = event.clientX !== 0 || event.clientY !== 0;
  openContextMenu({ x: pointer ? event.clientX : rect.x + rect.width / 2, y: pointer ? event.clientY : rect.y, items, target });
}

export function DockItem({ app, tabIndex = -1 }: { app: AppMeta; tabIndex?: number }) {
  const store = useStore(); const anchor = useRef<HTMLAnchorElement>(null);
  const animation = useRef<Animation | null>(null);
  const blink = useRef(false);
  const running = useAtomValue(runningAtom)[app.id]; const focused = useAtomValue(focusedAppAtom) === app.id;
  const empty = useAtomValue(koodaEmptyAtom); const reducedMotion = useAtomValue(reducedMotionAtom);
  const id = useId(); const statusId = `${id}-status`; const tooltipId = `${id}-tooltip`;
  const stopBounce = () => { animation.current?.cancel(); animation.current = null; if (anchor.current) delete anchor.current.dataset.bouncing; };
  useEffect(() => anchor.current ? registerDockAnchor(app.id, anchor.current) : undefined, [app.id]);
  useEffect(() => {
    const stopWhenReady = () => { if (store.get(appLoadAtom)[app.id] !== 'loading' || !store.get(runningAtom)[app.id]) stopBounce(); };
    const offLoad = store.sub(appLoadAtom, stopWhenReady); const offRunning = store.sub(runningAtom, stopWhenReady);
    return () => { offLoad(); offRunning(); stopBounce(); };
  }, [app.id, store]);
  useEffect(() => { if (reducedMotion) stopBounce(); }, [reducedMotion]);
  useEffect(() => {
    if (blink.current && running && anchor.current) {
      blink.current = false;
      anchor.current.querySelector('.os-dock-indicator')?.animate([{ opacity: .7 }, { opacity: .2 }, { opacity: .7 }], { duration: 120 });
    }
  }, [running]);

  const launch = (element: HTMLAnchorElement, newInstance: boolean) => {
    const before = store.get(desktopAtom); const loaded = store.get(appLoadAtom)[app.id] === 'ready';
    openApp(app.id, { origin: originFor(element), newInstance });
    if (before === store.get(desktopAtom) || loaded) return;
    stopBounce();
    if (reducedMotion) {
      blink.current = true;
    } else if (store.get(appLoadAtom)[app.id] === 'loading') {
      const icon = element.querySelector('svg'); if (!icon) return;
      element.dataset.bouncing = '';
      const bounce = icon.animate([{ transform: 'translateY(0)', easing: 'cubic-bezier(.22,1,.36,1)' },
        { transform: 'translateY(-14px)', offset: .5, easing: 'cubic-bezier(.4,0,1,1)' }, { transform: 'translateY(0)' }], { duration: 450, iterations: 3 });
      animation.current = bounce;
      void bounce.finished.then(() => { if (animation.current === bounce) { animation.current = null; delete element.dataset.bouncing; } }, () => {});
    }
  };

  return <a ref={anchor} className="os-dock-link" data-dock-item data-dock-app={app.id} href={app.basePath}
    aria-label={app.name} tabIndex={tabIndex} aria-current={focused ? 'page' : undefined} data-pressed={focused}
    aria-describedby={[running ? statusId : null, tooltipId].filter(Boolean).join(' ')}
    onContextMenu={event => context(event, `dock:${app.id}`, dockMenuItems(app))}
    onClick={event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      const state = store.get(desktopAtom);
      const windows = [...state.order].reverse().map(windowId => state.windows[windowId]!).filter(win => win.appId === app.id && !win.closing);
      // Option always creates a new Terminal, including while its first window is focused.
      if (!windows.length || (event.altKey && app.multiInstance)) { launch(event.currentTarget, event.altKey && app.multiInstance); return; }
      const top = windows[0]!;
      if (app.id !== 'trash' && state.focusedId === top.id) {
        if (windows.length === 1) minimizeWindow(top.id);
        else focusWindow(windows[1]!.id);
      } else focusWindow(top.id);
    }}>
    <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href={`#${app.id === 'trash' ? empty ? 'app-trash' : 'app-trash-full' : app.icon}`} /></svg>
    {running && <><span className="os-dock-indicator" aria-hidden="true" data-minimized={running.allMinimized} />
      <span className="sr-only" id={statusId}>{running.allMinimized ? 'Minimised' : 'Running'}</span></>}
    <span className="os-dock-tooltip" role="tooltip" id={tooltipId}>{app.name}</span>
  </a>;
}

export function DockExternalItem({ link }: { link: DockLink }) {
  const tooltipId = useId();
  return <a className="os-dock-link" data-dock-item href={link.href} aria-label={link.label} tabIndex={-1}
    target="_blank" rel="noopener noreferrer" aria-describedby={tooltipId}
    onClick={event => { if (event.button === 0 && event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); void copyLink(link); } }}
    onContextMenu={event => context(event, `dock:link:${link.id}`, [item('Open', `dock.linkOpen.${link.id}`), item('Copy link', `dock.linkCopy.${link.id}`)])}>
    <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href={`#${link.icon}`} /></svg>
    <svg className="os-dock-external" viewBox="0 0 9 9" aria-hidden="true" focusable="false"><path d="M2 7 7 2M2 2h5v5" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
    <span className="os-dock-tooltip" role="tooltip" id={tooltipId}>{link.label}</span>
  </a>;
}
