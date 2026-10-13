import AxeBuilder from '@axe-core/playwright';
import type { Page, Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { test, expect } from './fixtures';
import { desktopMenus } from '../../src/os/registry/menus';

const menuLabel = (command: string) => desktopMenus().flatMap(menu => menu.items)
  .flatMap(item => item.kind === 'item' && item.command === command ? [item.label] : [])[0]!;

const prop = (page: Page, id: string) => page.locator(`[data-prop="${id}"]`);
async function desktop(page: Page) {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await expect(page.locator('[data-k-props]')).toBeVisible();
}
async function drag(page: Page, target: Locator, dx: number, dy: number, release = true) {
  const box = (await target.boundingBox())!; const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 });
  if (release) await page.mouse.up();
}
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('serendib:props:v1') ?? '{}'));

test('hover shows Projects and a single click opens from the tuk-tuk', async ({ page }) => {
  await page.addInitScript(() => document.addEventListener('click', event => {
    if ((event.target as Element).closest('[data-prop]')) Object.assign(window, { propOrigin: { x: event.clientX + scrollX, y: event.clientY + scrollY } });
  }, true));
  await desktop(page); const target = prop(page, 'tuktuk'); await target.hover();
  await expect(target.locator('.k-prop-label')).toHaveCSS('opacity', '1'); await expect(target.locator('.k-prop-label')).toHaveText('Projects');
  // Locator actions can scroll between measurement and dispatch. Compare one coordinate space.
  const box = await target.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; });
  await target.click();
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible(); await expect(page).toHaveURL(/\/projects$/);
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
  const origin = await page.evaluate(() => (window as unknown as { propOrigin: { x: number; y: number } }).propOrigin);
  expect(origin.x).toBeGreaterThanOrEqual(box.x); expect(origin.x).toBeLessThanOrEqual(box.x+box.width);
  expect(origin.y).toBeGreaterThanOrEqual(box.y); expect(origin.y).toBeLessThanOrEqual(box.y+box.height);
});

test('drag persists stage offsets before paint on reload, never opens, and resets', async ({ page }) => {
  await desktop(page); await drag(page, prop(page, 'tuktuk'), 120, 60);
  await expect.poll(() => saved(page)).toEqual({ tuktuk: { dx: 120, dy: 60 } });
  await expect(page.locator('[data-window-id]')).toHaveCount(0);
  await page.addInitScript(() => {
    Object.assign(window, { propBeforePaint: '', propShift: 0 });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as unknown as { propShift: number }).propShift += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    requestAnimationFrame(() => { (window as unknown as { propBeforePaint: string }).propBeforePaint = document.documentElement.style.getPropertyValue('--k-dx-tuktuk'); });
  });
  await page.reload(); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => (window as unknown as { propBeforePaint: string }).propBeforePaint)).toBe('120');
  expect(await page.evaluate(() => (window as unknown as { propShift: number }).propShift)).toBe(0);
  await page.mouse.click(700, 640, { button: 'right' });
  await page.getByRole('menuitem', { name: menuLabel('desktop.cleanUp'), exact: true }).click();
  await expect.poll(() => saved(page)).toEqual({});
  await expect.poll(() => prop(page, 'tuktuk').evaluate(el => getComputedStyle(el).translate)).toBe('0px');
});

test('Escape restores a drag and clears pointer capture', async ({ page }) => {
  await desktop(page); await drag(page, prop(page, 'tuktuk'), 120, 60, false);
  await expect(prop(page, 'tuktuk')).toHaveAttribute('data-dragging', '');
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(prop(page, 'tuktuk')).not.toHaveAttribute('data-dragging'); expect(await saved(page)).toEqual({});
  expect(await prop(page, 'tuktuk').evaluate(el => el.style.willChange)).toBe(''); await expect(page.locator('[data-window-id]')).toHaveCount(0);
});

test('a completed first drag is replayed when its cold runtime arrives', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/props-runtime.*.js', async route => { await hold; await route.continue(); });
  try {
    await desktop(page); await drag(page, prop(page, 'tuktuk'), 120, 0);
    expect(await saved(page)).toEqual({}); release();
    await expect.poll(() => saved(page)).toEqual({ tuktuk: { dx: 120, dy: 0 } });
    await expect(page.locator('[data-window-id]')).toHaveCount(0);
  } finally { release(); }
});

test('desktop greeting keys retain their order while the runtime is cold', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/props-runtime.*.js', async route => { await hold; await route.continue(); });
  try {
    await desktop(page); await expect(page.locator('[data-mochi]')).toBeVisible();
    await page.mouse.click(700, 640); await page.keyboard.type('ayubowan'); release();
    await expect(page.locator('[data-mochi-bubble]')).toHaveText('ආයුබෝවන්!');
    await expect(page.locator('[data-mochi]')).toHaveAttribute('data-mood', 'wave');
  } finally { release(); }
});

test('keyboard focus, spatial arrows, context menu, move, cancel and Enter work', async ({ page }) => {
  await desktop(page); await page.keyboard.press('Alt+Digit2'); await expect(prop(page, 'lantern')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(prop(page, 'crbook')).toBeFocused();
  await page.keyboard.press('End'); await expect(prop(page, 'radio')).toBeFocused();
  await page.keyboard.press('Home'); await expect(prop(page, 'lantern')).toBeFocused();
  await prop(page, 'tuktuk').focus(); await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu', { name: 'desktop:prop:tuktuk context menu' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Move with keyboard' }).click();
  await expect(prop(page, 'tuktuk')).toHaveAttribute('data-keyboard-move', '');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Enter');
  await expect.poll(() => saved(page)).toEqual({ tuktuk: { dx: 8, dy: 32 } });
  await page.keyboard.press('Shift+F10'); await page.getByRole('menuitem', { name: 'Move with keyboard' }).click();
  await expect(prop(page, 'tuktuk')).toHaveAttribute('data-keyboard-move', '');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
  expect(await saved(page)).toEqual({ tuktuk: { dx: 8, dy: 32 } });
  await page.keyboard.press('Enter'); await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
});

test('post box scrolls to the board and story right-click is left to the browser', async ({ page }) => {
  await desktop(page); await prop(page, 'postbox').click(); await expect(page).toHaveURL(/#ws-board$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(900);
  await page.locator('#ws-board').click({ button: 'right' }); await expect(page.getByRole('menu')).toHaveCount(0);
});

test('Tab exits the props and cancels an uncommitted keyboard move', async ({ page }) => {
  await desktop(page); const target = prop(page, 'tuktuk'); await target.focus();
  await page.keyboard.press('Shift+F10'); await page.getByRole('menuitem', { name: 'Move with keyboard' }).click();
  await expect(target).toHaveAttribute('data-keyboard-move', '');
  await page.keyboard.press('ArrowRight'); await expect(target).toHaveAttribute('data-keyboard-move', '');
  await page.keyboard.press('Tab'); await expect(target).not.toBeFocused();
  await expect(target).not.toHaveAttribute('data-keyboard-move'); expect(await saved(page)).toEqual({});
  await expect.poll(() => target.evaluate(el => getComputedStyle(el).translate)).toBe('0px');
});

test('a modified prop click preserves native new-tab navigation', async ({ page, context }) => {
  await desktop(page);
  const popup = context.waitForEvent('page'); await prop(page, 'tuktuk').click({ modifiers: ['ControlOrMeta'] });
  const opened = await popup; await opened.waitForURL('**/projects');
  await expect(page.locator('[data-window-id]')).toHaveCount(0); await expect(page).toHaveURL(/\/$/); await opened.close();
});

test('Escape cancels a first gesture while the prop runtime is still loading', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/props-runtime.*.js', async route => { await hold; await route.continue(); });
  try {
    await desktop(page); await drag(page, prop(page, 'tuktuk'), 120, 0, false);
    await page.keyboard.press('Escape'); await page.mouse.up(); release();
    await prop(page, 'tuktuk').focus(); await page.keyboard.press('ArrowRight'); await expect(prop(page, 'crbook')).toBeFocused();
    expect(await saved(page)).toEqual({}); await expect(page.locator('[data-window-id]')).toHaveCount(0);
  } finally { release(); }
});

test('empty hero menu uses Kottu labels and no widgets or marquee', async ({ page }) => {
  await desktop(page); await page.mouse.click(700, 640, { button: 'right' });
  for (const name of ['New Terminal window', 'Change wallpaper…', menuLabel('desktop.cleanUp'), menuLabel('os.about')]) await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Show Mochi' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemcheckbox', { name: 'Show widgets' })).toHaveCount(0); await expect(page.locator('[data-desktop-marquee]')).toHaveCount(0);
});

test('reduced motion, forced colours and the hero accessibility contract', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await desktop(page); await prop(page, 'tuktuk').hover();
  await expect(prop(page, 'tuktuk')).toHaveCSS('transform', 'none');
  expect(await page.locator('.k-scroll-cue b').evaluate(el => el.getAnimations().length)).toBe(0);
  await drag(page, prop(page, 'tuktuk'), 80, 0); expect(await prop(page, 'tuktuk').evaluate(el => el.getAnimations().length)).toBe(0);
  expect((await new AxeBuilder({ page }).include('.k-hero').analyze()).violations).toEqual([]);
  await page.emulateMedia({ forcedColors: 'active' }); await expect(page.locator('body > .wallpaper')).toBeHidden();
  await expect(prop(page, 'tuktuk').locator('.k-prop-label')).toHaveCSS('opacity', '1');
});

test('drag clamps to retain at least forty percent of the prop', async ({ page }) => {
  await desktop(page); const target = prop(page, 'tuktuk'); const box = (await target.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(entry => /props-runtime.*\.js/.test(entry.name)))).toBe(true);
  await page.locator('[data-k-props]').dispatchEvent('pointermove', { pointerId: 1, clientX: -1000, clientY: -1000, pointerType: 'mouse' });
  await expect(target).toHaveAttribute('data-dragging', '');
  await page.locator('[data-k-props]').dispatchEvent('pointerup', { pointerId: 1, clientX: -1000, clientY: -1000, pointerType: 'mouse' });
  await page.mouse.up();
  const geometry = await prop(page, 'tuktuk').evaluate(el => {
    const css = getComputedStyle(el); const translate = css.translate.split(' ').map(parseFloat);
    return { x: parseFloat(css.left) + translate[0]!, y: parseFloat(css.top) + (translate[1] ?? 0), w: el.clientWidth, h: el.clientHeight };
  });
  expect(geometry.x + geometry.w).toBeGreaterThanOrEqual(geometry.w * .4 - 1);
  expect(geometry.y + geometry.h).toBeGreaterThanOrEqual(geometry.h * .4 - 1);
});

test('hover and mid-drag screenshots @visual', async ({ page }) => {
  mkdirSync('.astro/k7-artifacts/screenshots', { recursive: true }); await desktop(page);
  await prop(page, 'tuktuk').hover(); await expect(prop(page, 'tuktuk').locator('.k-prop-label')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: '.astro/k7-artifacts/screenshots/prop-hover.png' });
  await drag(page, prop(page, 'tuktuk'), 120, 40, false); await expect(prop(page, 'tuktuk')).toHaveAttribute('data-dragging', '');
  await page.screenshot({ path: '.astro/k7-artifacts/screenshots/prop-mid-drag.png' }); await page.keyboard.press('Escape'); await page.mouse.up();
});
