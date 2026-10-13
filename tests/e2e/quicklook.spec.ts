import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import { expectTapTargets, holdTile, isPhone, openSheetFromHome, phoneScreenshot, phoneSizes } from './phone-sheet-sizes';

const artifacts = resolve('.astro/p2-8-artifacts');
test('deep-linked Quick Look works with Projects, pages images and query, wraps, and closes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/projects/salli?shot=1'); const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' });
  await expect(dialog).toBeVisible(); await expect(dialog.getByRole('status')).toHaveText('2 of 3');
  const image = dialog.getByRole('img'); const second = await image.getAttribute('src');
  await page.keyboard.press('ArrowRight'); await expect(dialog.getByRole('status')).toHaveText('3 of 3'); await expect(page).toHaveURL(/\?shot=2$/);
  await expect(image).not.toHaveAttribute('src', second!);
  await page.keyboard.press('ArrowRight'); await expect(dialog.getByRole('status')).toHaveText('1 of 3'); await expect(page).toHaveURL(/\?shot=0$/);
  await page.keyboard.press('ArrowLeft'); await expect(dialog.getByRole('status')).toHaveText('3 of 3');
  await page.keyboard.press('Home'); await expect(dialog.getByRole('status')).toHaveText('1 of 3');
  await page.keyboard.press('End'); await expect(dialog.getByRole('status')).toHaveText('3 of 3');
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(page).toHaveURL(/\/projects\/salli$/);
  expect(errors).toEqual([]);
});
test('Quick Look controls, focus containment, Space close, and cached project data', async ({ page }) => {
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.goto('/projects/salli?shot=0'); const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' });
  await expect(dialog.getByRole('button', { name: 'Close Quick Look' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Next image' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Close Quick Look' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Next image' }).click(); await expect(dialog.getByRole('status')).toHaveText('2 of 3');
  await dialog.getByRole('button', { name: 'Previous image' }).click(); await expect(dialog.getByRole('status')).toHaveText('1 of 3');
  await expect(dialog.getByRole('link', { name: 'Open full size' })).toHaveAttribute('target', '_blank');
  await page.keyboard.press('Space'); await expect(dialog).toBeHidden(); await expect(page).toHaveURL(/\/projects\/salli$/);
  expect(requests.filter(url => url.includes('/data/projects.json'))).toHaveLength(1);
});
test('out-of-range shot normalizes and project-data failure retries without losing the URL', async ({ page }) => {
  let requests = 0; await page.route('**/data/projects.json', async route => { if (++requests === 1) await route.abort(); else await route.continue(); });
  await page.goto('/projects/salli?shot=99'); const dialog = page.getByRole('dialog', { name: /^Quick Look/ });
  await expect(dialog.getByText('Preview couldn’t load.')).toBeVisible(); await expect(page).toHaveURL(/\?shot=99$/);
  await dialog.getByRole('button', { name: 'Try again' }).click(); await expect(dialog.getByRole('status')).toHaveText('1 of 3'); await expect(page).toHaveURL(/\?shot=0$/);
});
test('browser captures render a 28px address bar and preserve their aspect ratio', async ({ page }) => {
  await page.goto('/projects/agentmeter?shot=0'); const dialog = page.getByRole('dialog', { name: /^Quick Look/ });
  const frame = dialog.locator('[data-kind="browser"]'); await expect(frame).toBeVisible();
  await expect(frame.locator(':scope > div').first()).toHaveCSS('min-height', '28px');
  await expect(dialog.getByRole('img')).toBeVisible();
  const box = await dialog.boundingBox(); expect(box!.width).toBeLessThanOrEqual(1440 * .86); expect(box!.height).toBeLessThanOrEqual(900 * .82);
});
test('projects without shots fall back to a bare cover preview', async ({ page }) => {
  await page.route('**/data/projects.json', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.projects.find((project: { slug: string }) => project.slug === 'salli').screens = [];
    await route.fulfill({ json: data });
  });
  await page.goto('/projects/salli?shot=1'); const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' });
  await expect(dialog.locator('[data-kind="bare"]')).toBeVisible(); await expect(dialog.getByRole('status')).toHaveText('1 of 1');
  await expect(page).toHaveURL(/\?shot=0$/); await expect(dialog.getByRole('button', { name: 'Next image' })).toBeDisabled();
});
for (const theme of ['light', 'dark'] as const) test(`Quick Look ${theme} screenshot and accessibility`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.addInitScript(theme => localStorage.setItem('serendib:theme', JSON.stringify(theme)), theme);
  await page.goto('/projects/salli?shot=1'); const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' });
  await expect(dialog.getByRole('status')).toHaveText('2 of 3'); await expect(dialog.getByRole('img')).toBeVisible();
  await expect.poll(() => dialog.getByRole('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => dialog.evaluate(el => [el, el.parentElement!].map(node => getComputedStyle(node).opacity).join())).toBe('1,1');
  const axe = await new AxeBuilder({ page }).include('.os-quicklook').analyze(); expect(axe.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]);
  const box = await dialog.boundingBox(); expect(box!.width).toBeLessThanOrEqual(1440 * .86); expect(box!.height).toBeLessThanOrEqual(900 * .82);
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, `quicklook-${theme}-1440x900.png`) });
});
test('mobile Quick Look fits the viewport with touch controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/projects/salli?shot=1');
  const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' }); await expect(dialog.getByRole('status')).toHaveText('2 of 3');
  const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(dialog.getByRole('button', { name: 'Next image' })).toHaveCSS('width', '44px');
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, 'quicklook-mobile-390x844.png') });
  await dialog.getByRole('button', { name: 'Close Quick Look' }).click(); await expect(page).toHaveURL(/\/projects\/salli$/);
});

// Projects query.shot drives the existing overlay and its focus containment.
test('selecting a Projects tile and pressing Space opens its first capture', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const win = page.locator('[data-window-id="projects"]');
  const salli = win.getByRole('option', { name: 'Salli', exact: true });
  const phone = await isPhone(page);
  // Phone tiles open on tap, so selection-and-Space becomes a hold → Quick Look.
  if (phone) { await salli.scrollIntoViewIfNeeded(); const menu = await holdTile(page, salli); await menu.getByRole('menuitem', { name: 'Quick Look', exact: true }).tap(); }
  else { await salli.click(); await page.keyboard.press('Space'); }
  const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' });
  await expect(dialog.getByRole('status')).toHaveText('1 of 3');
  await expect(page).toHaveURL(/\/projects\/salli\?shot=0$/);
  if (phone) { await dialog.getByRole('button', { name: 'Close Quick Look' }).tap(); await win.getByRole('link', { name: 'Back to Projects', exact: true }).tap(); }
  else { await page.keyboard.press('Escape'); await win.getByRole('button', { name: 'Back', exact: true }).click(); }
  await expect(salli).toHaveAttribute('aria-selected', 'true');
});

test.describe('Quick Look in a phone sheet @mobile', () => {
  test.beforeEach(({}, info) => { test.skip(!info.project.name.startsWith('mobile'), 'Phone sheets are covered by the mobile projects.'); });
  for (const size of phoneSizes) test(`opens over the Projects sheet and fits ${size.width}×${size.height} ${size.theme}`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    // Home → Projects → Salli → a screen thumbnail.
    const sheet = await openSheetFromHome(page, 'Projects', 'projects', 'Projects', size);
    const salli = sheet.getByRole('option', { name: 'Salli', exact: true }); await salli.scrollIntoViewIfNeeded(); await salli.tap();
    await sheet.getByRole('button', { name: 'Open screen 2 of 3: Activity', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' });
    await expect(dialog.getByRole('status')).toHaveText('2 of 3');
    await expect.poll(() => dialog.getByRole('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await expectTapTargets(dialog);
    // Audit the settled overlay rather than its opening fade.
    await expect.poll(() => dialog.evaluate(el => [el, el.parentElement!].map(node => getComputedStyle(node).opacity).join())).toBe('1,1');
    const axe = await new AxeBuilder({ page }).include('.os-quicklook').analyze();
    expect(axe.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]);
    await phoneScreenshot(page, info, 'quicklook', size);
    await dialog.getByRole('button', { name: 'Next image' }).tap(); await expect(dialog.getByRole('status')).toHaveText('3 of 3');
    await dialog.getByRole('button', { name: 'Close Quick Look' }).tap(); await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects\/salli$/);
    await expect(sheet).toBeVisible();
    expect(errors).toEqual([]);
  });
});
