import { APP_META } from '../registry/meta';
import { RESET } from 'jotai/utils';
import { prefetchApp } from '../registry/loader';
import { getStore } from '../state/store';
import { viewAtom } from '../state/atoms';
import { openApp } from '../wm/commands';
import { matchRoute } from './routes';
import { queryFor } from './url';
import type { AppId } from '../types/apps';
import { postcardsAvailableAtom } from '../state/features';

export interface LinkEvent {
  defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean;
}
export interface LinkAnchor {
  href: string; hasAttribute(name: string): boolean; getAttribute(name: string): string | null;
  closest(selector: string): unknown;
}
export type LinkDecision = { kind: 'native' } | { kind: 'simple'; href: string }
  | { kind: 'external'; href: string } | { kind: 'app'; appId: AppId; route: string; query: Record<string, string> };
export function classifyLink(event: LinkEvent, anchor: LinkAnchor, location: URL, postcards = false): LinkDecision {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || anchor.hasAttribute('download') || (anchor.getAttribute('target') && anchor.getAttribute('target') !== '_self')
    || /(?:^|\s)external(?:\s|$)/i.test(anchor.getAttribute('rel') ?? '')) return { kind: 'native' };
  let url: URL;
  try { url = new URL(anchor.href, location); } catch { return { kind: 'native' }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { kind: 'native' };
  if (url.origin !== location.origin) return anchor.closest('[data-window-id], #static-window')
    ? { kind: 'external', href: url.href } : { kind: 'native' };
  if (url.hash === '#simple') return { kind: 'simple', href: url.href };
  const matched = matchRoute(url.pathname);
  if (!matched || (matched.appId === 'guestbook' ? !postcards : APP_META[matched.appId].phase !== 'v1')) return { kind: 'native' };
  // Same-document anchors remain useful inside prose and long documents.
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return { kind: 'native' };
  return { kind: 'app', ...matched, query: queryFor(matched.appId, Object.fromEntries(url.searchParams)) };
}
function anchorFor(target: EventTarget | null): HTMLAnchorElement | null {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return element?.closest<HTMLAnchorElement>('a[href]') ?? null;
}
export function interceptLinks(document: Document, window: Window): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered: HTMLAnchorElement | null = null;
  const clear = () => { clearTimeout(timer); hovered = null; };
  const click = (event: MouseEvent) => {
    const anchor = anchorFor(event.target); if (!anchor) return;
    if (anchor.hasAttribute('data-simple-back') && !event.defaultPrevented && event.button === 0
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      // Fragment navigation also clears :target; replaceState alone leaves the reading CSS active.
      if (window.location.hash) window.location.replace('#');
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      getStore().set(viewAtom, RESET);
      return;
    }
    const decision = classifyLink(event, anchor, new URL(window.location.href), getStore().get(postcardsAvailableAtom));
    if (decision.kind === 'native') return;
    if (decision.kind === 'simple') {
      getStore().set(viewAtom, 'simple');
      // A different document must still supply its own static reading content.
      if (new URL(decision.href).pathname === window.location.pathname) { event.preventDefault(); window.history.replaceState(window.history.state, '', decision.href); }
    } else if (getStore().get(viewAtom) !== 'simple') {
      event.preventDefault();
      if (decision.kind === 'external') window.open(decision.href, '_blank', 'noopener,noreferrer');
      else openApp(decision.appId, { route: decision.route, query: decision.query, origin: { x: event.clientX, y: event.clientY } });
    }
  };
  const intent = (event: Event) => {
    const anchor = anchorFor(event.target); if (!anchor || anchor === hovered) return;
    clear();
    const decision = classifyLink({ defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }, anchor, new URL(window.location.href), getStore().get(postcardsAvailableAtom));
    if (decision.kind !== 'app') return;
    hovered = anchor;
    timer = setTimeout(() => prefetchApp(decision.appId), 80);
  };
  const leave = (event: Event) => {
    const related = (event as MouseEvent).relatedTarget;
    if (hovered && (!(related instanceof Node) || !hovered.contains(related))) clear();
  };
  const hashchange = () => { if (window.location.hash === '#simple') getStore().set(viewAtom, 'simple'); };
  window.addEventListener('hashchange', hashchange);
  document.addEventListener('click', click);
  document.addEventListener('pointerover', intent); document.addEventListener('focusin', intent);
  document.addEventListener('pointerout', leave); document.addEventListener('focusout', leave);
  return () => { clear(); window.removeEventListener('hashchange', hashchange); document.removeEventListener('click', click);
    document.removeEventListener('pointerover', intent); document.removeEventListener('focusin', intent);
    document.removeEventListener('pointerout', leave); document.removeEventListener('focusout', leave); };
}
