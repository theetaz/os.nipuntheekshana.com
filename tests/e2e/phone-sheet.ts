import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';

/** The narrowest phone width the sheets must fit (D§13.3). */
export const NARROW_PHONE = { width: 360, height: 780 };

/** `@mobile` variants only apply to the phone projects. */
export const phoneOnly = (info: TestInfo) => !info.project.name.startsWith('mobile');

/** The one presented sheet. */
export const visibleSheet = (page: Page) => page.locator('[data-sheet]:visible');

/** Opens an app by tapping its home-screen launcher, as a visitor would. */
export async function openFromHome(page: Page, name: string, appId: string): Promise<Locator> {
  await page.goto('/');
  const home = page.locator('[data-shell="mobile"] [data-phone-home]');
  await expect(home).toBeVisible();
  await home.locator('[data-phone-icon]').and(page.getByRole('link', { name, exact: true })).first().tap();
  const sheet = visibleSheet(page);
  await expect(sheet).toHaveAttribute('data-app', appId);
  await expect(sheet).not.toHaveAttribute('data-adopting');
  await expect(sheet.locator('[data-scroll-root]').first()).toBeVisible();
  // Measure the resting sheet, not a frame of its FLIP from the icon.
  await expect(sheet).not.toHaveAttribute('data-transition', /./);
  await expect(sheet).not.toHaveAttribute('data-sheet-animating');
  await expect.poll(() => sheet.evaluate(el => Math.round(el.getBoundingClientRect().width) === innerWidth)).toBe(true);
  return sheet;
}

/**
 * Nothing in the sheet scrolls or extends sideways, and every visible control
 * offers a 44 × 44 px target (a wrapping label counts towards it). The shared
 * header is checked by the sheet specs.
 */
export async function expectPhoneSheetFits(sheet: Locator, context = '') {
  const problems = await sheet.evaluate(root => {
    const width = innerWidth; const found: string[] = [];
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 32)}"`;
    const shown = (el: Element) => { const style = getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0; };
    if (document.documentElement.scrollWidth > width) found.push(`document ${document.documentElement.scrollWidth} > ${width}`);
    for (const el of root.querySelectorAll('*')) {
      if (!shown(el)) continue;
      const style = getComputedStyle(el);
      if (/auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) found.push(`scrolls sideways: ${name(el)} ${el.scrollWidth} > ${el.clientWidth}`);
      const box = el.getBoundingClientRect();
      if (box.width && (box.right > width + 1 || box.left < -1)) {
        // Content clipped by an ancestor that itself fits is not overflow.
        let clipped = false;
        for (let parent = el.parentElement; parent && parent !== root; parent = parent.parentElement) {
          if (getComputedStyle(parent).overflowX !== 'visible') { const outer = parent.getBoundingClientRect(); clipped = outer.right <= width + 1 && outer.left >= -1; break; }
        }
        if (!clipped) found.push(`outside the viewport: ${name(el)} ${Math.round(box.left)}–${Math.round(box.right)}`);
      }
    }
    const controls = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="tab"], [role="radio"], [role="switch"], [role="option"], [tabindex="0"]';
    for (const el of root.querySelectorAll(controls)) {
      if (!shown(el) || el.closest('[data-sheet-header], [aria-hidden="true"]')) continue;
      const box = el.getBoundingClientRect(); const label = el.closest('label')?.getBoundingClientRect();
      const w = Math.max(box.width, label?.width ?? 0); const h = Math.max(box.height, label?.height ?? 0);
      if (w < 44 || h < 44) found.push(`small target: ${name(el)} ${Math.round(w)}×${Math.round(h)}`);
    }
    return found;
  });
  expect(problems, context).toEqual([]);
}

/** Axe on the open sheet: no serious or critical violations. */
export async function expectSheetAccessible(page: Page, context = '') {
  // Audit settled colours, not a frame of a theme or state transition.
  await expect(page.locator('html')).not.toHaveClass(/theme-changing/);
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity)
    .map(animation => animation.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).include('[data-window-layer="mobile"]:not([hidden]) [data-sheet]').analyze();
  expect(result.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`), context).toEqual([]);
}
