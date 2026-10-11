import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { fixtureServer, type FixtureServer } from './fixture-server';
import { test, expect } from './fixtures';

const artifacts = resolve('.astro/p2-8-artifacts');
async function openSpotlight(page: Page) {
  await expect(page.locator('html')).toHaveClass(/os-ready/);
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Spotlight search' }); await expect(dialog).toBeVisible();
  const input = dialog.getByRole('combobox'); await expect(input).toBeFocused(); return { dialog, input };
}
async function search(page: Page, query: string) {
  const result = await openSpotlight(page); await result.input.fill(query);
  await expect(result.dialog.getByRole('option').first()).toBeVisible(); return result;
}

test('Spotlight fetches lazily, ranks Salli first, supports arrows and Enter, and remembers Recent', async ({ page }) => {
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  // Assert Ctrl+K against the non-Mac global shortcut policy, independently of the host OS.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'Linux' });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ platform: 'Linux' }) });
  });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  expect(requests.filter(url => url.includes('/data/search.json'))).toHaveLength(0);
  expect(requests.filter(url => /\/(Spotlight|QuickLook|Alerts|Toasts|ContextMenuHost)\./.test(url))).toHaveLength(0);
  await page.keyboard.press('Control+k'); const dialog = page.getByRole('dialog', { name: 'Spotlight search' });
  const input = dialog.getByRole('combobox'); await input.fill('salli');
  const options = dialog.getByRole('option'); await expect(options.first()).toHaveAttribute('data-entry-id', 'project:salli');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await input.fill('map'); await expect(options).not.toHaveCount(1);
  await input.press('ArrowDown'); await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(input).toHaveAttribute('aria-activedescendant', await options.nth(1).getAttribute('id') as string);
  await input.press('ArrowUp'); await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await input.fill('salli'); await input.press('Enter'); await expect(page).toHaveURL(/\/projects\/salli$/); await expect(dialog).toBeHidden();
  await page.keyboard.press('Control+k'); await expect(dialog.getByRole('group', { name: 'Recent' })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Recent' }).getByRole('option').first()).toHaveAttribute('data-entry-id', 'project:salli');
  expect(requests.filter(url => url.includes('/data/search.json'))).toHaveLength(1);
});

test('no-results copy, combobox semantics, Tab containment, Escape, and focus return', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  const trigger = page.locator('[data-shell="desktop"] .simple-entry'); await trigger.focus();
  const { dialog, input } = await openSpotlight(page); await input.fill('zzzz');
  await expect(dialog.getByText('Nothing for "zzzz". Try "map", "Go" or "Sinhala".')).toBeVisible();
  await expect(input).toHaveAttribute('aria-expanded', 'true'); await expect(input).toHaveAttribute('aria-autocomplete', 'list');
  await expect(input).not.toHaveAttribute('aria-activedescendant');
  await input.press('Tab'); await expect(dialog.getByRole('button', { name: 'Clear search' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(input).toBeFocused();
  await input.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
});

test('Recent includes a project opened outside Spotlight and survives a reload', async ({ page }) => {
  await page.goto('/projects/salli');
  const { dialog } = await openSpotlight(page);
  await expect(dialog.getByRole('group', { name: 'Recent' }).getByRole('option').first()).toHaveAttribute('data-entry-id', 'project:salli');
  await page.keyboard.press('Escape'); await page.reload();
  const reopened = await openSpotlight(page);
  await expect(reopened.dialog.getByRole('group', { name: 'Recent' }).getByRole('option').first()).toHaveAttribute('data-entry-id', 'project:salli');
});

test('Alt+Space opens Spotlight, slash opens outside typing, and search failures can retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/data/search.json', async route => { requests++; if (requests === 1) await route.abort(); else await route.continue(); });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await page.keyboard.press('Alt+Space');
  const dialog = page.getByRole('dialog', { name: 'Spotlight search' }); await expect(dialog.getByText('Search couldn’t load. Please try again.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Try again' }).click(); await expect(dialog.getByRole('group', { name: 'Suggestions' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  await page.keyboard.press('/'); await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').fill('/'); await expect(dialog.getByRole('combobox')).toHaveValue('/');
});

test('indexed actions toggle theme, open Wallpaper settings, resolve Empty Kooda, and show a toast', async ({ page }) => {
  await page.goto('/');
  const original = await page.locator('html').getAttribute('data-theme');
  let result = await search(page, 'Toggle dark appearance'); await result.input.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', original === 'dark' ? 'light' : 'dark');
  result = await search(page, 'Change wallpaper'); await result.input.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  result = await search(page, 'Empty Kooda'); await result.input.press('Enter');
  const alert = page.getByRole('alertdialog', { name: 'Empty Kooda?' }); await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Empty Kooda', exact: true }).click(); await expect(alert).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Kooda emptied' })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) test(`Spotlight ${theme} screenshot, accessibility, reduced motion and transparency`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => { localStorage.setItem('serendib:theme', JSON.stringify(theme)); localStorage.setItem('serendib:transparency', '"reduce"'); }, theme);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); const { dialog } = await search(page, 'map');
  await expect(dialog).toHaveCSS('backdrop-filter', 'none');
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(page.locator('.os-spotlight-layer')).toHaveCSS('opacity', '1');
  const axe = await new AxeBuilder({ page }).include('.os-spotlight').analyze();
  expect(axe.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]);
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, `spotlight-${theme}-1440x900.png`) });
  expect(errors).toEqual([]);
});

test('mobile Spotlight fills the viewport and closes with its touch control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  const { dialog, input } = await openSpotlight(page); await input.fill('salli');
  await expect(dialog.getByRole('option').first()).toHaveAttribute('data-entry-id', 'project:salli');
  await expect.poll(() => dialog.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, 'spotlight-mobile-390x844.png') });
  await dialog.getByRole('button', { name: 'Close Spotlight' }).click(); await expect(dialog).toBeHidden();
});

test.describe('overlay API interactions', () => {
  let server: FixtureServer; let route: string; let origin: string;
  test.beforeAll(async ({}, info) => {
    route = `p2-8-overlays-${info.workerIndex}`;
    server = await fixtureServer(`overlays-${info.workerIndex}`, 4745 + info.workerIndex, { [route]: `---
import Overlays from '../../../tests/fixtures/p2-8/Overlays';
import '../../../src/styles/global.css';
---
<!doctype html><html lang="en"><head><meta charset="UTF-8"/><title>Overlay verification</title></head><body><Overlays client:load /></body></html>` });
    origin = server.origin;
  });
  test.afterAll(async () => { await server?.stop(); });
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(`${origin}/${route}`);
    await expect(page.locator('[data-overlay-fixture-ready]')).toHaveAttribute('data-overlay-fixture-ready', 'true');
  });

  // Safari pointer activation blurs buttons; keyboard activation establishes the
  // previous focus that these API restoration tests must preserve.
  test('system alerts settle both primary and cancel promises and restore focus', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'System alert', exact: true }); await trigger.focus(); await trigger.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'Continue?' }); await expect(dialog.getByRole('button', { name: 'Continue' })).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.getByTestId('alert-result')).toHaveText('primary'); await expect(trigger).toBeFocused();
    await expect(dialog).toHaveCount(0);
    await trigger.press('Enter'); await expect(dialog.getByRole('button', { name: 'Continue' })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
    await expect(page.getByTestId('alert-result')).toHaveText('cancel'); await expect(trigger).toBeFocused();
  });
  test('window sheets attach under the title bar and contain keyboard focus', async ({ page }) => {
    await page.getByRole('button', { name: 'Window sheet' }).click(); const dialog = page.getByRole('alertdialog', { name: 'Delete screenshot?' });
    await expect(dialog).toBeVisible(); const box = await dialog.boundingBox(); expect(box!.width).toBe(420); expect(box!.y).toBe(140);
    await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.getByTestId('alert-result')).toHaveText('cancel');
  });
  test('queued alerts resolve one at a time', async ({ page }) => {
    await page.getByRole('button', { name: 'Queue alerts' }).click(); await expect(page.getByRole('alertdialog', { name: 'Second alert' })).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog', { name: 'First alert' })).toBeVisible();
    await page.getByRole('button', { name: 'First', exact: true }).click(); await expect(page.getByTestId('alert-result')).toHaveText('first:primary');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
  test('context menus flip inside edges, expose checked state, execute commands, and return focus', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Context menu', exact: true }); await trigger.focus(); await trigger.press('Enter');
    const menu = page.getByRole('menu', { name: 'Fixture context menu' }); await expect(menu).toBeVisible();
    const box = await menu.boundingBox(); expect(box!.x + box!.width).toBeLessThanOrEqual(1432); expect(box!.y + box!.height).toBeLessThanOrEqual(892);
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Show widgets' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter'); await expect(page.getByTestId('widgets')).toHaveText('false'); await expect(trigger).toBeFocused();
    await trigger.press('Enter'); await page.keyboard.press('Escape'); await expect(menu).toBeHidden(); await expect(trigger).toBeFocused();
  });
  test('toasts cap at three, expose status, dismiss at four seconds, and pause on hover and focus', async ({ page }) => {
    await page.clock.install(); const add = page.getByRole('button', { name: 'Add toast' });
    for (let i = 0; i < 4; i++) await add.click(); await page.clock.runFor(150);
    const cards = page.getByRole('article'); await expect(cards).toHaveCount(3); await expect(page.locator('.os-toasts[role="status"]')).toContainText('Notice 4');
    await cards.last().hover(); await page.clock.runFor(4100); await expect(cards).toHaveCount(1);
    await page.mouse.move(0, 0); await page.clock.runFor(4100); await expect(cards).toHaveCount(0);
    await add.click(); await expect(cards).toHaveCount(1); await cards.getByRole('button').focus(); await page.clock.runFor(4100); await expect(cards).toHaveCount(1);
    await add.focus(); await page.clock.runFor(4100); await expect(cards).toHaveCount(0);
  });
  test('action toasts last eight seconds and their action runs', async ({ page }) => {
    await page.clock.install(); const trigger = page.getByRole('button', { name: 'Action toast' }); await trigger.click(); await expect(page.getByRole('article')).toHaveCount(1);
    await page.clock.runFor(4100); await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo changes' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Changes undone' })).toBeVisible();
    await page.clock.runFor(150); await expect(page.getByRole('article')).toHaveCount(0);
    await trigger.click(); await expect(page.getByRole('article')).toHaveCount(1); await page.clock.runFor(8100); await expect(page.getByRole('article')).toHaveCount(0);
  });
  test('Quick Look from the API uses the source rect and reduced motion crossfades', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Preview screenshot' }); await trigger.focus(); await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' }); await expect(dialog).toBeVisible(); await expect(dialog.getByRole('status')).toHaveText('1 of 3');
    const transforms = await dialog.evaluate(element => element.getAnimations().flatMap(animation =>
      (animation.effect as KeyframeEffect).getKeyframes().map(frame => String(frame.transform ?? 'none'))));
    expect(transforms.every(value => value === 'none' || value === 'translateX(0px) translateY(0px)')).toBe(true);
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
  });
  test('Quick Look zooms from the source rect when motion is enabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.reload();
    await expect(page.locator('[data-overlay-fixture-ready]')).toHaveAttribute('data-overlay-fixture-ready', 'true');
    await page.evaluate(() => {
      const records: string[] = []; Object.assign(window, { quicklookTransforms: records });
      const observer = new MutationObserver(() => {
        const panel = document.querySelector<HTMLElement>('.os-quicklook');
        if (panel) records.push(panel.style.transform);
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
    });
    await page.getByRole('button', { name: 'Preview screenshot' }).click();
    const dialog = page.getByRole('dialog', { name: 'Quick Look — Salli' }); await expect(dialog.getByRole('status')).toHaveText('1 of 3');
    await expect.poll(() => page.evaluate(() => (window as unknown as { quicklookTransforms: string[] }).quicklookTransforms.some(value => /scale[XY]\(0\./.test(value)))).toBe(true);
    await expect(dialog).toHaveCSS('transform', 'none'); await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
  });
  for (const theme of ['light', 'dark'] as const) test(`alerts, context menus and toasts ${theme} screenshots and accessibility`, async ({ page }) => {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    mkdirSync(artifacts, { recursive: true });
    await page.getByRole('button', { name: 'System alert', exact: true }).click(); await expect(page.getByRole('alertdialog')).toBeVisible();
    // Contrast is measured after the allowed reduced-motion crossfade has settled.
    await expect(page.getByRole('alertdialog')).toHaveCSS('opacity', '1');
    await expect(page.locator('.os-alert-layer')).toHaveCSS('opacity', '1');
    const axe = await new AxeBuilder({ page }).include('.os-alert').analyze(); expect(axe.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]);
    await page.screenshot({ path: resolve(artifacts, `alert-${theme}-1440x900.png`) }); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Context menu', exact: true }).click(); await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: resolve(artifacts, `context-menu-${theme}-1440x900.png`) }); await page.keyboard.press('Escape');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add toast' }).click(); await expect(page.getByRole('article')).toHaveCount(3);
    for (const card of await page.getByRole('article').all()) await expect(card).toHaveCSS('opacity', '1');
    await page.screenshot({ path: resolve(artifacts, `toasts-${theme}-1440x900.png`) });
  });
});
