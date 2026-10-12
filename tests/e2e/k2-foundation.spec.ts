import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, openApp } from './fixtures';

const artifacts = resolve('.astro/k2-artifacts/screenshots');
const built = readFileSync('dist/client/index.html', 'utf8');
const budgets = JSON.parse(readFileSync('dist/client/.budgets.json', 'utf8'));

test('built foundation meets font, HTML, CSS and lazy-runtime budgets', async () => {
  const preloads = [...built.matchAll(/<link\b[^>]*\brel="preload"[^>]*>/g)].map(match => match[0]).filter(tag => tag.includes('as="font"'));
  expect(preloads).toHaveLength(2);
  const fontBytes = preloads.map(tag => readFileSync(`dist/client${tag.match(/href="([^"]+)"/)![1]}`));
  const expectedFonts = ['@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2', '@fontsource/shrikhand/files/shrikhand-latin-400-normal.woff2'];
  for (const name of expectedFonts) expect(fontBytes.some(bytes => bytes.equals(readFileSync(`node_modules/${name}`)))).toBe(true);
  const row = (metric: string) => budgets.rows.find((row: { metric: string; resource: string }) => row.metric === metric && row.resource === 'index.html').bytes;
  expect(row('B1 initial JS')).toBeLessThanOrEqual(114573 - 205);
  expect(row('B5 CSS')).toBeLessThanOrEqual(26 * 1024); expect(row('B7 HTML home')).toBeLessThanOrEqual(28 * 1024);
  expect(row('B6 font bytes')).toBeLessThanOrEqual(50 * 1024);
  expect(budgets.passed).toBe(true);
  expect(budgets.rows.filter((row: { metric: string }) => row.metric === 'K story chunk')).toHaveLength(5);
  expect(budgets.rows.filter((row: { metric: string }) => row.metric.startsWith('K image')).length).toBeGreaterThan(0);
  expect((built.match(/<astro-island\b/g) ?? []).length).toBe(1);
});

test('the document scrolls while an open desktop window keeps its viewport rectangle', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Desktop fixed-window geometry');
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight > innerHeight + 600)).toBe(true);
  await openApp(page, 'Projects'); const win = page.locator('[data-window-id="projects"]');
  await expect(win.locator('.projects-app')).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.querySelector('[data-window-id="projects"]')!.getAnimations().map(animation => animation.finished)); });
  const before = (await win.boundingBox())!;
  const band = (await page.locator('body > .wallpaper').boundingBox())!;
  await expect(page.locator('.desktop-surface')).toHaveCSS('position', 'absolute');
  await expect(page.locator('body > .wallpaper')).toHaveCSS('position', 'absolute');
  await page.mouse.move(20, 700); await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  const after = (await win.boundingBox())!;
  const scrolledBand = (await page.locator('body > .wallpaper').boundingBox())!;
  expect(Math.abs(scrolledBand.y - band.y + await page.evaluate(() => scrollY))).toBeLessThanOrEqual(1);
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before[key] - after[key])).toBeLessThanOrEqual(1);
});

test('story sections are crawlable on home and deep links, and absent on 404', async ({ page }) => {
  for (const path of ['/', '/projects/salli']) {
    await page.goto(path);
    await expect(page.locator('#story')).toHaveCount(1);
    if (path === '/') await expect(page.locator('#story')).not.toHaveAttribute('data-nosnippet');
    else await expect(page.locator('#story')).toHaveAttribute('data-nosnippet');
    expect(await page.locator('#story > section').evaluateAll(sections => sections.map(section => ({ id: section.id, labelled: !!section.querySelector(`#${section.getAttribute('aria-labelledby')}`), sec: section.getAttribute('data-sec') })))).toEqual([
      ['ws-hello','intro'],['k-skills','skills'],['k-bio','bio'],['ws-work','work'],['ws-projects','highlights'],['k-side','side'],['k-fun','fun'],['k-oss','oss'],['ws-board','board'],['k-footer','footer'],
    ].map(([id, sec]) => ({ id, sec, labelled: true })));
    await expect(page.locator('h1:visible')).toHaveCount(1);
  }
  expect((await page.goto('/nope'))?.status()).toBe(404); await expect(page.locator('#story')).toHaveCount(0);
});

test('both themes resolve the new window token before hydration', async ({ page }) => {
  for (const [theme, expected] of [['light', '#FFFDF8'], ['dark', '#241C3D']]) {
    await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' }); await page.goto('/');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--os-window').trim().toUpperCase())).toBe(expected);
  }
});

test('idle story loading follows os-ready and history restoration is manual', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { k2Ready: 0 });
    const observer = new MutationObserver(() => {
      if (document.documentElement?.classList.contains('os-ready')) { Object.assign(window, { k2Ready: performance.now() }); observer.disconnect(); }
    }); observer.observe(document, { subtree: true, attributes: true });
  });
  const requested = page.waitForResponse(response => /\/story-runtime\.[^/]+\.js/.test(response.url()));
  await page.goto('/'); await (await requested).finished();
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => /\/story-runtime\.[^/]+\.js/.test(entry.name)));
  await expect(page.locator('html')).toHaveClass(/os-ready/);
  expect(await page.evaluate(() => history.scrollRestoration)).toBe('manual');
  const timing = await page.evaluate(() => ({ ready: (window as unknown as { k2Ready: number }).k2Ready,
    runtime: performance.getEntriesByType('resource').find(entry => /\/story-runtime\.[^/]+\.js/.test(entry.name))!.startTime }));
  expect(timing.ready).toBeGreaterThan(0); expect(timing.runtime).toBeGreaterThanOrEqual(timing.ready);
});

test('saved prop offsets exist before module scripts run', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('serendib:props:v1', '{"tuktuk":{"dx":10,"dy":-5}}');
    const observer = new MutationObserver(() => {
      const html = document.documentElement;
      if (html?.style.getPropertyValue('--k-dx-tuktuk') === '10') {
        Object.assign(window, { k2Props: { dx: html.style.getPropertyValue('--k-dx-tuktuk'), dy: html.style.getPropertyValue('--k-dy-tuktuk'),
          ready: html.classList.contains('os-ready'), modules: document.querySelectorAll('script[type="module"]').length } }); observer.disconnect();
      }
    }); observer.observe(document, { subtree: true, attributes: true, childList: true });
  });
  await page.goto('/');
  expect(await page.evaluate(() => (window as unknown as { k2Props: unknown }).k2Props)).toEqual({ dx: '10', dy: '-5', ready: false, modules: 0 });
});

test('Simple view exposes the story, one h1 and no chrome', async ({ page }) => {
  await page.goto('/#simple'); await expect(page.locator('#story')).toBeVisible();
  await expect(page.locator('h1:visible')).toHaveCount(1); await expect(page.locator('.os-chrome:visible')).toHaveCount(0);
});

test('the legacy phone home keeps the story out of its translucent background', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/os-ready/);
  await expect(page.locator('.phone-home:visible')).toHaveCount(1);
  await expect(page.locator('#story')).toBeHidden();
  await page.goto('/#simple'); await expect(page.locator('#story')).toBeVisible();
});

test('the modal stack locks document scroll and releases it after Search closes', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  if (await page.locator('html').getAttribute('data-mode') === 'mobile') {
    const home = page.locator('[data-shell="mobile"] .phone-home');
    await expect(home).toBeVisible(); await home.getByRole('link', { name: 'Spotlight', exact: true }).click();
  } else await page.getByRole('button', { name: /^(Spotlight|Search)$/ }).click();
  await expect(page.getByRole('dialog', { name: 'Spotlight search' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/k-scroll-lock/);
  await page.keyboard.press('Escape'); await expect(page.locator('html')).not.toHaveClass(/k-scroll-lock/);
});

test('home and direct deep links have zero CLS and no console errors', async ({ page, browserName }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    Object.assign(window, { k2Cls: 0 });
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
      for (const entry of list.getEntries()) { const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as unknown as { k2Cls: number }).k2Cls += shift.value; }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  for (const path of ['/', '/projects/salli']) {
    await page.goto(path); await expect(page.locator('html')).toHaveClass(/os-ready/);
    if (path !== '/') await expect(page.locator('[data-window-id="projects"]')).not.toHaveAttribute('data-adopting');
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
    if (browserName === 'chromium') expect(await page.evaluate(() => (window as unknown as { k2Cls: number }).k2Cls)).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('home has no serious or critical axe violations on desktop and 390px phone', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? '')).map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  }
});

test('foundation captures the required light, dark, scrolled and phone screenshots', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'One stable set of visual artifacts'); mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme }); await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(artifacts, `home-${theme}-1440x900.png`) });
    await page.evaluate(() => scrollTo(0, 1200)); await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
    await page.screenshot({ path: resolve(artifacts, `home-${theme}-scrolled-1200.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(artifacts, 'home-light-390x844.png') });
});
