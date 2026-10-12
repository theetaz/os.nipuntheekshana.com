import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page, Locator } from '@playwright/test';
import type { ClientActivity } from '../../src/os/types/content';
import { test, expect, openApp, openMenu, closeApp } from './fixtures';
import { NARROW_PHONE, expectPhoneSheetFits, expectSheetAccessible, openFromHome, phoneOnly } from './phone-sheet';

const counts = Array.from({ length: 371 }, (_, index) => index === 0 || index === 370 ? -1 : index % 5 === 0 ? 0 : (index * 7) % 42);
const activity: Extract<ClientActivity, { available: true }> = {
  available: true, start: '2025-10-05', weeks: 53, counts,
  total: counts.filter(count => count > 0).reduce((sum, count) => sum + count, 0),
  activeDays: counts.filter(count => count > 0).length, longestStreak: 4, currentStreak: 2,
  busiest: { date: '2026-03-14', count: 41 }, busiestWeekday: 6, stars: 120, fetchedAt: '2026-10-11T12:00:00Z',
};
const app = (page: Page) => page.locator('[data-window-id="activity"]');
const stage = (page: Page) => app(page).locator('[data-terrain-stage]');

async function openFixture(page: Page, data: ClientActivity = activity) {
  await page.route('**/data/activity.json', route => route.fulfill({ json: data }));
  await page.goto('/');
  await openApp(page, 'Activity');
  await expect(app(page).getByRole('heading', { name: 'Activity', exact: true })).toHaveCount(1);
}
async function frames(page: Page, count = 5) {
  await page.evaluate(async count => {
    for (let i = 0; i < count; i++) await new Promise<void>(done => requestAnimationFrame(() => done()));
  }, count);
}
async function instrumentTerrain(page: Page) {
  await page.addInitScript(() => {
    const draws = new WeakMap<HTMLCanvasElement, number>();
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function(...args) {
      draws.set(this.canvas, (draws.get(this.canvas) ?? 0) + 1);
      return clear.apply(this, args);
    };
    Object.assign(window, { activityDraws: (canvas: HTMLCanvasElement) => draws.get(canvas) ?? 0 });
  });
}
const drawCount = (page: Page) => app(page).locator('canvas').evaluate(canvas =>
  (window as unknown as { activityDraws(canvas: HTMLCanvasElement): number }).activityDraws(canvas as HTMLCanvasElement));

async function paintedPoint(canvas: Locator) {
  return canvas.evaluate(node => {
    const canvas = node as HTMLCanvasElement;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const rect = canvas.getBoundingClientRect();
    const painted = (x: number, y: number) => {
      const i = (y * canvas.width + x) * 4;
      return pixels[i + 3]! === 255 && pixels[i]! > pixels[i + 1]! * 1.3 && pixels[i + 1]! > pixels[i + 2]! * 1.3;
    };
    for (let y = 20; y < canvas.height - 20; y += 4) for (let x = 20; x < canvas.width - 20; x += 4) {
      // Select the interior of a face, away from its painted anti-aliasing seam.
      if ([-2, 0, 2].every(dy => [-2, 0, 2].every(dx => painted(x + dx, y + dy)))) {
        return { x: rect.left + x / canvas.width * rect.width, y: rect.top + y / canvas.height * rect.height };
      }
    }
    throw new Error('No contribution column was painted.');
  });
}

test('stat tiles match the built activity endpoint', async ({ page }) => {
  const scenes: string[] = [];
  page.on('request', request => { if (/\/terrain\.[\w-]+\.js/.test(request.url())) scenes.push(request.url()); });
  const data = await (await page.request.get('/data/activity.json')).json() as ClientActivity;
  await page.goto('/'); await frames(page); expect(scenes).toEqual([]);
  await openApp(page, 'Activity');
  if (!data.available) {
    await expect(app(page)).toContainText('GitHub didn’t answer'); return;
  }
  for (const [label, value] of [['Contributions', data.total.toLocaleString('en-US')], ['Active days', String(data.activeDays)], ['Longest streak', `${data.longestStreak} days`]] as const) {
    await expect(app(page).locator('.activity-stat').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(value);
  }
  await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/);
  expect(scenes).toHaveLength(1);
});

test('Calendar flattens the scene; keyboard days, fly-in and orbit remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFixture(page); await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/);
  await frames(page);
  const image = await app(page).locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await app(page).getByRole('button', { name: 'Calendar', exact: true }).click(); await frames(page);
  await expect(app(page).locator('[data-terrain]')).toHaveAttribute('data-view', 'top');
  const flat = await app(page).locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  expect(flat).not.toBe(image);
  await stage(page).focus(); await page.keyboard.press('ArrowRight');
  await expect(app(page).locator('[data-terrain-live]')).toHaveText('Monday, Oct 6, 2025: 7 contributions');
  await page.keyboard.press('ArrowRight');
  await expect(app(page).locator('[data-terrain-live]')).toHaveText('Monday, Oct 13, 2025: 14 contributions');
  await page.keyboard.press('ArrowDown');
  await expect(app(page).locator('[data-terrain-live]')).toHaveText('Tuesday, Oct 14, 2025: 21 contributions');
  await page.keyboard.press('Enter'); await frames(page);
  const zoom = await app(page).locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  expect(zoom).not.toBe(flat);
  await page.keyboard.press('Escape'); await page.keyboard.press('Shift+ArrowLeft');
  await expect(app(page).locator('[data-terrain]')).toHaveAttribute('data-view', 'perspective');
  await expect(app(page).getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(app(page).locator('[data-terrain-tip]')).toHaveClass(/is-shown/);
});

test('View menu controls the focused Activity window', async ({ page }) => {
  await openFixture(page);
  await openMenu(page, 'View');
  await page.getByRole('menuitemradio', { name: 'Calendar', exact: true }).click();
  await expect(app(page).getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('hover lifts a day, shows its tooltip, and clicking flies the camera in', async ({ page }) => {
  await instrumentTerrain(page); await openFixture(page);
  await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/);
  let previous = -1;
  await expect.poll(async () => {
    const current = await drawCount(page); const settled = current > 0 && current === previous; previous = current; return settled;
  }).toBe(true);
  const canvas = app(page).locator('canvas');
  const point = await paintedPoint(canvas);
  const resting = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL());
  await page.mouse.move(point.x, point.y);
  await expect(app(page).locator('[data-terrain-tip]')).toHaveClass(/is-shown/);
  await expect(app(page).locator('[data-terrain-live]')).toContainText('contributions');
  await expect.poll(() => canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL())).not.toBe(resting);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => drawCount(page)).toBeGreaterThan(previous);
});

test('terrain uses layout pixels when initialized during a scale, then survives resize and DPR changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/terrain.*.js', async route => { await hold; await route.continue(); });
  try {
    await openFixture(page);
    await stage(page).evaluate(node => { node.style.transform = 'scale(0.86)'; node.style.transformOrigin = '0 0'; });
    release();
    await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/);
    const canvas = app(page).locator('canvas');
    const check = async () => {
      await expect.poll(() => canvas.evaluate(node => {
        const canvas = node as HTMLCanvasElement;
        return { width: canvas.width, height: canvas.height,
          expectedWidth: Math.round(canvas.clientWidth * Math.min(2, devicePixelRatio)),
          expectedHeight: Math.round(canvas.clientHeight * Math.min(2, devicePixelRatio)) };
      })).toMatchObject(await canvas.evaluate(node => ({
        width: Math.round(node.clientWidth * Math.min(2, devicePixelRatio)),
        height: Math.round(node.clientHeight * Math.min(2, devicePixelRatio)),
      })));
      await frames(page);
      const point = await paintedPoint(canvas);
      await page.mouse.move(point.x, point.y);
      await expect(app(page).locator('[data-terrain-tip]')).toHaveClass(/is-shown/);
      await page.mouse.move(0, 0); await frames(page);
    };
    await check();
    await stage(page).evaluate(node => { node.style.transform = ''; });
    await check();
    if(await page.locator('html').getAttribute('data-mode')==='mobile')await page.setViewportSize({width:412,height:915});else await app(page).getByRole('button',{name:'Maximise Activity',exact:true}).click();
    await frames(page, 12); await check();
    await page.evaluate(() => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
      window.dispatchEvent(new Event('resize'));
    });
    await check();
  } finally { release(); }
});

test('unavailable data renders the specified empty state and link', async ({ page }) => {
  await openFixture(page, { available: false, fetchedAt: activity.fetchedAt });
  await expect(app(page)).toContainText('GitHub didn’t answer when this site was built. The terrain will be back after the next deploy.');
  await expect(app(page).getByRole('link', { name: 'Open github.com/theetaz ↗' })).toHaveAttribute('href', 'https://github.com/theetaz');
  await expect(app(page).locator('canvas')).toHaveCount(0);
});

test('a failed data request can be retried', async ({ page }) => {
  let requests = 0;
  await page.route('**/data/activity.json', route => ++requests === 1 ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ json: activity }));
  await page.goto('/'); await openApp(page, 'Activity');
  await expect(app(page).getByRole('alert')).toContainText('Couldn’t load activity.');
  await app(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(app(page).getByText('120', { exact: true })).toBeVisible();
  expect(requests).toBe(2);
});

test('the static calendar and stat tiles work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    const data = await (await page.request.get(`${baseURL}/data/activity.json`)).json() as ClientActivity;
    await page.goto(`${baseURL}/activity`);
    const window = page.locator('#static-window');
    if (data.available) {
      await expect(window.locator('.activity-calendar')).toBeVisible();
      await expect(window.locator('.activity-calendar rect')).toHaveCount(data.counts.filter(count => count >= 0).length);
      await expect(window).toContainText(`${data.total.toLocaleString('en-US')} GitHub contributions`);
      await expect(window.locator('.activity-stat')).toHaveCount(3 + Number(data.busiest !== null) + Number(data.stars !== null));
    } else await expect(window).toContainText('GitHub didn’t answer');
    await expect(window.getByRole('link', { name: /GitHub/ })).toBeVisible();
    mkdirSync(resolve('.astro/p3-8-artifacts'), { recursive: true });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.screenshot({ path: resolve(`.astro/p3-8-artifacts/activity-static-${theme}.png`) });
    }
  } finally { await context.close(); }
});

test('the terrain works without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await openFixture(page); await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/);
});

test('a missing 2D context retains an accessible calendar', async ({ page }) => {
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await openFixture(page);
  await expect(app(page).locator('.activity-calendar')).toBeVisible();
  if (await page.locator('html').getAttribute('data-mode') === 'mobile')
    await expectPhoneSheetFits(app(page), 'Activity without a canvas context');
  await stage(page).focus(); await page.keyboard.press('ArrowDown');
  await expect(app(page).locator('[data-terrain-live]')).toHaveText('Monday, Oct 6, 2025: 7 contributions');
  await expect(app(page).locator('.activity-day-focused')).toHaveCount(1);
});

test('rendering pauses on minimise and tab hide, resumes on restore, and close destroys listeners', async ({ page }) => {
  await instrumentTerrain(page); await openFixture(page);
  await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/);
  await expect.poll(() => drawCount(page)).toBeGreaterThan(0);
  await app(page).getByRole('button', { name: 'Calendar', exact: true }).click();
  await app(page).getByRole('button', { name: 'Minimise Activity', exact: true }).click();
  await expect(app(page)).toBeHidden();
  const paused = await drawCount(page); await frames(page, 8); expect(await drawCount(page)).toBe(paused);
  await openApp(page, 'Activity'); await expect(app(page)).toBeVisible();
  await expect.poll(() => drawCount(page)).toBeGreaterThan(paused);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await drawCount(page);
  await app(page).getByRole('button', { name: '3D', exact: true }).click();
  await frames(page, 8); expect(await drawCount(page)).toBe(hidden);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => drawCount(page)).toBeGreaterThan(hidden);
  await stage(page).focus(); await page.keyboard.press('ArrowRight');
  await app(page).evaluate(root => Object.assign(window, {
    oldActivityStage: root.querySelector('[data-terrain-stage]'), oldActivityLive: root.querySelector('[data-terrain-live]'),
    oldActivityCanvas: root.querySelector('canvas'), oldActivityRoot: root.querySelector('[data-terrain]'),
  }));
  await closeApp(page, 'Activity'); await expect(app(page)).toHaveCount(0);
  const before = await page.evaluate(() => {
    const old = window as unknown as { oldActivityLive: HTMLElement; oldActivityStage: HTMLElement; oldActivityCanvas: HTMLCanvasElement; oldActivityRoot: HTMLElement; activityDraws(canvas: HTMLCanvasElement): number };
    const result = { text: old.oldActivityLive.textContent, draws: old.activityDraws(old.oldActivityCanvas), ready: old.oldActivityRoot.classList.contains('is-ready') };
    old.oldActivityStage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    document.documentElement.dataset.accent = 'lotus';
    return result;
  });
  expect(before.ready).toBe(false); await frames(page, 8);
  const after = await page.evaluate(() => {
    const old = window as unknown as { oldActivityLive: HTMLElement; oldActivityCanvas: HTMLCanvasElement; activityDraws(canvas: HTMLCanvasElement): number };
    return { text: old.oldActivityLive.textContent, draws: old.activityDraws(old.oldActivityCanvas) };
  });
  expect(after).toEqual({ text: before.text, draws: before.draws });
});

test('reduced motion draws only on interaction and respects the OS override', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await instrumentTerrain(page); await openFixture(page);
  await expect.poll(() => drawCount(page)).toBeGreaterThan(0); await frames(page, 8);
  const idle = await drawCount(page); await frames(page, 8); expect(await drawCount(page)).toBe(idle);
  await app(page).getByRole('button', { name: 'Calendar', exact: true }).click(); await frames(page, 8);
  const calendar = await drawCount(page); expect(calendar - idle).toBe(1);
  await frames(page, 8); expect(await drawCount(page)).toBe(calendar);
  await page.evaluate(() => { document.documentElement.dataset.motion = 'full'; });
  await app(page).getByRole('button', { name: '3D', exact: true }).click(); await frames(page, 8);
  expect(await drawCount(page)).toBeGreaterThan(calendar + 1);
  await page.evaluate(() => { document.documentElement.dataset.motion = 'reduce'; }); await frames(page, 8);
  const reduced = await drawCount(page); await frames(page, 8); expect(await drawCount(page)).toBe(reduced);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`adoption preserves content geometry and zero CLS at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let release!: () => void; const hold = new Promise<void>(done => { release = done; });
    await page.route('**/ActivityApp.*.js', async route => { await hold; await route.continue(); });
    await page.addInitScript(() => {
      Object.assign(window, { activityCls: 0 });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as unknown as { activityCls: number }).activityCls += shift.value;
      } }).observe({ type: 'layout-shift', buffered: true });
    });
    try {
      await page.goto('/activity', { waitUntil: 'domcontentloaded' });
      await expect(app(page)).toHaveAttribute('data-adopting', '');
      const before = await page.locator('#static-window .activity-view').boundingBox();
      release(); await expect(page.locator('#static-window')).toBeHidden(); await frames(page, 8);
      const after = await app(page).locator('.activity-view').boundingBox();
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - after![key])).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => (window as unknown as { activityCls: number }).activityCls)).toBe(0);
    } finally { release(); }
  });
}

test('all accents and themes update the terrain; screenshots and accessibility stay responsive @visual', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFixture(page); await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/);
  mkdirSync(resolve('.astro/p3-8-artifacts'), { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    let previousImage = '';
    for (const accent of ['thambili', 'lagoon', 'lotus', 'tea']) {
      await page.evaluate(accent => { document.documentElement.dataset.accent = accent; }, accent); await frames(page);
      await expect(app(page).locator('canvas')).toHaveCSS('opacity', '1');
      const image = await app(page).locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
      expect(image).not.toBe(previousImage); previousImage = image;
      await page.screenshot({ path: resolve(`.astro/p3-8-artifacts/activity-${theme}-${accent}.png`) });
    }
    const scan = await new AxeBuilder({ page }).include('[data-window-id="activity"]').withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(scan.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/activity');
  await expect(page.locator('#static-window')).toBeHidden();
  await expect(app(page).locator('[data-terrain]')).toHaveClass(/is-ready/); await frames(page);
  await page.screenshot({ path: resolve('.astro/p3-8-artifacts/activity-mobile-dark.png') });
  const width = await page.locator('[data-window-id="activity"] .activity-view').evaluate(root => ({ client: root.clientWidth, scroll: root.scrollWidth }));
  expect(width.scroll).toBe(width.client);
  await page.emulateMedia({ colorScheme: 'light' }); await frames(page);
  await page.screenshot({ path: resolve('.astro/p3-8-artifacts/activity-mobile-light.png') });
  expect(errors).toEqual([]);
});

test('Activity opens from home with two-column tiles and the narrow terrain at 360 px @mobile', async ({ page }, info) => {
  test.skip(phoneOnly(info), 'Pocket sheets are covered by the mobile projects.');
  await page.setViewportSize(NARROW_PHONE);
  const sheet = await openFromHome(page, 'Activity', 'activity');
  const tiles = await sheet.locator('.activity-stat').evaluateAll(els => els.map(el => { const box = el.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width) }; }));
  expect(tiles.length).toBeGreaterThanOrEqual(3);
  expect(new Set(tiles.map(tile => tile.x)).size).toBe(2); expect(tiles[0]!.y).toBe(tiles[1]!.y); expect(tiles[2]!.x).toBe(tiles[0]!.x);
  expect(Math.abs(tiles[0]!.w - tiles[1]!.w)).toBeLessThanOrEqual(1);
  // The terrain chooses its narrow pose below a 560 px layout width.
  const canvas = sheet.locator('.activity-terrain-stage canvas'); await expect(sheet.locator('.activity-view')).toHaveClass(/is-ready/);
  expect(await canvas.evaluate(el => el.clientWidth)).toBeLessThan(560);
  await expectPhoneSheetFits(sheet, '3D'); await expectSheetAccessible(page, '3D');
  await sheet.getByRole('button', { name: 'Calendar', exact: true }).tap();
  await expect(sheet.locator('.activity-view')).toHaveAttribute('data-view', 'top');
  await expect(sheet.getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectPhoneSheetFits(sheet, 'Calendar'); await expectSheetAccessible(page, 'Calendar');
  await sheet.getByRole('button', { name: '3D', exact: true }).tap();
  await expect(sheet.locator('.activity-view')).toHaveAttribute('data-view', 'perspective');
});
