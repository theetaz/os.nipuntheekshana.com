import type { SearchEntry } from '../types/content';

const kindOrder = { app: 0, project: 1, post: 2, action: 3 } as const;
const normalise = (text: string) => text.normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/gu, ' ');

function subsequence(query: string, text: string): boolean {
  let index = 0;
  for (const letter of text) {
    if (letter === query[index]) index++;
    if (index === query.length) return true;
  }
  return false;
}

/** Lower tiers win. Recency only breaks otherwise equal matches. */
export function matchTier(entry: SearchEntry, query: string): number | null {
  const needle = normalise(query);
  if (!needle) return null;
  const title = normalise(entry.title);
  const keywords = normalise(entry.keywords);
  if (title === needle) return 0;
  if (title.startsWith(needle)) return 1;
  let start = title.indexOf(needle);
  while (start >= 0) {
    if (start === 0 || !/[\p{L}\p{N}]/u.test(title[start - 1]!)) return 2;
    start = title.indexOf(needle, start + 1);
  }
  if (title.includes(needle)) return 3;
  if (keywords.includes(needle)) return 4;
  if (subsequence(needle, title) || subsequence(needle, keywords)) return 5;
  return null;
}

export function rankSpotlight(entries: readonly SearchEntry[], query: string, recent: readonly string[] = []): SearchEntry[] {
  if (!normalise(query)) {
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    return [...new Set(recent)].slice(0, 5).flatMap(id => byId.get(id) ?? []);
  }
  const recency = new Map<string, number>();
  recent.forEach((id, index) => { if (!recency.has(id)) recency.set(id, index); });
  return entries.map((entry, index) => ({ entry, index, tier: matchTier(entry, query) }))
    .filter((value): value is typeof value & { tier: number } => value.tier !== null)
    .sort((a, b) => a.tier - b.tier || kindOrder[a.entry.kind] - kindOrder[b.entry.kind]
      || Number(b.entry.kind === 'project' && !!b.entry.featured) - Number(a.entry.kind === 'project' && !!a.entry.featured)
      || (recency.get(a.entry.id) ?? Infinity) - (recency.get(b.entry.id) ?? Infinity) || a.index - b.index)
    .map(value => value.entry);
}

export interface SpotlightGroup { label: string; entries: SearchEntry[] }
export function spotlightGroups(entries: readonly SearchEntry[], query: string, recent: readonly string[] = []): SpotlightGroup[] {
  const ranked = rankSpotlight(entries, query, recent);
  if (!normalise(query)) {
    const suggestions = ['app:maps', 'action:play', 'app:cv', 'app:now']
      .flatMap(id => entries.find(entry => entry.id === id) ?? []);
    return [{ label: 'Recent', entries: ranked }, { label: 'Suggestions', entries: suggestions }]
      .filter(group => group.entries.length);
  }
  const top = ranked[0];
  if (!top) return [];
  let remaining = 23;
  return [{ label: 'Top hit', entries: [top] }, ...(['app', 'project', 'post', 'action'] as const).map(kind => {
    const hits = ranked.filter(entry => entry !== top && entry.kind === kind).slice(0, Math.min(6, remaining));
    remaining -= hits.length;
    return { label: { app: 'Apps', project: 'Projects', post: 'Writing', action: 'Actions' }[kind], entries: hits };
  })].filter(group => group.entries.length);
}
