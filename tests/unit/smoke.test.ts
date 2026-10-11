import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBudgets } from '../../scripts/check-budgets.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const defaults = JSON.parse(readFileSync(join(root, 'budgets.config.json'), 'utf8'));
const gzipBytes = (source: string) => gzipSync(Buffer.from(source), { level: 9 }).length;
const temporary: string[] = [];

function build(files: Record<string, string | Buffer>, overrides: Record<string, unknown> = {}) {
  mkdirSync(join(root, 'test-results'), { recursive: true });
  const directory = mkdtempSync(join(root, 'test-results/budgets-'));
  temporary.push(directory);
  writeFileSync(join(directory, 'budgets.config.json'), JSON.stringify({ ...defaults, ...overrides }));
  for (const [name, source] of Object.entries(files)) {
    const target = join(directory, 'dist', name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return directory;
}

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('quality harness smoke', () => {
  it('exposes the quality harness through the expected npm scripts', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(manifest.scripts.test).toBe('vitest run');
    expect(manifest.scripts.budgets).toBe('node scripts/check-budgets.mjs');
  });

  it('follows every HTML entry, static re-exports and cycles exactly once, excluding lazy apps', async () => {
    const entry = 'import{a}from"./shared.x.js";export{b}from"./other.x.js";import("./ProjectsApp.x.js");';
    const shared = 'import "./entry.x.js";export const a=1;';
    const other = 'export const b=2;';
    const inline = 'import "./_astro/entry.x.js";';
    const component = 'export const c=3;';
    const renderer = 'export const r=4;';
    const preload = 'export const p=5;';
    const app = 'import "./shared.x.js";export const app=6;';
    const directory = build({
      'index.html': `<script src="/_astro/entry.x.js" type="module"></script>
        <script type="module">${inline}</script>
        <link href="/_astro/preload.x.js" rel="modulepreload">
        <astro-island component-url="/_astro/component.x.js" renderer-url="/_astro/renderer.x.js"></astro-island>`,
      '_astro/entry.x.js': entry, '_astro/shared.x.js': shared, '_astro/other.x.js': other,
      '_astro/component.x.js': component, '_astro/renderer.x.js': renderer,
      '_astro/preload.x.js': preload, '_astro/ProjectsApp.x.js': app,
    });
    const report = await checkBudgets({ root: directory, log: false });
    expect(report.passed, report.errors.join('\n')).toBe(true);
    expect(report.rows.find((row) => row.metric === 'B1 initial JS')?.bytes)
      .toBe([entry, shared, other, component, renderer, preload, inline].reduce((sum, js) => sum + gzipBytes(js), 0));
    expect(report.rows.find((row) => row.metric === 'B4 incremental JS')?.bytes).toBe(gzipBytes(app));
    expect(JSON.parse(readFileSync(join(directory, 'dist/.budgets.json'), 'utf8')).passed).toBe(true);
  });

  it('fails if an app is statically reachable even below the byte limit', async () => {
    const directory = build({
      'index.html': '<astro-island component-url="/_astro/ProjectsApp.x.js"></astro-island>',
      '_astro/ProjectsApp.x.js': 'export const app=1;',
    });
    const report = await checkBudgets({ root: directory, log: false });
    expect(report.passed).toBe(false);
    expect(report.errors.join('\n')).toContain('app chunks in initial JS');
  });

  it('measures all route assets, inline CSS, raw font bytes, HTML and data JSON; ignores og.html', async () => {
    const css = 'body{color:red}';
    const inlineCss = 'h1{color:blue}';
    const json = '{"items":[1,2,3]}';
    const route = `<link rel='stylesheet' href='/_astro/styles.x.css'>
      <style>${inlineCss}</style><link rel=preload as=font href='/fonts/a.woff2'>
      <link rel=preload as=font href='/fonts/a.woff2'>`;
    const directory = build({
      'index.html': '<title>Home</title>', 'nested/route.html': route,
      'og.html': '<script type="module" src="/missing.js"></script>',
      '_astro/styles.x.css': css, 'fonts/a.woff2': Buffer.alloc(10), 'data/test.json': json,
    }, { cssPerPage: 0, preloadFonts: { count: 0, bytes: 9 }, htmlRouteMax: 0, jsonMax: 0 });
    const report = await checkBudgets({ root: directory, log: false });
    expect(report.passed).toBe(false);
    expect(report.errors).toEqual([]);
    expect(report.rows.find((row) => row.metric === 'B5 CSS' && row.resource === 'nested/route.html')?.bytes)
      .toBe(gzipBytes(css) + gzipBytes(inlineCss));
    expect(report.rows.find((row) => row.metric === 'B6 font count' && row.resource === 'nested/route.html')?.bytes).toBe(1);
    expect(report.rows.find((row) => row.metric === 'B6 font bytes' && row.resource === 'nested/route.html')?.bytes).toBe(10);
    expect(report.rows.find((row) => row.metric === 'B8 HTML route' && row.resource === 'nested/route.html')?.bytes).toBe(gzipBytes(route));
    expect(report.rows.find((row) => row.metric === 'B9 JSON')?.bytes).toBe(gzipBytes(json));
    expect(report.rows.some((row) => row.resource === 'og.html')).toBe(false);
    for (const metric of ['B5 CSS', 'B6 font count', 'B6 font bytes', 'B8 HTML route', 'B9 JSON']) {
      expect(report.rows.some((row) => row.metric === metric && row.status === 'fail'), metric).toBe(true);
    }
  });

  it('enforces home, route, motion, app and scene JavaScript thresholds', async () => {
    const directory = build({
      'index.html': '<script type="module" src="/_astro/entry.x.js"></script>',
      'route.html': '<script type="module" src="/_astro/entry.x.js"></script>',
      '_astro/entry.x.js': 'export const entry=1;',
      '_astro/motion-features.x.js': 'export const motion=1;',
      '_astro/ProjectsApp.x.js': 'export const app=1;',
      '_astro/island.x.js': 'export const scene=1;',
    }, { initialJsHome: 0, initialJsRoute: 0, motionFeatures: 0,
      apps: { ProjectsApp: 0, island: 0 }, htmlHome: 0 });
    const report = await checkBudgets({ root: directory, log: false });
    expect(report.passed).toBe(false);
    for (const metric of ['B1 initial JS', 'B2 initial JS', 'B3 motion features', 'B4 incremental JS', 'B7 HTML home']) {
      expect(report.rows.some((row) => row.metric === metric && row.status === 'fail'), metric).toBe(true);
    }
    expect(report.rows.filter((row) => row.metric === 'B4 incremental JS')).toHaveLength(2);
  });

  it('reports missing imports as failures and notices unbuilt app chunks', async () => {
    const directory = build({
      'index.html': '<script type="module" src="/_astro/entry.x.js"></script>',
      '_astro/entry.x.js': 'import "./missing.x.js";',
    });
    const report = await checkBudgets({ root: directory, log: false });
    expect(report.passed).toBe(false);
    expect(report.errors.join('\n')).toContain('missing.x.js');
    expect(report.notices.join('\n')).toContain('SKIP B4 ProjectsApp');
  });

  it('ignores comments, quoted import text and dynamic imports; resolves URL queries', async () => {
    const directory = build({
      'index.html': '<!-- <script type="module" src="/missing.js"></script> -->'
        + '<script type="module" src="/_astro/entry.x.js?v=1&amp;x=2"></script>',
      '_astro/entry.x.js': `// import 'missing-comment.js';\nconst s="import 'missing-string.js'";import('missing-lazy.js');`,
    });
    expect((await checkBudgets({ root: directory, log: false })).passed).toBe(true);
  });

  it('warns for oversized 640/1600px AVIF images without failing the build', async () => {
    const images = await Promise.all([640, 1600].map((width) => sharp({
      create: { width, height: 1, channels: 3, background: '#ff0000' },
    }).avif().toBuffer()));
    const directory = build({ 'index.html': '<title>Home</title>',
      '_astro/cover.avif': images[0]!, '_astro/screen.avif': images[1]!,
    }, { imageWarn: { coverAvif640: 0, screenAvif1600: 0 } });
    const report = await checkBudgets({ root: directory, log: false });
    expect(report.passed).toBe(true);
    expect(report.rows.filter((row) => row.metric === 'B10 AVIF image' && row.status === 'warn')).toHaveLength(2);
  });
});
