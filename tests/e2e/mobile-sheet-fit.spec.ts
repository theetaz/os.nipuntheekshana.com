import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from './fixtures';
import { expectPhoneSheetFits, phoneOnly, visibleSheet } from './phone-sheet';

// Island, Activity, Settings, About, Now, Read me and Kooda in their Pocket
// sheets: no sideways scrolling and 44 px targets at every phone width, in both
// themes. The per-app `@mobile` specs cover layout and interaction at 360 px.
const routes = [
  ['/maps', 'island'], ['/maps/play', 'pin-the-city'], ['/activity', 'activity'], ['/settings', 'settings'],
  ['/settings?section=wallpaper', 'settings-wallpaper'], ['/about', 'about'], ['/now', 'now'], ['/readme', 'readme'], ['/kooda', 'kooda'],
] as const;
const sizes = [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 412, height: 915 }];
const artifacts = resolve('.astro/p4-3c-artifacts/screenshots');
// Screenshots: every sheet at 390 × 844 in both themes and 360 × 780 in light.
const captured = (width: number, theme: string) => width === 390 || (width === 360 && theme === 'light');

for (const size of sizes) for (const theme of ['light', 'dark'] as const) {
  test(`sheets fit ${size.width} × ${size.height} in ${theme} @mobile`, async ({ page }, info) => {
    test.skip(phoneOnly(info), 'Pocket sheets are covered by the mobile projects.');
    test.slow();
    await page.setViewportSize(size); await page.emulateMedia({ colorScheme: theme });
    mkdirSync(artifacts, { recursive: true });
    for (const [path, name] of routes) {
      await page.goto(path);
      const sheet = visibleSheet(page);
      await expect(sheet).not.toHaveAttribute('data-adopting'); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
      await expect(sheet.locator('[data-scroll-root]').first()).toBeVisible();
      await page.evaluate(async () => { await document.fonts.ready; });
      await expectPhoneSheetFits(sheet, `${path} ${theme} ${size.width}`);
      if (info.project.name === 'mobile-chromium' && captured(size.width, theme))
        await page.screenshot({ path: resolve(artifacts, `${name}-${theme}-${size.width}x${size.height}.png`) });
    }
  });
}
