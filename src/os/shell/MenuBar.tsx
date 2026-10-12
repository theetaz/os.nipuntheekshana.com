import './MenuBar.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAtom, useAtomValue, useStore } from 'jotai';
import type { AppId, AppMenus } from '../types/apps';
import { focusedAppAtom, openMenuAtom } from '../state/atoms';
import { APP_META } from '../registry/meta';
import { loadApp } from '../registry/loader';
import type { ShellMenu } from '../registry/menus';
import { menuOutline, overflowMenus } from '../registry/menu-layout';
import { Workspaces } from './Workspaces';
import type { DesktopProps } from '../Desktop';
import { nextFocusIndex } from '../lib/focus';
import { IslandMenu } from './IslandMenu';
import { StatusItems } from './StatusItems';
import { useMenuHost } from './menu-host-state';

const loadingMenus: AppMenus = { view: [] };
function useFocusedMenus(appId: AppId | null): AppMenus {
  const store = useStore(); const [loaded, setLoaded] = useState<{ id: AppId; menus: AppMenus } | null>(null);
  useEffect(() => {
    if (!appId) return;
    let active = true;
    void loadApp(appId, store).then(module => { if (active) setLoaded({ id: appId, menus: module.menus ?? {} }); }, () => {});
    return () => { active = false; };
  }, [appId, store]);
  return loaded?.id === appId ? loaded.menus : loadingMenus;
}

export function MenuBar({ children, home, build }: { children?: ReactNode; home?: DesktopProps['home']; build?: DesktopProps['build'] }) {
  const appId = useAtomValue(focusedAppAtom); const definitions = useFocusedMenus(appId);
  const [open, setOpen] = useAtom(openMenuAtom); const [active, setActive] = useState('island');
  const nav = useRef<HTMLElement | null>(null); const measure = useRef<HTMLDivElement | null>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const menus = useMemo(() => menuOutline(appId ? APP_META[appId] : undefined, definitions), [appId, definitions]);
  const [space, setSpace] = useState<{ available: number; widths: number[]; more: number } | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      if (!nav.current || !measure.current) return;
      const widths = Array.from(measure.current.children).map(node => node.getBoundingClientRect().width);
      const more = widths.pop() ?? 52;
      setSpace({ available: Math.max(0, nav.current.clientWidth - (nav.current.querySelector('.mb-brand-module')?.clientWidth ?? 94) - 16), widths, more });
    };
    update(); const observer = new ResizeObserver(update);
    if (nav.current) observer.observe(nav.current);
    if (measure.current) observer.observe(measure.current);
    let mounted = true;
    void document.fonts.ready.then(() => { if (mounted) update(); });
    return () => { mounted = false; observer.disconnect(); };
  }, [menus]);
  const visible = useMemo(() => space ? overflowMenus(menus, space.widths, space.available, space.more) : menus, [menus, space]);
  const top = useMemo<readonly ShellMenu[]>(() => [{ id: 'island', label: 'Kottu menu', items: [] }, ...visible], [visible]);
  const anchors = useMemo(() => new Map(top.map(menu => [menu.id, { current: null as HTMLButtonElement | null }])), [top]);
  const move = useCallback((id: string, direction: 1 | -1) => {
    const next = top[nextFocusIndex(top.findIndex(menu => menu.id === id), direction, top.length)];
    if (!next) return;
    setActive(next.id); anchors.get(next.id)?.current?.focus(); setOpen(next.id);
  }, [top, anchors, setOpen]);
  const spec = useMemo(() => ({ menus: top, anchors, move, appId, definitions, version: build?.version }), [top, anchors, move, appId, definitions, build?.version]);
  useMenuHost(spec);
  useEffect(() => {
    const blur = () => setOpen(null);
    window.addEventListener('blur', blur); return () => window.removeEventListener('blur', blur);
  }, [setOpen]);
  useEffect(() => {
    if (!top.some(menu => menu.id === active)) setActive('island');
    if (open && !open.startsWith('status.') && !top.some(menu => menu.id === open)) setOpen(null);
  }, [top, active, open, setOpen]);
  return <header className="static-menubar mb-bar os-chrome">
    <nav ref={nav} className="mb-nav js-only" aria-label="Menu bar"><ul role="menubar" aria-label="Application menus" className="mb-menus"
      onKeyDown={event => {
        const index = top.findIndex(menu => menu.id === active); let next: ShellMenu | undefined;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = top[nextFocusIndex(index, event.key === 'ArrowRight' ? 1 : -1, top.length)];
        else if (event.key === 'Home') next = top[0]; else if (event.key === 'End') next = top.at(-1);
        else if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); setOpen(active); }
        else if (event.key === 'Escape') { event.preventDefault(); setOpen(null); }
        else if (event.key === 'Tab') setOpen(null);
        else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          const now = performance.now(); const text = (now - typeahead.current.at < 700 ? typeahead.current.text : '') + event.key.toLocaleLowerCase();
          typeahead.current = { text, at: now };
          const query = Array.from(text).every(letter => letter === text[0]) ? text[0]! : text;
          next = top.slice(index + 1).concat(top.slice(0, index + 1)).find(menu => menu.label.toLocaleLowerCase().startsWith(query));
        }
        if (next) { event.preventDefault(); setActive(next.id); anchors.get(next.id)?.current?.focus(); if (top.some(menu => menu.id === open)) setOpen(next.id); }
      }}>{[top.slice(0, 1), top.slice(1)].map((group, index) => <li key={index} role="none" className={`mb-module ${index ? 'mb-app-module' : 'mb-brand-module'}`}><ul role="none" className="mb-app-menus">{group.map(menu => {
        const props = { ref: anchors.get(menu.id), tabIndex: active === menu.id ? 0 : -1, 'aria-expanded': open === menu.id,
          'aria-controls': open === menu.id ? `shell-menu-${menu.id}` : undefined,
          onFocus: () => setActive(menu.id), onClick: () => setOpen(value => value === menu.id ? null : menu.id),
          onPointerEnter: () => { if (top.some(value => value.id === open)) { setActive(menu.id); setOpen(menu.id); } } };
        return <li key={menu.id} role="none">{menu.id === 'island' ? <IslandMenu {...props} />
          : <button {...props} type="button" role="menuitem" aria-haspopup="menu" className={`mb-trigger ${menu.strong ? 'mb-app' : ''}`}>{menu.label}</button>}</li>;
      })}</ul></li>)}</ul></nav>
    <Workspaces />
    {children}
    <a className="simple-entry" href="#simple">Simple view</a>
    <StatusItems home={home} />
    <div ref={measure} aria-hidden="true" className="mb-measure">{menus.map(menu => <span key={menu.id} className={`mb-trigger ${menu.strong ? 'mb-app' : ''}`}>{menu.label}</span>)}<span className="mb-trigger">More</span></div>
  </header>;
}
