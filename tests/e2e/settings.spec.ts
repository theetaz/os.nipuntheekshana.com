import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, openMenu, openApp, closeApp } from './fixtures';
import { NARROW_PHONE, expectPhoneSheetFits, expectSheetAccessible, openFromHome, phoneOnly } from './phone-sheet';

const app = (page: Page) => page.locator('[data-window-id="settings"]');
const phone = async (page: Page) => await page.locator('html').getAttribute('data-mode') === 'mobile';
const back = (page: Page) => app(page).getByRole('button', { name: 'Back to Settings', exact: true });
async function settings(page: Page) {
  await page.goto('/settings');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  // Phone sheets open on the section list (D§13.3); desktop opens on Appearance.
  if (await phone(page)) await section(page, 'Appearance');
  await expect(app(page).getByRole('radiogroup', { name: 'Theme', exact: true })).toBeVisible();
  return app(page);
}
async function section(page: Page, name: string) {
  if (await phone(page) && await back(page).isVisible()) await back(page).click();
  await app(page).getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name, exact: true }).click();
  await expect(app(page).getByRole('region', { name, exact: true })).toBeVisible();
}
async function stored(page: Page, key: string) { return page.evaluate(key => localStorage.getItem(`serendib:${key}`), key); }
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(({}, info) => { if (info.expectedStatus !== 'skipped') expect(errors).toEqual([]); });

test('Dark applies live and persists before scripts load, without a theme flash', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); const win = await settings(page);
  await win.getByRole('radio', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await stored(page, 'theme')).toBe('"dark"');
  await page.addInitScript(() => {
    const themes: string[] = []; Object.assign(window, { settingsThemes: themes });
    new MutationObserver(() => { const theme = document.documentElement?.dataset.theme; if (theme) themes.push(theme); })
      .observe(document, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
  });
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/SettingsApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#static-window')).not.toHaveAttribute('hidden');
  } finally { release(); }
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  if (await phone(page)) await section(page, 'Appearance');
  await expect(app(page).getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => (window as unknown as { settingsThemes: string[] }).settingsThemes.every(theme => theme === 'dark'))).toBe(true);
});

test('Lotus changes the accent token and radio groups support arrow keys', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); const win = await settings(page);
  const light = win.getByRole('radio', { name: 'Light', exact: true }); await light.focus(); await page.keyboard.press('ArrowRight');
  await expect(win.getByRole('radio', { name: 'Dark', exact: true })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await light.click(); await win.getByRole('radio', { name: 'Lotus', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'lotus');
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--os-accent').trim())).toBe('#ff7eb6');
  expect(await stored(page, 'accent')).toBe('"lotus"');
});

test('Reduce motion stops live dock magnification and transparency becomes solid', async ({ page }) => {
  await settings(page); const dock = page.locator('[data-shell="desktop"] .os-dock');
  const projects = dock.locator('[data-dock-app="projects"]'); await projects.hover();
  await expect.poll(() => projects.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(71);
  await section(page, 'Accessibility');
  await app(page).getByRole('radiogroup', { name: 'Motion', exact: true }).getByRole('radio', { name: 'Reduce', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await expect(dock).toHaveAttribute('data-reduced-motion', 'true'); await projects.hover();
  expect(await projects.evaluate(el => el.getBoundingClientRect().width)).toBe(48);
  await app(page).getByRole('radiogroup', { name: 'Transparency', exact: true }).getByRole('radio', { name: 'Reduce', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-transparency', 'reduce');
  expect(await stored(page, 'motion')).toBe('"reduce"'); expect(await stored(page, 'transparency')).toBe('"reduce"');
});

test('wallpapers apply live and all four previews retain their own ids', async ({ page }) => {
  await settings(page); await section(page, 'Wallpaper');
  const group = app(page).getByRole('radiogroup', { name: 'Wallpaper', exact: true });
  await expect(group.getByRole('radio')).toHaveCount(4);
  for (const [id, name] of [['kottu', 'Kottu'], ['galle-face', 'Galle Face'], ['pettah', 'Pettah'], ['paper', 'Paper']]) {
    await group.getByRole('radio', { name, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-wallpaper', id!);
    expect(await stored(page, 'wallpaper')).toBe(JSON.stringify(id));
    await expect(app(page).locator(`[data-preview="${id}"]`)).toBeVisible();
  }
});


test('Desktop resets remove remembered geometry and prop positions', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('serendib:geometry:v1', JSON.stringify({ projects: { x: 24, y: 60, w: 600, h: 440 } }));
    localStorage.setItem('serendib:props:v1', JSON.stringify({ tuktuk: { dx: 160, dy: 160 } }));
  });
  await settings(page); await section(page, 'Desktop');
  await app(page).getByRole('button', { name: 'Reset window sizes and positions', exact: true }).click();
  expect(await stored(page, 'geometry:v1')).toBeNull();
  await app(page).getByRole('button', { name: 'Reset prop positions', exact: true }).click(); await expect.poll(() => stored(page, 'props:v1')).toBe('{}');
  await expect.poll(() => page.locator('html').evaluate(el => el.style.getPropertyValue('--k-dx-tuktuk'))).toBe('0');
});

test('Sound binds its switch and volume and lazily plays an audio sample', async ({ page }) => {
  await page.addInitScript(() => {
    const Audio = window.AudioContext; Object.assign(window, { settingsAudio: 0 });
    window.AudioContext = new Proxy(Audio, { construct(target, args) {
      (window as unknown as { settingsAudio: number }).settingsAudio++; return Reflect.construct(target, args);
    } });
  });
  await settings(page); await section(page, 'Sound'); const win = app(page);
  await expect(win.getByRole('switch', { name: 'Interface sounds' })).toHaveAttribute('aria-checked', 'false');
  await expect(win.getByRole('slider', { name: 'Volume' })).toHaveValue('60'); await expect(win.getByRole('button', { name: 'Play a sample' })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { settingsAudio: number }).settingsAudio)).toBe(0);
  await win.getByRole('switch', { name: 'Interface sounds' }).click();
  await win.getByRole('slider', { name: 'Volume' }).fill('35'); expect(await stored(page, 'volume')).toBe('0.35');
  expect(await stored(page, 'sound')).toBe('true'); await win.getByRole('button', { name: 'Play a sample' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { settingsAudio: number }).settingsAudio)).toBeGreaterThan(0);
});

test('Mochi writes preserve position and pets, and pet reset requires confirmation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('serendib:mochi', JSON.stringify({ visible: true, naps: true, pos: { x: 180, y: 260 }, pets: 12 })));
  await settings(page); await section(page, 'Mochi'); const win = app(page);
  await win.getByRole('switch', { name: 'Show Mochi' }).click(); await win.getByRole('switch', { name: 'Mochi naps when idle' }).click();
  expect(JSON.parse((await stored(page, 'mochi'))!)).toEqual({ visible: false, naps: false, pos: { x: 180, y: 260 }, pets: 12 });
  await win.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0); await expect(win.getByText('Pets so far: 12')).toBeVisible();
  await win.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(win.getByText('Pets so far: 0')).toBeVisible();
  expect(JSON.parse((await stored(page, 'mochi'))!)).toEqual({ visible: false, naps: false, pos: { x: 180, y: 260 }, pets: 0 });
});

test('desktop context query selects Wallpaper, menu state follows selection and window stays fixed', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await page.mouse.click(700, 640, { button: 'right' }); await page.getByRole('menuitem', { name: 'Change wallpaper…' }).click();
  await expect(app(page).getByRole('region', { name: 'Wallpaper', exact: true })).toBeVisible();
  await expect(app(page).locator('[id="window-title-settings"]')).toHaveText('Wallpaper');
  await expect(app(page).locator('[data-resize-handle]')).toHaveCount(0); await expect(app(page).locator('[data-transition]')).toHaveCount(0);
  await section(page, 'Appearance');
  await openMenu(page, 'View');
  await expect(page.getByRole('menuitemradio', { name: 'Appearance', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: 'Sound', exact: true }).click(); await expect(app(page).getByRole('region', { name: 'Sound' })).toBeVisible();
  const before = await app(page).boundingBox();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('window:keyboardMove', { detail: { windowId: 'settings' } })));
  await page.keyboard.press('Alt+Shift+ArrowRight'); await page.keyboard.press('Alt+Shift+ArrowDown'); await page.keyboard.press('Enter');
  expect(await app(page).boundingBox()).toEqual(before);
});

test('Developer is gated by the atom and exposes developer tools', async ({ page }) => {
  await settings(page); const nav = app(page).getByRole('navigation', { name: 'Settings sections' });
  await expect(nav.getByRole('button', { name: 'Developer' })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'serendib:dev', newValue: 'true', storageArea: localStorage })));
  await section(page, 'Developer'); await expect(app(page).getByRole('switch', { name: 'Show FPS meter' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'serendib:dev', newValue: 'false', storageArea: localStorage })));
  await expect(nav.getByRole('button', { name: 'Developer' })).toHaveCount(0); await expect(app(page).getByRole('region', { name: 'Appearance' })).toBeVisible();
});

test('simple view keeps real Settings content and keyboard help opens Read me', async ({ page }) => {
  await settings(page); await section(page, 'Accessibility'); await app(page).getByRole('link', { name: 'Keyboard shortcuts' }).click();
  await expect(page.locator('[data-window-id="readme"]')).toBeVisible();
  await closeApp(page,'Read me.txt');
  await expect(page.locator('[data-window-id="readme"]')).toHaveCount(0);
  if(await page.locator('html').getAttribute('data-mode')==='mobile')await openApp(page,'Settings');
  await app(page).getByRole('button', { name: 'Switch to simple view' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-view', 'simple'); expect(await stored(page, 'view')).toBe('"simple"');
  await expect(page.locator('#static-window')).toBeVisible(); await expect(page.getByText('Made in Colombo by Nipun Theekshana.')).toBeVisible();
});

test('static Settings contains all sections, working anchors and credits without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(); await page.goto(`${baseURL}/settings`);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Settings sections' }); await expect(nav.getByRole('link')).toHaveCount(7);
    await nav.getByRole('link', { name: 'Wallpaper', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Wallpaper', exact: true })).toBeVisible();
    await nav.getByRole('link', { name: 'About', exact: true }).click();
    await expect(page.getByText('Made in Colombo by Nipun Theekshana.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Source on GitHub/ })).toHaveAttribute('href', 'https://github.com/theetaz/nipuntheekshana.com');
    // Axe needs timers. Audit the rendered no-JS document in a separate runtime,
    // with every site script removed and the same URL, styles and fragment.
    const html = await page.evaluate(() => {
      const document = globalThis.document.documentElement.cloneNode(true) as HTMLElement;
      document.querySelectorAll('script').forEach(script => script.remove());
      return `<!doctype html>${document.outerHTML}`;
    });
    const auditContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const audit = await auditContext.newPage();
      await audit.route('**/settings', route => route.fulfill({ contentType: 'text/html', body: html }));
      await audit.goto(`${baseURL}/settings#settings-static-about`);
      await expect(audit.locator('[data-window-id="settings"]')).toHaveCount(0);
      const result = await new AxeBuilder({ page: audit }).setLegacyMode().include('#static-window').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze(); expect(result.violations).toEqual([]);
    } finally { await auditContext.close(); }
  } finally { await context.close(); }
});

test('Settings adoption preserves geometry and first content at zero CLS', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    Object.assign(window, { settingsCls: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { settingsCls: number }).settingsCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/SettingsApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' }); await expect(app(page)).toHaveAttribute('data-adopting', '');
    const before = await page.locator('#static-window').boundingBox();
    // A phone sheet opens on the list, which leads the static page too; desktop opens on Appearance.
    const listed = await phone(page);
    const preview = await page.locator(listed ? '#static-window .settings-nav-appearance' : '#static-window .settings-theme-preview').first().boundingBox();
    release(); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    await page.evaluate(async () => { await document.fonts.ready; });
    const after = await app(page).boundingBox();
    const livePreview = await (listed ? app(page).getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Appearance', exact: true }) : app(page).locator('.settings-theme-preview').first()).boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(before![key] - after![key])).toBeLessThanOrEqual(1);
      expect(Math.abs(preview![key] - livePreview![key])).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => (window as unknown as { settingsCls: number }).settingsCls)).toBe(0);
  } finally { release(); }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`all sections fit ${viewport.width} × ${viewport.height} in ${theme}, with accessible screenshots @visual @a11y`, async ({ page }) => {
      const artifacts = resolve('.astro/p3-10-artifacts'); mkdirSync(artifacts, { recursive: true });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme }); await settings(page);
      await page.mouse.move(0, 0); await page.evaluate(async () => { await document.fonts.ready; });
      for (const name of ['Appearance', 'Wallpaper', 'Accessibility', 'Sound', 'Mochi', 'Desktop', 'About']) {
        await section(page, name);
        expect(await app(page).locator('.settings-app').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const result = await new AxeBuilder({ page }).setLegacyMode().include('[data-window-id="settings"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze(); expect(result.violations, `${name}, ${theme}, ${viewport.width}`).toEqual([]);
        if (name === 'Appearance' || name === 'Wallpaper') await page.screenshot({ path: resolve(artifacts, `${name.toLowerCase()}-${theme}-${viewport.width}x${viewport.height}.png`) });
      }
    });
  }
}

test('Settings opens from home as a section list; each section is a detail with Back, at 360 px @mobile', async ({ page }, info) => {
  test.skip(phoneOnly(info), 'Pocket sheets are covered by the mobile projects.');
  await page.setViewportSize(NARROW_PHONE);
  const sheet = await openFromHome(page, 'Settings', 'settings');
  const nav = sheet.getByRole('navigation', { name: 'Settings sections' });
  await expect(sheet.locator('.sheet-title')).toHaveText('Settings'); await expect(page).toHaveURL(/\/settings$/);
  await expect(nav.getByRole('button')).toHaveCount(7); await expect(sheet.getByRole('region')).toHaveCount(0);
  const rows = await nav.getByRole('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().width));
  expect(new Set(rows.map(Math.round)).size).toBe(1);
  await expectPhoneSheetFits(sheet, 'list'); await expectSheetAccessible(page, 'list');
  // List → detail is a history entry, so the system Back gesture returns to the list.
  await nav.getByRole('button', { name: 'Wallpaper', exact: true }).tap();
  await expect(sheet.getByRole('region', { name: 'Wallpaper', exact: true })).toBeVisible(); await expect(nav).toBeHidden();
  await expect(page).toHaveURL(/\/settings\?section=wallpaper$/); await expect(sheet.locator('.sheet-title')).toHaveText('Wallpaper');
  await expect(back(page)).toBeFocused();
  await page.goBack(); await expect(page).toHaveURL(/\/settings$/); await expect(nav).toBeVisible(); await expect(sheet.getByRole('region')).toHaveCount(0);
  for (const name of ['Appearance', 'Wallpaper', 'Accessibility', 'Sound', 'Mochi', 'Desktop', 'About']) {
    await nav.getByRole('button', { name, exact: true }).tap();
    await expect(sheet.getByRole('region', { name, exact: true })).toBeVisible();
    await expectPhoneSheetFits(sheet, name); await expectSheetAccessible(page, name);
    // The in-content Back returns to the list and to the row that was chosen.
    await back(page).tap(); await expect(nav.getByRole('button', { name, exact: true })).toBeFocused();
    await expect(page).toHaveURL(/\/settings$/);
  }
  await nav.getByRole('button', { name: 'Appearance', exact: true }).tap();
  await sheet.getByRole('radio', { name: 'Dark', exact: true }).tap();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expectSheetAccessible(page, 'dark');
});
