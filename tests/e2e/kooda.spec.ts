import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, openMenu, closeApp } from './fixtures';
import { items } from '../../src/os/apps/trash/items';
import { NARROW_PHONE, expectPhoneSheetFits, expectSheetAccessible, openFromHome, phoneOnly } from './phone-sheet';

const managed = '[data-window-id="trash"]';
const artifactDir = resolve('.astro/p3-11-artifacts');

test('no-JS Kooda has real items and each note opens natively, including simple view', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/kooda');
    const win = page.locator('#static-window');
    await expect(win.locator('[data-scroll-root]')).toHaveCount(1);
    await expect(win.getByRole('heading', { name: 'Kooda', exact: true })).toHaveCount(1);
    await expect(win.locator('.kooda-subtitle')).toHaveText('Kooda (කූඩය) — Sinhala for basket.');
    await expect(win.getByRole('button', { name: 'Empty Kooda', exact: true })).toBeDisabled();
    await expect(win).toContainText('Empty Kooda requires JavaScript.');
    for (const item of items) {
      const note = win.locator('details').filter({ hasText: item.name });
      await note.locator('summary').click();
      await expect(note.locator('p')).toHaveText(item.note);
      await note.locator('summary').click();
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/kooda#simple');
    await expect(page.locator('#static-window')).toBeVisible();
    await expect(page.locator('.kooda-static-note')).toHaveCount(items.length);
    await expect(page.locator('#os-initial-data')).toHaveAttribute('data-key', 'trash:index');
  } finally { await context.close(); }
});

test('every item opens its note; keyboard dismissal restores tile focus and contains Tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/kooda');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const win = page.locator(managed);
  await expect(win.locator('.kooda-tile')).toHaveCount(items.length);
  for (const item of items) {
    const tile = win.getByRole('button', { name: item.name, exact: true });
    await tile.focus();
    await page.keyboard.press('Enter');
    const card = page.getByRole('dialog', { name: item.name, exact: true });
    await expect(card).toBeVisible();
    await expect(card.locator('p')).toHaveText(item.note);
    await expect(card.getByRole('button', { name: 'Close note' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(card.getByRole('button', { name: 'Close note' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(tile).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test('Empty Kooda confirms, cancels, updates dock, survives reopen, and resets on reload', async ({ page }) => {
  await page.goto('/kooda');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const win = page.locator(managed);
  const empty = win.getByRole('button', { name: 'Empty Kooda', exact: true });
  const dockIcon = page.locator('[data-shell="desktop"] .os-dock-link[data-dock-app="trash"] use');
  await expect(dockIcon).toHaveAttribute('href', '#app-trash-full');
  await empty.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('alertdialog', { name: 'Empty Kooda?' });
  await expect(sheet).toHaveClass(/os-alert-sheet/);
  await expect(sheet).toContainText('Nothing here is really deleted. These are just jokes.');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(empty).toBeFocused();
  await expect(win.locator('.kooda-tile')).toHaveCount(items.length);
  await page.keyboard.press('Enter');
  await expect(sheet.getByRole('button', { name: 'Empty', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sheet).toHaveCount(0);
  await expect(win.getByRole('heading', { name: 'Kooda is empty.' })).toBeVisible();
  await expect(empty).toBeDisabled();
  await expect(dockIcon).toHaveAttribute('href', '#app-trash');
  await closeApp(page, 'Kooda');
  await expect(win).toHaveCount(0);
  await page.locator('[data-shell="desktop"] .os-dock-link[data-dock-app="trash"]').click();
  await expect(win.getByRole('heading', { name: 'Kooda is empty.' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(win.locator('.kooda-tile')).toHaveCount(items.length);
  await expect(dockIcon).toHaveAttribute('href', '#app-trash-full');
});

test('File menu owns Empty Kooda state and dock emptying updates the open app', async ({ page }) => {
  await page.goto('/kooda');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await openMenu(page, 'File');
  await page.getByRole('menuitem', { name: 'Empty Kooda…', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  if(await page.locator('html').getAttribute('data-mode')==='mobile'){await openMenu(page,'File');await page.getByRole('menuitem',{name:'Empty Kooda…',exact:true}).click();}else{await page.locator('[data-shell="desktop"] .os-dock-link[data-dock-app="trash"]').click({button:'right'});await page.getByRole('menuitem',{name:'Empty Kooda',exact:true}).click();}
  await page.getByRole('button', { name: 'Empty', exact: true }).click();
  await expect(page.locator(managed).getByRole('heading', { name: 'Kooda is empty.' })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await openMenu(page, 'File');
  await expect(page.getByRole('menuitem', { name: 'Empty Kooda…', exact: true })).toHaveAttribute('aria-disabled', 'true');
});

test('adoption preserves content geometry and text with zero CLS', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Layout-shift measurement uses Chromium.');
  let release!: () => void;
  const hold = new Promise<void>(done => { release = done; });
  await page.route('**/TrashApp.*.js', async route => { await hold; await route.continue(); });
  await page.addInitScript(() => {
    Object.assign(window, { koodaCls: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { koodaCls: number }).koodaCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  try {
    await page.goto('/kooda', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(managed)).toHaveAttribute('data-adopting', '');
    await page.evaluate(async () => { await Promise.all([document.fonts.load('13px "Instrument Sans"'), document.fonts.load('32px "Fraunces"')]); });
    const staticWin = page.locator('#static-window');
    const before = await staticWin.boundingBox();
    const subtitle = await staticWin.locator('.kooda-subtitle').boundingBox();
    const tile = await staticWin.locator('.kooda-tile').first().boundingBox();
    const heading = await staticWin.locator('h1').textContent();
    const paragraph = await staticWin.locator('p').first().textContent();
    release();
    await expect(staticWin).toHaveAttribute('hidden', '');
    const win = page.locator(managed);
    for (const [expected, actual] of [[before, await win.boundingBox()], [subtitle, await win.locator('.kooda-subtitle').boundingBox()], [tile, await win.locator('.kooda-tile').first().boundingBox()]]) {
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(expected![key] - actual![key])).toBeLessThanOrEqual(1);
    }
    expect(await win.locator('h1').textContent()).toBe(heading);
    expect(await win.locator('p').first().textContent()).toBe(paragraph);
    expect(await page.evaluate(() => (window as unknown as { koodaCls: number }).koodaCls)).toBe(0);
  } finally { release(); }
});

test('adoption preserves scroll and focus in a short window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 });
  let release!: () => void;
  const hold = new Promise<void>(done => { release = done; });
  await page.route('**/TrashApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/kooda', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(managed)).toHaveAttribute('data-adopting', '');
    const scroller = page.locator('#static-window > [data-scroll-root]');
    await scroller.evaluate(el => { (el as HTMLElement).focus(); el.scrollTop = 60; });
    expect(await scroller.evaluate(el => el.scrollTop)).toBe(60);
    release();
    await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    expect(await page.locator(`${managed} [data-scroll-root]`).evaluate(el => el.scrollTop)).toBe(60);
    expect(await page.locator(managed).evaluate(el => el.contains(document.activeElement))).toBe(true);
  } finally { release(); }
});

test('light and dark accents, note and empty states pass axe with no serious violations', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/kooda');
    await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    for (const accent of ['thambili', 'lagoon', 'lotus', 'tea']) {
      await page.evaluate(value => document.documentElement.dataset.accent = value, accent);
      const scan = async () => {
        const result = await new AxeBuilder({ page }).include(managed).analyze();
        expect(result.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]);
      };
      await scan();
      await page.locator(managed).getByRole('button', { name: items[0]!.name }).click();
      await expect(page.locator('.kooda-note-card')).toHaveCSS('opacity', '1');
      await expect(page.locator('.kooda-note-card')).toHaveCSS('transform', 'none');
      await scan();
      await page.keyboard.press('Escape');
    }
    await page.locator(managed).getByRole('button', { name: 'Empty Kooda', exact: true }).click();
    await page.getByRole('button', { name: 'Empty', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    const result = await new AxeBuilder({ page }).include(managed).analyze();
    expect(result.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]);
  }
});

test('desktop and phone content are responsive and produce light/dark artifacts @visual', async ({ page }) => {
  mkdirSync(artifactDir, { recursive: true });
  for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/kooda');
      await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
      const win = page.locator(managed);
      expect(await win.locator('.kooda-scroll').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const toolbar = await win.getByRole('button', { name: 'Empty Kooda', exact: true }).boundingBox();
      const titlebar = await win.locator('[data-window-titlebar]').boundingBox();
      expect(toolbar!.y).toBeGreaterThanOrEqual(mode==='phone'?titlebar!.y+titlebar!.height:titlebar!.y);
      if(mode==='desktop')expect(toolbar!.y+toolbar!.height).toBeLessThanOrEqual(titlebar!.y+titlebar!.height);
      if (mode === 'phone') expect(toolbar!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: resolve(artifactDir, `${mode}-${theme}.png`) });
      await win.getByRole('button', { name: items[0]!.name }).click();
      await expect(page.locator('.kooda-note-card')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: resolve(artifactDir, `${mode}-${theme}-note.png`) });
      await page.keyboard.press('Escape');
      await win.getByRole('button', { name: 'Empty Kooda', exact: true }).click();
      await page.getByRole('button', { name: 'Empty', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await page.screenshot({ path: resolve(artifactDir, `${mode}-${theme}-empty.png`) });
    }
  }
});

test('Kooda opens from home; a tapped item opens and closes its note at 360 px @mobile', async ({ page }, info) => {
  test.skip(phoneOnly(info), 'Pocket sheets are covered by the mobile projects.');
  await page.setViewportSize(NARROW_PHONE);
  const sheet = await openFromHome(page, 'Kooda', 'trash');
  await expect(sheet.locator('.kooda-tile')).toHaveCount(items.length);
  await expectPhoneSheetFits(sheet); await expectSheetAccessible(page);
  const item = items[0]!; await sheet.getByRole('button', { name: item.name, exact: true }).tap();
  const card = page.getByRole('dialog', { name: item.name, exact: true }); await expect(card.locator('p')).toHaveText(item.note);
  const close = card.getByRole('button', { name: 'Close note' });
  // Measure once the note has finished scaling in.
  await expect.poll(async () => (await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await close.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  const box = (await card.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(NARROW_PHONE.width);
  await expectSheetAccessible(page, 'note');
  await close.tap(); await expect(card).toHaveCount(0);
});
