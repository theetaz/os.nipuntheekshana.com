import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

const sections = ['ws-hello', 'k-skills', 'k-bio', 'ws-work', 'ws-projects', 'k-side', 'k-fun', 'k-oss', 'ws-board', 'k-footer'];
for (const width of [1440, 390]) for (const theme of ['light', 'dark'] as const) {
  for (const surface of ['page', 'hero', ...sections, 'compose']) test(`${surface} is accessible at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/api/health', route => route.fulfill({ json: { ai: false, postcards: true } }));
    await page.route('**/api/postcards*', route => route.fulfill({ json: { items: [], next: null } }));
    await page.goto(surface === 'compose' ? '/postcards' : '/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
    const selector = surface === 'page' ? 'body' : surface === 'hero' ? width === 390 ? '.phone-home' : '.k-hero'
      : surface === 'compose' ? '.managed-window[data-app="guestbook"]' : `#${surface}`;
    await expect(page.locator(selector)).toBeVisible();
    if (sections.includes(surface)) await page.locator(selector).scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page }).include(selector).analyze();
    expect(result.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? '')).map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
    expect(errors).toEqual([]);
  });
}
