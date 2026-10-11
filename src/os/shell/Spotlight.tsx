import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue, useStore } from 'jotai';
import { AnimatePresence, m, useIsPresent } from 'motion/react';
import { alertsAtom, desktopAtom, koodaEmptyAtom, recentAtom, reducedMotionAtom, resolvedThemeAtom, spotlightOpenAtom } from '../state/atoms';
import { alert, announce, openApp, runCommand, toast } from '../wm/commands';
import { useAppData } from '../lib/fetch-json';
import { nextFocusIndex, trapTab } from '../lib/focus';
import { springs } from '../lib/springs';
import { canPrefetch, prefetchApp } from '../registry/loader';
import type { AppIconId } from '../types/apps';
import type { SearchEntry } from '../types/content';
import { AppIcon } from '../ui/AppIcon';
import { useOverlayHost } from '../ui/Overlay';
import { useModalFocus } from './Alerts';
import { spotlightGroups } from './spotlight-rank';
import './p2-8-overlays.css';

function SpotlightPanel() {
  const store = useStore(); const [, setOpen] = useAtom(spotlightOpenAtom);
  const [recent, setRecent] = useAtom(recentAtom); const reduce = useAtomValue(reducedMotionAtom);
  const alerts = useAtomValue(alertsAtom); const host = useOverlayHost();
  const panel = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(''); const [active, setActive] = useState(0);
  const { data, error, retry } = useAppData<SearchEntry[]>('spotlight:search', '/data/search.json');
  const groups = useMemo(() => spotlightGroups(data ?? [], query, recent), [data, query, recent]);
  const entries = groups.flatMap(group => group.entries); const selected = entries[active];
  const id = useId(); const listId = `${id}-results`;
  const present = useIsPresent();
  useModalFocus(panel, present && !alerts.length, host);
  useEffect(() => { panel.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active, query, data]);
  useEffect(() => { if (data) announce(`${entries.length} search results`); }, [data, query]);
  const close = () => setOpen(false);
  const activate = async (entry: SearchEntry) => {
    setRecent(values => [entry.id, ...values.filter(value => value !== entry.id)].slice(0, 5));
    close();
    const target = entry.target;
    if (target.type === 'app') { openApp(target.appId, { route: target.route }); return; }
    if (target.type === 'href') {
      const link = document.createElement('a'); link.href = target.href; link.download = ''; link.click(); return;
    }
    switch (target.action) {
      case 'theme': runCommand(`theme.${store.get(resolvedThemeAtom) === 'dark' ? 'light' : 'dark'}`, 'spotlight'); break;
      case 'email':
        try { await navigator.clipboard.writeText(entry.subtitle); toast({ title: 'Email copied' }); }
        catch { toast({ title: "Couldn't copy the email", body: entry.subtitle }); }
        break;
      case 'mochi': runCommand('mochi.wake', 'spotlight'); break;
      case 'wallpaper': runCommand('os.settings', 'spotlight');
        { const desktop = store.get(desktopAtom);
          if (desktop.focusedId) store.set(desktopAtom, { type: 'SET_QUERY', id: desktop.focusedId, query: { section: 'wallpaper' } }); }
        break;
      case 'simple': runCommand('os.simpleView', 'spotlight'); break;
      case 'trash':
        if (await alert({ title: 'Empty Kooda?', body: 'The basket will be cleared for this visit.', primary: 'Empty Kooda', danger: true }) === 'primary') {
          store.set(koodaEmptyAtom, true); toast({ title: 'Kooda emptied' });
        }
        break;
    }
  };
  let row = 0;
  const content = <m.div className="os-modal-layer os-spotlight-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
    onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <m.div ref={panel} className="os-spotlight" role="dialog" aria-modal="true" aria-label="Spotlight search" tabIndex={-1} inert={!present || !!alerts.length}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      transition={reduce ? { duration: 0.1 } : springs.popover}
      onKeyDown={event => {
        event.stopPropagation(); trapTab(event, event.currentTarget);
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        else if (event.target === input.current && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); if (entries.length) setActive(index => nextFocusIndex(index, event.key === 'ArrowDown' ? 1 : -1, entries.length));
        } else if (event.target === input.current && event.key === 'Enter' && selected) { event.preventDefault(); void activate(selected); }
      }}>
      <div className="os-spotlight-input">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
        <input ref={input} data-autofocus data-os-shortcuts="allow" role="combobox" aria-label="Search projects, writing, apps" aria-autocomplete="list"
          aria-expanded="true" aria-controls={listId} aria-activedescendant={selected ? `${id}-option-${active}` : undefined}
          autoComplete="off" spellCheck={false} placeholder="Search projects, writing, apps…" value={query}
          onChange={event => { setQuery(event.target.value); setActive(0); }} />
        {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); setActive(0); input.current?.focus(); }}>×</button>}
        <button type="button" className="os-spotlight-close" aria-label="Close Spotlight" onClick={close}>×</button>
      </div>
      <div id={listId} role="listbox" aria-label="Search results" aria-busy={!data && !error} className="os-spotlight-results">
        {groups.map((group, groupIndex) => <div key={group.label} role="group" aria-labelledby={`${id}-group-${groupIndex}`}>
          <div id={`${id}-group-${groupIndex}`} role="presentation" aria-hidden="true" className="os-spotlight-group">{group.label}</div>
          {group.entries.map(entry => {
            const index = row++;
            return <div key={`${group.label}-${entry.id}`} id={`${id}-option-${index}`} role="option" aria-selected={active === index} data-entry-id={entry.id}
              className="os-spotlight-option" onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()}
              onClick={() => void activate(entry)} onMouseEnter={() => { if (entry.target.type === 'app' && canPrefetch()) prefetchApp(entry.target.appId, store); }}>
              <AppIcon size={20} icon={entry.icon.startsWith('project:') ? 'app-projects' : entry.icon as AppIconId} />
              <span className="text-ui-strong truncate">{entry.title}</span><span className="os-spotlight-subtitle">{entry.subtitle}</span>
            </div>;
          })}
        </div>)}
      </div>
      {error ? <div className="os-spotlight-message"><p>Search couldn’t load. Please try again.</p><button type="button" onClick={retry}>Try again</button></div>
        : !data ? <p className="os-spotlight-message" role="status">Loading search…</p>
          : !entries.length && <p className="os-spotlight-message">Nothing for "{query}". Try "map", "Go" or "Sinhala".</p>}
      <p className="os-spotlight-footer">↑↓ to move · Return to open · Esc to close</p>
    </m.div>
  </m.div>;
  return host ? createPortal(content, host) : null;
}

export function Spotlight() {
  const open = useAtomValue(spotlightOpenAtom);
  return <AnimatePresence>{open && <SpotlightPanel />}</AnimatePresence>;
}
