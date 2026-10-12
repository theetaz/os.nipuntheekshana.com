import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { APP_META } from '../../src/os/registry/meta';
import type {
  BrandApi, BrandCard, ClientArchiveItem, ClientBrand, ClientPost, ClientPostSummary,
  ClientActivity, ClientProfile, ClientProject, ClientScreen, ClientWork, ImageSet, SearchEntry,
} from '../../src/os/types/content';
import { compareProjects } from '../../src/lib/client-data';

const dist = resolve('dist/client');
const data = resolve(dist, 'data');
type Validator = (value: unknown) => void;
type Schema<T> = { [K in keyof Required<T>]: Validator };
const string: Validator = (value) => { expect(typeof value).toBe('string'); };
const number: Validator = (value) => { expect(typeof value).toBe('number'); expect(Number.isFinite(value)).toBe(true); };
const boolean: Validator = (value) => { expect(typeof value).toBe('boolean'); };
const date: Validator = (value) => { string(value); expect(Number.isNaN(Date.parse(value as string))).toBe(false); };
const optional = (validate: Validator): Validator => (value) => { if (value !== undefined) validate(value); };
const nullable = (validate: Validator): Validator => (value) => { if (value !== null) validate(value); };
const array = (validate: Validator): Validator => (value) => {
  expect(Array.isArray(value)).toBe(true);
  (value as unknown[]).forEach(validate);
};
const oneOf = (...values: unknown[]): Validator => (value) => { expect(values).toContain(value); };
function object<T>(schema: Schema<T>): Validator {
  return (value) => {
    expect(value).not.toBeNull();
    expect(typeof value).toBe('object');
    expect(Array.isArray(value)).toBe(false);
    for (const [key, validate] of Object.entries(schema) as [string, Validator][]) {
      try { validate((value as Record<string, unknown>)[key]); }
      catch (error) { throw new Error(`Invalid ${key}: ${String(error)}`); }
    }
  };
}
const strings = array(string);
const fact = object<{ value: string; label: string }>({ value: string, label: string });
const headings = array(object<ClientWork['headings'][number]>({ depth: number, slug: string, text: string }));
const imageSchema: Schema<ImageSet> = { src: string, width: number, height: number, avif: string, webp: string, alt: string };
const image = object<ImageSet>(imageSchema);
const screen = object<ClientScreen>({ ...imageSchema, label: string, kind: oneOf('phone', 'browser', 'bare'), trimBottom: optional(number), bar: optional(string) });
const api = object<BrandApi>({ method: string, host: string, path: string, status: string, time: optional(string), body: string });
const card: Validator = (value) => {
  const kind = (value as BrandCard).kind;
  if (kind === 'stat') object<Extract<BrandCard, { kind: 'stat' }>>({ kind: oneOf('stat'), label: string, value: string, note: optional(string), progress: optional(number) })(value);
  else if (kind === 'steps') object<Extract<BrandCard, { kind: 'steps' }>>({ kind: oneOf('steps'), label: string, steps: strings, footnote: optional(string) })(value);
  else object<Extract<BrandCard, { kind: 'code' }>>({ kind: oneOf('code'), label: string, lines: strings, footnote: optional(string) })(value);
};
const brand = object<ClientBrand>({
  color: string, ink: string, shade: optional(string), backdrop: object({ dark: string, light: string }),
  platform: string, platformNote: string, chips: strings, cta: optional(object({ label: string, href: string })),
  domain: optional(string), address: optional(string), cards: array(card), api: optional(api),
});
const project = object<ClientProject>({
  slug: string, title: string, native: optional(string), tagline: string, description: string,
  category: oneOf('data', 'apps', 'hardware', 'worlds', 'ai'), categoryLabel: string, stack: strings,
  status: oneOf('active', 'incubating', 'archived'), year: number, repo: optional(string), live: optional(string), story: optional(string),
  featured: boolean, tint: optional(number), icon: nullable(image), monogram: string, cover: image, screens: array(screen), brand: nullable(brand), order: number,
});
const archive = object<ClientArchiveItem>({ title: string, note: string, year: string, stack: string });
const work = object<ClientWork>({ slug: string, lede: string, role: string, facts: array(fact), html: string, headings });
const summarySchema: Schema<ClientPostSummary> = { slug: string, title: string, description: string, date, updated: optional(date), kind: oneOf('engineering', 'notes', 'life'), tags: strings, minutes: number };
const post = object<ClientPost>({ ...summarySchema, html: string, headings });
const profile = object<ClientProfile>({
  site: object<ClientProfile['site']>({
    name: string, nameSinhala: string, fullName: string, title: string, role: string, tagline: string, description: string,
    location: string, coordinates: object({ lat: number, lon: number }), timezone: string, email: string, careerStart: number,
  }),
  cv: object<ClientProfile['cv']>({ href: string, filename: string, updated: date, sizeLabel: string }),
  links: object<ClientProfile['links']>({ github: string, linkedin: string, prabhava: string, prabhavaGithub: string, source: string }),
  socials: array(object<ClientProfile['socials'][number]>({ label: string, handle: string, href: string })),
  currently: strings, highlights: array(fact), summary: string, competencies: strings,
  experience: array(object<ClientProfile['experience'][number]>({
    org: string, role: string, period: string, location: optional(string), href: optional(string), summary: string, highlights: optional(strings), stack: optional(strings),
  })),
  education: object<ClientProfile['education']>({ school: string, degree: string, period: string, location: string }),
  skills: array(object<ClientProfile['skills'][number]>({ group: string, items: strings })),
  principles: array(object<ClientProfile['principles'][number]>({ title: string, body: string })),
  hobbies: array(object<ClientProfile['hobbies'][number]>({ name: string, note: string, icon: string })),
  now: object<ClientProfile['now']>({ updated: date, items: strings }),
  chapters: array(object<ClientProfile['chapters'][number]>({ year: string, title: string, body: string })), avatar: image,
});
const target: Validator = (value) => {
  const type = (value as SearchEntry['target']).type;
  if (type === 'app') object({ type: oneOf('app'), appId: oneOf(...Object.keys(APP_META)), route: optional(string) })(value);
  else if (type === 'action') object({ type: oneOf('action'), action: string })(value);
  else object({ type: oneOf('href'), href: string })(value);
};
const search = object<SearchEntry>({ id: string, kind: oneOf('app', 'project', 'post', 'action'), title: string, subtitle: string, keywords: string, icon: string, featured: optional(boolean), target });

function read<T>(file: string): T { return JSON.parse(readFileSync(resolve(data, file), 'utf8')) as T; }
function assertImageAssets(set: ImageSet) {
  expect(set.width).toBeGreaterThan(0);
  expect(set.height).toBeGreaterThan(0);
  expect(set.src).toMatch(/^\/_astro\//);
  expect(existsSync(resolve(dist, set.src.slice(1)))).toBe(true);
  if (set.src.endsWith('.svg')) {
    expect(set.avif).toBe(''); expect(set.webp).toBe('');
    return;
  }
  for (const format of ['avif', 'webp'] as const) {
    expect(set[format]).not.toBe('');
    for (const variant of set[format].split(', ')) {
      const match = variant.match(/^(.+) (\d+)w$/);
      expect(match).not.toBeNull();
      expect(Number(match![2])).toBeLessThanOrEqual(set.width);
      expect(match![1]).toMatch(new RegExp(`\\.${format}$`));
      expect(existsSync(resolve(dist, match![1]!.slice(1)))).toBe(true);
    }
  }
}

describe.skipIf(!existsSync(dist))('built JSON contracts', () => {
  it('emits all five index endpoints, 18 work files and two writing details', () => {
    for (const name of ['profile', 'projects', 'writing', 'activity', 'search']) expect(existsSync(resolve(data, `${name}.json`))).toBe(true);
    expect(readdirSync(resolve(data, 'work')).filter((file) => file.endsWith('.json'))).toHaveLength(18);
    expect(readdirSync(resolve(data, 'writing')).filter((file) => file.endsWith('.json'))).toHaveLength(2);
  });

  it('matches the profile type, CV file size and avatar variants', () => {
    const value = read<ClientProfile>('profile.json');
    profile(value);
    expect(value.cv.sizeLabel).toBe(`PDF · ${Math.round(statSync(resolve('public', value.cv.filename)).size / 1024)} KB`);
    expect(value.chapters).toHaveLength(6);
    assertImageAssets(value.avatar);
  });

  it('matches every project and archive type, orders projects, and keeps JSON below B9', () => {
    const value = read<{ projects: ClientProject[]; archive: ClientArchiveItem[]; categories: Record<string, string> }>('projects.json');
    array(project)(value.projects); array(archive)(value.archive);
    object({ data: string, apps: string, hardware: string, worlds: string, ai: string })(value.categories);
    expect(value.projects).toHaveLength(18); expect(value.archive).toHaveLength(8);
    expect(value.projects.filter((item) => item.featured)).toHaveLength(6);
    expect(value.projects).toEqual([...value.projects].sort(compareProjects));
    value.projects.forEach((item, order) => {
      expect(item.order).toBe(order); expect(item.categoryLabel).toBe(value.categories[item.category]);
      assertImageAssets(item.cover);
      if (item.icon) assertImageAssets(item.icon);
      item.screens.forEach(assertImageAssets);
      const detail = read<ClientWork>(`work/${item.slug}.json`);
      work(detail); expect(detail.slug).toBe(item.slug); expect(detail.html).toContain('<h2');
    });
    expect(gzipSync(readFileSync(resolve(data, 'projects.json')), { level: 9 }).length).toBeLessThanOrEqual(20480);
  });

  it('matches summaries and rendered posts, including headings and Shiki code', () => {
    const summaries = read<ClientPostSummary[]>('writing.json');
    array(object<ClientPostSummary>(summarySchema))(summaries);
    expect(summaries).toHaveLength(2);
    summaries.forEach((summary) => {
      expect(summary.minutes).toBeGreaterThan(0); expect(summary).not.toHaveProperty('html');
      const detail = read<ClientPost>(`writing/${summary.slug}.json`);
      post(detail); expect(detail).toMatchObject(summary); expect(detail.html).toContain('<p>');
      detail.headings.forEach((heading) => expect(detail.html).toContain(`id="${heading.slug}"`));
    });
    expect(read<ClientPost>('writing/an-island-made-of-points.json').html).toContain('shiki');
  });

  it('matches either the available or failed-soft activity response', () => {
    const value = read<Record<string, unknown>>('activity.json');
    boolean(value.available); date(value.fetchedAt);
    if (value.available) {
      object<Extract<ClientActivity, { available: true }>>({
        available: oneOf(true), start: date, weeks: number, counts: array(number), total: number,
        activeDays: number, longestStreak: number, currentStreak: number,
        busiest: nullable(object({ date, count: number })), busiestWeekday: oneOf(0, 1, 2, 3, 4, 5, 6), stars: nullable(number), fetchedAt: date,
      })(value);
      expect((value.counts as number[]).length).toBe((value.weeks as number) * 7);
    } else expect(Object.keys(value).sort()).toEqual(['available', 'fetchedAt']);
  });

  it('indexes only v1 apps, all projects and posts, and the eight specified actions', () => {
    const entries = read<SearchEntry[]>('search.json');
    array(search)(entries);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(entries.filter((entry) => entry.kind === 'app')).toHaveLength(13);
    expect(entries.filter((entry) => entry.kind === 'project')).toHaveLength(18);
    expect(entries.filter((entry) => entry.kind === 'post')).toHaveLength(2);
    expect(entries.filter((entry) => entry.kind === 'action').map((entry) => entry.title)).toEqual([
      'Toggle dark appearance', 'Copy email address', 'Download CV (PDF)', 'Play Pin the city',
      'Wake Mochi', 'Change wallpaper…', 'Simple view', 'Empty Kooda',
    ]);
    expect(entries.some((entry) => entry.id === 'app:guestbook')).toBe(true);
    for (const entry of entries) expect(entry.icon).toMatch(/^(app-|project:)/);
    expect(entries.find((entry) => entry.id === 'project:salli')?.keywords).toContain('සල්ලි');
    expect(entries.find((entry) => entry.id === 'action:simple')?.target).toEqual({ type: 'action', action: 'simple' });
    expect(entries.find((entry) => entry.id === 'action:play')?.target).toEqual({ type: 'app', appId: 'maps', route: 'play' });
  });
});
