import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const sections = [
  ['ws-hello', 'intro', 'Hello', '#FFC93C', '#3B2E32'],
  ['k-skills', 'skills', 'Toolbox', '#FFF7E8', '#1B1530'],
  ['k-bio', 'bio', 'About me', '#0FA3A3', '#1D2E44'],
  ['ws-work', 'work', 'Work', '#1B1530', '#120D24'],
  ['ws-projects', 'highlights', 'Highlights', '#FF8A3D', '#3B2836'],
  ['k-side', 'side', 'Side projects', '#3DBE6B', '#232F3C'],
  ['k-fun', 'fun', 'Fun stuff', '#FF7EB6', '#3B2745'],
  ['k-oss', 'oss', 'Open source', '#EE5148', '#3B2137'],
  ['ws-board', 'board', 'Message board', '#FFC93C', '#3B2E32'],
  ['k-footer', 'footer', 'Kottu OS', '#1B1530', '#0B0716'],
] as const;
const rgb = (hex: string) => `rgb(${[1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`;
const screenshots = resolve('.astro/k8-artifacts/screenshots');

// The legacy phone home hides the story in normal mode. Simple view is
// the public phone route to this static content.
async function openStory(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto((page.viewportSize()?.width ?? 1440) <= 1023 ? '/#simple' : '/#ws-hello');
  await expect(page.locator('#story')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.describe('static scroll story', () => {
  test.use({ javaScriptEnabled: false });

  test('sections keep their order, workspace ids, labelled headings, prompts and frill dividers', async ({ page }) => {
    await openStory(page);
    expect(await page.locator('#story .k-sec').evaluateAll(elements => elements.map(section => ({
      id: section.id, sec: section.getAttribute('data-sec'), labelled: section.getAttribute('aria-labelledby'),
      title: section.querySelector('h2')?.firstChild?.textContent?.trim(),
      prompt: section.querySelector('.k-prompt')?.textContent?.trim(),
      divider: { height: getComputedStyle(section, '::before').height, top: getComputedStyle(section, '::before').top,
        content: getComputedStyle(section, '::before').content },
      margin: getComputedStyle(section).scrollMarginTop,
    })))).toEqual(sections.map(([id, sec, title]) => ({ id, sec, title, labelled: `${id}-title`,
      prompt: expect.stringMatching(/^nipun@kottu:~.*\$ /), divider: { height: '18px', top: '-17px', content: '""' }, margin: '40px' })));
    await expect(page.locator('#story script, #story astro-island')).toHaveCount(0);
    await expect(page.locator('.k-sec-shape[aria-hidden="true"]')).toHaveCount(10);
    for (const id of ['ws-hello', 'ws-work', 'ws-projects', 'ws-board']) {
      const target = await page.locator(`#${id}`).evaluate(element => {
        const top = Math.max(0, element.getBoundingClientRect().top + scrollY - 40);
        element.scrollIntoView({ block: 'start', behavior: 'instant' });
        return top;
      });
      await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(target, 0);
      if (id !== 'ws-hello') expect(target).toBeGreaterThan(0);
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} section backgrounds match the design palette without JavaScript`, async ({ page }) => {
      await openStory(page, theme);
      for (const [id, , , light, dark] of sections) await expect(page.locator(`#${id}`)).toHaveCSS('background-color', rgb(theme === 'light' ? light : dark));
    });
  }

  test('the intro has five descriptive badges and a die-cut avatar, all lazy and dimensioned', async ({ page }) => {
    await openStory(page);
    const images = page.locator('#ws-hello img');
    await expect(images).toHaveCount(6);
    expect(await images.evaluateAll(elements => elements.map(image => ({ alt: image.getAttribute('alt'), lazy: image.getAttribute('loading'), width: Number(image.getAttribute('width')) > 0, height: Number(image.getAttribute('height')) > 0 })))).toEqual([
      'Nipun', 'tiny Lotus Tower sticker', 'map pin sticker', 'smiling microchip sticker', 'game controller sticker', 'glass of tea sticker',
    ].map(alt => ({ alt, lazy: 'lazy', width: true, height: true })));
    await expect(page.locator('.k-avatar')).toHaveCSS('border-radius', '50%');
    await expect(page.locator('.k-intro')).toContainText("I'm Nipun");
    await expect(page.locator('.k-intro strong')).toHaveText(['open data', 'tiny-screen hardware', 'browser game']);
    const height = (page.viewportSize()?.width ?? 1440) <= 1023 ? '34px' : '56px';
    await expect(page.locator('.k-inline-sticker').first()).toHaveCSS('height', height);
  });

  test('the seven skill blocks use build-time SVG icons and the bio retains its notes and Now link', async ({ page }) => {
    await openStory(page);
    await expect(page.locator('.k-skills > li')).toHaveText(['Smart contracts', 'Data pipelines', 'Maps & geo', 'On-device ML', 'Web & mobile apps', 'ESP32 hardware', 'Teams of 50+']);
    await expect(page.locator('.k-skill-icon svg[aria-hidden="true"]')).toHaveCount(7);
    await expect(page.locator('.k-bio-body > p')).toHaveCount(2);
    expect(await page.locator('.k-bio-body > p').evaluateAll(elements => elements.map(element => element.textContent!.trim().split(/\s+/).length))).toEqual([47, 41]);
    await expect(page.locator('.k-bio-notes > li')).toHaveText(['10+ years shipping software', '50+ engineers led', '1,000+ smart contracts, 0 critical incidents']);
    await expect(page.locator('.k-now-note li')).toHaveCount(3);
    await expect(page.locator('.k-now-note a')).toHaveAttribute('href', '/now');
    await expect(page.locator('.k-now-note time')).toHaveText('updated 28 Sep');
    await expect(page.locator('.k-polaroid figcaption')).toHaveText("that's me, machan!");
  });

  test('seven native career rows open with Enter and expose their highlights', async ({ page }) => {
    await openStory(page);
    const rows = page.getByRole('list', { name: 'Career, newest first' }).locator(':scope > li');
    await expect(rows).toHaveCount(7);
    for (const row of await rows.all()) {
      const summary = row.locator('summary');
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(row.locator('details')).toHaveAttribute('open', '');
      await expect(row.locator('.k-git-highlights')).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(row.locator('details')).not.toHaveAttribute('open');
      await expect(summary.locator('.k-git-graph')).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(page.locator('.k-open-cv')).toHaveAttribute('href', '/cv');
  });

  test('project frames retain the three card grids and the Pin the city route', async ({ page }) => {
    await openStory(page);
    for (const [group, count] of [['highlights', 6], ['side', 9], ['fun', 4]] as const) await expect(page.locator(`[data-k-cards="${group}"] [data-k-card]`)).toHaveCount(count);
    await expect(page.locator('[data-k-card="pin-the-city"] a')).toHaveAttribute('href', '/maps/play');
    const phone = (page.viewportSize()?.width ?? 1440) <= 1023;
    for (const [group, count] of [['highlights', phone ? 1 : 2], ['side', phone ? 2 : 3], ['fun', phone ? 2 : 4]] as const) {
      expect(await page.locator(`[data-k-cards="${group}"]`).evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(count);
    }
    await expect(page.locator('[data-k-board]')).toHaveCSS('min-height', phone ? '560px' : '720px');
  });

  test('snapshot activity is static: four tiles, a labelled 371-cell heatmap and eight receipts', async ({ page }) => {
    let requests = 0;
    await page.route('**/data/activity.json', route => { requests++; return route.fulfill({ json: { available: false } }); });
    await openStory(page);
    await expect(page.locator('.k-stat')).toHaveCount(4);
    await expect(page.locator('.k-stat span')).toHaveText(['Contributions this year', 'Active days', 'Longest streak', 'Stars']);
    await expect(page.locator('.k-heatmap svg')).toHaveAttribute('role', 'img');
    await expect(page.locator('.k-heatmap svg')).toHaveAttribute('aria-label', /GitHub contributions.*different days/);
    await expect(page.locator('.k-heatmap rect')).toHaveCount(371);
    await expect(page.locator('.k-receipt')).toHaveCount(8);
    await expect(page.locator('.k-orgs a')).toHaveCount(2);
    expect(requests).toBe(0);
    if ((page.viewportSize()?.width ?? 1440) <= 1023) {
      const calendar = page.locator('.k-heatmap-scroll');
      await calendar.focus(); await expect(calendar).toBeFocused();
      await calendar.evaluate(element => element.scrollBy({ left: 120, behavior: 'instant' }));
      await expect.poll(() => calendar.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    }
  });

  test('the footer exposes four contacts and keeps the exact hidden visit counter mount', async ({ page }) => {
    await openStory(page);
    await expect(page.getByRole('navigation', { name: 'Say hi' }).getByRole('link')).toHaveCount(4);
    await expect(page.locator('.k-contacts a').first()).toHaveAttribute('href', 'mailto:theekshana2@gmail.com');
    await expect(page.locator('p.k-visits[data-k-visits]')).toHaveAttribute('hidden', '');
    await expect(page.locator('p.k-visits[data-k-visits]')).toBeEmpty();
    await expect(page.locator('.k-footer-brand')).toContainText("Kottu OS 2.0 'Pettah'");
    await expect(page.locator('.k-footer-brand a').last()).toHaveAttribute('href', '#ws-desktop');
    await expect(page.locator('.k-footer-brand img')).toHaveAttribute('loading', 'lazy');
  });

  for (const width of [360, 390, 412]) for (const theme of ['light', 'dark'] as const) {
    test(`${width}px ${theme} story has no horizontal overflow and uses the phone layouts`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 }); await openStory(page, theme);
      expect(await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ width, scroll: width });
      for (const [id] of sections) {
        expect(await page.locator(`#${id}`).evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(width);
      }
      await expect(page.locator('.k-sec').first()).toHaveCSS('padding-top', '64px');
      await expect(page.locator('.k-intro')).toHaveCSS('font-size', '30px');
      await expect(page.locator('.k-skills li').first()).toHaveCSS('height', '48px');
      await expect(page.locator('.k-polaroid')).toHaveCSS('width', '120px');
      expect(await page.locator('.k-bio-notes').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
      expect(await page.locator('.k-stats').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
    });
  }

  test.describe('accessibility', () => {
    test.use({ javaScriptEnabled: true });
    for (const theme of ['light', 'dark'] as const) test(`${theme} hydrated story keeps one h1, zero console errors and stable lazy images`, async ({ page, browserName }, info) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => {
        Object.assign(window, { storyCls: 0, storyShifts: [], storyClsSupported: PerformanceObserver.supportedEntryTypes.includes('layout-shift') });
        if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean; sources: { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] };
            if (!shift.hadRecentInput) {
              const metrics = window as unknown as { storyCls: number; storyShifts: unknown[] };
              metrics.storyCls += shift.value;
              metrics.storyShifts.push({ value: shift.value, sources: shift.sources.map(source => ({
                node: (source.node instanceof Element ? source.node : source.node?.parentElement)?.outerHTML.slice(0, 300),
                previous: source.previousRect.toJSON(), current: source.currentRect.toJSON(),
              })) });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await openStory(page, theme);
      await expect(page.locator('html')).toHaveClass(/os-ready/);
      await expect(page.locator('h1:visible')).toHaveCount(1);
      for (const [id] of sections) {
        await page.locator(`#${id}`).scrollIntoViewIfNeeded();
        const geometry = await page.locator(`#${id}`).evaluate(async element => {
          const boxes = () => [element, ...element.querySelectorAll('img')].map(node => {
            const { top, left, width, height } = node.getBoundingClientRect();
            return { top: top + scrollY, left, width, height };
          });
          const before = boxes();
          await Promise.all([...element.querySelectorAll('img')].map(image => image.decode()));
          await document.fonts.ready;
          await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
          return { before, after: boxes() };
        });
        expect(geometry.after, `${id} image decoding preserves reserved layout`).toEqual(geometry.before);
      }
      const layout = await page.evaluate(() => {
        const { storyCls, storyClsSupported, storyShifts } = window as unknown as { storyCls: number; storyClsSupported: boolean; storyShifts: unknown[] };
        return { cls: storyClsSupported ? storyCls : null, supported: storyClsSupported, shifts: storyShifts };
      });
      await info.attach('story-layout', { body: JSON.stringify({ theme, ...layout }), contentType: 'application/json' });
      if (browserName === 'chromium') expect(layout.supported).toBe(true);
      if (layout.supported) expect(layout.cls, JSON.stringify(layout.shifts)).toBe(0);
      expect(errors).toEqual([]);
    });
    for (const theme of ['light', 'dark'] as const) for (const [id] of sections) {
      test(`${id} has no serious or critical axe violations in ${theme}`, async ({ page }) => {
        await openStory(page, theme);
        await page.locator(`#${id}`).scrollIntoViewIfNeeded();
        const result = await new AxeBuilder({ page }).include(`#${id}`).analyze();
        expect(result.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? '')).map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) }))).toEqual([]);
      });
    }
  });

  test('reduced motion suppresses sticker wobble and skill lifts, including the explicit preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await openStory(page);
    await page.locator('.k-inline-sticker').first().hover();
    await expect(page.locator('.k-inline-sticker').first()).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.k-skills li').first()).toHaveCSS('transition-duration', '0s');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => document.documentElement.dataset.motion = 'reduce');
    await page.locator('.k-inline-sticker').first().hover();
    await expect(page.locator('.k-inline-sticker').first()).toHaveCSS('animation-name', 'none');
  });

  test('forced colours remove motifs and rings while preserving readable content and native controls', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' }); await openStory(page);
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    await expect(page.locator('.k-sec-shape').first()).toHaveCSS('display', 'none');
    await expect(page.locator('.k-story-window').first()).toHaveCSS('background-image', 'none');
    await expect(page.locator('.k-story-window').first()).toHaveCSS('border-top-width', '1px');
    await page.locator('.k-git-log summary').first().focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.k-git-log details').first()).toHaveAttribute('open', '');
  });

  for (const theme of ['light', 'dark'] as const) test(`${theme} more contrast hides motifs, strengthens borders and promotes tertiary text`, async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' }); await openStory(page, theme);
    expect(await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches)).toBe(true);
    const checkContrast = async () => {
      for (const motif of await page.locator('.k-sec-shape').all()) await expect(motif).toHaveCSS('display', 'none');
      for (const surface of await page.locator('.k-prompt, .k-sticky, .k-polaroid').all()) await expect(surface).toHaveCSS('border-top-width', '3px');
      await expect(page.locator('.k-git-dates').first()).toHaveCSS('color', 'rgb(210, 200, 232)');
      await expect(page.locator('.k-logout')).toHaveCSS('color', 'rgb(210, 200, 232)');
    };
    await checkContrast();
    await page.emulateMedia({ contrast: 'no-preference' });
    await page.evaluate(() => document.documentElement.dataset.contrast = 'more');
    await checkContrast();
  });

  for (const theme of ['light', 'dark'] as const) test(`${theme} reduced transparency retains opaque story surfaces`, async ({ page }) => {
    await openStory(page, theme);
    await page.evaluate(() => document.documentElement.dataset.transparency = 'reduce');
    await expect(page.locator('.k-story-window').first()).toHaveCSS('backdrop-filter', 'none');
    await expect(page.locator('.k-sticky').first()).toHaveCSS('background-color', 'rgb(255, 226, 122)');
  });

  test('captures every section at 1440 light and dark and 390 light', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'One canonical screenshot set');
    mkdirSync(screenshots, { recursive: true });
    for (const [width, height, theme] of [[1440, 900, 'light'], [1440, 900, 'dark'], [390, 844, 'light']] as const) {
      await page.setViewportSize({ width, height }); await openStory(page, theme);
      for (const [id] of sections) {
        await page.locator(`#${id}`).evaluate(async element => {
          scrollTo(0, element.getBoundingClientRect().top + scrollY - 40);
          await document.fonts.ready;
          await Promise.all([...element.querySelectorAll('img')].map(image => image.decode().catch(() => {})));
        });
        await page.screenshot({ path: resolve(screenshots, `${id}-${theme}-${width}x${height}.png`) });
      }
    }
  });
});
