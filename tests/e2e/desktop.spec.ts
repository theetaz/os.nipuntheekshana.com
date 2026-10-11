import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import type { Page, Locator } from '@playwright/test';
import { test, expect } from './fixtures';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = resolve(root, '.astro/p2-7-artifacts');
async function desktop(page: Page) {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  test.fixme(await page.locator('html').getAttribute('data-mode') === 'mobile', 'P4-1: the phone home launcher replaces desktop icon selection, drag and marquee controls.');
  await expect(page.getByRole('listbox', { name: 'Desktop', exact: true })).toBeVisible();
}
const icon = (page: Page, name: string) => page.getByRole('option', { name, exact: true });
async function drag(page: Page, target: Locator, dx: number, dy: number) {
  const box = (await target.boundingBox())!; const x = box.x + box.width / 2; const y = box.y + 28;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
  await expect(target).not.toHaveAttribute('data-dragging');
  await target.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
}

test('single click selects an accent pill; double-click opens without navigating the document', async ({ page }) => {
  await desktop(page); const projects = icon(page, 'Projects'); await projects.click();
  await expect(projects).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('[data-window-id]')).toHaveCount(0);
  expect(await projects.locator('span').evaluate(node => {
    const expected = document.createElement('span'); expected.style.backgroundColor = 'var(--os-accent)'; document.body.append(expected);
    const matches = getComputedStyle(node).backgroundColor === getComputedStyle(expected).backgroundColor; expected.remove(); return matches;
  })).toBe(true);
  await projects.dblclick(); await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  await expect(page).toHaveURL(/\/projects$/); expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
});
test('Ctrl and Command toggle selection; Shift extends the anchored range', async ({ page }) => {
  await desktop(page); await icon(page, 'Read me.txt').click(); await icon(page, 'Projects').click({ modifiers: ['Control'] });
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(2);
  await icon(page, 'Read me.txt').click({ modifiers: ['Meta'] }); await expect(icon(page, 'Read me.txt')).toHaveAttribute('aria-selected', 'false');
  await icon(page, 'CV.pdf').click({ modifiers: ['Shift'] });
  for (const name of ['Read me.txt', 'Projects', 'Writing', 'CV.pdf']) await expect(icon(page, name)).toHaveAttribute('aria-selected', 'true');
});
test('arrows, Home, End and Enter provide roving selection and launch', async ({ page }) => {
  await desktop(page); await icon(page, 'Read me.txt').focus(); await page.keyboard.press('ArrowDown');
  await expect(icon(page, 'Projects')).toBeFocused(); await expect(icon(page, 'Projects')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await expect(icon(page, 'Projects')).toBeFocused();
  await page.keyboard.press('End'); await expect(icon(page, 'Pin the city')).toBeFocused();
  await page.keyboard.press('Home'); await expect(icon(page, 'Read me.txt')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-window-id="readme"]')).toBeVisible();
});
test('Shift-arrow extends selection and Ctrl-arrow moves focus without changing it', async ({ page }) => {
  await desktop(page); await icon(page, 'Read me.txt').click(); await page.keyboard.press('Shift+ArrowDown');
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(2);
  await page.keyboard.press('Control+ArrowDown'); await expect(icon(page, 'Writing')).toBeFocused();
  await expect(icon(page, 'Writing')).toHaveAttribute('aria-selected', 'false');
});
test('Pin the city opens Island in Play mode', async ({ page }) => {
  await desktop(page); await icon(page, 'Pin the city').dblclick(); await expect(page).toHaveURL(/\/maps\/play$/);
});
test('static desktop icon links remain clickable with JavaScript disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage(); await page.goto(baseURL!);
    await page.locator('body > .desktop-icons').getByRole('link', { name: 'Projects', exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/); await expect(page.locator('#static-window')).toBeVisible();
  } finally { await context.close(); }
});
test('drag snaps to a 96 × 104 grid, persists through reload, and cleans up', async ({ page }) => {
  await desktop(page); const readme = icon(page, 'Read me.txt'); await drag(page, readme, -120, 130);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:icons:v1')!))).toEqual({ readme: { x: 96, y: 104 } });
  let box = (await readme.boundingBox())!; expect(box.x).toBe(1236); expect(box.y).toBe(152);
  await page.reload(); await expect(page.locator('html')).toHaveClass(/os-ready/); box = (await readme.boundingBox())!;
  expect(box.x).toBe(1236); expect(box.y).toBe(152);
  await desktop(page);
  await page.mouse.click(900, 650, { button: 'right' }); await page.getByRole('menuitem', { name: 'Clean up icons' }).click();
  await expect(readme).not.toHaveAttribute('data-positioned'); expect((await readme.boundingBox())!.y).toBe(48);
  expect(await page.evaluate(() => localStorage.getItem('serendib:icons:v1'))).toBe('{}');
});
test('selected icons drag together; cancellation keeps stored positions and clears capture', async ({ page }) => {
  await desktop(page); await icon(page, 'Read me.txt').click(); await icon(page, 'Projects').click({ modifiers: ['Control'] });
  await drag(page, icon(page, 'Read me.txt'), -96, 104);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:icons:v1')!))).toEqual({ readme: { x: 96, y: 104 }, projects: { x: 96, y: 208 } });
  const readme = icon(page, 'Read me.txt'); const box = (await readme.boundingBox())!;
  await page.mouse.move(box.x + 42, box.y + 28); await page.mouse.down(); await page.mouse.move(box.x - 200, box.y + 160);
  await page.keyboard.press('Escape'); await page.mouse.up(); await expect(readme).not.toHaveAttribute('data-dragging');
  expect(await readme.evaluate(node => node.style.willChange)).toBe('');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:icons:v1')!).readme)).toEqual({ x: 96, y: 104 });
});
test('rubber band selects two touched icons and additive marquee retains another', async ({ page }) => {
  await desktop(page); await page.mouse.move(1300, 40); await page.mouse.down(); await page.mouse.move(1430, 235, { steps: 8 });
  await expect(page.locator('[data-desktop-marquee]')).toBeVisible(); await page.mouse.up();
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(2); await expect(page.locator('[data-desktop-marquee]')).toBeHidden();
  await icon(page, 'CV.pdf').click({ modifiers: ['Control'] }); await page.keyboard.down('Shift');
  await page.mouse.move(1300, 40); await page.mouse.down(); await page.mouse.move(1430, 235, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Shift');
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(3);
});
test('empty desktop clears selection and blurs a window without minimizing it', async ({ page }) => {
  await desktop(page); await icon(page, 'Projects').dblclick();
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  // The real Projects window occupies the old (900, 780) stub-era point.
  const empty = { x: 1250, y: 700 };
  expect(await page.evaluate(point => !!document.elementFromPoint(point.x, point.y)?.closest('.desktop-surface'), empty)).toBe(true);
  await page.mouse.click(empty.x, empty.y);
  await expect(page.locator('[data-desktop-icon][aria-selected="true"]')).toHaveCount(0);
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  await expect(page.locator('[data-window-id="projects"]')).toHaveAttribute('data-focused', 'false');
});
test('desktop right-click menu provides the specified actions and checkbox state', async ({ page }) => {
  await desktop(page); await page.mouse.click(900, 650, { button: 'right' });
  await expect(page.getByRole('menu', { name: 'desktop context menu' })).toBeVisible();
  for (const name of ['New Terminal window', 'Change wallpaper…', 'Clean up icons', 'About Serendib']) await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Show widgets' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Show Mochi' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemcheckbox', { name: 'Show widgets' }).click(); await expect(page.locator('.desktop-widgets')).toBeHidden();
  await page.mouse.click(900, 650, { button: 'right' }); await expect(page.getByRole('menuitemcheckbox', { name: 'Show widgets' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('menuitemcheckbox', { name: 'Show widgets' }).click(); await expect(page.locator('.ticket-wrap')).toBeVisible();
  await page.mouse.click(900, 650, { button: 'right' }); await page.getByRole('menuitem', { name: 'Change wallpaper…' }).click();
  await expect(page.locator('[data-window-id="settings"]')).toBeVisible();
  // Settings is a Phase 3 stub. commands.test.ts asserts its wallpaper section
  // query; here the production host must open the actual Settings window.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
test('icon right-click and keyboard context menus hand off their Open action', async ({ page }) => {
  await desktop(page); const projects = icon(page, 'Projects'); await projects.click({ button: 'right' });
  await expect(projects).toHaveAttribute('aria-selected', 'true'); await expect(page.getByRole('menu', { name: 'desktop:projects context menu' })).toBeVisible();
  await page.keyboard.press('Escape'); await projects.focus(); await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'Open', exact: true }).click(); await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
});
test('type-ahead selects icons and ayubowan dispatches once only on the desktop', async ({ page }) => {
  await desktop(page); await page.evaluate(() => { Object.assign(window, { desktopEggs: 0 }); document.addEventListener('ayubowan', () => { (window as unknown as { desktopEggs: number }).desktopEggs++; }); });
  await page.mouse.click(900, 780); await page.keyboard.type('wr'); await expect(icon(page, 'Writing')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.type('ayubowan'); expect(await page.evaluate(() => (window as unknown as { desktopEggs: number }).desktopEggs)).toBe(1);
  await icon(page, 'Projects').dblclick(); await page.keyboard.type('ayubowan');
  expect(await page.evaluate(() => (window as unknown as { desktopEggs: number }).desktopEggs)).toBe(1);
});
test('widgets stay clickable above the surface and obey resize rules', async ({ page }) => {
  await desktop(page); await page.locator('.ticket-wrap').click(); await expect(page.locator('[data-window-id="about"]')).toBeVisible();
  await desktop(page); await page.locator('.now-sticky a').click(); await expect(page.locator('[data-window-id="now"]')).toBeVisible();
  await desktop(page); if (await page.locator('.activity-strip').count()) { await page.locator('.activity-strip a').click(); await expect(page.locator('[data-window-id="activity"]')).toBeVisible(); }
  await desktop(page); await page.setViewportSize({ width: 1440, height: 690 }); await expect(page.locator('.now-sticky')).toBeHidden();
  await page.setViewportSize({ width: 1100, height: 900 }); await expect(page.locator('.now-sticky')).toBeVisible(); await expect(page.locator('.activity-strip')).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 }); await expect(page.locator('.now-sticky')).toBeVisible();
  await icon(page, 'Projects').click(); await page.mouse.click(440, 420);
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);
});
test('reduced motion suppresses icon and ticket lift and drag settling; selection passes axe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await desktop(page); await icon(page, 'Read me.txt').hover();
  await expect(icon(page, 'Read me.txt').locator('svg')).toHaveCSS('transform', 'none');
  const before = await page.locator('.ticket-wrap').boundingBox(); await page.locator('.ticket-wrap').hover();
  expect(await page.locator('.ticket-wrap').boundingBox()).toEqual(before);
  await drag(page, icon(page, 'Read me.txt'), -96, 104); expect(await icon(page, 'Read me.txt').evaluate(node => node.getAnimations().length)).toBe(0);
  await icon(page, 'Read me.txt').click(); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('hydration preserves static icon positions, mobile widget flow, CLS 0 and console cleanliness @visual', async ({ page }) => {
  await mkdir(artifacts, { recursive: true }); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    Object.assign(window, { desktopCLS: 0 });
    if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) return;
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
      if (!shift.hadRecentInput) (window as unknown as { desktopCLS: number }).desktopCLS += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  for (const [mode, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme }); let release!: () => void; const held = new Promise<void>(done => { release = done; });
      await page.route('**/Desktop.*.js', async route => { await held; await route.continue(); });
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        // WebKit's fonts.ready also waits for the held module/load event.
        // Load the rendered faces directly before measuring static geometry.
        await page.evaluate(async () => {
          const text = document.body.innerText;
          const fonts = new Set(Array.from(document.querySelectorAll('*'), node => getComputedStyle(node).font));
          await Promise.all(Array.from(fonts).filter(Boolean).map(font => document.fonts.load(font, text)));
          await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        });
        const widgets = await page.locator('.desktop-widgets').boundingBox();
        const icons = await page.locator('body > .desktop-icons svg').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y }; }));
        release(); await expect(page.locator('html')).toHaveClass(/os-ready/);
        await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
        expect(await page.locator('.desktop-widgets').boundingBox()).toEqual(widgets);
        if (mode === 'desktop') expect(await page.locator('[data-shell="desktop"] .desktop-icons svg').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y }; }))).toEqual(icons);
        if (await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('layout-shift'))) {
          expect(await page.evaluate(() => (window as unknown as { desktopCLS: number }).desktopCLS)).toBe(0);
        }
        await page.screenshot({ path: resolve(artifacts, `${mode}-${theme}.png`) });
      } finally { release(); await page.unroute('**/Desktop.*.js'); }
    }
  }
  expect(errors).toEqual([]);
});

test('a cold icon controller retains a completed first drag', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(done => { release = done; });
  await page.route('**/desktop-icon-drag.*.js', async route => { await held; await route.continue(); });
  try {
    await desktop(page); await drag(page, icon(page, 'Read me.txt'), -120, 130);
    release();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('serendib:icons:v1')!))).toEqual({ readme: { x: 96, y: 104 } });
    await expect(icon(page, 'Read me.txt')).not.toHaveAttribute('data-dragging');
    await expect(page.locator('[data-window-id]')).toHaveCount(0);
  } finally { release(); }
});

test('a cold marquee controller retains a completed first selection', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(done => { release = done; });
  await page.route('**/desktop-marquee.*.js', async route => { await held; await route.continue(); });
  try {
    await desktop(page);
    await page.mouse.move(1300, 40); await page.mouse.down(); await page.mouse.move(1430, 235, { steps: 8 }); await page.mouse.up();
    release(); await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(2);
    await expect(page.locator('[data-desktop-marquee]')).toBeHidden();
  } finally { release(); }
});

test('Escape cancels a cold marquee before its controller arrives', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(done => { release = done; });
  await page.route('**/desktop-marquee.*.js', async route => { await held; await route.continue(); });
  try {
    await desktop(page); await icon(page, 'CV.pdf').click();
    await page.mouse.move(1300, 40); await page.mouse.down(); await page.mouse.move(1430, 235);
    await page.keyboard.press('Escape'); await page.mouse.up();
    const downloaded = page.waitForEvent('requestfinished', { predicate: request => /desktop-marquee\..*\.js/.test(request.url()) });
    release(); await downloaded; await page.evaluate(() => new Promise(done => requestAnimationFrame(done)));
    await expect(icon(page, 'CV.pdf')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
    await expect(page.locator('[data-desktop-marquee]')).toBeHidden();
  } finally { release(); }
});
