import './Dock.css';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { postcardsAvailableAtom } from '../state/features';
import { APP_META, DOCK_LINKS } from '../registry/meta';
import { reducedMotionAtom } from '../state/atoms';
import { nextFocusIndex } from '../lib/focus';
import { DockItem, DockExternalItem } from './DockItem';


export function Dock({ mode = 'desktop' }: { mode?: 'desktop' | 'mobile' }) {
  const root = useRef<HTMLElement>(null); const toolbar = useRef<HTMLUListElement>(null);
  const postcards = useAtomValue(postcardsAvailableAtom);
  const reducedMotion = useAtomValue(reducedMotionAtom);
  const typeahead = useRef({ text: '', at: 0 });
  const apps = Object.values(APP_META).filter(app => app.phase === 'v1' && (app.id !== 'guestbook' || postcards) && (mode === 'mobile' ? app.mobile.dockOrder !== null : app.dockOrder !== null && app.id !== 'trash'))
    .sort((a, b) => (mode === 'mobile' ? a.mobile.dockOrder! - b.mobile.dockOrder! : a.dockOrder! - b.dockOrder!));

  useLayoutEffect(() => {
    const nav = root.current; const list = toolbar.current;
    if (!nav || !list || mode !== 'desktop' || reducedMotion) return;
    let disposed = false; let cleanup: (() => void) | undefined; let loading = false; let x = 0; let inside = false;
    const load = () => {
      if (loading) return; loading = true;
      void import('./dock-magnification').then(module => {
        if (!disposed) cleanup = module.magnifyDock(nav, list, inside ? x : NaN);
      }).catch(() => { loading = false; });
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !matchMedia('(pointer: fine)').matches) return;
      x = event.clientX; inside = true; load();
    };
    const move = (event: PointerEvent) => { x = event.clientX; if (!loading) enter(event); };
    const leave = () => { inside = false; };
    nav.addEventListener('pointerenter', enter); nav.addEventListener('pointermove', move); nav.addEventListener('pointerleave', leave);
    // Install input before the shell is revealed and warm this small controller
    // for fine pointers; cold module latency must not consume the hover spring.
    if (matchMedia('(pointer: fine)').matches) load();
    return () => { disposed = true; cleanup?.(); nav.removeEventListener('pointerenter', enter); nav.removeEventListener('pointermove', move); nav.removeEventListener('pointerleave', leave); };
  }, [mode, reducedMotion]);

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.code === 'Escape') toolbar.current?.querySelectorAll<HTMLElement>('[data-dock-item]').forEach(element => { element.dataset.tooltipDismissed = ''; });
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, []);

  return <><nav ref={root} className="static-dock os-dock os-chrome" aria-label="Dock"
    data-dock-mode={mode} data-reduced-motion={reducedMotion}>
    <ul ref={toolbar} role="toolbar" aria-label="Apps" aria-orientation="horizontal"
      onFocusCapture={event => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-dock-item]');
        if (!link) return;
        toolbar.current?.querySelectorAll<HTMLAnchorElement>('[data-dock-item]').forEach(element => { element.tabIndex = element === link ? 0 : -1; });
        delete link.dataset.tooltipDismissed;
      }} onPointerOver={event => {
        const link = (event.target as HTMLElement).closest<HTMLElement>('[data-dock-item]');
        if (link && (!(event.relatedTarget instanceof Node) || !link.contains(event.relatedTarget))) delete link.dataset.tooltipDismissed;
      }} onKeyDown={event => {
        if (event.altKey || event.metaKey || event.ctrlKey) return;
        const items = Array.from(toolbar.current?.querySelectorAll<HTMLAnchorElement>('[data-dock-item]') ?? []);
        const active = items.findIndex(element => element === document.activeElement);
        let index: number | undefined;
        if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') index = nextFocusIndex(active, event.code === 'ArrowLeft' ? -1 : 1, items.length);
        else if (event.code === 'Home') index = 0;
        else if (event.code === 'End') index = items.length - 1;
        else if (event.key.length === 1 && event.key !== ' ') {
          const now = performance.now(); const previous = now - typeahead.current.at < 700 ? typeahead.current.text : '';
          const text = previous + event.key.toLocaleLowerCase(); typeahead.current = { text, at: now };
          const query = [...text].every(letter => letter === text[0]) ? text[0]! : text;
          const ordered = items.slice(active + 1).concat(items.slice(0, active + 1));
          const match = ordered.find(element => element.getAttribute('aria-label')?.toLocaleLowerCase().startsWith(query));
          if (match) index = items.indexOf(match);
        }
        if (index !== undefined) { event.preventDefault(); event.stopPropagation(); items[index]?.focus(); }
      }}>
      {apps.map((app, i) => <li role="presentation" key={app.id}><DockItem app={app} tabIndex={i === 0 ? 0 : -1} /></li>)}
      {mode === 'desktop' && <><li role="presentation" className="dock-divider" aria-hidden="true" />
        {DOCK_LINKS.map(link => <li role="presentation" key={link.id}><DockExternalItem link={link} /></li>)}
        <li role="presentation" className="dock-divider" aria-hidden="true" /><li role="presentation"><DockItem app={APP_META.trash} /></li></>}
    </ul>
  </nav></>;
}
