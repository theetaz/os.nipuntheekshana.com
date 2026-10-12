import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, openApp } from './fixtures';

/** Phone presentation is decided by the island; mobile projects at any width use it. */
export async function isPhone(page: Page) {
  return await page.locator('html').getAttribute('data-mode') === 'mobile';
}

export const phoneSizes = [
  { width: 390, height: 844, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
  { width: 360, height: 780, theme: 'light' },
] as const;
export type PhoneSize = typeof phoneSizes[number];

/** Opens an app from the phone home screen and returns its full-screen sheet. */
export async function openSheetFromHome(page: Page, app: string, appId: string, title: string, size: PhoneSize) {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.emulateMedia({ colorScheme: size.theme, reducedMotion: 'reduce' });
  await page.addInitScript(theme => localStorage.setItem('serendib:theme', JSON.stringify(theme)), size.theme);
  await page.goto('/');
  await openApp(page, app);
  await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
  // Titles follow sub-routes, so later steps use the app's sheet itself.
  const sheet = page.locator(`.managed-window[data-sheet][data-app="${appId}"]`);
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(box.x).toBe(0); expect(box.width).toBe(size.width);
  return sheet;
}

/**
 * No horizontal scroll in the document or sheet, and nothing paints past the
 * viewport edge unless it sits inside an intentional horizontal scroller
 * (filter chips, screen strips, a zoomed page stack).
 */
export async function expectNoHorizontalOverflow(sheet: Locator) {
  const result = await sheet.evaluate(root => {
    const width = innerWidth;
    const scrolls = (el: Element) => /auto|scroll|hidden|clip/.test(getComputedStyle(el).overflowX);
    const offenders = [...root.querySelectorAll('*')].filter(el => {
      const box = el.getBoundingClientRect();
      // Visually hidden 1 px text (sr-only) does not paint.
      if (box.width <= 1 || box.height <= 1 || box.right <= width + .5 && box.left >= -.5) return false;
      for (let parent = el.parentElement; parent && parent !== root; parent = parent.parentElement) if (scrolls(parent)) return false;
      return getComputedStyle(el).visibility !== 'hidden';
    }).map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
    const roots = [...root.querySelectorAll<HTMLElement>('[data-scroll-root]')].filter(el => el.getClientRects().length)
      .map(el => el.scrollWidth - el.clientWidth);
    return { document: document.documentElement.scrollWidth - width, sheet: root.scrollWidth - root.clientWidth, roots, offenders };
  });
  expect(result.document).toBeLessThanOrEqual(0);
  expect(result.sheet).toBeLessThanOrEqual(0);
  for (const overflow of result.roots) expect(overflow).toBeLessThanOrEqual(0);
  expect(result.offenders).toEqual([]);
}

/** Every visible control in the given scopes is at least 44 × 44 CSS px. */
export async function expectTapTargets(scopes: Locator) {
  const small = await scopes.evaluateAll(elements => elements.flatMap(scope =>
    [...scope.querySelectorAll<HTMLElement>('a[href], button, input, [role="option"], [role="radio"], [role="menuitem"]')]
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .map(el => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.tagName.toLowerCase()} "${el.getAttribute('aria-label') ?? el.textContent?.trim()}" ${Math.round(box.width)}×${Math.round(box.height)}`)));
  expect(small).toEqual([]);
}

export async function expectSheetAccessible(page: Page, app: string) {
  const results = await new AxeBuilder({ page }).include(`.managed-window[data-sheet][data-app="${app}"]`)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
}

/** Final sheet screenshots come from mobile Chromium; WebKit runs the same assertions. */
export async function phoneScreenshot(page: Page, info: TestInfo, name: string, size: PhoneSize) {
  if (info.project.name !== 'mobile-chromium') return;
  const directory = resolve('.astro/p4-3a-artifacts/screenshots');
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `${size.width}x${size.height}-${size.theme}-${name}.png`) });
}

/** Holds a phone tile for its context menu: pointer down, the 500 ms timer, then release. */
export async function holdTile(page: Page, tile: Locator) {
  const box = (await tile.boundingBox())!; const point = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  await tile.dispatchEvent('pointerdown', { button: 0, pointerId: 7, pointerType: 'touch', isPrimary: true, ...point });
  const menu = page.getByRole('menu'); await expect(menu).toBeVisible();
  await tile.dispatchEvent('pointerup', { button: 0, pointerId: 7, pointerType: 'touch', isPrimary: true, ...point });
  return menu;
}
