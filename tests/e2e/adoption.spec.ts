import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from './fixtures';

test('adoption preserves rect, scroll and focused static content in the same handoff frame', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/ProjectsApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/projects/salli', { waitUntil: 'domcontentloaded' }); await expect(page.locator('html')).toHaveClass(/os-ready/);
    const staticWin = page.locator('#static-window'); const managed = page.locator('[data-window-id="projects"]');
    await expect(managed).toHaveAttribute('data-adopting', ''); await expect(managed).toHaveAttribute('inert', '');
    const before = await staticWin.boundingBox(); const pending = await managed.boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - pending![key])).toBeLessThanOrEqual(1);
    await page.addStyleTag({ content: '.managed-window [data-scroll-root]::after { content: ""; display: block; height: 2000px; }' });
    await staticWin.locator('[data-scroll-root]').evaluate(el => { (el as HTMLElement).tabIndex = -1; (el as HTMLElement).focus(); el.scrollTop = 123; });
    release(); await expect(staticWin).toHaveAttribute('hidden', ''); await expect(staticWin).toHaveAttribute('inert', '');
    await expect(managed).not.toHaveAttribute('data-adopting'); await expect(managed).not.toHaveAttribute('inert');
    const after = await managed.boundingBox(); for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - after![key])).toBeLessThanOrEqual(1);
    expect(await managed.locator('[data-scroll-root]').evaluate(el => el.scrollTop)).toBe(123);
    expect(await managed.evaluate(el => el.contains(document.activeElement))).toBe(true);
  } finally { release(); }
});

test('adoption never steals focus outside the static window', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/ProjectsApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/projects/salli', { waitUntil: 'domcontentloaded' }); await expect(page.locator('[data-adopting]')).toHaveCount(1);
    const simple = await page.locator('html').getAttribute('data-mode')==='mobile' ? page.locator('[data-phone-skip]') : page.locator('[data-shell="desktop"] .simple-entry'); await simple.focus(); release();
    await expect(page.locator('#static-window')).toHaveAttribute('hidden', ''); await expect(simple).toBeFocused();
  } finally { release(); }
});

test('adoption stays at zero CLS in desktop and mobile and produces theme artifacts @visual', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'CLS is measured in Chromium.');
  mkdirSync(resolve('.astro/p2-4-artifacts'), { recursive: true });
  await page.addInitScript(() => {
    Object.assign(window, { adoptionCls: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { adoptionCls: number }).adoptionCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme }); await page.goto('/projects/salli');
      await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
      expect(await page.evaluate(() => (window as unknown as { adoptionCls: number }).adoptionCls)).toBe(0);
      await page.screenshot({ path: resolve(`.astro/p2-4-artifacts/adoption-${theme}-${mode}.png`) });
    }
  }
});
