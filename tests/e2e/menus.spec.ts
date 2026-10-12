import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test as nativeDateTest, type Page } from '@playwright/test';
import { test, expect, openApp, openMenu } from './fixtures';
import { fixtureServer, type FixtureServer } from './fixture-server';

let fixtureRoute: string; let fixtureOrigin: string; let server: FixtureServer;
test.beforeAll(async ({}, info) => {
  fixtureRoute = `p2-5-menus-${info.workerIndex}`;
  server = await fixtureServer(`menus-${info.workerIndex}`, 4600 + info.workerIndex, { [fixtureRoute]: `---
import MenuFixture from '../../../tests/fixtures/p2-5-menus';
import '../../../src/styles/global.css';
---
<!doctype html><html lang="en" data-motion="reduce"><head><meta charset="UTF-8" /><title>Menu fixture</title></head><body><MenuFixture client:load /></body></html>` });
  fixtureOrigin = server.origin;
});
test.afterAll(async () => { await server?.stop(); });
const bar = (page: Page) => page.getByRole('menubar', { name: 'Application menus' });
async function hydrated(page: Page, route = '/') { await page.goto(route); await expect(page.locator('html')).toHaveClass(/os-ready/); }
async function menu(page: Page, name: string) {
  await openMenu(page, name);
  const panel = page.getByRole('menu', { name, exact: true });
  await expect(panel).toBeVisible(); return panel;
}

test('Tab and Option-1 reach the island; arrows, Home, End, typeahead and Escape rove', async ({ page }) => {
  await hydrated(page);
  const island = bar(page).getByRole('menuitem', { name: 'Island menu' });
  await page.keyboard.press('Alt+1'); await expect(island).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(island).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(bar(page).getByRole('menuitem', { name: 'Serendib' })).toBeFocused();
  await page.keyboard.press('End'); await expect(bar(page).getByRole('menuitem', { name: 'Help' })).toBeFocused();
  await page.keyboard.press('Home'); await expect(island).toBeFocused();
  await page.keyboard.press('w'); await expect(bar(page).getByRole('menuitem', { name: 'Window' })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'Minimise', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(bar(page).getByRole('menuitem', { name: 'Window' })).toBeFocused();
});
test('Window Zoom routes Enter to the focused window and Escape returns to its trigger', async ({ page }) => {
  await hydrated(page, '/projects'); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const window = page.locator('[data-window-id="projects"]'); const initial = await window.boundingBox();
  await menu(page, 'Window'); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Zoom', exact: true })).toBeFocused(); await page.keyboard.press('Enter');
  await expect.poll(async () => (await window.boundingBox())!.width).toBeGreaterThan(initial!.width);
  await expect(page.getByRole('menu', { name: 'Window', exact: true })).toBeHidden();
  await menu(page, 'Window'); await page.keyboard.press('Escape'); await expect(bar(page).getByRole('menuitem', { name: 'Window' })).toBeFocused();
});
test('an open menu switches on horizontal arrows and pointer movement', async ({ page }) => {
  await hydrated(page); await menu(page, 'Go'); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu', { name: 'Window', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('menu', { name: 'Go', exact: true })).toBeVisible();
  await bar(page).getByRole('menuitem', { name: 'Help', exact: true }).hover();
  await expect(page.getByRole('menu', { name: 'Help', exact: true })).toBeVisible();
  await page.mouse.click(900, 650);
  await expect(page.getByRole('menu', { name: 'Help', exact: true })).toBeHidden();
  await menu(page, 'Help'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('menu', { name: 'Help', exact: true })).toBeHidden();
});
test('windows list tracks instances, checks focus and restores minimised windows', async ({ page }) => {
  await hydrated(page); await openApp(page, 'Projects'); await openApp(page, 'Terminal');
  await menu(page, 'File'); await page.getByRole('menuitem', { name: 'New window', exact: true }).click();
  await expect(page.locator('[data-window-id="terminal~2"]')).toBeVisible();
  await menu(page, 'Window');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Terminal 2', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Projects', exact: true })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('menuitem', { name: 'Minimise', exact: true }).click();
  await expect(page.locator('[data-window-id="terminal~2"]')).toBeHidden();
  await menu(page, 'Window'); await page.getByRole('menuitemcheckbox', { name: '◇ Terminal 2', exact: true }).click();
  await expect(page.locator('[data-window-id="terminal~2"]')).toBeVisible();
  await menu(page, 'Window'); await expect(page.getByRole('menuitemcheckbox', { name: 'Terminal 2', exact: true })).toHaveAttribute('aria-checked', 'true');
});
test('disabled items remain focusable and inert on the desktop', async ({ page }) => {
  await hydrated(page); await menu(page, 'Window'); const minimize = page.getByRole('menuitem', { name: 'Minimise', exact: true });
  await expect(minimize).toBeFocused(); await expect(minimize).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter'); await expect(page.getByRole('menu', { name: 'Window', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'Zoom', exact: true })).toBeFocused();
});
test('loaded app menus use live useAppMenuState and route through useAppCommands', async ({ page }) => {
  await page.goto(`${fixtureOrigin}/${fixtureRoute}`); await expect(page.getByTestId('app-command')).toHaveText('None');
  await menu(page, 'View'); const live = page.getByRole('menuitemcheckbox', { name: 'Live option' });
  await expect(live).toHaveAttribute('aria-checked', 'false'); await live.click();
  await expect(page.getByTestId('app-command')).toHaveText('projects.toggle');
  await menu(page, 'View'); await expect(live).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowDown'); const disabled = page.getByRole('menuitem', { name: 'Unavailable action' });
  await expect(disabled).toBeFocused(); await expect(disabled).toHaveAttribute('aria-disabled', 'true'); await page.keyboard.press('Enter');
  await expect(page.getByTestId('app-command')).toHaveText('projects.toggle');
  await expect(page.getByRole('menu', { name: 'View', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Focus another app' }).click();
  await menu(page, 'View'); await expect(live).toHaveCount(0);
});
test('More preserves menus at 200 percent text size and returns them when space recovers', async ({ page }) => {
  await hydrated(page, '/projects');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.addStyleTag({ content: '.mb-bar .mb-trigger, .mb-bar .mb-status-button, .mb-bar .simple-entry { font-size:26px; }' });
  const more = bar(page).getByRole('menuitem', { name: 'More', exact: true }); await expect(more).toBeVisible();
  await more.click(); const help = page.getByRole('menuitem', { name: 'Help', exact: true }); await help.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menu', { name: 'Help', exact: true })).toBeVisible();
  const box = await page.getByRole('menu', { name: 'Help', exact: true }).boundingBox(); expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await expect(more).toBeFocused();
  await page.addStyleTag({ content: '.mb-bar .mb-trigger, .mb-bar .mb-status-button, .mb-bar .simple-entry { font-size:13px; }' });
  await expect(more).toHaveCount(0); await expect(bar(page).getByRole('menuitem', { name: 'Help', exact: true })).toBeVisible();
});
test('Now popover shows three items, dismisses with Escape and opens Now', async ({ page }) => {
  await page.goto(`${fixtureOrigin}/${fixtureRoute}`); await expect(page.getByTestId('app-command')).toBeVisible();
  const trigger = page.getByRole('button', { name: "What Nipun's up to" }); await trigger.click();
  const popover = page.getByRole('dialog', { name: "What Nipun's up to" }); await expect(popover.getByRole('listitem')).toHaveText(['One', 'Two', 'Three']);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await trigger.click();
  await page.getByRole('button', { name: 'Open Now ›' }).click(); await expect(bar(page).getByRole('menuitem', { name: 'Now', exact: true })).toBeVisible();
});
test('sound and appearance write preferences and Option-click opens Appearance settings', async ({ page }) => {
  await hydrated(page); await page.getByRole('button', { name: 'Sound off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sound on', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('serendib:sound'))).toBe('true');
  const appearance = page.getByRole('button', { name: 'Appearance', exact: true });
  for (const theme of ['light', 'dark', 'auto']) { await appearance.click(); await expect.poll(() => page.evaluate(() => localStorage.getItem('serendib:theme'))).toBe(JSON.stringify(theme)); }
  await appearance.click({ modifiers: ['Alt'] }); await expect(page).toHaveURL(/\/settings\?section=appearance$/);
  await page.goto(`${fixtureOrigin}/${fixtureRoute}`); await expect(page.getByTestId('app-command')).toBeVisible();
  await appearance.click({ modifiers: ['Alt'] }); await expect(page.getByTestId('focused-section')).toHaveText('appearance');
});
test('Spotlight, appearance toasts, app About version and shortcuts route through shell APIs', async ({ page }) => {
  await page.goto(`${fixtureOrigin}/${fixtureRoute}`); await expect(page.getByTestId('app-command')).toBeVisible();
  await page.getByRole('button', { name: 'Spotlight', exact: true }).click(); await expect(page.getByTestId('spotlight-open')).toHaveText('true');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click(); await expect(page.getByTestId('toast-title')).toContainText('appearance');
  await menu(page, 'Projects'); await page.getByRole('menuitem', { name: 'About Projects', exact: true }).click();
  await expect(page.getByTestId('alert-body')).toContainText('Version 2.0');
  await menu(page, 'Help'); await page.getByRole('menuitem', { name: 'Keyboard shortcuts', exact: true }).click();
  await expect(page.getByTestId('focused-section')).toHaveText('shortcuts');
});
test('View checks track preference commands and the Wallpaper submenu', async ({ page }) => {
  await hydrated(page); await menu(page, 'View'); const widgets = page.getByRole('menuitemcheckbox', { name: 'Show widgets' });
  await expect(widgets).toHaveAttribute('aria-checked', 'true'); await widgets.click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('serendib:widgets'))).toBe('false'); await menu(page, 'View');
  await expect(widgets).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await menu(page, 'View'); await expect(page.getByRole('menuitemradio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitem', { name: 'Wallpaper', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitemradio', { name: 'Paper', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'paper');
});
test('shortcut hints follow navigator platform precedence', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' }, configurable: true }); });
  await hydrated(page); await menu(page, 'Window');
  await expect(page.getByRole('menuitem', { name: 'Snap left', exact: true })).toHaveText('Snap left⌥[');
  await page.keyboard.press('Escape'); await menu(page, 'Island menu');
  await expect(page.getByRole('menuitem', { name: 'System Settings…', exact: true })).toHaveText('System Settings…⌥,');
});
test('non-Mac shortcut hints use Alt and Ctrl', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
  });
  await hydrated(page); await menu(page, 'Window');
  await expect(page.getByRole('menuitem', { name: 'Snap right', exact: true })).toHaveText('Snap rightAlt+]');
  await expect(page.getByRole('button', { name: 'Spotlight', exact: true })).toHaveAttribute('title', 'Spotlight (Ctrl+K)');
});
test.describe('visitor clock in Colombo', () => {
  test.use({ timezoneId: 'Asia/Colombo', locale: 'en-GB' });
  test('formats the fixed date, Colombo line, status and Option-click LK mode', async ({ page }) => {
    await hydrated(page); const clock = page.locator('.mb-clock'); await expect(clock).toHaveText('Sun 11 Oct  23:11');
    await clock.click(); const popover = page.getByRole('dialog', { name: 'Clock', exact: true });
    await expect(popover).toContainText('Sunday 11 October'); await expect(popover).toContainText('23:11where you are');
    await expect(popover).toContainText('23:11in Colombo (UTC+05:30)'); await expect(popover).toContainText('Nipun is probably shipping something.');
    await page.keyboard.press('Escape'); await expect(clock).toBeFocused(); await clock.click({ modifiers: ['Alt'] });
    await expect(clock).toHaveText('LK Sun 11 Oct  23:11'); await clock.click({ modifiers: ['Alt'] }); await expect(clock).toHaveText('Sun 11 Oct  23:11');
  });
});
nativeDateTest('minute ticks align to the next minute and catch up after visibility resumes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T17:41:00Z') }); await hydrated(page);
  nativeDateTest.skip(await page.locator('html').getAttribute('data-mode')==='mobile','The clock popover is desktop-only.');
  await page.clock.pauseAt(new Date('2026-10-11T17:41:37.250Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const clock = page.locator('.mb-clock'); const before = await clock.textContent();
  await page.clock.runFor(22_749); await expect(clock).toHaveText(before!); await page.clock.runFor(1); await expect(clock).not.toHaveText(before!);
  await page.clock.setSystemTime(new Date('2026-10-11T17:50:05Z')); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(clock.locator('time')).toHaveAttribute('datetime', '2026-10-11T17:50:05.000Z');
});
test('menu screens have no console errors, zero hydration CLS, reduced motion and accessible roles @visual', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    Object.assign(window, { menuCLS: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { menuCLS: number }).menuCLS += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  const artifacts = resolve('.astro/p2-5-artifacts'); await mkdir(artifacts, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1440, height: 900 });
    await hydrated(page, '/projects'); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
    expect(await page.evaluate(() => (window as unknown as { menuCLS: number }).menuCLS)).toBe(0);
    await menu(page, 'Window');
    await page.getByRole('menu', { name: 'Window', exact: true }).evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
    await page.screenshot({ path: resolve(artifacts, `menus-${theme}-1440x900.png`) });
    expect((await new AxeBuilder({ page }).include('.mb-bar').include('[data-os-ui-overlays]').analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape'); await page.locator('.mb-clock').click();
    await page.getByRole('dialog', { name: 'Clock', exact: true }).evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
    await page.screenshot({ path: resolve(artifacts, `clock-${theme}-1440x900.png`) });
    expect(await page.locator('.mb-now-dot').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
    await page.setViewportSize({ width: 390, height: 844 }); await hydrated(page);
    await page.screenshot({ path: resolve(artifacts, `home-${theme}-390x844.png`) });
  }
  expect(errors).toEqual([]);
});
