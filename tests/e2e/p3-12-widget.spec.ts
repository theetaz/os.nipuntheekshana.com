import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, preview, type PreviewServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
let server: PreviewServer; let origin: string; let directory: string;
test.beforeAll(async ({}, info) => {
  const previewPort = Number(new URL(process.env.BASE_URL ?? 'http://localhost:4372').port);
  const port = 25_000 + previewPort + info.workerIndex; directory = resolve(`.astro/p3-12-widget-${info.workerIndex}`);
  // Build just this React fixture, avoiding the unrelated Astro content/image pipeline.
  await build({ configFile: false, plugins: [tailwindcss()], logLevel: 'warn', oxc: { jsx: { runtime: 'automatic' } },
    build: { outDir: directory, emptyOutDir: true, rolldownOptions: { input: resolve('tests/fixtures/p3-12-widget.html') } } });
  server = await preview({ configFile: false, logLevel: 'warn', build: { outDir: directory }, preview: { host: 'localhost', port, strictPort: true } });
  origin = `http://localhost:${port}`;
});
test.afterAll(async () => {
  if (server) await new Promise<void>((done, reject) => server.httpServer.close(error => error ? reject(error) : done()));
  if (directory) await rm(directory, { recursive: true, force: true });
});
test('Pocket widget pets, opens its menu on long press, and never drags at 390×844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${origin}/tests/fixtures/p3-12-widget.html`);
  const root = page.locator('[data-mochi]'); const pet = page.getByRole('button', { name: 'Mochi, a small desk buddy. Press to pet.' });
  await expect(root).toHaveAttribute('data-physics', 'rest'); await pet.click(); await expect(page.locator('[data-mochi-bubble]')).toHaveText('Hehe. Again?');
  const before = (await pet.boundingBox())!; await page.mouse.move(before.x + 40, before.y + 40); await page.mouse.down();
  await expect(page.getByRole('menu', { name: 'Mochi context menu' })).toBeVisible(); await page.mouse.up();
  await page.keyboard.press('Escape'); await expect(pet).toBeFocused();
  await page.mouse.move(before.x + 40, before.y + 40); await page.mouse.down(); await page.mouse.move(320, 400, { steps: 10 }); await page.mouse.up();
  expect(await pet.boundingBox()).toEqual(before); await expect(root).toHaveAttribute('data-physics', 'rest');
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(violations).toEqual([]); await mkdir('.astro/p3-12-artifacts', { recursive: true });
  await page.screenshot({ path: '.astro/p3-12-artifacts/mochi-widget-390.png', animations: 'disabled' });
});
