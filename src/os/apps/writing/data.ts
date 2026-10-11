import type { ClientPost, ClientPostSummary } from '../../types/content';

export type Folder = 'all' | ClientPostSummary['kind'];
export type TextSize = 15 | 17 | 19;
export interface WritingInitialData { posts: ClientPostSummary[]; post: ClientPost | null }
export const FOLDERS = [
  { id: 'all', label: 'All' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'notes', label: 'Notes' },
  { id: 'life', label: 'Life' },
] as const;
export const RSS_URL = 'https://nipuntheekshana.com/writing/rss.xml';
export function writingPath(slug = '') { return `/writing${slug ? `/${slug}` : ''}`; }
export function mainSiteUrl(slug = '') { return `https://nipuntheekshana.com${writingPath(slug)}`; }
export function filterPosts(posts: readonly ClientPostSummary[], folder: Folder, tag: string | null, search: string) {
  const words = search.trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  return posts.filter(post => (folder === 'all' || post.kind === folder) && (!tag || post.tags.includes(tag))
    && words.every(word => `${post.title} ${post.description} ${post.tags.join(' ')} ${post.kind}`.toLocaleLowerCase('en').includes(word)));
}
export function postDate(date: string, long = false) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: long ? 'long' : 'short',
    ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(date));
}
/** Adapt trusted Astro HTML for OS routes and the shared Prose theme selectors. */
export function readerHtml(html: string, nativeLinks = false) {
  const adapted = html.replace(/href="\/work(?=[/"?#])/g, 'href="/projects')
    .replace(/<pre class="astro-code\b/g, '<pre class="shiki astro-code')
    // GitHub Light's parameter orange otherwise falls below WCAG AA at the code size.
    .replace(/(<span style=")color:#E36209(?=[;"])/g, '$1color:#B34C00');
  if (!nativeLinks) return adapted;
  return adapted.replace(/<a href="(https?:\/\/[^"]+)"([^>]*)>/g, (anchor, href: string, attributes: string) => {
    if (/\btarget=/.test(attributes) || new URL(href).origin === 'https://os.nipuntheekshana.com') return anchor;
    const rel = /\brel="/.test(attributes) ? attributes.replace(/\brel="([^"]*)"/, 'rel="$1 noopener noreferrer"')
      : `${attributes} rel="noopener noreferrer"`;
    return `<a href="${href}"${rel} target="_blank">`;
  });
}
