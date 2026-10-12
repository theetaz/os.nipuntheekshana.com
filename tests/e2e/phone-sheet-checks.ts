import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';

/** Phone sheet checks shared by the Writing, Messages and Terminal `@mobile` variants. */
export const phoneOnly = (info: TestInfo) => !info.project.name.startsWith('mobile');
export const sheet = (page: Page) => page.locator('[data-sheet]:visible');

/** Opens an app from the phone home screen (grid or dock), as a visitor would. */
export async function openFromHome(page: Page, href: string) {
  await page.goto('/');
  await expect(page.locator('[data-shell="mobile"] .phone-home')).toBeVisible();
  await page.locator(`[data-shell="mobile"] a[href="${href}"][data-phone-icon]`).first().click();
  await expect(sheet(page)).toHaveCount(1);
  // Measure the resting sheet, not a frame of its FLIP growth from the icon.
  await expect(sheet(page)).not.toHaveAttribute('data-sheet-animating');
  const viewport = page.viewportSize()!;
  await expect.poll(async () => { const box = await sheet(page).boundingBox(); return box && [box.x, box.y, box.width, box.height].map(Math.round); })
    .toEqual([0, 0, viewport.width, viewport.height]);
  return sheet(page);
}

/**
 * Nothing inside the sheet may stick out sideways or make the sheet (or its
 * scroll roots) scroll horizontally. Intentional horizontal scrollers, such as
 * chip rows and code blocks, clip their own content and are allowed.
 */
export async function expectNoHorizontalOverflow(app: Locator) {
  const offenders = await app.evaluate(root => {
    const bounds = root.getBoundingClientRect(); const found: string[] = [];
    const describe = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
    for (const scroller of [root, ...root.querySelectorAll<HTMLElement>('[data-scroll-root], .window-content')]) {
      if (scroller.getClientRects().length && scroller.scrollWidth > scroller.clientWidth + 1) found.push(`${describe(scroller)} scrolls sideways`);
    }
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      if (el.closest('.sr-only') || !el.getClientRects().length) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || (rect.right <= bounds.right + 1 && rect.left >= bounds.left - 1)) continue;
      let clipped = false;
      for (let parent = el.parentElement; parent && parent !== root; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX !== 'visible') { clipped = true; break; }
      }
      if (!clipped) found.push(`${describe(el)} spans ${Math.round(rect.left)}–${Math.round(rect.right)}`);
    }
    if (document.documentElement.scrollWidth > innerWidth) found.push('document scrolls sideways');
    return found;
  });
  expect(offenders).toEqual([]);
}

/** Every visible control is at least 44 × 44 px, except inline links inside running text. */
export async function expectTapTargets(app: Locator, exempt = '') {
  const small = await app.evaluate((root, exempt) => [...root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [role="button"]')]
    .filter(el => {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden' || el.closest('.sr-only')) return false;
      if (exempt && el.matches(exempt)) return false;
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return false;
      const rect = el.getBoundingClientRect(); return rect.width < 43.5 || rect.height < 43.5;
    })
    .map(el => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}" `
      + `${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`), exempt);
  expect(small).toEqual([]);
}

export async function expectAccessibleSheet(page: Page) {
  const result = await new AxeBuilder({ page }).include('[data-sheet]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
}

/** Simulates an on-screen keyboard: the visual viewport shrinks, as P4-2's sheet tests do. */
export async function showKeyboard(page: Page, height: number) {
  await page.evaluate(height => {
    const viewport = visualViewport!; Object.defineProperty(viewport, 'height', { configurable: true, value: height });
    viewport.dispatchEvent(new Event('resize'));
  }, height);
  await expect.poll(async () => (await sheet(page).boundingBox())!.height).toBe(height);
}
export async function hideKeyboard(page: Page) {
  await page.evaluate(() => {
    const viewport = visualViewport!; delete (viewport as unknown as { height?: number }).height;
    viewport.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => (await sheet(page).boundingBox())!.height).toBe(await page.evaluate(() => innerHeight));
}
/** The element is fully inside the sheet's visible area above the simulated keyboard. */
export async function expectAboveKeyboard(target: Locator, keyboardTop: number) {
  // The sheet applies visualViewport changes on the next animation frame; let layout settle under load.
  await expect.poll(async () => {
    const box = (await target.boundingBox())!;
    return box.y >= 0 && box.y + box.height <= keyboardTop + .5;
  }).toBe(true);
}
