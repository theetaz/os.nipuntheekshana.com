import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { GLOBAL_SHORTCUTS, formatShortcut } from '../../src/os/lib/hotkeys-match';
import { test, expect } from './fixtures';

const managed = (page: Page, app: string) => page.locator(`.managed-window[data-app="${app}"]`);
async function openShortcuts(page: Page, waitForContent = true) {
  await page.getByRole('menubar', { name: 'Application menus' }).getByRole('menuitem', { name: 'Help', exact: true }).click();
  await page.getByRole('menu', { name: 'Help', exact: true }).getByRole('menuitem', { name: 'Keyboard shortcuts', exact: true }).click();
  if (waitForContent) await expect(managed(page, 'readme').getByRole('table', { name: 'Keyboard shortcuts' })).toBeVisible();
}
async function atSection(page: Page, section: string, stage = 'Section navigation') {
  const document = managed(page, 'readme');
  await expect.poll(() => document.evaluate((el, id) => {
    const root = el.querySelector('[data-scroll-root]')!;
    const heading = root.querySelector(`#${id}`)!;
    return Math.round(heading.getBoundingClientRect().top - root.getBoundingClientRect().top);
  }, section)).toBe(20);
  await expect(document.locator(`#${section}`), stage).toBeFocused();
}

for (const width of [1440, 390]) {
  test(`static Now and Read me remain complete without JavaScript at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: width === 390 ? 844 : 900 } });
    const page = await context.newPage();
    try {
      await page.goto('/now');
      await expect(page.getByRole('list', { name: 'Current focus' }).getByRole('listitem')).toHaveCount(5);
      await expect(page.locator('#static-window time')).toHaveText('28 September 2026');
      await expect(page.locator('#static-window time')).toHaveAttribute('datetime', '2026-09-28');
      await expect(page.getByRole('link', { name: 'Inspired by nownownow.com ↗' })).toHaveAttribute('href', 'https://nownownow.com');
      await page.goto('/readme');
      for (const name of ['Welcome', 'Getting around', 'Keyboard shortcuts', 'Prefer a plain page?', 'Privacy', 'Credits'])
        await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(1);
      await expect(page.getByRole('table').getByRole('row')).toHaveCount(GLOBAL_SHORTCUTS.length + 3);
      await page.getByRole('navigation', { name: 'In this document' }).getByRole('link', { name: 'Keyboard shortcuts' }).click();
      await expect(page.locator('#shortcuts')).toBeInViewport();
      await page.getByRole('link', { name: 'Switch to simple view' }).click();
      await expect(page.locator('.static-titlebar')).toBeHidden();
      await expect(page.getByText('No cookies and no tracking.', { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await context.close(); }
  });
}

test('Now opens from Go with the five items, date and paper surface', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await page.getByRole('menubar', { name: 'Application menus' }).getByRole('menuitem', { name: 'Go', exact: true }).click();
  await page.getByRole('menu', { name: 'Go', exact: true }).getByRole('menuitem', { name: 'Now', exact: true }).click();
  const window = managed(page, 'now');
  await expect(window.getByRole('listitem')).toHaveCount(5);
  await expect(window.locator('footer')).toContainText('Updated 28 September 2026 · Colombo');
  await expect(window.getByRole('button', { name: 'Zoom Now' })).toHaveAttribute('aria-disabled', 'true');
  expect(await window.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 233, 168)');
  expect(errors).toEqual([]);
});

test('Help opens Read me scrolled to shortcuts, and the section survives reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await openShortcuts(page); await atSection(page, 'shortcuts', 'Initial Help');
  await expect(page).toHaveURL(/\/readme\?section=shortcuts$/);
  await page.reload(); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await atSection(page, 'shortcuts');
  await expect(managed(page, 'readme')).toHaveAccessibleName('Read me.txt');
  expect(errors).toEqual([]);
});

test('section links, View commands, repeated Help and history scroll within the document', async ({ page }) => {
  await page.goto('/readme'); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const window = managed(page, 'readme');
  await window.getByRole('navigation', { name: 'In this document' }).getByRole('link', { name: 'Privacy' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/section=privacy/);
  await expect(window.locator('#privacy')).toBeFocused();
  await openShortcuts(page); await atSection(page, 'shortcuts', 'Help after Privacy');
  await window.locator('[data-scroll-root]').evaluate(el => { el.scrollTop = 0; });
  await openShortcuts(page); await atSection(page, 'shortcuts', 'Repeated Help');
  await page.getByRole('menubar', { name: 'Application menus' }).getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menu', { name: 'View', exact: true }).getByRole('menuitem', { name: 'Keyboard shortcuts' }).click();
  await atSection(page, 'shortcuts', 'View command');
  await page.goBack(); await expect(window.locator('#privacy')).toBeFocused();
  await page.goForward(); await atSection(page, 'shortcuts', 'History forward');
});

for (const platform of ['mac', 'windows'] as const) {
  test(`the shortcut table uses ${platform} labels from the global map`, async ({ page }) => {
    await page.addInitScript(mac => {
      Object.defineProperty(navigator, 'platform', { value: mac ? 'MacIntel' : 'Win32', configurable: true });
      Object.defineProperty(navigator, 'userAgentData', { value: { platform: mac ? 'macOS' : 'Windows' }, configurable: true });
    }, platform === 'mac');
    await page.goto('/readme?section=shortcuts'); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    const rows = managed(page, 'readme').getByRole('table').locator('tbody tr');
    for (const [index, entry] of GLOBAL_SHORTCUTS.entries())
      await expect(rows.nth(index).locator('kbd')).toHaveText(formatShortcut(entry.shortcut, platform));
    await atSection(page, 'shortcuts');
  });
}

test('the plain page link works after opening Read me from the desktop', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await openShortcuts(page);
  await managed(page, 'readme').getByRole('link', { name: 'Switch to simple view' }).click();
  await expect(page).toHaveURL(/\/readme#simple$/);
  await expect(page.locator('#static-window')).toBeVisible();
  await expect(page.locator('#static-window').getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible();
  await expect(page.locator('#static-window .static-titlebar')).toBeHidden();
});

for (const app of ['now', 'readme'] as const) {
  test(`${app} retries a failed data request after opening from home`, async ({ page }) => {
    let fail = true;
    await page.route('**/data/profile.json', route => fail ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
    await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
    if (app === 'readme') await openShortcuts(page, false);
    else {
      await page.getByRole('menubar', { name: 'Application menus' }).getByRole('menuitem', { name: 'Go', exact: true }).click();
      await page.getByRole('menu', { name: 'Go', exact: true }).getByRole('menuitem', { name: 'Now', exact: true }).click();
    }
    const window = managed(page, app);
    await expect(window.getByRole('button', { name: 'Try again' })).toBeVisible();
    fail = false; await window.getByRole('button', { name: 'Try again' }).click();
    if (app === 'now') await expect(window.getByRole('listitem')).toHaveCount(5);
    else { await expect(window.getByRole('table')).toBeVisible(); await atSection(page, 'shortcuts'); }
  });
}

for (const app of ['now', 'readme'] as const) {
  test(`${app} adopts the static content with identical geometry, scroll and focus`, async ({ page }) => {
    let release!: () => void; const hold = new Promise<void>(done => { release = done; });
    await page.route(`**/${app === 'now' ? 'NowApp' : 'ReadmeApp'}.*.js`, async route => { await hold; await route.continue(); });
    try {
      await page.goto(`/${app}`, { waitUntil: 'domcontentloaded' });
      await expect(managed(page, app)).toHaveAttribute('data-adopting', '');
      await page.evaluate(async () => { await document.fonts.load(getComputedStyle(document.querySelector('#static-window h1')!).font); });
      const staticWindow = page.locator('#static-window');
      const before = await staticWindow.locator('h1').boundingBox();
      await staticWindow.locator('[data-scroll-root]').evaluate(el => { (el as HTMLElement).focus(); el.scrollTop = 100; });
      const scroll = await staticWindow.locator('[data-scroll-root]').evaluate(el => el.scrollTop);
      release(); await expect(staticWindow).toHaveAttribute('hidden', '');
      const root = managed(page, app).locator('[data-scroll-root]');
      expect(await root.evaluate(el => el.scrollTop)).toBe(scroll);
      await expect(root).toBeFocused();
      await root.evaluate(el => { el.scrollTop = 0; });
      const after = await managed(page, app).locator('h1').boundingBox();
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(Math.abs(before![key] - after![key]), key).toBeLessThanOrEqual(1);
    } finally { release(); }
  });
}

for (const app of ['now', 'readme']) for (const [mode, viewport] of [
  ['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }],
] as const) for (const theme of ['light', 'dark'] as const) {
  test(`${app} ${theme} ${mode}: zero CLS, narrow layout and all accents pass axe @visual`, async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'Layout shift is measured in Chromium.');
    mkdirSync(resolve('.astro/p3-5-artifacts'), { recursive: true });
    await page.addInitScript(() => {
      Object.assign(window, { p35Cls: 0, p35Shifts: [] });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) {
          const state = window as unknown as { p35Cls: number; p35Shifts: unknown[] };
          state.p35Cls += shift.value;
          state.p35Shifts.push({ value: shift.value, sources: (entry as PerformanceEntry & {
            sources: { node: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
          }).sources.map(source => ({ node: source.node?.outerHTML?.slice(0, 400), before: source.previousRect, after: source.currentRect })) });
        }
      } }).observe({ type: 'layout-shift', buffered: true });
    });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport); await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(`/${app}`); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
    const window = managed(page, app); const root = window.locator('[data-scroll-root]');
    await page.screenshot({ path: resolve(`.astro/p3-5-artifacts/${app}-${theme}-${mode}.png`) });
    expect(await root.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { p35Cls: number }).p35Cls),
      `${app} ${theme} ${mode}: ${JSON.stringify(await page.evaluate(() => (window as unknown as { p35Shifts: unknown[] }).p35Shifts))}`).toBe(0);
    for (const accent of ['thambili', 'lagoon', 'lotus', 'tea']) {
      await page.evaluate(value => { document.documentElement.dataset.accent = value; }, accent);
      const result = await new AxeBuilder({ page }).include(`.managed-window[data-app="${app}"]`).analyze();
      expect(result.violations, `${app} ${theme} ${mode} ${accent}`).toEqual([]);
    }
    await page.evaluate(() => { document.documentElement.dataset.accent = 'thambili'; });
    expect(errors).toEqual([]);
  });
}
