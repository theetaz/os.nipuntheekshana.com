import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { test, expect, openApp, openMenu } from './fixtures';
import { expectNoHorizontalOverflow, expectSheetAccessible, expectTapTargets, isPhone, openSheetFromHome, phoneScreenshot, phoneSizes } from './phone-sheet-sizes';

const artifacts = resolve('.astro/p3-4-artifacts');
const viewer = (page: Page) => page.locator('.managed-window[data-app="cv"]');
async function openCv(page: Page) {
  await page.goto('/cv');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(viewer(page).getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  return viewer(page);
}
type ZoomCommand = 'Zoom in' | 'Zoom out' | 'Actual size' | 'Fit width';
const zoomButtons: Record<ZoomCommand, string> = { 'Zoom in': 'Zoom in', 'Zoom out': 'Zoom out', 'Actual size': 'Actual size', 'Fit width': 'Fit' };
// Phone viewers condense the toolbar to Print and Download (D§13.3), so zoom
// commands come from the sheet's App commands → View menu instead.
async function zoom(page: Page, win: Locator, command: ZoomCommand) {
  if (await isPhone(page) || command === 'Actual size') {
    await openMenu(page, 'View'); await page.getByRole('menuitem', { name: new RegExp(`^${command}`) }).click();
    // Menus run their command after a short activation flash; let it land first.
    await expect(page.getByRole('menu')).toHaveCount(0);
  } else await win.getByRole('button', { name: zoomButtons[command], exact: true }).click();
}
async function expectZoomDisabled(page: Page, win: Locator, command: 'Zoom in' | 'Zoom out') {
  if (!await isPhone(page)) { await expect(win.getByRole('button', { name: command, exact: true })).toBeDisabled(); return; }
  await openMenu(page, 'View');
  await expect(page.getByRole('menuitem', { name: new RegExp(`^${command}`) })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
}
const expectFit = (win: Locator) => expect.poll(() => win.locator('.cv-scroll').evaluate(el => {
  const style = getComputedStyle(el);
  const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return Math.abs(el.querySelector('.cv-page')!.getBoundingClientRect().width - width);
})).toBeLessThan(1);
async function scrollToPage(win: Locator, pageNumber: 1 | 2) {
  await win.locator('.cv-scroll').evaluate((el, pageNumber) => {
    const paper = el.querySelectorAll<HTMLElement>('.cv-page')[pageNumber - 1]!;
    el.scrollTop += paper.getBoundingClientRect().top - el.getBoundingClientRect().top;
  }, pageNumber);
}

test('CV has two fixed pages, a real download and no duplicate accessible thumbnail content', async ({ page }) => {
  const win = await openCv(page);
  await expect(win.locator('.cv-page')).toHaveCount(2);
  await expect(win.locator('.cv-page').first()).toContainText('PerfectUs Technologies');
  await expect(win.locator('.cv-page').first()).toContainText('KeenEye Solutions');
  await expect(win.locator('.cv-page').first()).not.toContainText('Parallax Technologies');
  await expect(win.locator('.cv-page').last()).toContainText('Parallax Technologies');
  await expect(win.locator('.cv-page').last()).toContainText('Prabhava Labs');
  await expect(win.locator('.cv-page').last()).toContainText('University of Ruhuna');
  await expect(win.getByRole('heading', { name: 'Nipun Theekshana', exact: true })).toHaveCount(1);
  const link = win.getByRole('link', { name: /Download PDF/ });
  await expect(link).toHaveAttribute('href', '/Nipun_Theekshana_CV.pdf');
  await expect(link).toHaveAttribute('download', 'Nipun_Theekshana_CV.pdf');
  await expect(link).toContainText(`PDF · ${Math.round(statSync(resolve('public/Nipun_Theekshana_CV.pdf')).size / 1024)} KB`);
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(download.suggestedFilename()).toBe('Nipun_Theekshana_CV.pdf');
  // Phone sheets scale the A4 pages to fit; the layout box stays 794 × 1123.
  const phone = await isPhone(page);
  for (const paper of await win.locator('.cv-page').all()) {
    const metrics = await paper.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height,
      layoutWidth: (el as HTMLElement).offsetWidth, layoutHeight: (el as HTMLElement).offsetHeight,
      contentBottom: Math.max(...Array.from(el.querySelectorAll(':scope > :not(footer)')).map(child => child.getBoundingClientRect().bottom)),
      footerTop: el.querySelector('footer')!.getBoundingClientRect().top }));
    expect(metrics.layoutWidth).toBe(794); expect(metrics.layoutHeight).toBe(1123);
    if (phone) expect(metrics.height / metrics.width).toBeCloseTo(1123 / 794, 2);
    else { expect(metrics.width).toBe(794); expect(metrics.height).toBe(1123); }
    expect(metrics.contentBottom).toBeLessThan(metrics.footerTop);
  }
});

test('zoom uses 25% steps, sizes its wrapper and respects 50–200% bounds', async ({ page }) => {
  const win = await openCv(page);
  if (await isPhone(page)) {
    // The phone starts fitted; an explicit zoom pins the scale and shows its level.
    await expect(win.locator('.cv-zoom')).toBeHidden();
    await zoom(page, win, 'Actual size');
    await expect(win.getByLabel('Zoom level')).toHaveText('100%');
  }
  await zoom(page, win, 'Zoom in'); await zoom(page, win, 'Zoom in');
  await expect(win.getByLabel('Zoom level')).toHaveText('150%');
  expect((await win.locator('.cv-page').first().boundingBox())!.width).toBeCloseTo(1191, 0);
  expect((await win.locator('.cv-scaled-pages').boundingBox())!.width).toBeCloseTo(1191, 0);
  await zoom(page, win, 'Zoom in'); await zoom(page, win, 'Zoom in'); await expectZoomDisabled(page, win, 'Zoom in');
  for (let i = 0; i < 6; i++) await zoom(page, win, 'Zoom out');
  await expect(win.getByLabel('Zoom level')).toHaveText('50%');
  await expectZoomDisabled(page, win, 'Zoom out');
});

test('Fit follows the content width after sidebar and window changes', async ({ page }) => {
  const win = await openCv(page);
  if (await isPhone(page)) {
    // Phone pages fit by default; after a zoom, the condensed toolbar offers Fit.
    await expectFit(win);
    await zoom(page, win, 'Zoom in');
    await win.getByRole('button', { name: 'Fit', exact: true }).click();
    await expect(win.locator('.cv-zoom')).toBeHidden();
    await expectFit(win);
    // Thumbnails need more room than a phone sheet has.
    await openMenu(page, 'View');
    await expect(page.getByRole('menuitemcheckbox', { name: 'Show thumbnails' })).toBeDisabled();
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(win.getByRole('navigation', { name: 'Page thumbnails' })).toBeHidden();
    // Window changes: a narrower phone and a landscape rotation keep the fit.
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: 360, height: 780 }); await expectFit(win);
    await page.setViewportSize({ width: size.height, height: size.width }); await expectFit(win);
    await page.setViewportSize(size); await expectFit(win);
    return;
  }
  await win.getByRole('button', { name: 'Fit', exact: true }).click();
  await expectFit(win);
  await win.getByRole('button', { name: 'Show thumbnails', exact: true }).click();
  await expect(win.getByRole('navigation', { name: 'Page thumbnails' })).toHaveCount(0);
  await expectFit(win);
  await win.locator('[data-window-titlebar]').dblclick();
  await expectFit(win);
});

test('thumbnails and scrolling update the page indicator', async ({ page }) => {
  const win = await openCv(page);
  if (await isPhone(page)) {
    // Phone sheets hide thumbnails; scrolling drives the indicator.
    await expect(win.getByRole('navigation', { name: 'Page thumbnails' })).toBeHidden();
    await scrollToPage(win, 2);
    await expect(win.locator('.cv-page-indicator')).toHaveText('Page 2 of 2');
  } else {
    await win.getByRole('link', { name: 'Go to page 2' }).click();
    await expect(win.locator('.cv-page-indicator')).toHaveText('Page 2 of 2');
    await expect(win.getByRole('link', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'page');
  }
  await win.locator('.cv-scroll').evaluate(el => { el.scrollTop = 0; });
  await expect(win.locator('.cv-page-indicator')).toHaveText('Page 1 of 2');
});

test('page tracking reflects a thumbnail jump reversed within the same frame', async ({ page }) => {
  const win = await openCv(page);
  if (await isPhone(page)) {
    // Without thumbnails, the same-frame reversal is a jump to page 2 and back.
    await win.locator('.cv-scroll').evaluate(el => {
      el.scrollTop = el.querySelectorAll<HTMLElement>('.cv-page')[1]!.offsetTop;
      el.scrollTop = 0;
    });
    await expect(win.locator('.cv-page-indicator')).toHaveText('Page 1 of 2');
    await scrollToPage(win, 2);
    await expect(win.locator('.cv-page-indicator')).toHaveText('Page 2 of 2');
    await win.locator('.cv-scroll').evaluate(el => { el.scrollTop = 0; el.scrollTop = el.scrollHeight; el.scrollTop = 0; });
    await expect(win.locator('.cv-page-indicator')).toHaveText('Page 1 of 2');
    return;
  }
  await win.evaluate(element => {
    (element.querySelector('.cv-thumbnails a[href$="page-2"]') as HTMLElement).click();
    element.querySelector<HTMLElement>('.cv-scroll')!.scrollTop = 0;
  });
  await expect(win.locator('.cv-page-indicator')).toHaveText('Page 1 of 2');
  await expect(win.getByRole('link', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'page');
});

test('View menu and keyboard shortcuts control the focused viewer', async ({ page }) => {
  const win = await openCv(page);
  const phone = await isPhone(page);
  // A phone sheet starts fitted; Actual size gives both presentations the same start.
  if (phone) await zoom(page, win, 'Actual size');
  await openMenu(page, 'View');
  await page.getByRole('menuitem', { name: 'Zoom in', exact: false }).click();
  await expect(win.getByLabel('Zoom level')).toHaveText('125%');
  await win.locator('.cv-scroll').focus();
  await page.keyboard.press('Alt+Equal');
  await expect(win.getByLabel('Zoom level')).toHaveText('150%');
  await page.keyboard.press('Alt+Minus');
  await expect(win.getByLabel('Zoom level')).toHaveText('125%');
  await page.keyboard.press('Alt+Digit0');
  await expect(win.getByLabel('Zoom level')).toHaveText('100%');
  await openMenu(page, 'View');
  if (phone) {
    await expect(page.getByRole('menuitemcheckbox', { name: 'Show thumbnails' })).toBeDisabled();
    await page.getByRole('menuitem', { name: /^Fit width/ }).click();
    await expect(win.locator('.cv-zoom')).toBeHidden(); await expectFit(win);
    return;
  }
  await expect(page.getByRole('menuitemcheckbox', { name: 'Show thumbnails' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemcheckbox', { name: 'Show thumbnails' }).click();
  await expect(win.getByRole('button', { name: 'Show thumbnails', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('Print scopes the document before printing and clears its state on afterprint', async ({ page }) => {
  const win = await openCv(page);
  await page.evaluate(() => { window.print = () => {
    Object.assign(window, { printState: { printing: document.documentElement.dataset.printing,
      targets: document.querySelectorAll('[data-cv-print-target]').length } });
  }; });
  await win.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { printState: unknown }).printState)).toEqual({ printing: 'cv', targets: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('html')).not.toHaveAttribute('data-printing');
  await expect(win.locator('[data-cv-print-target]')).toHaveCount(0);
});

test('print media hides chrome, restores actual size and generates two A4 PDF pages', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'page.pdf is Chromium-only.');
  mkdirSync(artifacts, { recursive: true });
  const win = await openCv(page);
  await zoom(page, win, 'Zoom in');
  await page.emulateMedia({ media: 'print' });
  await expect(win.locator('.cv-toolbar')).toBeHidden();
  await expect(win.locator('.cv-thumbnails')).toBeHidden();
  await expect(page.locator('[data-window-titlebar]')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Dock', exact: true })).toBeHidden();
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain('Download PDF');
  expect(visibleText).not.toContain('Back to the desktop');
  await expect(page.locator('.cv-page:visible')).toHaveCount(2);
  expect((await win.locator('.cv-page').first().boundingBox())!.width).toBeCloseTo(210 * 96 / 25.4, 0);
  // Two compact rows: LinkedIn aligns with location and stays inside the paper.
  const contact = await win.locator('.cv-page .cv-contact').evaluate(root => {
    const row = root.getBoundingClientRect();
    return { height: row.height, children: Array.from(root.children).map(child => {
      const rect = child.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, right: rect.right, rowRight: row.right };
    }) };
  });
  expect(contact.height).toBeLessThanOrEqual(38);
  expect(contact.children[3]!.top).toBe(contact.children[4]!.top);
  for (const child of contact.children) expect(child.right).toBeLessThanOrEqual(child.rowRight + 1);
  const path = resolve(artifacts, 'cv-a4.pdf');
  const pdf = await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
  const structure = pdf.toString('latin1');
  expect(structure.match(/\/Type\s*\/Page\b/g)).toHaveLength(2);
  const boxes = [...structure.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  expect(boxes).toHaveLength(2);
  for (const box of boxes) { expect(Number(box[1])).toBeCloseTo(595.28, 0); expect(Number(box[2])).toBeCloseTo(841.89, 0); }
  await info.attach('A4 CV PDF', { path, contentType: 'application/pdf' });
});

test('adoption preserves CV geometry, scroll, focus and zero layout shift', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/CvApp.*.js', async route => { await hold; await route.continue(); });
  await page.addInitScript(() => {
    Object.assign(window, { cvCls: 0, cvShifts: [] });
    new PerformanceObserver(list => list.getEntries().forEach(entry => {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean;
        sources: { node?: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] };
      if (!shift.hadRecentInput) {
        (window as unknown as { cvCls: number }).cvCls += shift.value;
        (window as unknown as { cvShifts: unknown[] }).cvShifts.push({ value: shift.value,
          sources: shift.sources.map(source => ({ node: source.node?.outerHTML.slice(0, 150),
            before: source.previousRect.toJSON(), after: source.currentRect.toJSON() })) });
      }
    })).observe({ type: 'layout-shift', buffered: true });
  });
  try {
    await page.goto('/cv', { waitUntil: 'domcontentloaded' });
    const staticWin = page.locator('#static-window');
    await expect(viewer(page)).toHaveAttribute('data-adopting', '');
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
    const before = await staticWin.boundingBox();
    const paperBefore = await staticWin.locator('.cv-page').first().boundingBox();
    await staticWin.locator('.cv-scroll').evaluate(el => { (el as HTMLElement).focus(); el.scrollTop = 123; });
    release();
    await expect(staticWin).toHaveAttribute('hidden', '');
    const after = await viewer(page).boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - after![key])).toBeLessThanOrEqual(1);
    const paperAfter = await viewer(page).locator('.cv-page').first().boundingBox();
    expect(paperAfter!.x).toBe(paperBefore!.x);
    expect(paperAfter!.y + 123).toBe(paperBefore!.y);
    expect(await viewer(page).locator('.cv-scroll').evaluate(el => el.scrollTop)).toBe(123);
    expect(await viewer(page).evaluate(el => el.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { cvShifts: unknown[] }).cvShifts)).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { cvCls: number }).cvCls)).toBe(0);
  } finally { release(); }
});

test('CV loads its data when opened from the desktop and retries failed requests', async ({ page }) => {
  await page.route('**/data/profile.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/'); await openApp(page, 'CV');
  await expect(viewer(page).getByRole('heading', { name: "Couldn't load the CV." })).toBeVisible();
  await page.unroute('**/data/profile.json');
  await viewer(page).getByRole('button', { name: 'Try again' }).click();
  await expect(viewer(page).locator('.cv-page')).toHaveCount(2);
});

for (const theme of ['light', 'dark'] as const) test(`CV is accessible in ${theme} and saves a desktop screenshot @visual`, async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  const win = await openCv(page);
  await expect(win.locator('.cv-page').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(win.locator('.cv-page').first()).toHaveCSS('color', 'rgb(27, 21, 48)');
  await win.getByRole('button', { name: 'Fit', exact: true }).click();
  const results = await new AxeBuilder({ page }).include('.managed-window[data-app="cv"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  await page.screenshot({ path: resolve(artifacts, `cv-${theme}-desktop.png`) });
  expect(errors).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) test(`phone viewer fits its container in ${theme} @visual`, async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto('/cv');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const win = viewer(page);
  await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
  await expect(win.locator('.cv-thumbnails')).toBeHidden();
  await expect(win.locator('.cv-zoom')).toBeHidden();
  expect((await win.locator('.cv-page').first().boundingBox())!.width).toBeCloseTo(358, 0);
  expect(await win.locator('.cv-scroll').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  await expect(win.getByRole('button', { name: 'Print', exact: true })).toBeEnabled();
  await page.screenshot({ path: resolve(artifacts, `cv-${theme}-phone.png`) });
});

test.describe('static CV', () => {
  test.use({ javaScriptEnabled: false });
  test('all content and thumbnails work without JavaScript, including print PDF', async ({ page, browserName }) => {
    await page.goto('/cv'); await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
    const staticWin = page.locator('#static-window');
    await expect(staticWin.locator('.cv-page')).toHaveCount(2);
    await expect(staticWin.getByRole('button', { name: 'Zoom in', exact: true })).toBeHidden();
    const thumbnails = staticWin.getByRole('link', { name: 'Go to page 2' });
    if (await thumbnails.isVisible()) {
      await thumbnails.click();
      expect(await staticWin.locator('.cv-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(1000);
    } else {
      await expect(staticWin.locator('.cv-thumbnails')).toBeHidden();
      await staticWin.locator('.cv-page').last().scrollIntoViewIfNeeded();
      await expect(staticWin.locator('.cv-page').last()).toBeInViewport();
    }
    await page.emulateMedia({ media: 'print' });
    await expect(staticWin.locator('.cv-toolbar')).toBeHidden();
    await expect(staticWin.locator('.static-titlebar')).toBeHidden();
    if (browserName === 'chromium') {
      mkdirSync(artifacts, { recursive: true });
      const pdf = await page.pdf({ path: resolve(artifacts, 'cv-a4-nojs.pdf'), preferCSSPageSize: true, printBackground: true });
      expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(2);
    }
  });
  test('phone content fits the sheet and saves a 390×844 screenshot', async ({ page }) => {
    mkdirSync(artifacts, { recursive: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cv'); await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
    const staticWin = page.locator('#static-window');
    await expect(staticWin.locator('.cv-thumbnails')).toBeHidden();
    const pageWidth = (await staticWin.locator('.cv-page').first().boundingBox())!.width;
    expect(pageWidth).toBeCloseTo(358, 0);
    expect(await staticWin.locator('.cv-scroll').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
    await page.screenshot({ path: resolve(artifacts, 'cv-nojs-phone.png') });
  });
  test('Simple view presents both pages in the document flow', async ({ page }) => {
    await page.goto('/cv#simple');
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
    await expect(page.locator('.static-titlebar')).toBeHidden();
    await expect(page.locator('.cv-thumbnails')).toBeHidden();
    expect(await page.locator('.cv-scroll').evaluate(el => getComputedStyle(el).overflow)).toBe('visible');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
    expect(await page.locator('.cv-page').last().evaluate(el => el.getBoundingClientRect().bottom)).toBeGreaterThan(page.viewportSize()!.height);
  });
});

test.describe('CV phone sheet @mobile', () => {
  test.beforeEach(({}, info) => { test.skip(!info.project.name.startsWith('mobile'), 'Phone sheets are covered by the mobile projects.'); });
  for (const size of phoneSizes) test(`opens from home with a fit-width toolbar at ${size.width}×${size.height} ${size.theme}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const sheet = await openSheetFromHome(page, 'CV', 'cv', 'Nipun_Theekshana_CV.pdf', size);
    await expect(sheet.locator('.cv-page')).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loaded');
    // D§13.3: pages fit the width; the toolbar is condensed to Download and Print.
    const toolbar = sheet.getByRole('group', { name: 'CV document controls' });
    await expect(toolbar.getByRole('button', { name: 'Print', exact: true })).toBeVisible();
    await expect(toolbar.getByRole('link', { name: /Download PDF/ })).toBeVisible();
    await expect(toolbar.locator('.cv-page-indicator')).toHaveText('Page 1 of 2');
    for (const hidden of ['.cv-zoom', '.cv-navigation', '.cv-thumbnails']) await expect(sheet.locator(hidden)).toBeHidden();
    await expectFit(sheet);
    expect((await sheet.locator('.cv-page').first().boundingBox())!.width).toBeCloseTo(size.width - 32, 0);
    await expectNoHorizontalOverflow(sheet);
    await expectTapTargets(sheet.locator('.sheet-header, .cv-toolbar'));
    await expectSheetAccessible(page, 'cv');
    await phoneScreenshot(page, info, 'cv', size);
    // Core interaction: Print scopes the document to this viewer.
    await page.evaluate(() => { window.print = () => Object.assign(window, { cvPrinted: document.querySelectorAll('[data-cv-print-target]').length }); });
    await toolbar.getByRole('button', { name: 'Print', exact: true }).tap();
    expect(await page.evaluate(() => (window as unknown as { cvPrinted: number }).cvPrinted)).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    // A pinned zoom keeps the toolbar inside the sheet and offers Fit to return.
    await zoom(page, sheet, 'Zoom in');
    await expect(sheet.getByLabel('Zoom level')).toBeVisible();
    await expectTapTargets(sheet.locator('.cv-toolbar'));
    expect(await toolbar.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await sheet.getByRole('button', { name: 'Fit', exact: true }).tap();
    await expectFit(sheet);
    await expectNoHorizontalOverflow(sheet);
    expect(errors).toEqual([]);
  });
});
