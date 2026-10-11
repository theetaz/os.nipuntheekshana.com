import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

const artifacts = resolve('.astro/p1-7-artifacts');

test('desktop widgets keep the reference geometry in light and dark @visual', async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // Axis-aligned bounds include the ticket's -1.2° and sticky's 2° rotation.
    for (const [built, target] of [
      ['.ticket-wrap', { x: 45.619, y: 67.418, width: 444.762, height: 241.164 }],
      ['.now-sticky', { x: 59.957, y: 331.744, width: 256.085, height: 244.511 }],
      ['.activity-strip', { x: 48, y: 604, width: 360, height: 112 }],
    ] as const) {
      const rect = await page.locator(built).boundingBox();
      if (built === '.activity-strip' && !rect) continue; // Build-time data can be unavailable.
      expect(rect).not.toBeNull();
      for (const field of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(rect![field] - target![field]), `${theme} ${built} ${field}`).toBeLessThanOrEqual(2);
    }
    expect(await page.locator('.ticket h1').evaluate((element) => element.clientHeight)).toBe(40);
    await page.screenshot({ path: resolve(artifacts, `home-${theme}-desktop.png`) });
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/projects/salli');
  await page.screenshot({ path: resolve(artifacts, 'project-salli-desktop.png') });
  await page.goto('/projects/salli#simple');
  await page.screenshot({ path: resolve(artifacts, 'project-salli-simple.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(artifacts, `home-${theme}-phone.png`) });
  }
});

test('static page chrome and content have no accessibility violations @a11y', async ({ page }) => {
  for (const path of ['/', '/#simple', '/projects/salli', '/projects/salli#simple', '/writing/hello-world', '/nope']) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map(({ target }) => target) })), path).toEqual([]);
  }
});

test('route pages do not log errors and reduced motion skips the boot @smoke', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  for (const path of ['/', '/projects', '/projects/salli', '/writing', '/writing/hello-world', '/writing/an-island-made-of-points', '/about', '/cv', '/now', '/readme', '/terminal', '/maps', '/maps/play', '/activity', '/messages', '/settings', '/kooda']) await page.goto(path);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => localStorage.removeItem('serendib:booted'));
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-boot');
  await expect(page.locator('.boot-screen')).toBeHidden();
  expect(errors).toEqual([]);
});

test('stored Simple view can return to the desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/os-ready/);
  await page.locator('[data-shell="desktop"] .simple-entry').click();
  expect(await page.evaluate(() => localStorage.getItem('serendib:view'))).toBe('"simple"');
  await page.reload();
  await expect(page.locator('#home-document')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the desktop', exact: true }).click();
  await expect(page.locator('.ticket')).toBeVisible();
  await expect(page.locator('#home-document')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('serendib:view'))).toBeNull();
});


test('home has zero layout shift while its fonts load', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { layoutShift: number }).layoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as unknown as { layoutShift: number }).layoutShift += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  expect(await page.evaluate(() => (window as unknown as { layoutShift: number }).layoutShift)).toBe(0);
});
