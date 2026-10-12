import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, openApp, openMenu, closeApp } from './fixtures';
import { NARROW_PHONE, expectPhoneSheetFits, expectSheetAccessible, openFromHome, phoneOnly } from './phone-sheet';
// Headless Chromium needs an explicit software-GPU opt-in on this shared Mac.
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
const app = (page: Page) => page.locator('[data-window-id="maps"]');
const view = (page: Page) => app(page).locator('.maps-view');
async function ready(page: Page, path = '/maps') {
  await page.goto(path); await expect(app(page)).not.toHaveAttribute('data-adopting');
  await expect(view(page)).toBeVisible();
}
async function frames(page: Page, count = 6) {
  await page.evaluate(async value => { for (let i = 0; i < value; i++) await new Promise<void>(done => requestAnimationFrame(() => done())); }, count);
}
async function expectThirtyFps(stage: ReturnType<typeof app>) {
  const sample = await stage.evaluate(async el => {
    const before = Number((el as HTMLElement).dataset.frames); const start = performance.now();
    for (let i = 0; i < 60; i++) await new Promise<void>(done => requestAnimationFrame(() => done()));
    return { frames: Number((el as HTMLElement).dataset.frames) - before, duration: performance.now() - start };
  });
  expect(sample.frames).toBeGreaterThan(0);
  expect(sample.frames).toBeLessThanOrEqual(Math.ceil(sample.duration / (1000 / 30)) + 2);
}
async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (/webgl/.test(type)) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
}
async function finishGame(page: Page) {
  const map = app(page).getByRole('group', { name: 'Pin the city map', exact: true });
  for (let round = 1; round <= 5; round++) {
    await expect(app(page).getByText(`Round ${round} / 5`, { exact: true })).toBeVisible();
    // Round 1 is also rendered while the mode effect initializes the game.
    // Wait for its actual guess phase before sending a one-shot keyboard input.
    await expect(map.locator('.maps-crosshair')).toBeVisible();
    // Keyboard makes the default central crosshair a guess even if a card overlaps it.
    await map.focus(); await map.press('Enter');
    await expect(app(page).locator('.maps-game').getByText(/ · (?:<1|\d+) km$/)).toBeVisible();
    await app(page).getByRole('button', { name: round === 5 ? 'See my score' : 'Next city', exact: true }).click();
  }
  await expect(app(page).getByText('Final', { exact: true })).toBeVisible();
  await expect(app(page).locator('.maps-game h2')).toContainText('/ 5,000');
}

test('WebGL arrives over the poster; controls, markers and five rounds work without console errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const sceneResponse = page.waitForResponse(response => /\/island\.[^/]+\.js$/.test(new URL(response.url()).pathname));
  await ready(page); expect((await sceneResponse).status()).toBe(200);
  await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
  await expect(app(page).locator('canvas')).toBeVisible(); await expect(app(page).locator('.maps-poster')).toHaveCSS('opacity', '0');
  await app(page).getByRole('button', { name: 'Where’s Nipun? (Colombo)' }).click();
  await app(page).getByRole('button', { name: 'Recentre', exact: true }).click();
  await app(page).getByRole('button', { name: 'Play', exact: true }).click(); await expect(page).toHaveURL(/\/maps\/play$/);
  await expect(app(page).getByText('Round 1 / 5', { exact: true })).toBeVisible();
  const map = app(page).getByRole('group', { name: 'Pin the city map' });
  const bounds = (await map.boundingBox())!;
  await map.click({ position: { x: Math.min(440, bounds.width / 2), y: Math.min(340, bounds.height / 2) } });
  await expect(app(page).locator('.maps-game').getByText(/ · (?:<1|\d+) km$/)).toBeVisible();
  await expect(app(page).getByRole('button', { name: 'Next city', exact: true })).toBeFocused();
  await expect(app(page).locator('.maps-guess-line')).toHaveAttribute('x1', /\d/);
  await app(page).getByRole('button', { name: 'Leave game' }).click();
  await app(page).getByRole('button', { name: 'Play', exact: true }).click(); await finishGame(page);
  await expect(app(page).getByText(/Survey Department material|Tuk-tuk navigator|Weekend explorer|Confident tourist|Lost somewhere in Pettah/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('SVG plays all five rounds and persists the best score across reloads', async ({ page }) => {
  await disableWebGL(page); await ready(page, '/maps/play'); await expect(view(page)).toHaveAttribute('data-surface', 'svg');
  await expect(app(page).getByText('Your browser skipped WebGL, so this is the flat version. The game still works.')).toBeVisible();
  await expect(app(page).locator('canvas')).toHaveCount(0); await finishGame(page);
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:pin:best') ?? '0') as number); expect(best).toBeGreaterThan(0);
  await page.reload(); await expect(app(page).getByText('Round 1 / 5', { exact: true })).toBeVisible(); await finishGame(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:pin:best') ?? '0') as number)).toBeGreaterThanOrEqual(best);
});

test('slow fonts keep the flat game usable before automatic 3D scene work', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(done => { release = done; });
  await page.route('**/*.woff2', async route => { await held; await route.continue(); });
  const scenes: string[] = []; page.on('request', request => { if (/\/island\.[^/]+\.js$/.test(new URL(request.url()).pathname)) scenes.push(request.url()); });
  try {
    await page.goto('/maps/play', { waitUntil: 'domcontentloaded' });
    await expect(view(page)).toHaveAttribute('data-surface', 'svg');
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');
    const map = app(page).getByRole('group', { name: 'Pin the city map', exact: true });
    await expect(map.locator('.maps-crosshair')).toBeVisible(); await map.focus(); await map.press('Enter');
    await expect(app(page).locator('.maps-game').getByText(/ · (?:<1|\d+) km$/)).toBeVisible();
    expect(scenes).toEqual([]);
    release(); await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
    expect(scenes).toHaveLength(1);
  } finally { release(); }
});

test('Save-Data keeps three.js deferred until explicit loading and preserves the current round', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g' } }));
  const scenes: string[] = []; page.on('request', request => { if (/\/island\.[^/]+\.js/.test(request.url())) scenes.push(request.url()); });
  await ready(page, '/maps/play'); await expect(view(page)).toHaveAttribute('data-surface', 'svg');
  await expect(app(page).getByRole('button', { name: 'Load 3D (≈135 KB)' })).toBeVisible(); expect(scenes).toEqual([]);
  const map = app(page).getByRole('group', { name: 'Pin the city map' }); await map.focus(); await map.press('Enter');
  await app(page).getByRole('button', { name: 'Next city', exact: true }).click();
  const city = await app(page).locator('.maps-game h2').textContent();
  await app(page).getByRole('button', { name: 'Load 3D (≈135 KB)' }).click(); await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
  await expect(app(page).getByText('Round 2 / 5', { exact: true })).toBeVisible(); await expect(app(page).locator('.maps-game h2')).toHaveText(city!); expect(scenes).toHaveLength(1);
});

test('small map canvases cap continuous rendering at 30 fps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await ready(page);
  await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
  await expectThirtyFps(app(page).locator('.maps-stage'));
});

test('minimisation and hidden documents pause frames; closing disposes every GPU buffer and program', async ({ page }) => {
  await page.addInitScript(() => {
    const buffers = new Set<WebGLBuffer>(); const programs = new Set<WebGLProgram>();
    Object.assign(window, { mapsGpu: { buffers, programs } });
    const proto = WebGL2RenderingContext.prototype;
    const createBuffer = proto.createBuffer; const deleteBuffer = proto.deleteBuffer;
    const createProgram = proto.createProgram; const deleteProgram = proto.deleteProgram;
    proto.createBuffer = function () { const value = createBuffer.call(this); if (value) buffers.add(value); return value; };
    proto.deleteBuffer = function (value) { if (value) buffers.delete(value); deleteBuffer.call(this, value); };
    proto.createProgram = function () { const value = createProgram.call(this); if (value) programs.add(value); return value; };
    proto.deleteProgram = function (value) { if (value) programs.delete(value); deleteProgram.call(this, value); };
  });
  await ready(page); await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
  const stage = app(page).locator('.maps-stage');
  await app(page).getByRole('button', { name: 'Minimise Island', exact: true }).click(); await expect(app(page)).toBeHidden();
  const stopped = await stage.getAttribute('data-frames'); await frames(page); expect(await stage.getAttribute('data-frames')).toBe(stopped);
  await openApp(page, 'Island'); await expect(app(page)).toBeVisible(); await expect.poll(() => stage.getAttribute('data-frames')).not.toBe(stopped);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await stage.getAttribute('data-frames'); await frames(page); expect(await stage.getAttribute('data-frames')).toBe(hidden);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => stage.getAttribute('data-frames')).not.toBe(hidden);
  expect(await page.evaluate(() => (window as unknown as { mapsGpu: { buffers: Set<unknown> } }).mapsGpu.buffers.size)).toBeGreaterThan(0);
  await closeApp(page, 'Island'); await expect(app(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => { const gpu = (window as unknown as { mapsGpu: { buffers: Set<unknown>; programs: Set<unknown> } }).mapsGpu; return gpu.buffers.size + gpu.programs.size; })).toBe(0);
});

test('reduced motion does not run continuously; explicit keyboard camera changes still render', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page); await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
  const stage = app(page).locator('.maps-stage'); await frames(page); const before = await stage.getAttribute('data-frames'); await frames(page); expect(await stage.getAttribute('data-frames')).toBe(before);
  await stage.focus(); await stage.press('ArrowRight'); await expect.poll(() => stage.getAttribute('data-frames')).not.toBe(before);
  const dimensions = await app(page).locator('canvas').evaluate(el => ({ physical: (el as HTMLCanvasElement).width, css: el.clientWidth }));
  expect(dimensions.physical / dimensions.css).toBeLessThanOrEqual(2);
});

test('context loss switches to playable SVG and preserves the game state', async ({ page }) => {
  await ready(page, '/maps/play'); await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
  const city = await app(page).locator('.maps-game h2').textContent();
  await app(page).locator('canvas').evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(view(page)).toHaveAttribute('data-surface', 'svg'); await expect(app(page).locator('canvas')).toHaveCount(0);
  await expect(app(page).locator('.maps-game h2')).toHaveText(city!); await finishGame(page);
});

test('layers and menus work with keyboard; exploration and game have no axe violations', async ({ page }) => {
  await ready(page); await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
  await app(page).getByRole('button', { name: 'Layers ▾' }).click(); await app(page).getByRole('checkbox', { name: 'Town labels', exact: true }).uncheck();
  await expect(app(page).locator('.island-labels')).toBeHidden(); await page.keyboard.press('Escape');
  await expect(app(page).getByRole('checkbox', { name: 'Town labels', exact: true })).toHaveCount(0);
  await openMenu(page, 'View');
  await page.getByRole('menuitemcheckbox', { name: 'Town labels', exact: true }).click(); await expect(app(page).locator('.island-labels')).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[data-window-id="maps"]').analyze()).violations).toEqual([]);
  await app(page).getByRole('button', { name: 'Play', exact: true }).click();
  expect((await new AxeBuilder({ page }).include('[data-window-id="maps"]').analyze()).violations).toEqual([]);
});

test('keyboard crosshair takes 20 px or Shift 80 px steps; final score can be shared', async ({ page }) => {
  await disableWebGL(page); await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Object.assign(window, { sharedScore: text }); } } }));
  await ready(page, '/maps/play'); const map = app(page).getByRole('group', { name: 'Pin the city map' });
  await map.focus(); const initial = await app(page).locator('.maps-crosshair').boundingBox(); await map.press('ArrowRight'); const next = await app(page).locator('.maps-crosshair').boundingBox(); expect(next!.x - initial!.x).toBeCloseTo(20, 0);
  await map.press('Shift+ArrowRight'); const further = await app(page).locator('.maps-crosshair').boundingBox(); expect(further!.x - next!.x).toBeCloseTo(80, 0);
  await finishGame(page); await app(page).getByRole('button', { name: 'Share score', exact: true }).click(); await expect(app(page).getByText('Score copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { sharedScore: string }).sharedScore)).toMatch(/^I scored [\d,]+ \/ 5,000 in Pin the city: https:\/\/os.nipuntheekshana.com\/maps\/play$/);
});


test('light and dark desktop and phone layouts produce artifacts with zero adoption CLS', async ({ page }) => {
  mkdirSync(resolve('.astro/p3-7-artifacts'), { recursive: true });
  await page.addInitScript(() => {
    Object.assign(window, { mapsCls: 0 });
    new PerformanceObserver(list => list.getEntries().forEach(entry => { const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }; if (!shift.hadRecentInput) (window as unknown as { mapsCls: number }).mapsCls += shift.value; })).observe({ type: 'layout-shift', buffered: true });
  });
  for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme }); await ready(page); await expect(view(page)).toHaveAttribute('data-surface', 'webgl');
      await page.evaluate(async () => { await document.fonts.ready; }); await expect(app(page).locator('.maps-stage')).toHaveAttribute('data-intro', 'complete'); await frames(page);
      expect(await page.evaluate(() => (window as unknown as { mapsCls: number }).mapsCls)).toBe(0);
      await page.screenshot({ path: resolve(`.astro/p3-7-artifacts/maps-${theme}-${mode}.png`) });
      await app(page).getByRole('button', { name: 'Play', exact: true }).click();
      await page.screenshot({ path: resolve(`.astro/p3-7-artifacts/play-${theme}-${mode}.png`) });
      if (mode === 'phone') {
        expect(await app(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const button = app(page).getByRole('button', { name: 'Leave game', exact: true }); expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('a short phone sheet keeps the docked game card and map in view without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 }); await disableWebGL(page); await ready(page, '/maps/play');
  expect(await view(page).evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
  const card = (await app(page).locator('.maps-game').boundingBox())!; const sheet = (await app(page).boundingBox())!;
  expect(Math.abs(card.y + card.height - (sheet.y + sheet.height))).toBeLessThanOrEqual(1);
  await finishGame(page); await app(page).getByRole('button', { name: 'Play again', exact: true }).click();
  await expect(app(page).getByText('Round 1 / 5', { exact: true })).toBeVisible();
});

test('Island opens from home; the game card docks as a bottom sheet and taps place pins at 360 px @mobile', async ({ page }, info) => {
  test.skip(phoneOnly(info), 'Pocket sheets are covered by the mobile projects.');
  await page.setViewportSize(NARROW_PHONE); await disableWebGL(page);
  const sheet = await openFromHome(page, 'Island', 'maps');
  // Exploring: the info card and legend share the bottom dock; the map fills the rest.
  const stage = sheet.locator('.maps-stage'); const infoCard = sheet.locator('.maps-info');
  await expect(infoCard).toBeVisible(); await expect(sheet.locator('.maps-legend')).toBeVisible();
  expect((await stage.boundingBox())!.y + (await stage.boundingBox())!.height).toBeLessThanOrEqual((await infoCard.boundingBox())!.y + 1);
  await expectPhoneSheetFits(sheet, 'explore'); await expectSheetAccessible(page, 'explore');
  await sheet.getByRole('button', { name: 'Play', exact: true }).tap();
  await expect(page).toHaveURL(/\/maps\/play$/);
  const card = sheet.locator('.maps-game'); await expect(card).toBeVisible();
  const frame = (await sheet.boundingBox())!; const docked = (await card.boundingBox())!;
  // Full sheet width, flush with its bottom edge, below the whole map.
  expect(docked.x).toBeCloseTo(frame.x, 0); expect(docked.width).toBeCloseTo(frame.width, 0);
  expect(Math.abs(docked.y + docked.height - (frame.y + frame.height))).toBeLessThanOrEqual(1);
  const map = (await stage.boundingBox())!; expect(map.y + map.height).toBeLessThanOrEqual(docked.y + 1);
  await expect(card.locator('.maps-game-keys')).toHaveCSS('position', 'absolute');
  await expectPhoneSheetFits(sheet, 'play'); await expectSheetAccessible(page, 'play');
  // A tap on the island is the guess; the map keeps its size when the card reveals the answer.
  await expect(stage.locator('.maps-crosshair')).toBeVisible();
  await page.touchscreen.tap(map.x + map.width / 2, map.y + map.height / 2);
  await expect(card.getByText(/ · (?:<1|\d+) km$/)).toBeVisible();
  const after = (await stage.boundingBox())!; expect(Math.abs(after.height - map.height)).toBeLessThanOrEqual(1);
  await expect(card.getByRole('button', { name: 'Next city', exact: true })).toBeFocused();
  await expectPhoneSheetFits(sheet, 'reveal'); await expectSheetAccessible(page, 'reveal');
  await card.getByRole('button', { name: 'Next city', exact: true }).tap();
  await expect(card.getByText('Round 2 / 5', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Leave game', exact: true }).tap();
  await expect(page).toHaveURL(/\/maps$/); await expect(sheet.locator('.maps-info')).toBeVisible();
});
