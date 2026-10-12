import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from './fixtures';

const cases = [
  { name: 'menu', trigger: '[aria-label="Kottu menu"]', chunk: 'MenuHost', result: '[role="menu"][aria-label="Kottu menu"]', event: 'click' },
  { name: 'window', trigger: '.os-dock a[aria-label="Projects"]', chunk: 'WindowLayer', result: '[data-window-id="projects"]', event: 'click' },
  { name: 'clock', trigger: '.mb-clock', chunk: 'StatusPopovers', result: '#clock-popover', event: 'click' },
  { name: 'Now', trigger: '[aria-label^="What Nipun\'s up to:"]', chunk: 'StatusPopovers', result: '#now-popover', event: 'click' },
  { name: 'Spotlight', trigger: 'button[aria-label="Search"], [data-shell="mobile"] [aria-label="Spotlight"]', chunk: 'Spotlight', result: '[role="combobox"][aria-label="Search projects, writing, apps"]', event: 'click' },
  { name: 'context menu', trigger: '[data-desktop-icon="projects"]', chunk: 'ContextMenuHost', result: '[role="menu"][aria-label="desktop:projects context menu"]', event: 'contextmenu' },
] as const;
const chunks = (JSON.parse(readFileSync('dist/client/.css-scope.json', 'utf8')) as { chunks: Record<string, { imports: string[]; css: string[] }> }).chunks;
function preloadAssets(feature: string) {
  const entries = [feature, 'motion-features'].map(name => Object.keys(chunks).find(file => new RegExp(`/${name}\\.[^/]+\\.js$`).test(file))!);
  const styles = new Set<string>(); const seen = new Set<string>(); const queue = [...entries];
  while (queue.length) {
    const file = queue.pop()!; if (seen.has(file)) continue; seen.add(file);
    chunks[file]?.css.forEach(css => styles.add(`/${css}`)); queue.push(...(chunks[file]?.imports ?? []));
  }
  return { entries: entries.map(file => `/${file}`), styles: [...styles] };
}

for (const feature of cases) test(`first ${feature.name} interaction paints within 100 ms after intent preload @perf`, async ({ page }, info) => {
  test.skip(info.project.name.startsWith('mobile'), 'Desktop intent targets.');
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  const trigger = page.locator(feature.trigger); await expect(trigger).toBeVisible();
  const downloaded = page.waitForEvent('requestfinished', { predicate: request => new RegExp(`/${feature.chunk}\\.[^/]+\\.js`).test(request.url()) });
  await trigger.focus(); await downloaded;
  // The real preload awaits both the feature and motion, including their CSS.
  // One feature's requestfinished event does not mean that preload is ready.
  const assets = preloadAssets(feature.chunk);
  await page.evaluate(async entries => { await Promise.all(entries.map(entry => import(entry))); }, assets.entries);
  await expect.poll(() => page.evaluate(styles => styles.every(path => [...document.styleSheets].some(sheet => sheet.href && new URL(sheet.href).pathname === path)), assets.styles)).toBe(true);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(done)));
  const latency = await page.evaluate(async ({ trigger, result, event }) => {
    const start = performance.now();
    const painted = new Promise<number>(done => {
      const check = () => {
        const element = document.querySelector<HTMLElement>(result);
        if (!element?.getClientRects().length) return false;
        requestAnimationFrame(() => done(performance.now() - start)); return true;
      };
      const observer = new MutationObserver(() => { if (check()) observer.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    document.querySelector(trigger)!.dispatchEvent(new MouseEvent(event, { bubbles: true, cancelable: true, button: event === 'contextmenu' ? 2 : 0 }));
    return painted;
  }, feature);
  await info.attach('first-interaction', { body: JSON.stringify({ feature: feature.name, latency }), contentType: 'application/json' });
  console.log(`P2-INT ${feature.name}: ${latency.toFixed(1)} ms`);
  expect(latency).toBeLessThanOrEqual(100);
  const directory = resolve('.astro/p2-int-artifacts'); await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `latency-${info.project.name}-${feature.name.replaceAll(' ', '-')}.json`), JSON.stringify({ feature: feature.name, latency }));
});
