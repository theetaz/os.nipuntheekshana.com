import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkBudgets } from '../../scripts/check-budgets.mjs';
import { startStory } from '../../src/os/story/story-runtime';
import { storyProjects } from '../../src/lib/story-projects';

const features = vi.hoisted(() => Object.fromEntries(['cards', 'board', 'visits', 'workspaces'].map(name => [name, { start: vi.fn(), cleanup: vi.fn() }])) as Record<string, { start: ReturnType<typeof vi.fn>; cleanup: ReturnType<typeof vi.fn> }>);
vi.mock('../../src/os/story/story-cards', () => ({ start: features.cards!.start }));
vi.mock('../../src/os/story/story-board', () => ({ start: features.board!.start }));
vi.mock('../../src/os/story/story-visits', () => ({ start: features.visits!.start }));
vi.mock('../../src/os/story/story-workspaces', () => ({ start: features.workspaces!.start }));
vi.mock('../../src/lib/client-data', () => ({ getClientProjects: async () => [
  { slug: 'salli', title: 'Salli', featured: true, order: 0 },
  { slug: 'vidura', title: 'Vidura', featured: false, order: 1 },
  { slug: 'mochi', title: 'Mochi', featured: false, order: 2 },
] }));

let intersect: IntersectionObserverCallback;
const observed = new Set<Element>();
let disconnected = false;
class Observer {
  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) { intersect = callback; expect(options.rootMargin).toBe('800px'); }
  observe(el: Element) { observed.add(el); }
  unobserve(el: Element) { observed.delete(el); }
  disconnect() { disconnected = true; observed.clear(); }
}
const card = { matches: (selector: string) => selector === '[data-k-cards]' } as unknown as Element;
const board = { matches: (selector: string) => selector === '[data-k-board]' } as unknown as Element;
const visits = { matches: (selector: string) => selector === '[data-k-visits]' } as unknown as Element;
const root = { querySelectorAll: (selector: string) => [card, board, visits].filter(el => el.matches(selector)) } as unknown as Element;
function emit(elements: Element[]) { intersect(elements.map(target => ({ target, isIntersecting: true })) as IntersectionObserverEntry[], {} as IntersectionObserver); }
beforeEach(() => {
  vi.clearAllMocks(); observed.clear(); disconnected = false;
  for (const feature of Object.values(features)) feature.start.mockImplementation(() => feature.cleanup);
  vi.stubGlobal('IntersectionObserver', Observer); vi.stubGlobal('document', { documentElement: { dataset: { mode: 'desktop' } } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('story runtime lifecycle', () => {
  it('starts desktop workspaces at once and each feature only near the viewport', async () => {
    const cleanup = startStory(root); await vi.waitFor(() => expect(features.workspaces!.start).toHaveBeenCalledWith(root));
    expect(observed).toEqual(new Set([card, board, visits])); expect(features.cards!.start).not.toHaveBeenCalled();
    emit([card]); await vi.waitFor(() => expect(features.cards!.start).toHaveBeenCalledWith(card));
    expect(observed.has(card)).toBe(false); expect(features.board!.start).not.toHaveBeenCalled();
    emit([board, visits]); await vi.waitFor(() => expect(features.visits!.start).toHaveBeenCalledWith(visits));
    expect(features.board!.start).toHaveBeenCalledWith(board);
    cleanup(); expect(disconnected).toBe(true);
    for (const feature of Object.values(features)) expect(feature.cleanup).toHaveBeenCalledTimes(1);
  });
  it('ignores imports finishing after cleanup', async () => {
    const cleanup = startStory(root); emit([card, board, visits]); cleanup();
    await Promise.all([import('../../src/os/story/story-cards'), import('../../src/os/story/story-board'), import('../../src/os/story/story-visits'), import('../../src/os/story/story-workspaces')]);
    for (const feature of Object.values(features)) expect(feature.start).not.toHaveBeenCalled();
    expect(disconnected).toBe(true);
  });
  it('keeps workspace control off phones', async () => {
    vi.stubGlobal('document', { documentElement: { dataset: { mode: 'mobile' } } });
    const cleanup = startStory(root); emit([card]); await vi.waitFor(() => expect(features.cards!.start).toHaveBeenCalled());
    expect(features.workspaces!.start).not.toHaveBeenCalled(); cleanup();
  });
  it('groups projects in source order, maps stickers and adds the city game', async () => {
    const result = await storyProjects();
    expect(result.highlights.map(project => project.slug)).toEqual(['salli']);
    expect(result.side.map(project => project.slug)).toEqual(['vidura']);
    expect(result.fun.map(project => project.slug)).toEqual(['mochi', 'pin-the-city']);
    for (const project of Object.values(result).flat()) { expect(project.tilt).not.toBe(0); expect(Math.abs(project.tilt)).toBeLessThanOrEqual(7); expect(project.sticker).toBe(`sticker-${project.slug}`); }
    expect(result.fun.at(-1)).toMatchObject({ href: '/maps/play', command: '$ open /maps/play', cover: null });
    expect(await storyProjects()).toEqual(result);
  });
});

const temporary: string[] = [];
const config = JSON.parse(readFileSync('budgets.config.json', 'utf8'));
function fixture(files: Record<string, string | Buffer>, overrides: Record<string, unknown> = {}) {
  const parent = resolve('.astro/k2-artifacts'); mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(join(parent, 'budget-fixture-')); temporary.push(directory);
  writeFileSync(join(directory, 'budgets.config.json'), JSON.stringify({ ...config, ...overrides }));
  for (const [name, contents] of Object.entries(files)) { const file = join(directory, name); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, contents); }
  return directory;
}
afterEach(() => { temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })); });
describe('Kottu budget enforcement', () => {
  it('subtracts home dependencies from named story closures and enforces caps', async () => {
    const source = 'import "./shared.js"; export function startStory() {}';
    const directory = fixture({ 'dist/index.html': '<script type="module" src="/_astro/shared.js"></script>',
      'dist/_astro/shared.js': 'export const shared=1;', 'dist/_astro/story-runtime.x.js': source }, { storyChunks: { 'story-runtime': 0 } });
    const result = await checkBudgets({ root: directory, log: false });
    expect(result.passed).toBe(false);
    expect(result.rows.find((row: { metric: string }) => row.metric === 'K story chunk')).toMatchObject({ bytes: gzipSync(source, { level: 9 }).length, limit: 0, status: 'fail' });
  });
  it('fails if a story runtime becomes statically reachable on home', async () => {
    const directory = fixture({ 'dist/index.html': '<script type="module" src="/_astro/story-runtime.x.js"></script>', 'dist/_astro/story-runtime.x.js': 'export function startStory() {}' });
    const result = await checkBudgets({ root: directory, log: false });
    expect(result.passed).toBe(false); expect(result.errors.join('\n')).toContain('story chunk in initial JS');
  });
  it('uses provenance, dimensions and format to hard-fail both image densities', async () => {
    const avif = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#FF8A3D' } }).avif().toBuffer();
    const webp = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#FF8A3D' } }).webp().toBuffer();
    const directory = fixture({ 'dist/index.html': '<title>Home</title>', 'dist/_astro/prop-tea.x.avif': avif, 'dist/_astro/prop-tea.x.webp': webp,
      'src/assets/kottu/provenance.json': JSON.stringify([{ id: 'prop-tea', family: 'prop' }]),
      'scripts/kottu-art/assets.json': JSON.stringify({ assets: [{ id: 'prop-tea', family: 'prop', W: 32 }] }) },
    { kottuImages: { prop: { avif: [0, 0], webp: [0, 0] } } });
    const result = await checkBudgets({ root: directory, log: false });
    expect(result.passed).toBe(false);
    expect(result.rows.filter((row: { metric: string }) => row.metric.startsWith('K image')).map((row: { metric: string; status: string }) => ({ metric: row.metric, status: row.status })))
      .toEqual([{ metric: 'K image prop 1x avif', status: 'fail' }, { metric: 'K image prop 2x webp', status: 'fail' }]);
  });
});
