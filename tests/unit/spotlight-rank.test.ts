import { describe, expect, it } from 'vitest';
import { matchTier, rankSpotlight, spotlightGroups } from '../../src/os/shell/spotlight-rank';
import { matchGlobalShortcut } from '../../src/os/lib/hotkeys-match';
import type { SearchEntry } from '../../src/os/types/content';

function entry(id: string, title: string, kind: SearchEntry['kind'] = 'project', keywords = '', featured = false): SearchEntry {
  return { id, title, kind, keywords, featured, subtitle: '', icon: 'app-projects', target: { type: 'app', appId: 'projects' } };
}
const ids = (entries: SearchEntry[]) => entries.map(entry => entry.id);

describe('Spotlight match tiers', () => {
  it.each([
    ['Salli', '', 'salli', 0], ['Salli Finance', '', 'salli', 1], ['My Salli', '', 'salli', 2],
    ['My-Salli', '', 'salli', 2], ['My/Salli', '', 'salli', 2], ['XSalli', '', 'salli', 3],
    ['Money', 'Go salli react', 'salli', 4], ['Sri Lanka Local Index', '', 'salli', 5],
    ['Money', 'Sri Lanka Local Index', 'salli', 5], ['Salli', '', 'zzz', null], ['Salli', '', '', null],
    ['Salli', '', '   ', null], ['Salli', '', '  SALLI  ', 0], ['My   Salli', '', 'my salli', 0],
    ['Ｓａｌｌｉ', '', 'salli', 0], ['කූඩා', '', 'කූඩා', 0], ['கூடை', '', 'கூ', 1],
  ] as const)('ranks %s / %s for %s as %s', (title, keywords, query, tier) => {
    expect(matchTier(entry('test', title, 'project', keywords), query)).toBe(tier);
  });
  it('does not treat a letter or number inside a word as a boundary', () => {
    expect(matchTier(entry('a', 'PréSalli'), 'salli')).toBe(3);
    expect(matchTier(entry('a', '9Salli'), 'salli')).toBe(3);
  });
  it('finds a later word-start even when an earlier substring is inside a word', () => {
    expect(matchTier(entry('a', 'XSalli and Salli'), 'salli')).toBe(2);
  });
  it('fuzzy matching preserves order and requires every character', () => {
    expect(matchTier(entry('a', 'ABC'), 'acb')).toBeNull();
    expect(matchTier(entry('a', 'ABC'), 'aabc')).toBeNull();
    expect(matchTier(entry('a', 'ABC'), 'ac')).toBe(5);
  });
  it('treats query punctuation literally', () => {
    expect(matchTier(entry('a', 'Go [maps]'), '[maps]')).toBe(2);
    expect(matchTier(entry('a', 'Anything'), '.*')).toBeNull();
  });
  it('never searches the subtitle as an undocumented ranking field', () => {
    expect(matchTier({ ...entry('a', 'Money'), subtitle: 'salli' }, 'salli')).toBeNull();
  });
});

describe('Spotlight ranking and recency', () => {
  it('orders all six match tiers before kind, featured status, and recency', () => {
    const entries = [entry('fuzzy', 'Sri Lanka Local Index', 'app'), entry('keywords', 'Money', 'app', 'salli'),
      entry('substring', 'XSalli', 'app'), entry('word', 'My Salli', 'app'), entry('prefix', 'Salli Finance', 'app'), entry('exact', 'Salli', 'action')];
    expect(ids(rankSpotlight(entries, 'salli', ['fuzzy', 'keywords']))).toEqual(['exact', 'prefix', 'word', 'substring', 'keywords', 'fuzzy']);
  });
  it('breaks equal matches by app, project, writing, action', () => {
    const entries = [entry('action', 'Map', 'action'), entry('post', 'Map', 'post'), entry('project', 'Map'), entry('app', 'Map', 'app')];
    expect(ids(rankSpotlight(entries, 'map', ['action']))).toEqual(['app', 'project', 'post', 'action']);
  });
  it('puts featured projects first within a tier, ahead of recent unfeatured projects', () => {
    const entries = [entry('regular', 'Map'), entry('featured', 'Map', 'project', '', true)];
    expect(ids(rankSpotlight(entries, 'map', ['regular']))).toEqual(['featured', 'regular']);
  });
  it('prefers the most recent equal match without mutating inputs', () => {
    const entries = Object.freeze([entry('a', 'Map'), entry('b', 'Map'), entry('c', 'Map')]);
    const recent = Object.freeze(['c', 'b']);
    expect(ids(rankSpotlight(entries, 'map', recent))).toEqual(['c', 'b', 'a']);
    expect(ids([...entries])).toEqual(['a', 'b', 'c']);
  });
  it('ignores duplicate and stale recency ids, and preserves input order for unresolved ties', () => {
    const entries = [entry('a', 'Map'), entry('b', 'Map'), entry('c', 'Map')];
    expect(ids(rankSpotlight(entries, 'map', ['b', 'stale', 'c', 'b']))).toEqual(['b', 'c', 'a']);
    expect(ids(rankSpotlight(entries, 'map'))).toEqual(['a', 'b', 'c']);
  });
  it('empty search returns up to five known unique recents in newest-first order', () => {
    const entries = Array.from({ length: 8 }, (_, i) => entry(String(i), `Project ${i}`));
    expect(ids(rankSpotlight(entries, ' ', ['2', '2', '1', '4', '7', '5', '0']))).toEqual(['2', '1', '4', '7', '5']);
    expect(rankSpotlight(entries, '', ['stale'])).toEqual([]);
  });
  it('empty index and unmatched query are empty', () => {
    expect(rankSpotlight([], 'map')).toEqual([]);
    expect(rankSpotlight([entry('a', 'Map')], 'zzzz')).toEqual([]);
  });
});

describe('Spotlight presentation groups', () => {
  it('has one top hit, fixed group order, six per group, and at most 24 rows', () => {
    const entries = (['app', 'project', 'post', 'action'] as const).flatMap(kind =>
      Array.from({ length: 12 }, (_, i) => entry(`${kind}:${i}`, 'Map', kind)));
    const groups = spotlightGroups(entries, 'map');
    expect(groups.map(group => group.label)).toEqual(['Top hit', 'Apps', 'Projects', 'Writing', 'Actions']);
    expect(groups.map(group => group.entries.length)).toEqual([1, 6, 6, 6, 5]);
    expect(new Set(groups.flatMap(group => group.entries.map(entry => entry.id))).size).toBe(24);
  });
  it('omits empty groups and unmatched searches', () => {
    expect(spotlightGroups([entry('a', 'Map')], 'map')).toEqual([{ label: 'Top hit', entries: [entry('a', 'Map')] }]);
    expect(spotlightGroups([entry('a', 'Map')], 'zzz')).toEqual([]);
  });
  it('shows Recent and the four prescribed suggestions in order', () => {
    const entries = ['app:now', 'app:cv', 'app:maps', 'action:play', 'project:salli'].map(id => entry(id, id));
    const groups = spotlightGroups(entries, '', ['project:salli']);
    expect(groups.map(group => group.label)).toEqual(['Recent', 'Suggestions']);
    expect(ids(groups[1]!.entries)).toEqual(['app:maps', 'action:play', 'app:cv', 'app:now']);
  });
  it('omits Recent when there is no history and omits unavailable suggestions', () => {
    expect(spotlightGroups([entry('app:maps', 'Island')], '')).toEqual([{ label: 'Suggestions', entries: [entry('app:maps', 'Island')] }]);
  });
  it.each(['mac', 'windows', 'linux'] as const)('Option or Alt Space opens Spotlight on %s', platform => {
    expect(matchGlobalShortcut({ code: 'Space', altKey: true }, { platform })?.command).toBe('os.spotlight');
    expect(matchGlobalShortcut({ code: 'Space' }, { platform })).toBeNull();
    expect(matchGlobalShortcut({ code: 'Space', altKey: true, shiftKey: true }, { platform })).toBeNull();
  });
});
