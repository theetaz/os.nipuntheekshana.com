import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, openApp } from './fixtures';

const artifacts = resolve('.astro/k11-artifacts');
const screenshots = resolve(artifacts, 'screenshots');
async function hydrated(page: Page) { await expect(page.locator('html')).toHaveClass(/os-ready/); }
async function observeBoot(page: Page) {
  await page.addInitScript(() => {
    const supported = PerformanceObserver.supportedEntryTypes;
    const measurements = { shifts: [] as unknown[], visibleAtLoad: false, removedAt: 0, cls: 0, lcp: 0, exitPhase: '', ready: false, inputAt: 0, modal: null as null | { name: string | null; modal: string | null; accessible: boolean; focused: boolean; isolated: boolean; visualHidden: string | null }, statuses: [] as string[],
      supportsCLS: supported.includes('layout-shift'), supportsLCP: supported.includes('largest-contentful-paint') };
    Object.assign(window, { bootMeasurements: measurements });
    const input = () => { if (!measurements.inputAt) measurements.inputAt = performance.now(); };
    window.addEventListener('keydown', input, true); window.addEventListener('pointerdown', input, true);
    const sample = () => {
      const visual = document.querySelector('.boot-screen');
      if (visual && getComputedStyle(visual).display !== 'none' && getComputedStyle(visual).visibility === 'visible') measurements.visibleAtLoad = true;
      const panel = document.querySelector('[role="dialog"][aria-label="Starting Kottu OS"]');
      if (panel && document.querySelector('[data-boot-managed]')) measurements.modal = {
        name: panel.getAttribute('aria-label'), modal: panel.getAttribute('aria-modal'),
        accessible: !panel.closest('[aria-hidden="true"], [inert]') && !!panel.getClientRects().length
          && getComputedStyle(panel).display !== 'none' && getComputedStyle(panel).visibility === 'visible',
        focused: panel === document.activeElement,
        isolated: !!document.querySelector('[data-shell]')?.closest('[inert]'),
        visualHidden: document.querySelector('.boot-screen')?.getAttribute('aria-hidden') ?? null,
      };
      const status = panel?.querySelector('[role="status"]')?.textContent
        ?? [...document.querySelectorAll('[role="status"]')].find(element => element.textContent === 'Ready')?.textContent;
      if (status && measurements.statuses.at(-1) !== status) measurements.statuses.push(status);
      const phase = document.documentElement?.dataset.bootExit;
      if (phase) {
        measurements.exitPhase = phase;
        const ready = document.querySelector('.boot-ready');
        if (ready) measurements.ready ||= getComputedStyle(ready).visibility === 'visible';
      }
    };
    // Observe transient ARIA, focus and CSS status in the browser, before a
    // loaded WebKit process can miss them between cross-process assertions.
    const frame = () => { sample(); if (!measurements.removedAt) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    document.addEventListener('animationend', sample, true);
    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.removedNodes].some(node => node instanceof Element && node.matches('.boot-screen')))) {
        measurements.removedAt = performance.now();
      }
      sample();
    });
    observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
    if (measurements.supportsCLS) new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) { measurements.cls += shift.value; measurements.shifts.push({ at: entry.startTime, value: shift.value, sources: (entry as unknown as { sources: { node?: Element; previousRect: DOMRect; currentRect: DOMRect }[] }).sources?.map(source => ({ node: source.node?.outerHTML.slice(0, 250), previous: source.previousRect, current: source.currentRect })) }); }
    } }).observe({ type: 'layout-shift', buffered: true });
    if (measurements.supportsLCP) new PerformanceObserver(list => { for (const entry of list.getEntries()) measurements.lcp = entry.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  });
}
async function measurements(page: Page) {
  return page.evaluate(() => (window as unknown as { bootMeasurements: { visibleAtLoad: boolean; removedAt: number; cls: number; lcp: number; exitPhase: string; ready: boolean; inputAt: number; modal: { name: string | null; modal: string | null; accessible: boolean; focused: boolean; isolated: boolean; visualHidden: string | null } | null; statuses: string[]; supportsCLS: boolean; supportsLCP: boolean } }).bootMeasurements);
}

test.describe('first visit boot', () => {
  test.use({ boot: true });
  test('takes over static HTML, persists once, leaves LCP before exit, and has zero CLS', async ({ page, context }, info) => {
    await observeBoot(page); await page.goto('/', { waitUntil: 'domcontentloaded' });
    await hydrated(page);
    await expect(page.locator('.boot-screen')).toHaveCount(0, { timeout: 1800 });
    expect(await page.evaluate(() => localStorage.getItem('serendib:booted'))).toBe('true');
    const timing = await measurements(page);
    await mkdir(artifacts, { recursive: true }); await writeFile(resolve(artifacts, `boot-${info.project.name}-metrics.json`), JSON.stringify(timing, null, 2));
    expect(timing.visibleAtLoad).toBe(true); expect(timing.removedAt).toBeLessThanOrEqual(info.project.name.startsWith('mobile') ? 1000 : 1800);
    expect(timing.exitPhase).toBe('normal'); expect(timing.ready).toBe(true);
    expect(timing.modal).toEqual({ name: 'Starting Kottu OS', modal: 'true', accessible: true, focused: true, isolated: true, visualHidden: 'true' });
    expect(timing.statuses).toEqual(['Starting Kottu OS', 'Ready']);
    await expect(page.getByRole('status').filter({ hasText: /^Ready$/ })).toHaveText('Ready');
    if (timing.supportsCLS) expect(timing.cls).toBe(0);
    if (timing.supportsLCP) { expect(timing.lcp).toBeGreaterThan(0); expect(timing.lcp).toBeLessThan(1300); }
    const second = await context.newPage();
    try {
      await second.goto('/'); await hydrated(second); await expect(second.locator('.boot-screen')).toHaveCount(0);
      await expect(second.locator('html')).not.toHaveAttribute('data-boot');
    } finally { await second.close(); }
  });
  test('static GRUB and ordered lines follow the desktop and phone CSS timelines @visual', async ({ page }, info) => {
    let release!: () => void; const hold = new Promise<void>(done => { release = done; });
    await page.route('**/Desktop.*.js', async route => { await hold; await route.continue(); });
    const mobile = info.project.name.startsWith('mobile');
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await mkdir(screenshots, { recursive: true });
    const at = async (ms: number) => page.locator('.boot-screen').evaluate((panel, ms) => {
      for (const animation of panel.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = ms; }
    }, ms);
    const capture = async (name: string) => {
      if (info.project.name !== 'mobile-webkit') await page.screenshot({ path: resolve(screenshots, `${name}-${info.project.name}.png`), scale: 'css', animations: 'allow' });
    };
    const lineTimes = mobile ? [300, 380, 460, 540, 700] : [600, 670, 740, 810, 880, 950, 1020, 1090, 1230];
    const shown = mobile ? [0, 2, 3, 7, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    try {
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto('/', { waitUntil: 'domcontentloaded' }); await at(0);
        await page.locator('.boot-screen').evaluate(async panel => {
          const style = getComputedStyle(panel);
          await document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily.split(',')[0]}`);
        });
        const widths = await page.locator('.boot-screen').evaluate(panel => {
          const probe = document.createElement('span');
          probe.style.cssText = 'position:absolute;visibility:hidden;width:1ch;'; panel.append(probe);
          const primary = probe.getBoundingClientRect().width;
          probe.style.fontFamily = 'Courier New'; const fallback = probe.getBoundingClientRect().width; probe.remove();
          return { primary, fallback };
        });
        expect(Math.abs(widths.primary - widths.fallback)).toBeLessThan(.05);
        await info.attach(`boot-font-metrics-${theme}`, { body: JSON.stringify(widths), contentType: 'application/json' });
        await expect(page.locator('.boot-screen')).toBeVisible();
        await expect(page.locator('.boot-screen')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('.boot-screen')).toHaveCSS('background-color', 'rgb(18, 13, 36)');
        await expect(page.locator('.boot-screen')).toHaveCSS('font-family', /Martian Mono/);
        await expect(page.locator('.boot-grub-entry')).toHaveText([
          '*Kottu OS 2.0 "Pettah"', ' Kottu OS 2.0 "Pettah" (recovery mode: extra rice)',
          ' Memtest86+ (chops your RAM into small pieces)', ' Simple view (no chrome, just text)',
        ]);
        await expect(page.locator('.boot-grub-selected')).toHaveCSS('background-color', 'rgb(255, 201, 60)');
        await expect(page.locator('.boot-countdown-one')).toBeVisible();
        await expect(page.locator('.boot-countdown-zero')).toBeHidden();
        await capture(`grub-${theme}`);
        if (!mobile) {
          await at(400); await expect(page.locator('.boot-countdown-one')).toBeHidden();
          await expect(page.locator('.boot-countdown-zero')).toBeVisible();
        }
        for (const [step, ms] of lineTimes.entries()) {
          await at(ms - 1); await expect(page.locator('.boot-line').nth(shown[step]!)).toBeHidden();
          await at(ms); await expect(page.locator('.boot-grub')).toBeHidden();
          for (const [index, line] of (await page.locator('.boot-line').all()).entries()) {
            if (shown.slice(0, step + 1).includes(index)) await expect(line).toBeVisible();
            else await expect(line).toBeHidden();
          }
          if (step === 2) await capture(`mid-lines-${theme}`);
        }
        const last = page.locator('.boot-line').last();
        await expect(last).toContainText('Starting Hyprland on tty1…');
        await expect(page.locator('.boot-pending')).toBeVisible(); await expect(page.locator('.boot-ready')).toBeHidden();
        const before = await last.boundingBox();
        await page.locator('html').evaluate(html => html.classList.add('os-ready'));
        await at(mobile ? 749 : 1329); await expect(page.locator('.boot-ready')).toBeHidden();
        await at(mobile ? 750 : 1330); await expect(page.locator('.boot-ready')).toBeVisible();
        await expect(page.locator('.boot-pending')).toBeHidden();
        expect(await last.boundingBox()).toEqual(before);
        await expect(page.locator('.boot-ready .boot-ok')).toHaveCSS('color', 'rgb(85, 209, 132)');
        await capture(`last-line-${theme}`);
        await page.locator('html').evaluate(html => html.classList.remove('os-ready'));
        await expect(page.locator('.boot-ready')).toBeHidden(); await expect(page.locator('.boot-pending')).toBeVisible();
        // A late hydration signal must replace the pending marker immediately.
        await page.locator('html').evaluate(html => html.classList.add('os-ready'));
        await expect(page.locator('.boot-ready')).toBeVisible(); await expect(page.locator('.boot-pending')).toBeHidden();
        await page.locator('html').evaluate(html => html.classList.remove('os-ready'));
        expect(await page.locator('.boot-screen').evaluate(panel => panel.scrollWidth <= panel.clientWidth)).toBe(true);
      }
    } finally { release(); }
  });
  for (const input of ['key', 'pointer'] as const) {
    test(`${input} at 200 ms skips within 250 ms and cannot launch a desktop action`, async ({ page }) => {
      await observeBoot(page); await page.goto('/', { waitUntil: 'domcontentloaded' }); await hydrated(page);
      await page.waitForFunction(() => performance.now() >= 200);
      if (input === 'key') await page.keyboard.press('Control+k'); else await page.mouse.click(700, 400);
      await expect(page.locator('.boot-screen')).toHaveCount(0);
      const timing = await measurements(page); expect(timing.inputAt).toBeGreaterThanOrEqual(200);
      expect(timing.removedAt - timing.inputAt).toBeLessThanOrEqual(250);
      await expect(page.locator('[data-window-id]')).toHaveCount(0);
      await expect(page.getByRole('combobox')).toHaveCount(0);
    });
  }
  test('input while the boot controller loads is consumed and replayed as a skip', async ({ page }) => {
    await observeBoot(page);
    let release!: () => void; const hold = new Promise<void>(done => { release = done; });
    await page.route('**/BootController.*.js', async route => { await hold; await route.continue(); });
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' }); await hydrated(page);
      await page.keyboard.press('Control+k'); release();
      await expect(page.locator('.boot-screen')).toHaveCount(0);
      const timing = await measurements(page); expect(timing.exitPhase).toBe('skip');
      expect(timing.removedAt - timing.inputAt).toBeLessThanOrEqual(250);
      await expect(page.getByRole('combobox')).toHaveCount(0);
    } finally { release(); }
  });
  for (const [name, setup] of [
    ['system reduced motion', async (page: Page) => page.emulateMedia({ reducedMotion: 'reduce' })],
    ['saved reduced motion', async (page: Page) => page.addInitScript(() => localStorage.setItem('serendib:motion', '"reduce"'))],
    ['simple view', async (page: Page) => page.addInitScript(() => localStorage.setItem('serendib:view', '"simple"'))],
  ] as const) {
    test(`${name} skips boot from the first paint`, async ({ page }) => {
      await setup(page); await page.goto('/'); await expect(page.locator('html')).not.toHaveAttribute('data-boot');
      await expect(page.locator('.boot-screen')).toBeHidden();
    });
  }
  test('deep links and Simple hash never show boot', async ({ page }) => {
    for (const path of ['/projects', '/#simple']) {
      await page.goto(path); await expect(page.locator('html')).not.toHaveAttribute('data-boot');
      await expect(page.locator('.boot-screen')).toBeHidden();
    }
  });
  test('bots and no-JS visits keep the static desktop usable', async ({ browser }) => {
    for (const options of [{ userAgent: 'SerendibTestCrawler' }, { javaScriptEnabled: false }]) {
      const context = await browser.newContext(options);
      try {
        const page = await context.newPage(); await page.goto('/');
        await expect(page.locator('html')).not.toHaveAttribute('data-boot'); await expect(page.locator('.boot-screen')).toBeHidden();
        await expect(page.getByRole('heading', { name: 'Nipun Theekshana', exact: true })).toBeVisible();
      } finally { await context.close(); }
    }
  });
  test('mobile boot is removed by 1000 ms without shifting layout', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 }); await observeBoot(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.boot-screen')).toHaveCount(0);
    const timing = await measurements(page); expect(timing.visibleAtLoad).toBe(true); expect(timing.removedAt).toBeLessThanOrEqual(1000); if (timing.supportsCLS) expect(timing.cls).toBe(0);
    await mkdir(artifacts, { recursive: true }); await writeFile(resolve(artifacts, `boot-mobile-${info.project.name}-metrics.json`), JSON.stringify(timing, null, 2));
  });
  test('slow hydration keeps the CSS fail-safe and does not replay a finished boot', async ({ page }) => {
    let release!: () => void; const hold = new Promise<void>(done => { release = done; });
    await page.route('**/Desktop.*.js', async route => { await hold; await route.continue(); });
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.locator('.boot-screen')).toBeVisible();
      await expect(page.locator('.boot-screen')).toBeHidden({ timeout: 1800 }); release(); await hydrated(page);
      await expect(page.locator('.boot-screen')).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem('serendib:booted'))).toBe('true');
    } finally { release(); }
  });
  test('hydrating during the CSS exit finishes directly without brightening the overlay', async ({ page }) => {
    await observeBoot(page);
    let release!: () => void; const hold = new Promise<void>(done => { release = done; });
    await page.route('**/Desktop.*.js', async route => { await hold; await route.continue(); });
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.locator('.boot-screen')).toBeVisible();
      await page.waitForFunction(() => performance.now() >= 1350); release(); await hydrated(page);
      await expect(page.locator('.boot-screen')).toHaveCount(0);
      const timing = await measurements(page); expect(timing.removedAt).toBeLessThan(1600); expect(timing.exitPhase).toBe('');
      expect(await page.evaluate(() => localStorage.getItem('serendib:booted'))).toBe('true');
    } finally { release(); }
  });
  test('storage denial cannot prevent dismissal', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }));
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/'); await hydrated(page); await page.keyboard.press('Escape');
    await expect(page.locator('.boot-screen')).toHaveCount(0); expect(errors).toEqual([]);
  });
});

test.describe('Kottu power commands', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  let fixtureDirectory: string; let fixtureHtml: string;
  test.beforeAll(async ({}, info) => {
    fixtureDirectory = resolve(root, `.astro/k11-power-fixture-${info.workerIndex}`);
    await mkdir(fixtureDirectory, { recursive: true });
    const home = await readFile(resolve(root, 'dist/client/index.html'), 'utf8');
    const island = home.match(/<astro-island\b[^>]*component-export="default"[^>]*>/)![0];
    const serialized = JSON.parse(island.match(/ props="([^"]*)"/)![1]!.replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    const decode = ([type, value]: [number, unknown]): unknown => type === 1
      ? (value as [number, unknown][]).map(decode)
      : type === 0 && value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item as [number, unknown])])) : value;
    const props = Object.fromEntries(Object.entries(serialized).map(([key, value]) => [key, decode(value as [number, unknown])]));
    await writeFile(resolve(fixtureDirectory, 'entry.tsx'), `import React from 'react';
import { createRoot } from 'react-dom/client';
import Desktop from '../../src/os/Desktop';
import PowerHarness from '../../tests/fixtures/p2-9/PowerHarness';
createRoot(document.getElementById('k11-power-island')!).render(<><Desktop {...${JSON.stringify(props)}} /><PowerHarness /></>);`);
    await writeFile(resolve(fixtureDirectory, 'index.html'), '<!doctype html><html><head><title>Power verification</title></head><body><script type="module" src="./entry.tsx"></script></body></html>');
    // Build only the real client shell and observation harness. Astro's pages,
    // font copying and image pipeline have already been verified by the main build.
    await build({ configFile: false, root: fixtureDirectory, base: '/__k11-power/', plugins: [tailwindcss()],
      esbuild: { jsx: 'automatic' }, build: { outDir: resolve(fixtureDirectory, 'dist'), emptyOutDir: true }, logLevel: 'error' });
    const entry = await readFile(resolve(fixtureDirectory, 'dist/index.html'), 'utf8');
    const assets = entry.match(/<(?:script|link)\b[^>]*(?:src|href)="\/__k11-power\/[^>]*(?:><\/script>|>)/g)!.join('');
    fixtureHtml = home.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, script =>
      script.includes('localStorage') && script.includes('dataset.mode') ? script : '')
      .replace(/<astro-island\b[^>]*>/, '<div id="k11-power-island">').replace('</astro-island>', '</div>')
      .replace('</head>', `${assets}</head>`);
  });
  test.afterAll(async () => { if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true }); });
  async function openFixture(page: Page) {
    await page.route('**/__k11-power/**', async route => {
      const path = new URL(route.request().url()).pathname.slice('/__k11-power/'.length);
      if (!path) await route.fulfill({ contentType: 'text/html', body: fixtureHtml });
      else await route.fulfill({ body: await readFile(resolve(fixtureDirectory, 'dist', path)),
        contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
    });
    await page.route('**/', route => new URL(route.request().url()).pathname === '/'
      ? route.fulfill({ contentType: 'text/html', body: fixtureHtml }) : route.continue());
    await page.goto('/'); await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('data-power-probe', 'ready');
  }
  async function command(page: Page, name: string) {
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    const island = page.getByRole('menubar').getByRole('menuitem', { name: 'Kottu menu', exact: true });
    if (await island.isVisible()) {
      await island.click(); await page.getByRole('menuitem', { name, exact: true }).click();
    } else {
      // Phone power uses the same public command bus without desktop menu targets.
      const id = name === 'Suspend' ? 'os.sleep' : name === 'Reboot…' ? 'os.restart' : 'os.shutdown';
      await page.evaluate(command => (window as unknown as { powerFixture: { command(value: string): void } }).powerFixture.command(command), id);
    }
    await expect(name === 'Suspend' ? page.getByRole('dialog', { name: 'Night Mail screensaver' }) : page.getByRole('alertdialog')).toBeVisible();
  }
  async function confirm(page: Page, name: string) { await page.getByRole('alertdialog').getByRole('button', { name, exact: true }).click(); }
  async function setHidden(page: Page, hidden: boolean) {
    await page.evaluate(value => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  }
  test('shutdown confirmation can cancel, staggers closes, and any key reboots', async ({ page }) => {
    await openFixture(page); await openApp(page, 'Projects');
    await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
    await openApp(page, 'Terminal');
    await command(page, 'Power off…'); await confirm(page, 'Cancel'); await expect(page.locator('[data-window-id]')).toHaveCount(2);
    await command(page, 'Power off…'); await confirm(page, 'Shut down');
    const shutdown = page.getByRole('dialog', { name: "It's now safe to close this tab." }); await expect(shutdown).toBeVisible();
    await expect(shutdown).toHaveCSS('color', 'rgb(255, 201, 60)');
    await expect(shutdown.getByRole('button')).toBeFocused(); await expect(page.locator('[data-window-id]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    const closed = await page.evaluate(() => (window as unknown as { powerFixture: { closed: { id: string; at: number }[] } }).powerFixture.closed);
    expect(closed.map(value => value.id)).toEqual(['terminal', 'projects']); expect(closed[1]!.at - closed[0]!.at).toBeGreaterThanOrEqual(55);
    await page.keyboard.press('Control+k'); await expect(shutdown).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { powerFixture: { spotlight(): boolean } }).powerFixture.spotlight())).toBe(false);
    await expect(page.getByRole('dialog', { name: 'Starting Kottu OS' })).toBeVisible(); await page.keyboard.press('Escape');
    await expect(page.locator('.boot-screen')).toHaveCount(0); await expect(page.locator('[data-shell]').first()).not.toHaveAttribute('inert');
    if (await page.locator('html').getAttribute('data-mode') === 'desktop') {
    await expect(page.getByRole('menubar').getByRole('menuitem', { name: 'Kottu menu', exact: true })).toBeFocused();
    }
    expect(await page.locator('[data-shell]').first().evaluate(element => !!element.closest('[inert]'))).toBe(false);
  });
  test('close guards cancel a power operation', async ({ page }) => {
    await openFixture(page); await openApp(page, 'Projects');
    await page.evaluate(() => (window as unknown as { powerFixture: { guard(): void } }).powerFixture.guard());
    await command(page, 'Power off…'); await confirm(page, 'Shut down');
    await expect(page.locator('[data-window-id]')).toHaveCount(1); await expect(page.locator('.shutdown-screen')).toHaveCount(0);
  });
  test('restart closes windows, returns URL home and replays after a persisted boot', async ({ page }) => {
    await openFixture(page); await openApp(page, 'Projects');
    await command(page, 'Reboot…'); await confirm(page, 'Restart');
    await expect(page.locator('[data-window-id]')).toHaveCount(0); await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog', { name: 'Starting Kottu OS' })).toBeVisible();
    await page.mouse.click(700, 400); await expect(page.locator('.boot-screen')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('serendib:booted'))).toBe('true');
  });
  test('sleep retains windows, shows Colombo time and consumes wake shortcuts', async ({ page }) => {
    await openFixture(page); await openApp(page, 'Projects');
    await command(page, 'Suspend'); const saver = page.getByRole('dialog', { name: 'Night Mail screensaver' });
    await expect(saver).toBeVisible(); await expect(saver.locator('time')).toHaveText('23:11');
    await expect(saver).toHaveCSS('background-color', 'rgb(18, 13, 36)');
    await expect(saver.locator('time')).toHaveCSS('font-family', /Shrikhand/);
    await expect(saver.locator('time')).toHaveCSS('font-size', '64px');
    await expect(saver.locator('time')).toHaveCSS('color', 'rgb(255, 201, 60)');
    await expect(saver.locator('.screensaver-clock p')).toHaveCSS('font-family', /Martian Mono/);
    await expect(saver.getByRole('img', { name: 'Mochi asleep' })).toBeVisible();
    await expect(saver.getByRole('button')).toBeFocused();
    expect(await page.locator('[data-shell]').first().evaluate(element => !!element.closest('[inert]'))).toBe(true);
    await page.keyboard.press('Control+k'); await expect(saver).toHaveCount(0); await expect(page.locator('[data-window-id]')).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { powerFixture: { overlay(): string } }).powerFixture.overlay())).toBe('none');
    expect(await page.evaluate(() => (window as unknown as { powerFixture: { spotlight(): boolean } }).powerFixture.spotlight())).toBe(false);
    if (await page.locator('html').getAttribute('data-mode') === 'desktop') {
    await expect(page.getByRole('menubar').getByRole('menuitem', { name: 'Kottu menu', exact: true })).toBeFocused();
    }
    await command(page, 'Suspend'); await page.getByRole('button', { name: 'Press any key or tap to wake.' }).dispatchEvent('click');
    await expect(saver).toHaveCount(0);
    await command(page, 'Suspend'); await saver.dispatchEvent('pointerdown', { pointerType: 'touch' }); await expect(saver).toHaveCount(0);
  });
  test('live motion overrides stop drift and dismiss an active boot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await openFixture(page);
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('full'));
    await command(page, 'Suspend'); await expect(page.locator('.screensaver-island')).toHaveCSS('animation-name', 'night-mail-drift');
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('reduce'));
    await expect(page.locator('.screensaver-island')).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Escape'); await expect(page.locator('.screensaver')).toHaveCount(0);
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('full'));
    await command(page, 'Reboot…'); await confirm(page, 'Restart'); await expect(page.locator('.boot-screen')).toBeVisible();
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('reduce'));
    await expect(page.locator('.boot-screen')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('serendib:motion'))).toBe('"reduce"');
  });
  test('reduced motion makes sleep static and skips restart and shutdown boots', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await openFixture(page); await command(page, 'Suspend');
    await expect(page.locator('.screensaver-island')).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Tab'); await expect(page.locator('.screensaver')).toHaveCount(0);
    await command(page, 'Reboot…'); await confirm(page, 'Restart'); await expect(page.locator('.boot-screen')).toHaveCount(0);
    await command(page, 'Power off…'); await confirm(page, 'Shut down'); await expect(page.locator('.shutdown-screen')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('.shutdown-screen')).toHaveCount(0);
    await expect(page.locator('.boot-screen')).toHaveCount(0); await expect(page.locator('[data-shell]').first()).not.toHaveAttribute('inert');
  });
  test('never sleeps automatically, even after a long idle period', async ({ page }) => {
    await page.clock.install(); await openFixture(page); await page.clock.fastForward(3_600_000);
    await expect(page.locator('.screensaver')).toHaveCount(0);
  });
  test('hidden screensaver pauses drift and its clock, then catches up on visibility', async ({ page }) => {
    await openFixture(page); await page.clock.install({ time: new Date('2026-10-11T17:41:00Z') }); await command(page, 'Suspend');
    await expect(page.locator('.screensaver time')).toHaveText('23:11'); await setHidden(page, true);
    expect(await page.locator('.screensaver-island').evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
    await page.clock.fastForward(120_000); await expect(page.locator('.screensaver time')).toHaveText('23:11');
    await setHidden(page, false); await expect(page.locator('.screensaver time')).toHaveText('23:13');
  });
  test('boot status dialog is accessible and modal until completion @a11y', async ({ page }) => {
    await openFixture(page);
    await page.evaluate(() => Object.assign(window, { k11NativeTimers: {
      setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
      requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    } }));
    await page.clock.install({ time: new Date('2026-10-11T17:41:00Z') });
    await command(page, 'Reboot…'); await confirm(page, 'Restart');
    const dialog = page.getByRole('dialog', { name: 'Starting Kottu OS' });
    await expect(dialog).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 10).toISOString()));
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toBeFocused(); await expect(dialog.getByRole('status')).toHaveText('Starting Kottu OS');
    await expect(page.locator('.boot-screen')).toHaveAttribute('aria-hidden', 'true');
    // Keep the already-scheduled boot deadline paused while axe's own timers run.
    await page.evaluate(() => Object.assign(window, (window as unknown as { k11NativeTimers: object }).k11NativeTimers));
    const scan = await new AxeBuilder({ page }).include('[role="dialog"][aria-label="Starting Kottu OS"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations).toEqual([]);
    await page.clock.runFor(2000);
    await expect(page.locator('.boot-screen')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /^Ready$/ })).toHaveText('Ready');
  });
  test('overlays are accessible in both themes and capture desktop/mobile screenshots without console errors @visual @a11y', async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await mkdir(screenshots, { recursive: true });
    for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme }); await openFixture(page);
        await command(page, 'Reboot…'); await confirm(page, 'Restart');
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        await expect(page.locator('.boot-screen')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.boot-screen')).toHaveCount(0); await command(page, 'Suspend');
        await expect(page.locator('.screensaver time')).toHaveText('23:11');
        const sleepScan = await new AxeBuilder({ page }).include('.screensaver').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(sleepScan.violations).toEqual([]);
        await page.screenshot({ path: resolve(screenshots, `suspend-${theme}-${mode}-${info.project.name}.png`), scale: 'css' }); await page.keyboard.press('Escape');
        await expect(page.locator('.screensaver')).toHaveCount(0); await command(page, 'Power off…'); await confirm(page, 'Shut down');
        await expect(page.locator('.shutdown-copy')).toHaveCSS('opacity', '1');
        const shutdownScan = await new AxeBuilder({ page }).include('.shutdown-screen').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(shutdownScan.violations).toEqual([]);
        await page.screenshot({ path: resolve(screenshots, `power-off-${theme}-${mode}-${info.project.name}.png`), scale: 'css' }); await page.keyboard.press('Escape');
        await expect(page.locator('.boot-screen')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('.boot-screen')).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
  });
});
