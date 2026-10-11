import { matchRoute } from '../url/routes';
import type { AppId } from '../types/apps';

export const launchers = new WeakMap<Document, Map<AppId, WeakRef<HTMLElement>>>();
/** Capture the source before the link interceptor opens a window (including Safari clicks). */
export function trackWindowLaunches(document: Document): () => void {
  const click = (event: MouseEvent) => {
    const source = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!source || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL((source as HTMLAnchorElement).href, document.location.href);
    if (url.origin !== document.location.origin || url.hash === '#simple') return;
    const route = matchRoute(url.pathname);
    if (!route) return;
    let sources = launchers.get(document);
    if (!sources) { sources = new Map(); launchers.set(document, sources); }
    sources.set(route.appId, new WeakRef(source));
  };
  document.addEventListener('click', click, true);
  return () => document.removeEventListener('click', click, true);
}
