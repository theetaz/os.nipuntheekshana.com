import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAtom, useAtomValue, useStore } from 'jotai';
import type { AppId, AppMenus } from '../types/apps';
import { focusedAppAtom, openMenuAtom } from '../state/atoms';
import { APP_META } from '../registry/meta';
import { loadApp } from '../registry/loader';
import { appMenus, desktopMenus, islandMenu, overflowMenus, type ShellMenu } from '../registry/menus';
import { ISLAND_PATH, ISLAND_VIEWBOX } from '../icons/island-glyph';
import type { DesktopProps } from '../Desktop';
import { nextFocusIndex } from '../lib/focus';
import { IslandMenu } from './IslandMenu';
import { StatusItems } from './StatusItems';
import { useMenuHost } from './MenuHost';

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
const styles = `
  .static-menubar.mb-bar { height:32px; padding:0 10px; gap:0; border-bottom:1px solid var(--glass-edge); box-shadow:inset 0 1px 0 var(--glass-border); -webkit-backdrop-filter:var(--glass-filter); }
  .mb-bar nav.mb-nav { display:flex; align-items:center; gap:0; min-width:0; flex:1; }
  .mb-menus { display:flex; align-items:center; margin:0; padding:0; list-style:none; white-space:nowrap; min-width:0; }
  .mb-trigger { display:flex; align-items:center; justify-content:center; height:24px; padding:0 10px; border:0; border-radius:6px; color:var(--os-ink); font:450 13px/18px var(--font-ui); white-space:nowrap; cursor:default; }
  .mb-trigger[aria-expanded="true"], .mb-status-button[aria-expanded="true"] { background:var(--os-pressed); }
  .mb-trigger.mb-app { font-weight:600; max-width:150px; overflow:hidden; text-overflow:ellipsis; display:block; }
  .mb-status { margin-left:auto; display:flex; align-items:center; gap:2px; flex-shrink:0; }
  .mb-status-button { display:grid; place-items:center; width:24px; height:24px; border-radius:6px; color:var(--os-ink); }
  .mb-now-dot { width:7px; height:7px; border-radius:50%; background:var(--os-success); box-shadow:0 0 0 3px color-mix(in oklch, var(--os-success) 22%, transparent); animation:mb-now-pulse 2.4s ease-in-out infinite; }
  @keyframes mb-now-pulse { 50% { box-shadow:0 0 0 5px color-mix(in oklch, var(--os-success) 0%, transparent); } }
  @media (prefers-reduced-motion:reduce) { .mb-now-dot { animation:none; } }
  html[data-motion="reduce"] .mb-now-dot { animation:none; }
  .mb-clock { font-variant-numeric:tabular-nums; min-width:11em; padding:0 8px 0 10px; }
  .mb-clock time { white-space:pre; }
  .mb-measure { position:absolute; visibility:hidden; pointer-events:none; display:flex; white-space:nowrap; }
  .mb-bar .simple-entry { margin:0 8px; flex-shrink:0; }
  @media (max-width:759px), (pointer:coarse) { .static-menubar.mb-bar { height:calc(52px + env(safe-area-inset-top)); padding:env(safe-area-inset-top) 16px 0; } .mb-bar nav.mb-nav, .mb-status, .mb-measure, .mb-bar .simple-entry { display:none; } .mb-bar .mb-pocket-brand { display:flex; } }
  @media (min-width:760px) and (pointer:fine) { .mb-pocket-brand { display:none; } }
`;
export function MenuBar({ children, home, build }: { children?: ReactNode; home?: DesktopProps['home']; build?: DesktopProps['build'] }) {
  const appId = useAtomValue(focusedAppAtom); const definitions = useFocusedMenus(appId);
  const [open, setOpen] = useAtom(openMenuAtom); const [active, setActive] = useState('island');
  const nav = useRef<HTMLElement | null>(null); const measure = useRef<HTMLDivElement | null>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const menus = useMemo(() => appId ? appMenus(APP_META[appId], definitions) : desktopMenus(), [appId, definitions]);
  const [space, setSpace] = useState<{ available: number; widths: number[]; more: number } | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      if (!nav.current || !measure.current) return;
      const widths = Array.from(measure.current.children).map(node => node.getBoundingClientRect().width);
      const more = widths.pop() ?? 52;
      setSpace({ available: Math.max(0, nav.current.clientWidth - 31), widths, more });
    };
    update(); const observer = new ResizeObserver(update);
    if (nav.current) observer.observe(nav.current);
    if (measure.current) observer.observe(measure.current);
    let mounted = true;
    void document.fonts.ready.then(() => { if (mounted) update(); });
    return () => { mounted = false; observer.disconnect(); };
  }, [menus]);
  const visible = useMemo(() => space ? overflowMenus(menus, space.widths, space.available, space.more) : menus, [menus, space]);
  const top = useMemo<readonly ShellMenu[]>(() => [{ id: 'island', label: 'Island menu', items: islandMenu() }, ...visible], [visible]);
  const anchors = useMemo(() => new Map(top.map(menu => [menu.id, { current: null as HTMLButtonElement | null }])), [top]);
  const move = useCallback((id: string, direction: 1 | -1) => {
    const next = top[nextFocusIndex(top.findIndex(menu => menu.id === id), direction, top.length)];
    if (!next) return;
    setActive(next.id); anchors.get(next.id)?.current?.focus(); setOpen(next.id);
  }, [top, anchors, setOpen]);
  const spec = useMemo(() => ({ menus: top, anchors, move, version: build?.version }), [top, anchors, move, build?.version]);
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
    <style>{styles}</style>
    <a className="serendib-brand no-js-only" href="/" aria-label="Serendib home"><svg width="11" height="18" viewBox={ISLAND_VIEWBOX} aria-hidden="true"><path d={ISLAND_PATH} fill="currentColor" /></svg><span>Serendib</span></a>
    <a href="/" className="serendib-brand mb-pocket-brand js-only" aria-label="Serendib home">Serendib</a>
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
      }}>{top.map(menu => {
        const props = { ref: anchors.get(menu.id), tabIndex: active === menu.id ? 0 : -1, 'aria-expanded': open === menu.id,
          'aria-controls': open === menu.id ? `shell-menu-${menu.id}` : undefined,
          onFocus: () => setActive(menu.id), onClick: () => setOpen(value => value === menu.id ? null : menu.id),
          onPointerEnter: () => { if (top.some(value => value.id === open)) { setActive(menu.id); setOpen(menu.id); } } };
        return <li key={menu.id} role="none">{menu.id === 'island' ? <IslandMenu {...props} />
          : <button {...props} type="button" role="menuitem" aria-haspopup="menu" className={`mb-trigger ${menu.strong ? 'mb-app' : ''}`}>{menu.label}</button>}</li>;
      })}</ul></nav>
    {children ?? <nav className="no-js-only" aria-label="Site pages"><a href="/projects">Projects</a><a href="/writing">Writing</a><a href="/about">About</a><a href="/cv">CV</a><a href="/now">Now</a></nav>}
    <a className="simple-entry" href="#simple">Simple view</a>
    <StatusItems home={home} />
    <div ref={measure} aria-hidden="true" className="mb-measure">{menus.map(menu => <span key={menu.id} className={`mb-trigger ${menu.strong ? 'mb-app' : ''}`}>{menu.label}</span>)}<span className="mb-trigger">More</span></div>
  </header>;
}
