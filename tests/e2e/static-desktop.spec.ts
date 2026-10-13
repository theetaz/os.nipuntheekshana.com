import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, openMenu } from './fixtures';


const propCoordinates = [
  ['lantern', 70, 52, 112], ['crbook', 226, 118, 124], ['tea', 404, 96, 128], ['polaroid', 1004, 66, 128],
  ['lotus-tower', 1236, 40, 116], ['tuktuk', 48, 300, 300], ['thambili', 1112, 330, 124], ['thinkpad', 76, 566, 264],
  ['cricket-bat', 372, 668, 250], ['ola', 652, 660, 182], ['postbox', 904, 628, 100], ['radio', 1130, 596, 216],
] as const;

for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [1920, 1080]] as const) {
  for (const theme of ['light', 'dark']) for (const wallpaper of ['kottu', 'galle-face', 'pettah', 'paper']) {
    test(`stage composition at ${width} × ${height}, ${wallpaper}, ${theme} @visual`, async ({ page }, info) => {
      test.skip(info.project.name.startsWith('mobile'), 'The desktop hero is hidden on phones.');
      mkdirSync('.astro/k7-artifacts/screenshots', { recursive: true });
      await page.setViewportSize({ width, height });
      await page.addInitScript(({ theme, wallpaper }) => {
        localStorage.setItem('serendib:theme', JSON.stringify(theme));
        localStorage.setItem('serendib:wallpaper', JSON.stringify(wallpaper));
      }, { theme, wallpaper });
      await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('body > .wallpaper .wp-rays')).toHaveCSS('display', wallpaper === 'kottu' && theme === 'light' ? 'block' : 'none');
      await expect(page.locator('.k-scroll-cue b')).toHaveCSS('color', 'rgb(27, 21, 48)');
      await expect(page.locator('h1:visible')).toHaveCount(1); await expect(page.locator('.k-name span')).toHaveCount(2);
      const geometry = await page.locator('.k-hero').evaluate(hero => {
        const rect = hero.getBoundingClientRect(); const u = parseFloat(getComputedStyle(hero).getPropertyValue('--u'));
        const measure = (el: HTMLElement) => {
          const css = getComputedStyle(el);
          return { left: parseFloat(css.left), top: parseFloat(css.top), width: parseFloat(css.width) };
        };
        return { width: rect.width, height: rect.height, u,
          props: [...hero.querySelectorAll<HTMLElement>('[data-prop]')].map(el => ({ id: el.dataset.prop, ...measure(el) })),
          name: measure(hero.querySelector<HTMLElement>('.k-hello')!),
          tags: ['cto', 'founder', 'colombo'].map(id => ({ id, ...measure(hero.querySelector<HTMLElement>(`.k-tag-${id}`)!) })),
          cue: measure(hero.querySelector<HTMLElement>('.k-scroll-cue')!),
        };
      });
      const u = Math.min(1.25, Math.max(.68, Math.min(width / 1440, height / 900)));
      expect(geometry.u).toBeCloseTo(u, 5);
      for (const [id, x, y, w] of propCoordinates) {
        const actual = geometry.props.find(item => item.id === id)!;
        expect(Math.abs(actual.left - (width / 2 + (x - 720) * u)), id).toBeLessThanOrEqual(2);
        expect(Math.abs(actual.top - (height / 2 + (y - 450) * u)), id).toBeLessThanOrEqual(2);
        expect(Math.abs(actual.width - w * u), id).toBeLessThanOrEqual(2);
      }
      // The name's left is its centre; translate(-50%) supplies its visual left edge.
      expect(Math.abs(geometry.name.left - width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.name.top - (height / 2 + (226 - 450) * u))).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.name.width - 680 * u)).toBeLessThanOrEqual(2);
      for (const [id, x, y] of [['cto', 436, 560], ['founder', 766, 566], ['colombo', 858, 236]] as const) {
        if (id === 'colombo' && width < 1180) continue;
        const actual = geometry.tags.find(item => item.id === id)!;
        expect(Math.abs(actual.left - (width / 2 + (x - 720) * u)), id).toBeLessThanOrEqual(2);
        expect(Math.abs(actual.top - (height / 2 + (y - 450) * u)), id).toBeLessThanOrEqual(2);
      }
      await expect(page.locator('.k-tag-colombo')).toBeVisible({ visible: width >= 1180 });
      expect(Math.abs(geometry.cue.left - (width / 2 + (1272 - 720) * u))).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.cue.top - (height / 2 + (788 - 450) * u))).toBeLessThanOrEqual(2);
      await expect(page.locator('[data-mochi]')).toBeVisible();
      const mochi = await page.locator('[data-mochi]').evaluate(el => {
        const css = getComputedStyle(el); const matrix = new DOMMatrixReadOnly(css.transform);
        return { left: matrix.m41, top: matrix.m42, width: parseFloat(css.width) };
      });
      expect(Math.abs(mochi.left - (width / 2 + (236 - 720) * u))).toBeLessThanOrEqual(2);
      expect(Math.abs(mochi.top - (height / 2 + (538 - 450) * u))).toBeLessThanOrEqual(2);
      expect(Math.abs(mochi.width - 70 * u)).toBeLessThanOrEqual(2);
      await page.screenshot({ path: `.astro/k7-artifacts/screenshots/hero-${width}x${height}-${wallpaper}-${theme}.png` });
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`.astro/k7-artifacts/geometry-${width}-${wallpaper}-${theme}.json`, JSON.stringify({ viewportWidth: width, viewportHeight: height, theme, wallpaper, ...geometry, mochi }, null, 2));
      await page.goto('/projects/salli'); await expect(page.locator('.k-name')).toHaveJSProperty('tagName', 'P');
      await expect(page.locator('h1:visible')).toHaveCount(1);
    });
  }
}

test('static page chrome and content have no accessibility violations @a11y', async ({ page }) => {
  for (const path of ['/', '/#simple', '/projects/salli', '/projects/salli#simple', '/writing/hello-world', '/nope']) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map(({ target }) => target) })), path).toEqual([]);
  }
});

test('route pages do not log errors and reduced motion skips the boot @smoke', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  for (const path of ['/', '/projects', '/projects/salli', '/writing', '/writing/hello-world', '/writing/an-island-made-of-points', '/about', '/cv', '/now', '/readme', '/terminal', '/maps', '/maps/play', '/activity', '/messages', '/settings', '/kooda']) {
    const health = page.waitForResponse(response => response.url().endsWith('/api/health'));
    await page.goto(path); await expect(page.locator('html')).toHaveClass(/os-ready/);
    await (await health).finished();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => localStorage.removeItem('serendib:booted'));
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-boot');
  await expect(page.locator('.boot-screen')).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Starting Kottu OS' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('stored Simple view can return to the desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/os-ready/);
  if(await page.locator('html').getAttribute('data-mode')==='mobile'){await openMenu(page,'Help');await page.getByRole('menuitem',{name:'Simple view',exact:true}).last().click();}else await page.locator('[data-shell="desktop"] .simple-entry').click();
  await expect.poll(()=>page.evaluate(() => localStorage.getItem('serendib:view'))).toBe('"simple"');
  await page.reload();
  await expect(page.locator('#story')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the desktop', exact: true }).click();
  await expect(await page.locator('html').getAttribute('data-mode')==='mobile'?page.locator('[data-shell="mobile"] .phone-home'):page.locator('.k-hero')).toBeVisible();
  await expect(page.locator('#story')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('serendib:view'))).toBeNull();
});


test('home has zero layout shift while its fonts load', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { layoutShift: number }).layoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as unknown as { layoutShift: number }).layoutShift += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  expect(await page.evaluate(() => (window as unknown as { layoutShift: number }).layoutShift)).toBe(0);
});
