import './DesktopIcons.css';
import { atom, useAtom, useAtomValue, useStore } from 'jotai';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { APP_META } from '../registry/meta';
import { alertsAtom, contextMenuAtom, desktopAtom, focusedIdAtom, iconPositionsAtom, openMenuAtom, overlayAtom, reducedMotionAtom, spotlightOpenAtom } from '../state/atoms';
import { pathFor } from '../url/routes';
import { openApp, openContextMenu } from '../wm/commands';
import type { AppId } from '../types/apps';
import type { Point } from '../wm/types';
import { deferredPointer } from '../lib/deferred-pointer';
import { canPrefetch } from '../registry/loader';

const apps = Object.values(APP_META).filter(app => app.phase === 'v1' && app.desktopIcon)
  .sort((a, b) => a.desktopIcon!.order - b.desktopIcon!.order);
import { desktopSelectionAtom } from './desktop-selection';
export { desktopSelectionAtom } from './desktop-selection';
const viewportAtom = atom(get => get(desktopAtom).viewport);


export function DesktopIcons() {
  const store = useStore(); const [selected, setSelected] = useAtom(desktopSelectionAtom);
  const positions = useAtomValue(iconPositionsAtom); const viewport = useAtomValue(viewportAtom);
  const [active, setActive] = useState<AppId>(apps[0]!.id);
  const nodes = useRef(new Map<AppId, HTMLAnchorElement>());
  const anchor = useRef<AppId>(apps[0]!.id); const cancelDrag = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false); const typeahead = useRef({ text: '', at: 0, egg: '' });
  const controlClick = useRef(false); const animations = useRef(new Set<Animation>());
  const focus = (id: AppId) => { setActive(id); nodes.current.get(id)?.focus({ preventScroll: true }); };
  const select = (id: AppId, toggle = false, range = false) => {
    if (range) {
      const from = apps.findIndex(app => app.id === anchor.current); const to = apps.findIndex(app => app.id === id);
      const ids = apps.slice(Math.min(from, to), Math.max(from, to) + 1).map(app => app.id);
      setSelected(previous => toggle ? [...new Set([...previous, ...ids])] : ids);
    } else { anchor.current = id; setSelected(previous => toggle ? previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id] : [id]); }
    focus(id);
  };
  const open = (id: AppId, origin?: Point) => openApp(id, { route: APP_META[id].desktopIcon!.route ?? '', origin });
  const context = (id: AppId, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    // macOS reports Control-click as contextmenu instead of click; selection was handled on pointerdown.
    if (event.ctrlKey && controlClick.current) return;
    store.set(desktopAtom, { type: 'FOCUS_DESKTOP' });
    if (!store.get(desktopSelectionAtom).includes(id)) select(id); else focus(id);
    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenu({ target: `desktop:${id}`, x: event.clientX || rect.x + rect.width / 2, y: event.clientY || rect.bottom,
      items: [{ kind: 'item', label: 'Open', command: id === 'maps' ? 'go.pin' : `open.${id}` },
        { kind: 'separator' }, { kind: 'item', label: 'Clean up icons', command: 'desktop.cleanUp' }] });
  };
  const startDrag = (id: AppId, event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    cancelDrag.current?.(); suppressClick.current = false;
    const element = event.currentTarget; const native = event.nativeEvent;
    cancelDrag.current = deferredPointer(element, native, () => import('./desktop-icon-drag').then(module =>
      () => module.startIconDrag(store, element, id, native, nodes, anchor, suppressClick, animations, setSelected, focus,
        () => { cancelDrag.current = null; })), next => {
      if (Math.hypot(next.clientX - native.clientX, next.clientY - native.clientY) >= 4) suppressClick.current = true;
    });
  };
  useEffect(() => {
    const unsubscribe = store.sub(reducedMotionAtom, () => { if (store.get(reducedMotionAtom)) for (const animation of animations.current) animation.cancel(); });
    return () => { unsubscribe(); cancelDrag.current?.(); for (const animation of animations.current) animation.cancel(); };
  }, [store]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.key.length !== 1 || !/^[a-z0-9 .]$/i.test(event.key)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable], [role="textbox"], [role="dialog"], [role="menu"], [role="menubar"], [aria-label="Dock"]')) return;
      if (store.get(focusedIdAtom) || store.get(contextMenuAtom) || store.get(openMenuAtom) || store.get(spotlightOpenAtom) || store.get(alertsAtom).length || store.get(overlayAtom) !== 'none') return;
      event.preventDefault();
      const now = performance.now(); const previous = now - typeahead.current.at < 700 ? typeahead.current.text : '';
      const text = previous + event.key.toLocaleLowerCase();
      const egg = (now - typeahead.current.at < 1500 ? typeahead.current.egg : '') + event.key.toLocaleLowerCase();
      typeahead.current = { text, at: now, egg: egg.slice(-8) };
      if (egg.endsWith('ayubowan')) document.dispatchEvent(new CustomEvent('ayubowan', { bubbles: true }));
      const query = [...text].every(letter => letter === text[0]) ? text[0]! : text;
      const current = apps.findIndex(app => app.id === active);
      const ordered = apps.slice(current + 1).concat(apps.slice(0, current + 1));
      const match = ordered.find(app => app.desktopIcon!.label.toLocaleLowerCase().startsWith(query));
      if (match) select(match.id);
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [store, active]);
  return <nav aria-label="Desktop icons" className="os-chrome"><div className="desktop-icons" role="listbox" aria-label="Desktop" aria-multiselectable="true">
    <ul role="presentation">{apps.map(app => {
      const position = positions[app.id];
      return <li key={app.id} role="presentation"><a ref={node => { if (node) nodes.current.set(app.id, node); else nodes.current.delete(app.id); }}
        role="option" aria-selected={selected.includes(app.id)} tabIndex={active === app.id ? 0 : -1}
        data-desktop-icon={app.id} data-positioned={position ? '' : undefined}
        style={position ? { right: 24 + Math.max(0, Math.min(viewport.w - 132, position.x)), top: 48 + Math.max(0, Math.min(viewport.h - 224, position.y)) } : undefined}
        href={pathFor(app.id, app.desktopIcon!.route ?? '')} draggable={false}
        onFocus={() => { setActive(app.id); if (canPrefetch()) void import('./desktop-icon-drag').catch(() => {}); }}
        onPointerEnter={() => { if (canPrefetch()) void import('./desktop-icon-drag').catch(() => {}); }} onPointerDown={event => {
          controlClick.current = event.ctrlKey && event.button === 0;
          if (controlClick.current) { store.set(desktopAtom, { type: 'FOCUS_DESKTOP' }); select(app.id, true, event.shiftKey); }
          startDrag(app.id, event);
        }} onContextMenu={event => context(app.id, event)}
        onClick={event => {
          event.preventDefault(); if (suppressClick.current) { suppressClick.current = false; return; }
          if (event.ctrlKey && controlClick.current) { controlClick.current = false; return; }
          store.set(desktopAtom, { type: 'FOCUS_DESKTOP' }); select(app.id, event.metaKey || event.ctrlKey, event.shiftKey);
          if ('pointerType' in event.nativeEvent && event.nativeEvent.pointerType === 'touch') open(app.id, { x: event.clientX, y: event.clientY });
        }} onDoubleClick={event => { event.preventDefault(); if (!suppressClick.current) open(app.id, { x: event.clientX, y: event.clientY }); }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); for (const id of selected.length ? selected : [app.id]) open(id); }
          else if (event.key === ' ' && !event.altKey) { event.preventDefault(); select(app.id, event.metaKey || event.ctrlKey, event.shiftKey); }
          else if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
            event.preventDefault(); store.set(desktopAtom, { type: 'FOCUS_DESKTOP' });
            const rect = event.currentTarget.getBoundingClientRect(); const direction = event.key;
            const candidates = apps.filter(candidate => candidate.id !== app.id).map(candidate => ({ id: candidate.id, rect: nodes.current.get(candidate.id)!.getBoundingClientRect() }))
              .filter(candidate => direction === 'ArrowDown' ? candidate.rect.y > rect.y + 1 : direction === 'ArrowUp' ? candidate.rect.y < rect.y - 1 : direction === 'ArrowLeft' ? candidate.rect.x < rect.x - 1 : candidate.rect.x > rect.x + 1)
              .sort((a, b) => Math.hypot(a.rect.x - rect.x, a.rect.y - rect.y) - Math.hypot(b.rect.x - rect.x, b.rect.y - rect.y));
            const next = direction === 'Home' ? apps[0]!.id : direction === 'End' ? apps.at(-1)!.id : candidates[0]?.id;
            if (next) { if ((event.ctrlKey || event.metaKey) && !event.shiftKey) focus(next); else select(next, event.ctrlKey || event.metaKey, event.shiftKey); }
          }
        }}><svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><use href={`#${app.desktopIcon!.icon}`} /></svg><span>{app.desktopIcon!.label}</span></a></li>;
    })}</ul>
  </div></nav>;
}
