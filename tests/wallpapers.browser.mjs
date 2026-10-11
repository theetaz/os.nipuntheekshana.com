// Run after building tests/fixtures/wallpaper.config.mjs to .astro/wallpaper-fixture:
// node tests/wallpapers.browser.mjs [preview-directory]
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = resolve(root, '.astro/wallpaper-fixture');
const output = resolve(process.argv[2] || '/tmp/serendib-p1-3-previews');
await mkdir(output, { recursive: true });
const types = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  const path = resolve(site, `.${pathname === '/_wallpaper' ? '/_wallpaper.html' : pathname}`);
  if (!path.startsWith(site + '/')) { response.writeHead(403).end(); return; }
  try {
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const variants = ['galle-face', 'monsoon', 'contours', 'island', 'paper', 'island-live'];
const results = [];
try {
  for (const theme of ['light', 'dark']) {
    for (const wallpaper of variants) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        window.wallpaperMetrics = { shifts: [], tasks: [] };
        new PerformanceObserver((list) => window.wallpaperMetrics.shifts.push(...list.getEntries().map((e) => e.value)))
          .observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => window.wallpaperMetrics.tasks.push(...list.getEntries().map((e) => e.duration)))
          .observe({ type: 'longtask', buffered: true });
      });
      const page = await context.newPage();
      const requests = [], errors = [];
      page.on('request', (request) => requests.push({ url: request.url(), type: request.resourceType() }));
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text()); });
      await page.goto(`${origin}/_wallpaper?wallpaper=${wallpaper}&theme=${theme}`);
      await page.screenshot({ path: resolve(output, `${wallpaper}-${theme}.png`), animations: 'disabled' });
      const details = await page.evaluate(() => {
        const style = (selector) => getComputedStyle(document.querySelector(selector));
        return {
          ...window.wallpaperMetrics,
          background: style('.wp-sky').background,
          sun: style('.wp-sun').display,
          rain: style('.wp-rain').animationName,
          contours: style('.wp-contours').display,
          pointerEvents: style('.wallpaper').pointerEvents,
          horizon: document.querySelector('.wp-sea').getBoundingClientRect().top,
          svgCount: document.querySelectorAll('svg').length,
          stars: style('.wp-stars').display,
          windows: style('.wp-windows').display,
        };
      });
      const images = requests.filter((request) => request.type === 'image');
      assert.equal(images.length, wallpaper === 'contours' ? 1 : 0, `${wallpaper}/${theme}: conditional asset requests`);
      if (images.length) assert.match(images[0].url, /contours.*\.svg$/);
      assert.deepEqual(errors, [], `${wallpaper}/${theme}: browser errors`);
      assert.equal(details.shifts.reduce((sum, value) => sum + value, 0), 0);
      assert.deepEqual(details.tasks, [], `${wallpaper}/${theme}: long tasks`);
      assert.equal(details.pointerEvents, 'none');
      assert.equal(details.svgCount, 1);
      assert.equal(details.rain, 'none', 'Reduced motion stops rain');
      if (wallpaper === 'galle-face') {
        assert.equal(details.horizon, 702);
        assert.equal(details.stars, theme === 'dark' ? 'block' : 'none');
        assert.equal(details.windows, theme === 'dark' ? 'block' : 'none');
      } else assert.equal(details.sun, 'none');
      results.push({ wallpaper, theme, imageRequests: images.length, ...details });
      await context.close();
    }
  }
  for (const theme of ['light', 'dark']) {
    assert.ok((await readFile(resolve(output, `island-${theme}.png`)))
      .equals(await readFile(resolve(output, `island-live-${theme}.png`))), 'Live Island fallback is pixel-identical');
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const [os, preference, animated] of [
    ['no-preference', 'system', true], ['no-preference', 'reduce', false],
    ['reduce', 'system', false], ['reduce', 'full', true],
  ]) {
    await page.emulateMedia({ reducedMotion: os });
    await page.goto(`${origin}/_wallpaper?wallpaper=monsoon&motion=${preference}`);
    assert.equal(await page.locator('.wp-rain').evaluate((element) => getComputedStyle(element).animationName !== 'none'), animated);
  }
  await page.goto(`${origin}/_wallpaper?wallpaper=paper`);
  await page.emulateMedia({ forcedColors: 'active' });
  assert.equal(await page.locator('.wallpaper').evaluate((element) => getComputedStyle(element).display), 'none');
  await page.emulateMedia({ forcedColors: 'none' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/_wallpaper?theme=dark&wallpaper=island`);
  await page.screenshot({ path: resolve(output, 'island-dark-mobile.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  const veil = await page.locator('.wallpaper').evaluate((element) => {
    const style = getComputedStyle(element, '::after');
    return { height: style.height, opacity: style.opacity };
  });
  assert.ok(Math.abs(parseFloat(veil.height) - 844 * .4) < 1);
  assert.equal(veil.opacity, '0.6');
  await context.close();

  const noJs = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false, colorScheme: 'dark' });
  const fallback = await noJs.newPage();
  await fallback.goto(`${origin}/_wallpaper`);
  await fallback.screenshot({ path: resolve(output, 'galle-face-dark-no-js.png') });
  assert.match(await fallback.locator('.wp-sky').evaluate((element) => getComputedStyle(element).backgroundImage), /rgb\(11, 21, 32\)/);
  await noJs.close();
  await writeFile(resolve(output, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log(`12 wallpaper/theme variants: correct asset requests, CLS 0, no long tasks, no browser errors.\nMotion preferences, forced colours, mobile veil, no-JS dark and live fallback passed.\nPNGs: ${output}\nFixture: ${origin}/_wallpaper`);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
