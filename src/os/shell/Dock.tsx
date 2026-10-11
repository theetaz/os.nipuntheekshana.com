import { useEffect, useLayoutEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { APP_META, DOCK_LINKS } from '../registry/meta';
import { reducedMotionAtom } from '../state/atoms';
import { nextFocusIndex } from '../lib/focus';
import { DockItem, DockExternalItem } from './DockItem';
import { DOCK_REST_SIZE, MAGNIFY_STEP, magnify, magnifyAtRest, stepMagnifySpring, type MagnifySpring } from './magnify';

const styles = `
  .os-dock { contain: layout style; }
  .os-dock::before { content: ''; position: absolute; inset: -24px 0 auto; height: 24px; }
  .os-dock[data-dock-mode="desktop"] ul { height: 64px; align-items: flex-end; }
  .os-dock li { flex-shrink: 0; }
  .os-dock .dock-divider { align-self: center; }
  .os-dock .os-dock-link { position: relative; width: 48px; height: 48px; text-decoration: none; }
  .os-dock-link > svg { width: 100%; height: 100%; }
  .os-dock-link:active { box-shadow: inset 0 0 0 1px var(--os-accent); }
  .os-dock[data-reduced-motion="true"] .os-dock-link:hover { outline: 1px solid var(--os-accent); outline-offset: 1px; }
  .os-dock-indicator { position: absolute; left: 50%; bottom: -7px; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: var(--os-ink); opacity: .7; }
  .os-dock-indicator[data-minimized="true"] { background: transparent; border: 1px solid var(--os-ink); }
  .os-dock-tooltip { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); z-index: var(--z-menus); width: max-content; max-width: 240px; padding: 3px 8px; border-radius: 6px; font: 500 11px/14px var(--font-ui); letter-spacing: .01em; color: var(--os-ink); background: var(--menu-bg); backdrop-filter: var(--menu-filter); box-shadow: var(--shadow-menu); pointer-events: none; visibility: hidden; }
  .os-dock-link:hover .os-dock-tooltip { visibility: visible; transition: visibility 0s 300ms !important; }
  .os-dock-link:focus-visible .os-dock-tooltip { visibility: visible; transition: none !important; }
  .os-dock-link[data-tooltip-dismissed] .os-dock-tooltip { visibility: hidden; transition: none !important; }
  .os-dock .os-dock-external { position: absolute; top: 0; right: 0; width: 9px; height: 9px; filter: none; visibility: hidden; color: var(--os-ink); background: var(--glass-bg); border-radius: 2px; }
  .os-dock-link:is(:hover, :focus-visible) .os-dock-external { visibility: visible; }
  .os-dock-link[data-kooda-over="true"] { outline: 2px solid var(--os-accent); outline-offset: 2px; }
  .os-dock[data-reduced-motion="false"] .os-dock-link[data-kooda-over="true"] > svg { transform: scale(1.1); }
  @supports not (backdrop-filter: blur(1px)) { .os-dock ul { background: var(--os-titlebar); } .os-dock-tooltip { background: var(--os-raised); } }
  html[data-transparency="reduce"] .os-dock ul { background: var(--os-titlebar); backdrop-filter: none; }
  html[data-transparency="reduce"] .os-dock-tooltip { background: var(--os-raised); backdrop-filter: none; }
  @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .os-dock ul { background: var(--os-titlebar); backdrop-filter: none; } .os-dock-tooltip { background: var(--os-raised); backdrop-filter: none; } }
  @media (forced-colors: active) { .os-dock ul, .os-dock-tooltip { background: Canvas; border: 1px solid CanvasText; } .os-dock-indicator { background: CanvasText; } .os-dock-indicator[data-minimized="true"] { background: Canvas; border-color: CanvasText; } }
`;

export function Dock({ mode = 'desktop' }: { mode?: 'desktop' | 'mobile' }) {
  const root = useRef<HTMLElement>(null); const toolbar = useRef<HTMLUListElement>(null);
  const reducedMotion = useAtomValue(reducedMotionAtom);
  const typeahead = useRef({ text: '', at: 0 });
  const apps = Object.values(APP_META).filter(app => app.phase === 'v1' && (mode === 'mobile' ? app.mobile.dockOrder !== null : app.dockOrder !== null && app.id !== 'trash'))
    .sort((a, b) => (mode === 'mobile' ? a.mobile.dockOrder! - b.mobile.dockOrder! : a.dockOrder! - b.dockOrder!));

  useLayoutEffect(() => {
    const nav = root.current; const list = toolbar.current;
    if (!nav || !list || mode !== 'desktop' || reducedMotion) return;
    const fine = matchMedia('(pointer: fine)');
    const elements = Array.from(list.querySelectorAll<HTMLAnchorElement>('[data-dock-item]'));
    let centres: number[] = [];
    let springs: MagnifySpring[] = [];
    let frame = 0; let previous = 0; let remainder = 0;
    const visibility = new MutationObserver(() => measure());
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; previous = 0; remainder = 0;
      for (const element of elements) { element.style.width = '48px'; element.style.height = '48px'; }
      springs = elements.map(() => ({ size: DOCK_REST_SIZE, target: DOCK_REST_SIZE, velocity: 0 }));
    };
    const measure = () => {
      reset();
      if (!nav.getClientRects().length) return;
      // Read once at rest (and on resize), never after a pointer update or an animation write.
      centres = elements.map(element => { const rect = element.getBoundingClientRect(); return rect.x + rect.width / 2; });
      visibility.disconnect();
    };
    const tick = (now: number) => {
      frame = 0;
      const elapsed = previous ? Math.min((now - previous) / 1000, 1 / 15) : MAGNIFY_STEP;
      previous = now; remainder += elapsed;
      const steps = Math.floor(remainder / MAGNIFY_STEP); remainder -= steps * MAGNIFY_STEP;
      for (let i = 0; i < steps; i++) springs = springs.map(stepMagnifySpring);
      for (let i = 0; i < elements.length; i++) {
        const size = `${springs[i]!.size}px`;
        elements[i]!.style.width = size; elements[i]!.style.height = size;
      }
      if (springs.some(spring => !magnifyAtRest(spring))) frame = requestAnimationFrame(tick);
      else { previous = 0; remainder = 0; }
    };
    const target = (x: number | null) => {
      springs = springs.map((spring, i) => ({ ...spring, target: x === null ? DOCK_REST_SIZE : magnify(x - centres[i]!) }));
      if (!frame && springs.some(spring => !magnifyAtRest(spring))) frame = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => { if (centres.length && fine.matches && event.pointerType !== 'touch') target(event.clientX); };
    const leave = () => target(null);
    const changed = () => measure();
    // The island starts hidden. Wait for the shell handoff before caching resting centres.
    visibility.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-mode'] });
    measure();
    nav.addEventListener('pointermove', move); nav.addEventListener('pointerleave', leave);
    window.addEventListener('resize', measure); window.addEventListener('blur', leave);
    fine.addEventListener('change', changed);
    return () => { visibility.disconnect(); reset(); nav.removeEventListener('pointermove', move); nav.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', measure); window.removeEventListener('blur', leave); fine.removeEventListener('change', changed); };
  }, [mode, reducedMotion]);

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.code === 'Escape') toolbar.current?.querySelectorAll<HTMLElement>('[data-dock-item]').forEach(element => { element.dataset.tooltipDismissed = ''; });
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, []);

  return <><style>{styles}</style><nav ref={root} className="static-dock os-dock os-chrome" aria-label="Dock"
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
