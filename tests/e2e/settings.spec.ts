import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const app = (page: Page) => page.locator('[data-window-id="settings"]');
async function settings(page: Page) {
  await page.goto('/settings');
  await expect(app(page).getByRole('radiogroup', { name: 'Theme', exact: true })).toBeVisible();
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  return app(page);
}
async function section(page: Page, name: string) {
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
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--os-accent').trim())).toBe('#b866d6');
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

test('wallpapers apply live and previews keep their own layers; Data Saver disables live Island', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true,
    addEventListener() {}, removeEventListener() {} } }));
  await settings(page); await section(page, 'Wallpaper');
  const group = app(page).getByRole('radiogroup', { name: 'Wallpaper', exact: true }); await expect(group.getByRole('radio')).toHaveCount(6);
  await expect(group.getByRole('radio', { name: /Island \(live\)/ })).toBeDisabled();
  await expect(app(page).getByText('Island (live): Unavailable while Data Saver is on.')).toBeVisible();
  await group.getByRole('radio', { name: 'Monsoon', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'monsoon'); expect(await stored(page, 'wallpaper')).toBe('"monsoon"');
  await expect(page.locator('body > .wallpaper .wp-rain')).toBeVisible();
  await expect(app(page).locator('[data-preview="galle-face"] .wp-sea')).toBeVisible();
  await expect(app(page).locator('[data-preview="paper"] .wp-rain')).toBeHidden();
  await group.getByRole('radio', { name: 'Paper', exact: true }).click();
  await expect(app(page).locator('[data-preview="monsoon"] .wp-rain')).toBeVisible();
  await section(page, 'Accessibility'); await app(page).getByRole('radiogroup', { name: 'Motion' }).getByRole('radio', { name: 'Reduce' }).click();
  await section(page, 'Wallpaper');
  expect(await app(page).locator('[data-preview="monsoon"] .wp-rain').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('live Island is disabled when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => { const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
      if (String(args[0]).startsWith('webgl')) return null;
      return getContext.apply(this, args as Parameters<typeof getContext>);
    } as typeof getContext;
  });
  await settings(page); await section(page, 'Wallpaper');
  await expect(app(page).getByRole('radio', { name: /Island \(live\)/ })).toBeDisabled();
  await expect(app(page).getByText('Island (live): WebGL 2 is unavailable on this device.')).toBeVisible();
});

test('Desktop resets remove remembered geometry and icon positions and widgets update live', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('serendib:geometry:v1', JSON.stringify({ projects: { x: 24, y: 60, w: 600, h: 440 } }));
    localStorage.setItem('serendib:icons:v1', JSON.stringify({ projects: { x: 160, y: 160 } }));
  });
  await settings(page); await section(page, 'Desktop');
  await app(page).getByRole('button', { name: 'Reset window sizes and positions', exact: true }).click();
  expect(await stored(page, 'geometry:v1')).toBeNull();
  await app(page).getByRole('button', { name: 'Reset icon positions', exact: true }).click(); expect(await stored(page, 'icons:v1')).toBeNull();
  await app(page).getByRole('switch', { name: 'Show widgets' }).click();
  expect(await stored(page, 'widgets')).toBe('false');
  await expect(page.locator('[data-shell="desktop"] .desktop-widgets')).toBeHidden();
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
  await page.mouse.click(900, 650, { button: 'right' }); await page.getByRole('menuitem', { name: 'Change wallpaper…' }).click();
  await expect(app(page).getByRole('region', { name: 'Wallpaper', exact: true })).toBeVisible();
  await expect(app(page).locator('[id="window-title-settings"]')).toHaveText('Wallpaper');
  await expect(app(page).locator('[data-resize-handle]')).toHaveCount(0); await expect(app(page).locator('[data-transition]')).toHaveCount(0);
  await section(page, 'Appearance');
  await page.getByRole('menubar').getByRole('menuitem', { name: 'View', exact: true }).click();
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
  await page.locator('[data-window-id="readme"]').getByRole('button', { name: 'Close Read me' }).click();
  await expect(page.locator('[data-window-id="readme"]')).toHaveCount(0);
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
    const preview = await page.locator('#static-window .settings-theme-preview').first().boundingBox();
    release(); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    await page.evaluate(async () => { await document.fonts.ready; });
    const after = await app(page).boundingBox(); const livePreview = await app(page).locator('.settings-theme-preview').first().boundingBox();
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
