import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const artifacts = resolve('.astro/p2-9-artifacts');
async function hydrated(page: Page) { await expect(page.locator('html')).toHaveClass(/os-ready/); }
async function observeBoot(page: Page) {
  await page.addInitScript(() => {
    const supported = PerformanceObserver.supportedEntryTypes;
    const measurements = { removedAt: 0, cls: 0, lcp: 0, exitPhase: '', progress: 0, inputAt: 0,
      supportsCLS: supported.includes('layout-shift'), supportsLCP: supported.includes('largest-contentful-paint') };
    Object.assign(window, { bootMeasurements: measurements });
    const input = () => { if (!measurements.inputAt) measurements.inputAt = performance.now(); };
    window.addEventListener('keydown', input, true); window.addEventListener('pointerdown', input, true);
    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.removedNodes].some(node => node instanceof Element && node.matches('.boot-screen')))) {
        measurements.removedAt = performance.now();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    new MutationObserver(() => {
      const phase = document.documentElement.dataset.bootExit;
      if (!phase) return;
      measurements.exitPhase = phase;
      const fill = document.querySelector('.boot-progress span');
      if (fill) measurements.progress = new DOMMatrix(getComputedStyle(fill).transform).a;
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-boot-exit'] });
    if (measurements.supportsCLS) new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) measurements.cls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
    if (measurements.supportsLCP) new PerformanceObserver(list => { for (const entry of list.getEntries()) measurements.lcp = entry.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  });
}
async function measurements(page: Page) {
  return page.evaluate(() => (window as unknown as { bootMeasurements: { removedAt: number; cls: number; lcp: number; exitPhase: string; progress: number; inputAt: number; supportsCLS: boolean; supportsLCP: boolean } }).bootMeasurements);
}

test.describe('first visit boot', () => {
  test.use({ boot: true });
  test('takes over static HTML, persists once, leaves LCP before exit, and has zero CLS', async ({ page, context }) => {
    await observeBoot(page); await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.boot-screen')).toBeVisible(); await hydrated(page);
    await expect(page.getByRole('dialog', { name: 'Starting Serendib' })).toHaveAttribute('aria-modal', 'true');
    const bootScan = await new AxeBuilder({ page }).include('.boot-screen').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(bootScan.violations).toEqual([]);
    await expect(page.locator('.boot-screen')).toHaveCount(0, { timeout: 1800 });
    expect(await page.evaluate(() => localStorage.getItem('serendib:booted'))).toBe('true');
    const timing = await measurements(page); expect(timing.removedAt).toBeLessThanOrEqual(1800);
    expect(timing.exitPhase).toBe('normal'); expect(timing.progress).toBe(1);
    if (timing.supportsCLS) expect(timing.cls).toBe(0);
    if (timing.supportsLCP) { expect(timing.lcp).toBeGreaterThan(0); expect(timing.lcp).toBeLessThan(1300); }
    await mkdir(artifacts, { recursive: true }); await writeFile(resolve(artifacts, 'boot-desktop-metrics.json'), JSON.stringify(timing, null, 2));
    const second = await context.newPage();
    try {
      await second.goto('/'); await hydrated(second); await expect(second.locator('.boot-screen')).toHaveCount(0);
      await expect(second.locator('html')).not.toHaveAttribute('data-boot');
    } finally { await second.close(); }
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
      await expect(page.getByRole('dialog', { name: 'Spotlight search' })).toHaveCount(0);
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
  test('mobile boot is removed by 950 ms without shifting layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await observeBoot(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' }); await expect(page.locator('.boot-screen')).toBeVisible();
    await expect(page.locator('.boot-screen')).toHaveCount(0);
    const timing = await measurements(page); expect(timing.removedAt).toBeLessThanOrEqual(1000); if (timing.supportsCLS) expect(timing.cls).toBe(0);
    await mkdir(artifacts, { recursive: true }); await writeFile(resolve(artifacts, 'boot-mobile-metrics.json'), JSON.stringify(timing, null, 2));
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

test.describe('integrated power commands', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  let server: ChildProcess; let origin: string; let fixtureDirectory: string;
  test.beforeAll(async ({}, info) => {
    const port = 4700 + info.workerIndex; origin = `http://localhost:${port}`;
    fixtureDirectory = resolve(root, `.astro/p2-9-fixture-${info.workerIndex}`);
    await mkdir(resolve(fixtureDirectory, 'pages'), { recursive: true });
    await writeFile(resolve(fixtureDirectory, 'config.mjs'), `import base from '../../astro.config.mjs';
export default { ...base, adapter: undefined, srcDir: '.astro/p2-9-fixture-${info.workerIndex}/', cacheDir: '.astro/p2-9-fixture-${info.workerIndex}/cache/', outDir: '.astro/p2-9-fixture-${info.workerIndex}/dist/',
  vite: { ...base.vite, cacheDir: '.astro/p2-9-fixture-${info.workerIndex}/vite-cache/' } };`);
    await writeFile(resolve(fixtureDirectory, 'pages/index.astro'), `---
import OsLayout from '../../../src/layouts/OsLayout.astro';
import PowerHarness from '../../../tests/fixtures/p2-9/PowerHarness';
import { seoFor } from '../../../src/lib/seo';
const seo = seoFor({ path: '/', title: 'Power verification', description: 'Power integration verification', kind: 'home' });
---
<OsLayout seo={seo} initial={null} home><Fragment slot="after-main"><PowerHarness client:load /></Fragment></OsLayout>`);
    await new Promise<void>((done, reject) => {
      const build = spawn('npm', ['run', 'build', '--', '--config', `.astro/p2-9-fixture-${info.workerIndex}/config.mjs`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; build.stdout.on('data', chunk => { output += chunk; }); build.stderr.on('data', chunk => { output += chunk; });
      build.once('error', reject); build.once('exit', code => code === 0 ? done() : reject(new Error(`Power fixture build failed: ${output}`)));
    });
    await cp(resolve(root, 'dist/client/data'), resolve(fixtureDirectory, 'dist/data'), { recursive: true });
    // Standalone static fixtures expose the backend-unavailable health contract.
    await mkdir(resolve(fixtureDirectory, 'dist/api'), { recursive: true });
    await writeFile(resolve(fixtureDirectory, 'dist/api/health'), JSON.stringify({ ai: false, postcards: false }));
    server = spawn('npx', ['astro', 'preview', '--config', `.astro/p2-9-fixture-${info.workerIndex}/config.mjs`, '--ignore-lock', '--host', 'localhost', '--port', String(port)], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    await new Promise<void>((done, reject) => {
      let log = '';
      const timer = setTimeout(() => reject(new Error('Power fixture server did not become ready')), 60_000);
      const output = (chunk: Buffer) => { log = (log + chunk.toString()).slice(-16_000); if (chunk.toString().includes(`localhost:${port}`)) { clearTimeout(timer); done(); } };
      server.stdout?.on('data', output); server.stderr?.on('data', output);
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Power fixture server exited: ${code}\n${log}`)); });
    });
  });
  test.afterAll(async () => {
    if (server?.pid) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      await new Promise<void>(done => { if (server.exitCode !== null || server.signalCode !== null) done(); else server.once('exit', () => done()); });
    }
    if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
  });
  async function openFixture(page: Page) { await page.goto(origin); await hydrated(page); await expect(page.locator('html')).toHaveAttribute('data-power-probe', 'ready'); }
  async function command(page: Page, name: string) {
    const island = page.getByRole('menubar').getByRole('menuitem', { name: 'Island menu', exact: true });
    if (await island.isVisible()) {
      await island.click(); await page.getByRole('menuitem', { name, exact: true }).click();
    } else {
      // Pocket's menu UI arrives in P4; exercise the same public command bus here.
      const id = name === 'Sleep' ? 'os.sleep' : name === 'Restart…' ? 'os.restart' : 'os.shutdown';
      await page.evaluate(command => (window as unknown as { powerFixture: { command(value: string): void } }).powerFixture.command(command), id);
    }
    await expect(name === 'Sleep' ? page.getByRole('dialog', { name: 'Night Mail screensaver' }) : page.getByRole('alertdialog')).toBeVisible();
  }
  async function confirm(page: Page, name: string) { await page.getByRole('alertdialog').getByRole('button', { name, exact: true }).click(); }
  async function setHidden(page: Page, hidden: boolean) {
    await page.evaluate(value => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  }
  test('shutdown confirmation can cancel, staggers closes, and any key reboots', async ({ page }) => {
    await openFixture(page); await page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: 'Projects', exact: true }).click();
    await page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: 'Terminal', exact: true }).click();
    await command(page, 'Shut down…'); await confirm(page, 'Cancel'); await expect(page.locator('[data-window-id]')).toHaveCount(2);
    await command(page, 'Shut down…'); await confirm(page, 'Shut down');
    const shutdown = page.getByRole('dialog', { name: "It's now safe to close this tab." }); await expect(shutdown).toBeVisible();
    await expect(shutdown.getByRole('button')).toBeFocused(); await expect(page.locator('[data-window-id]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    const closed = await page.evaluate(() => (window as unknown as { powerFixture: { closed: { id: string; at: number }[] } }).powerFixture.closed);
    expect(closed.map(value => value.id)).toEqual(['terminal', 'projects']); expect(closed[1]!.at - closed[0]!.at).toBeGreaterThanOrEqual(55);
    await page.keyboard.press('Control+k'); await expect(shutdown).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { powerFixture: { spotlight(): boolean } }).powerFixture.spotlight())).toBe(false);
    await expect(page.getByRole('dialog', { name: 'Starting Serendib' })).toBeVisible(); await page.keyboard.press('Escape');
    await expect(page.locator('.boot-screen')).toHaveCount(0); await expect(page.locator('[data-shell="desktop"]')).not.toHaveAttribute('inert');
    await expect(page.getByRole('menubar').getByRole('menuitem', { name: 'Island menu', exact: true })).toBeFocused();
    expect(await page.locator('[data-shell="desktop"]').evaluate(element => !!element.closest('[inert]'))).toBe(false);
  });
  test('close guards cancel a power operation', async ({ page }) => {
    await openFixture(page); await page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: 'Projects', exact: true }).click();
    await page.evaluate(() => (window as unknown as { powerFixture: { guard(): void } }).powerFixture.guard());
    await command(page, 'Shut down…'); await confirm(page, 'Shut down');
    await expect(page.locator('[data-window-id]')).toHaveCount(1); await expect(page.locator('.shutdown-screen')).toHaveCount(0);
  });
  test('restart closes windows, returns URL home and replays after a persisted boot', async ({ page }) => {
    await openFixture(page); await page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: 'Projects', exact: true }).click();
    await command(page, 'Restart…'); await confirm(page, 'Restart');
    await expect(page.locator('[data-window-id]')).toHaveCount(0); await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog', { name: 'Starting Serendib' })).toBeVisible();
    await page.mouse.click(700, 400); await expect(page.locator('.boot-screen')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('serendib:booted'))).toBe('true');
  });
  test('sleep retains windows, shows Colombo time and consumes wake shortcuts', async ({ page }) => {
    await openFixture(page); await page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: 'Projects', exact: true }).click();
    await command(page, 'Sleep'); const saver = page.getByRole('dialog', { name: 'Night Mail screensaver' });
    await expect(saver).toBeVisible(); await expect(saver.locator('time')).toHaveText('23:11');
    await expect(saver.getByRole('img', { name: 'Mochi asleep' })).toBeVisible();
    await expect(saver.getByRole('button')).toBeFocused();
    expect(await page.locator('[data-shell="desktop"]').evaluate(element => !!element.closest('[inert]'))).toBe(true);
    await page.keyboard.press('Control+k'); await expect(saver).toHaveCount(0); await expect(page.locator('[data-window-id]')).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { powerFixture: { overlay(): string } }).powerFixture.overlay())).toBe('none');
    expect(await page.evaluate(() => (window as unknown as { powerFixture: { spotlight(): boolean } }).powerFixture.spotlight())).toBe(false);
    await expect(page.getByRole('menubar').getByRole('menuitem', { name: 'Island menu', exact: true })).toBeFocused();
    await command(page, 'Sleep'); await page.getByRole('button', { name: 'Press any key or tap to wake.' }).dispatchEvent('click');
    await expect(saver).toHaveCount(0);
    await command(page, 'Sleep'); await saver.dispatchEvent('pointerdown', { pointerType: 'touch' }); await expect(saver).toHaveCount(0);
  });
  test('live motion overrides stop drift and dismiss an active boot', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await openFixture(page);
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('full'));
    await command(page, 'Sleep'); await expect(page.locator('.screensaver-island')).toHaveCSS('animation-name', 'night-mail-drift');
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('reduce'));
    await expect(page.locator('.screensaver-island')).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Escape'); await expect(page.locator('.screensaver')).toHaveCount(0);
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('full'));
    await command(page, 'Restart…'); await confirm(page, 'Restart'); await expect(page.locator('.boot-screen')).toBeVisible();
    await page.evaluate(() => (window as unknown as { powerFixture: { setMotion(value: string): void } }).powerFixture.setMotion('reduce'));
    await expect(page.locator('.boot-screen')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('serendib:motion'))).toBe('"reduce"');
  });
  test('reduced motion makes sleep static and skips restart and shutdown boots', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await openFixture(page); await command(page, 'Sleep');
    await expect(page.locator('.screensaver-island')).toHaveCSS('animation-name', 'none');
    await page.keyboard.press('Tab'); await expect(page.locator('.screensaver')).toHaveCount(0);
    await command(page, 'Restart…'); await confirm(page, 'Restart'); await expect(page.locator('.boot-screen')).toHaveCount(0);
    await command(page, 'Shut down…'); await confirm(page, 'Shut down'); await expect(page.locator('.shutdown-screen')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('.shutdown-screen')).toHaveCount(0);
    await expect(page.locator('.boot-screen')).toHaveCount(0); await expect(page.locator('[data-shell="desktop"]')).not.toHaveAttribute('inert');
  });
  test('never sleeps automatically, even after a long idle period', async ({ page }) => {
    await page.clock.install(); await openFixture(page); await page.clock.fastForward(3_600_000);
    await expect(page.locator('.screensaver')).toHaveCount(0);
  });
  test('hidden screensaver pauses drift and its clock, then catches up on visibility', async ({ page }) => {
    await openFixture(page); await page.clock.install({ time: new Date('2026-10-11T17:41:00Z') }); await command(page, 'Sleep');
    await expect(page.locator('.screensaver time')).toHaveText('23:11'); await setHidden(page, true);
    expect(await page.locator('.screensaver-island').evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
    await page.clock.fastForward(120_000); await expect(page.locator('.screensaver time')).toHaveText('23:11');
    await setHidden(page, false); await expect(page.locator('.screensaver time')).toHaveText('23:13');
  });
  test('overlays are accessible in both themes and capture desktop/mobile screenshots without console errors @visual @a11y', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await mkdir(artifacts, { recursive: true });
    for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme }); await openFixture(page);
        await command(page, 'Restart…'); await confirm(page, 'Restart');
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        await expect(page.locator('.boot-screen')).toBeVisible();
        // Read at the animation's completion, inside the same browser task. Mobile's
        // fully visible plateau is 50 ms, too short for a cross-process polling retry.
        const wordmarkOpacity = await page.locator('.boot-wordmark').evaluate(async element => {
          await Promise.all(element.getAnimations().map(animation => animation.finished));
          return getComputedStyle(element).opacity;
        });
        expect(wordmarkOpacity).toBe('1');
        await page.screenshot({ path: resolve(artifacts, `boot-${theme}-${mode}.png`) }); await page.keyboard.press('Escape');
        await expect(page.locator('.boot-screen')).toHaveCount(0); await command(page, 'Sleep');
        await expect(page.locator('.screensaver time')).toHaveText('23:11');
        const sleepScan = await new AxeBuilder({ page }).include('.screensaver').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(sleepScan.violations).toEqual([]);
        await page.screenshot({ path: resolve(artifacts, `sleep-${theme}-${mode}.png`) }); await page.keyboard.press('Escape');
        await expect(page.locator('.screensaver')).toHaveCount(0); await command(page, 'Shut down…'); await confirm(page, 'Shut down');
        await expect(page.locator('.shutdown-copy')).toHaveCSS('opacity', '1');
        const shutdownScan = await new AxeBuilder({ page }).include('.shutdown-screen').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(shutdownScan.violations).toEqual([]);
        await page.screenshot({ path: resolve(artifacts, `shutdown-${theme}-${mode}.png`) }); await page.keyboard.press('Escape');
        await expect(page.locator('.boot-screen')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('.boot-screen')).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
  });
});
