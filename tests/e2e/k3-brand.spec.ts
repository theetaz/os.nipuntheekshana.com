import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

const screenshots = resolve('.astro/k3-artifacts/screenshots');
const welcome = "Kottu OS is Nipun's desktop in a browser. Drag the props, open the windows, or just scroll: the long version is below.";

for (const theme of ['light', 'dark'] as const) {
  for (const app of ['terminal', 'readme', 'settings'] as const) {
    test(`${app} exposes the Kottu brand in ${theme} mode`, async ({ page }, info) => {
      mkdirSync(screenshots, { recursive: true });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      if (info.project.name !== 'chromium') await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const path = app === 'terminal' ? '/terminal?cmd=neofetch' : app === 'settings' ? '/settings?section=about' : '/readme';
      await page.goto(path);
      await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
      const win = page.locator(`[data-window-id="${app}"]`);
      if (app === 'terminal') {
        await expect(win.locator('.terminal-output > [aria-live="off"]')).toContainText('Kottu OS 2.0 "Pettah"');
        await expect(win.locator('.terminal-output > [aria-live="off"]')).toContainText('Hyprland-ish (in your browser)');
        await expect(win.locator('.terminal-input-line > span')).toHaveText('nipun@kottu:~$ ');
      } else if (app === 'readme') {
        await expect(win).toContainText(welcome);
        await expect(win.getByRole('table')).toContainText('Super+1…5 (⌃1…5 on a Mac)');
        await expect(win).toContainText('Search finds apps');
      } else {
        await expect(win.getByRole('heading', { name: 'Kottu OS 2.0 “Pettah”' })).toBeVisible();
        await expect(win.locator('.settings-about-glyph svg')).toHaveAttribute('viewBox', '0 0 64 64');
        await expect(win).toContainText('Shrikhand, Kalam, Instrument Sans, Fraunces and Martian Mono');
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      });
      expect(await win.locator('[data-scroll-root]').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const audit = await new AxeBuilder({ page }).include(`[data-window-id="${app}"]`).analyze();
      expect(audit.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
      expect(errors).toEqual([]);
      await page.screenshot({ path: resolve(screenshots, `${app}-${theme}-${info.project.name}.png`), scale: 'css' });
    });
  }
}

test('the social preview is a complete noindex composition outside the sitemap', async ({ page, request }, info) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('/og');
  await expect(page).toHaveTitle('Kottu OS — social preview');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Nipun\s*Theekshana/);
  await expect(page.locator('.og-prop')).toHaveCount(11);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  expect(await page.locator('.og-stage').boundingBox()).toEqual({ x: 0, y: 0, width: 1200, height: 630 });
  if (info.project.name === 'chromium') {
    mkdirSync(screenshots, { recursive: true });
    await page.screenshot({ path: resolve(screenshots, 'og-page.png') });
  }
  const sitemap = await request.get('/sitemap-0.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).not.toMatch(/<loc>[^<]*\/og\/?<\/loc>/);
});

test('the favicon set uses the crossed-blade mark on light and dark surfaces', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'chromium', 'One desktop contact sheet records all fixed-size icon assets.');
  mkdirSync(screenshots, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const files = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];
  await page.setContent(`<html lang="en"><title>Kottu OS icons</title><style>
    body{margin:0;font:18px system-ui;color:#1B1530}section{height:450px;display:flex;align-items:center;justify-content:center;gap:48px;background:#FFFDF8}section+section{background:#1B1530;color:#FFFDF8}figure{text-align:center;margin:0}img{width:128px;height:128px;display:block;margin:0 auto 24px}
    </style><body>${['light', 'dark'].map(theme => `<section aria-label="${theme}">${files.map(file => `<figure><img alt="${file}" src="${baseURL}/${file}"><figcaption>${file}</figcaption></figure>`).join('')}</section>`).join('')}</body></html>`);
  await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
  await page.screenshot({ path: resolve(screenshots, 'favicon-set-light-dark.png') });
});
