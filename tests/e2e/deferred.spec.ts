import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from './fixtures';

const cases = [
  { name: 'menu', trigger: '[aria-label="Island menu"]', chunk: 'MenuHost', result: '[role="menu"][aria-label="Island menu"]', event: 'click' },
  { name: 'window', trigger: '.os-dock a[aria-label="Projects"]', chunk: 'WindowLayer', result: '[data-window-id="projects"]', event: 'click' },
  { name: 'clock', trigger: '.mb-clock', chunk: 'StatusPopovers', result: '#clock-popover', event: 'click' },
  { name: 'Now', trigger: '[aria-label="What Nipun\'s up to"]', chunk: 'StatusPopovers', result: '#now-popover', event: 'click' },
  { name: 'Spotlight', trigger: '[aria-label="Spotlight"]', chunk: 'Spotlight', result: '[role="combobox"][aria-label="Search projects, writing, apps"]', event: 'click' },
  { name: 'context menu', trigger: '[data-desktop-icon="projects"]', chunk: 'ContextMenuHost', result: '[role="menu"][aria-label="desktop:projects context menu"]', event: 'contextmenu' },
] as const;

for (const feature of cases) test(`first ${feature.name} interaction paints within 100 ms after intent preload @perf`, async ({ page }, info) => {
  test.skip(info.project.name.startsWith('mobile'), 'Desktop intent targets.');
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  const trigger = page.locator(feature.trigger); await expect(trigger).toBeVisible();
  const downloaded = page.waitForEvent('requestfinished', { predicate: request => new RegExp(`/${feature.chunk}\\.[^/]+\\.js`).test(request.url()) });
  await trigger.focus(); await downloaded;
  // Let the browser evaluate the downloaded module, then use the next paint as the proxy.
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
