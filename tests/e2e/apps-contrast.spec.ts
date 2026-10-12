import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

const artifacts = resolve('.astro/k13-artifacts');
const apps = ['projects', 'writing', 'about', 'cv', 'terminal', 'maps', 'activity', 'messages', 'now', 'settings', 'trash', 'readme'];
const routes = [
  ...apps.map(app => ({ app, path: app === 'trash' ? '/kooda' : `/${app}`, entry: true })),
  ...readdirSync(resolve('src/content/work')).filter(file => file.endsWith('.md'))
    .map(file => ({ app: 'projects', path: `/projects/${file.slice(0, -3)}`, entry: false })),
  ...readdirSync(resolve('src/content/writing')).filter(file => file.endsWith('.md'))
    .map(file => ({ app: 'writing', path: `/writing/${file.slice(0, -3)}`, entry: false })),
  { app: 'maps', path: '/maps/play', entry: false },
  { app: 'settings', path: '/settings?section=wallpaper', entry: false },
];

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

for (const theme of ['light', 'dark'] as const) {
  for (const { app, path, entry } of routes) {
    test(`${theme} ${path} has readable app chrome and content ${entry ? '@entry' : '@detail'}`, async ({ page }, info) => {
      const phone = info.project.name.startsWith('mobile');
      test.skip(phone && theme === 'dark', 'The phone contrast matrix covers light sheets; desktop covers both themes.');
      await page.setViewportSize({ width: phone ? 390 : 1440, height: phone ? 844 : 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.addInitScript(value => {
        localStorage.setItem('serendib:theme', JSON.stringify(value));
        localStorage.setItem('serendib:motion', JSON.stringify('reduce'));
        (window as unknown as { appShifts: number }).appShifts = 0;
        (window as unknown as { appShiftSources: unknown[] }).appShiftSources = [];
        if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number; sources: { node?: Element; previousRect: DOMRect; currentRect: DOMRect }[] };
            if (!shift.hadRecentInput) {
              (window as unknown as { appShifts: number }).appShifts += shift.value;
              (window as unknown as { appShiftSources: unknown[] }).appShiftSources.push({ value: shift.value,
                sources: shift.sources.map(source => ({ node: source.node?.outerHTML?.slice(0, 200), previous: source.previousRect, current: source.currentRect })) });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      }, theme);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(path);
      const window = page.locator(`.managed-window[data-app="${app}"]`);
      await expect(window).toBeVisible();
      await expect(window).not.toHaveAttribute('data-adopting');
      await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
      if (app === 'activity') await expect(window.locator('.activity-view')).toHaveClass(/is-ready/);
      if (app === 'maps') await expect(window.locator('.maps-view')).toHaveAttribute('data-surface', /svg|webgl/);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      });
      const sample = await window.evaluate(root => {
        const selectors = ['h1', 'h2', '.now-number', '.now-document li', '.cv-paper', '.cv-contact', '.messages-bubble--assistant', '.settings-swatch-thambili', '.maps-poster', '.terminal-input-wrap', '.prose blockquote'];
        return selectors.flatMap(selector => {
          const el = root.querySelector<HTMLElement>(selector);
          if (!el || !el.getClientRects().length) return [];
          const style = getComputedStyle(el);
          return [{ selector, color: style.color, background: style.backgroundColor, font: style.font, synthesis: style.fontSynthesis }];
        });
      });
      const result = await new AxeBuilder({ page }).include(`.managed-window[data-app="${app}"]`).analyze();
      const violations = result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
      const cls = await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('layout-shift')
        ? (window as unknown as { appShifts: number }).appShifts : null);
      const shifts = await page.evaluate(() => (window as unknown as { appShiftSources: unknown[] }).appShiftSources);
      const name = `${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${theme}-${phone ? '390x844' : '1440x900'}-${info.project.name}`;
      mkdirSync(resolve(artifacts, 'screenshots'), { recursive: true });
      writeFileSync(resolve(artifacts, `${name}.json`), JSON.stringify({ path, theme, project: info.project.name, sample, violations, errors, cls, shifts }, null, 2));
      await page.screenshot({ path: resolve(artifacts, 'screenshots', `${name}.png`), scale: 'css' });
      expect(violations, JSON.stringify(violations.map(item => ({ id: item.id, nodes: item.nodes })), null, 2)).toEqual([]);
      expect(errors).toEqual([]);
      if (cls !== null) expect(cls).toBe(0);
    });
  }
}

test('app typography and Terminal selection follow the Kottu tokens', async ({ page }) => {
  await page.goto('/now');
  const now = page.locator('.managed-window[data-app="now"]');
  await expect(now).not.toHaveAttribute('data-adopting');
  await expect(now.locator('h1')).toHaveCSS('font-weight', '700');
  await expect(now.locator('h1')).toHaveCSS('font-family', /Kalam/);
  await expect(now.locator('li').first()).toHaveCSS('font-weight', '400');
  await expect(now.locator('li').first()).toHaveCSS('font-size', '18px');
  await expect(now.locator('li').first()).toHaveCSS('line-height', '26px');
  await expect(now.locator('.now-number').first()).toHaveCSS('color', 'rgb(168, 74, 12)');
  await expect(now.locator('.now-number').first()).toHaveCSS('font-size', '19px');
  await expect(now.locator('.now-number').first()).toHaveCSS('font-weight', '700');
  await page.goto('/projects/salli');
  const project = page.locator('.managed-window[data-app="projects"]');
  await expect(project).not.toHaveAttribute('data-adopting');
  await expect(project.locator('.project-heading h1')).toHaveCSS('font-weight', '400');
  await expect(project.locator('.project-heading h1')).toHaveCSS('font-family', /Shrikhand/);
  await expect(project.locator('.project-heading h1')).toHaveCSS('font-synthesis', 'none');
  await expect(project.locator('.prose h2').first()).toHaveCSS('font-weight', '700');
  await expect(project.locator('.prose h2').first()).toHaveCSS('font-family', /Instrument Sans/);
  await project.locator('.prose').evaluate(prose => {
    const quote = document.createElement('blockquote');
    quote.textContent = 'A note in the margin.';
    prose.append(quote);
  });
  await expect(project.locator('.prose blockquote').last()).toHaveCSS('font-family', /Kalam/);
  await expect(project.locator('.prose blockquote').last()).toHaveCSS('font-size', '20px');
  await expect(project.locator('.prose blockquote').last()).toHaveCSS('line-height', '30px');
  await page.goto('/cv');
  const cv = page.locator('.managed-window[data-app="cv"]');
  await expect(cv).not.toHaveAttribute('data-adopting');
  await expect(cv.locator('.cv-pages h1')).toHaveCSS('font-family', /Fraunces/);
  await expect(cv.locator('.cv-pages .cv-paper').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(cv.locator('.cv-pages .cv-paper').first()).toHaveCSS('color', 'rgb(27, 21, 48)');
  await page.goto('/terminal');
  const terminal = page.locator('.managed-window[data-app="terminal"]');
  await expect(terminal).not.toHaveAttribute('data-adopting');
  expect(await terminal.locator('.terminal-body p').first().evaluate(element => {
    const selection = getComputedStyle(element, '::selection');
    return { color: selection.color, background: selection.backgroundColor };
  })).toEqual({ color: 'rgb(18, 13, 36)', background: 'rgb(255, 212, 94)' });
});
