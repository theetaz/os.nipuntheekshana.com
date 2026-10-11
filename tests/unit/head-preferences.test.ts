import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(new URL('../../src/layouts/OsLayout.astro', import.meta.url), 'utf8');
const script = layout.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Missing inline preference script');

function resolve({ prefs = {}, dark = false, reduce = false, mobile = false, pathname = '/', hash = '', userAgent = 'browser', blocked = false }:
  { prefs?: Record<string, string>; dark?: boolean; reduce?: boolean; mobile?: boolean; pathname?: string; hash?: string; userAgent?: string; blocked?: boolean } = {}) {
  const dataset: Record<string, string> = { theme: 'light', mode: 'desktop' };
  const classes = new Set(['no-js']);
  runInNewContext(script!, {
    document: { documentElement: { dataset, classList: { add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value) } } },
    window: { get localStorage() { if (blocked) throw new Error('Storage blocked'); return { getItem: (key: string) => prefs[key.replace('serendib:', '')] ?? null }; } },
    matchMedia: (query: string) => ({ matches: query.includes('color-scheme') ? dark : query.includes('reduced-motion') ? reduce : mobile }),
    location: { pathname, hash }, navigator: { userAgent },
  });
  return { dataset, classes };
}

describe('inline head preferences', () => {
  it('resolves JSON preferences and replaces no-js synchronously', () => {
    const { dataset, classes } = resolve({ prefs: {
      theme: '"dark"', wallpaper: '"monsoon"', accent: '"lotus"', motion: '"reduce"', transparency: '"reduce"', view: '"simple"',
    } });
    expect(dataset).toEqual({ theme: 'dark', mode: 'desktop', wallpaper: 'monsoon', accent: 'lotus', motion: 'reduce', transparency: 'reduce', view: 'simple' });
    expect([...classes]).toEqual(['js']);
  });
  it('survives blocked storage and malformed JSON', () => {
    expect(resolve({ blocked: true, dark: true }).dataset).toMatchObject({ theme: 'dark', accent: 'thambili', wallpaper: 'galle-face' });
    expect(resolve({ prefs: { theme: '{invalid', accent: '{invalid' } }).dataset).toMatchObject({ theme: 'light', accent: 'thambili' });
  });
  it('honours explicit light and dark over system appearance', () => {
    expect(resolve({ prefs: { theme: '"light"' }, dark: true }).dataset.theme).toBe('light');
    expect(resolve({ prefs: { theme: '"dark"' } }).dataset.theme).toBe('dark');
    expect(resolve({ prefs: { theme: '"auto"' }, dark: true }).dataset.theme).toBe('dark');
  });
  it('selects mobile before rendering', () => {
    expect(resolve({ mobile: true }).dataset.mode).toBe('mobile');
  });
  it('boots only eligible first home visits', () => {
    expect(resolve().dataset.boot).toBe('1');
    const ineligible: Parameters<typeof resolve>[0][] = [
      { pathname: '/about' }, { hash: '#simple' }, { reduce: true }, { userAgent: 'Googlebot' },
      { prefs: { booted: 'true' } }, { prefs: { motion: '"reduce"' } }, { prefs: { view: '"simple"' } },
    ];
    for (const input of ineligible) expect(resolve(input).dataset).not.toHaveProperty('boot');
    expect(resolve({ reduce: true, prefs: { motion: '"full"' } }).dataset.boot).toBe('1');
  });
});
