import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, openMenu } from './fixtures';

const artifacts = resolve('.astro/p1-7-artifacts');

test('desktop hero exposes the single name heading in light and dark @visual', async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { level: 1, name: 'Nipun Theekshana' })).toBeVisible();
    await expect(page.locator('h1:visible')).toHaveCount(1);
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
  for (const path of ['/', '/projects', '/projects/salli', '/writing', '/writing/hello-world', '/writing/an-island-made-of-points', '/about', '/cv', '/now', '/readme', '/terminal', '/maps', '/maps/play', '/activity', '/messages', '/settings', '/kooda']) {
    const health = page.waitForResponse(response => response.url().endsWith('/api/health'));
    await page.goto(path); await expect(page.locator('html')).toHaveClass(/os-ready/);
    await (await health).finished();
  }
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
  if(await page.locator('html').getAttribute('data-mode')==='mobile'){await openMenu(page,'Help');await page.getByRole('menuitem',{name:'Simple view',exact:true}).last().click();}else await page.locator('[data-shell="desktop"] .simple-entry').click();
  await expect.poll(()=>page.evaluate(() => localStorage.getItem('serendib:view'))).toBe('"simple"');
  await page.reload();
  await expect(page.locator('#story')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the desktop', exact: true }).click();
  await expect(await page.locator('html').getAttribute('data-mode')==='mobile'?page.locator('[data-shell="mobile"] .phone-ticket'):page.locator('.k-hero')).toBeVisible();
  if (await page.locator('html').getAttribute('data-mode') === 'mobile') await expect(page.locator('#story')).toBeHidden();
  else await expect(page.locator('#story')).toBeVisible();
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
