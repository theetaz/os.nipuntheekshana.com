import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from './fixtures';

const screenshots = resolve('.astro/k14-artifacts/screenshots');
for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) {
  for (const theme of ['light', 'dark'] as const) test(`Kottu composition at ${width}×${height} in ${theme}`, async ({ page }, info) => {
    mkdirSync(screenshots, { recursive: true });
    await page.setViewportSize({ width: width!, height: height! }); await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
    await expect(page.locator('[data-mochi]:visible')).toHaveCount(1);
    await page.evaluate(async () => {
      await document.fonts.ready;
      const hero = document.querySelector<HTMLElement>(document.documentElement.dataset.mode === 'mobile' ? '.phone-home' : '.k-hero')!;
      for (const image of hero.querySelectorAll<HTMLImageElement>('img')) if (image.getBoundingClientRect().width) await image.decode();
    });
    await expect(page.locator('h1:visible')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width!);
    await page.screenshot({ path: resolve(screenshots, `home-${theme}-${width}x${height}-${info.project.name}.png`), scale: 'css' });
    await page.locator('#ws-projects').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(screenshots, `highlights-${theme}-${width}x${height}-${info.project.name}.png`), scale: 'css' });
    if (width! >= 1180 && info.project.name === 'chromium') {
      const card = page.locator('[data-k-card="salli"]'); await card.locator('.k-card-link').hover();
      await expect(page.locator('.k-preview')).toBeVisible();
      await expect.poll(() => page.locator('.k-preview .k-typed').textContent()).toBe('open github.com/prabhavalabs/salli');
      await page.screenshot({ path: resolve(screenshots, `card-hover-${theme}-${width}x${height}.png`), scale: 'css' });
    }
    expect(errors).toEqual([]);
  });
}

for (const javaScriptEnabled of [true, false]) test.describe(`Simple phone view, JavaScript ${javaScriptEnabled}`, () => {
  test.use({ javaScriptEnabled, viewport: { width: 393, height: 844 } });
  test('CV, Now and Read me fit the document width in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) for (const path of ['/cv', '/now', '/readme']) {
      await page.emulateMedia({ colorScheme: theme }); await page.goto(`${path}#simple`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('h1:visible')).toHaveCount(1);
      await expect(page.locator('.os-chrome:visible')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} ${theme}`).toBeLessThanOrEqual(393);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowX)).not.toBe('hidden');
    }
  });
});
