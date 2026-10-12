import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { PLACES } from '../../src/os/scenes/pin-game';
import { toScene } from '../../src/os/scenes/island-model';
import { test, expect, openApp } from './fixtures';

const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const rain = (page: Page) => page.locator('[data-egg="rain"]');
const fps = (page: Page) => page.getByRole('meter', { name: 'Frames per second', includeHidden: true });
const settings = (page: Page) => page.locator('[data-window-id="settings"]');
const artifacts = resolve('.astro/p3-13-artifacts');

async function ready(page: Page, path = '/') {
  await page.goto(path); await expect(page.locator('html')).toHaveClass(/os-ready/);
}
async function konami(page: Page) { for (const key of sequence) await page.keyboard.press(key); }
async function developer(page: Page) {
  await openApp(page, 'Settings');
  await settings(page).getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Developer', exact: true }).click();
  await expect(settings(page).getByRole('switch', { name: 'Show FPS meter' })).toBeVisible();
}
async function hidden(page: Page, value: boolean) {
  await page.evaluate(value => { Object.defineProperty(document, 'hidden', { configurable: true, value }); document.dispatchEvent(new Event('visibilitychange')); }, value);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  Object.assign(page, { eggErrors: errors });
});
test.afterEach(({ page }) => expect((page as Page & { eggErrors: string[] }).eggErrors).toEqual([]));

test('effects remain lazy until their trigger', async ({ page }) => {
  const loaded: string[] = []; page.on('request', request => {
    if (/\/(?:rain|confetti|ayubowan|devmode)\.[^/]+\.js$/.test(new URL(request.url()).pathname)) loaded.push(request.url());
  });
  await ready(page); await expect(page.locator('[data-mochi]')).toBeVisible();
  // Phone sheets open Settings on its section list; desktop shows Appearance beside it.
  await openApp(page, 'Settings'); await expect(settings(page).getByRole('navigation', { name: 'Settings sections' })).toBeVisible();
  expect(loaded).toEqual([]); await expect(page.locator('[data-egg]')).toHaveCount(0);
});

test('Konami shows a single 400-drop canvas, umbrella and toast for ten seconds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await ready(page); await konami(page);
  await expect(page.getByText('Monsoon season.', { exact: true })).toBeVisible();
  await expect(rain(page).locator('canvas')).toHaveAttribute('data-drops', '400');
  const started = await page.evaluate(() => performance.now());
  await expect(page.locator('[data-mochi]')).toHaveAttribute('data-item', 'umbrella');
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, 'monsoon-light.png') });
  await expect(rain(page)).toHaveCSS('pointer-events', 'none'); await expect(rain(page)).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('region', { name: 'Desktop surface' }).click({ position: { x: 850, y: 560 } });
  await expect(rain(page).locator('canvas')).toHaveCount(0, { timeout: 12_000 });
  const duration = await page.evaluate(() => performance.now()) - started;
  expect(duration).toBeGreaterThan(9000); expect(duration).toBeLessThan(12_000);
});

test('Konami ignores editable fields and resets a partial sequence', async ({ page }) => {
  await ready(page, '/terminal'); const input = page.getByRole('textbox', { name: 'Terminal command' });
  await input.focus(); await konami(page); await expect(rain(page)).toHaveCount(0);
  await page.getByRole('region', { name: 'Desktop surface' }).click({ position: { x: 1250, y: 750 } });
  for (const key of sequence.slice(0, 5)) await page.keyboard.press(key);
  await input.focus(); await page.keyboard.press('x');
  await page.getByRole('region', { name: 'Desktop surface' }).click({ position: { x: 1250, y: 750 } });
  for (const key of sequence.slice(5)) await page.keyboard.press(key);
  await expect(rain(page)).toHaveCount(0); await konami(page); await expect(rain(page).locator('canvas')).toBeVisible();
});

for (const override of ['system', 'reduce'] as const) {
  test(`monsoon uses a static tint with ${override} reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: override === 'system' ? 'reduce' : 'no-preference' });
    if (override === 'reduce') await page.addInitScript(() => localStorage.setItem('serendib:motion', '"reduce"'));
    await ready(page); await page.clock.install(); await konami(page);
    await expect(rain(page)).toHaveAttribute('data-reduced-motion', 'true'); await expect(rain(page).locator('canvas')).toHaveCount(0);
    expect(await rain(page).evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await expect(page.getByText('Monsoon season.', { exact: true })).toBeVisible();
    await page.clock.fastForward(10_100); await expect(rain(page)).toHaveCount(0);
  });
}

test('rain draws at 30 fps and pauses both its canvas and lifetime while hidden', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { eggRainFrames: 0 }); const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (this: CanvasRenderingContext2D, path?: Path2D) {
      if (this.canvas.closest('[data-egg="rain"]')) (window as unknown as { eggRainFrames: number }).eggRainFrames++;
      return Reflect.apply(stroke, this, path ? [path] : []);
    };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await ready(page); await page.clock.install(); await konami(page);
  await expect(rain(page).locator('canvas')).toBeVisible();
  const count = () => page.evaluate(() => (window as unknown as { eggRainFrames: number }).eggRainFrames);
  const first = await count(); await page.clock.runFor(1000); const draws = await count() - first;
  expect(draws).toBeGreaterThanOrEqual(25); expect(draws).toBeLessThanOrEqual(32);
  await hidden(page, true); const paused = await count(); await page.clock.fastForward(15_000);
  expect(await count()).toBe(paused); await expect(rain(page)).toHaveAttribute('hidden', '');
  await hidden(page, false); await expect(rain(page)).toBeVisible();
  await page.clock.fastForward(8500); await expect(rain(page)).toBeVisible();
  await page.clock.fastForward(600); await expect(rain(page)).toHaveCount(0);
});

test('retriggering monsoon replaces it; motion changes switch the active effect to tint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' }); await ready(page); await konami(page);
  await expect(rain(page).locator('canvas')).toBeVisible(); await konami(page);
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, 'monsoon-dark.png') });
  await expect(rain(page)).toHaveCount(1); await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(rain(page)).toHaveAttribute('data-reduced-motion', 'true'); await expect(rain(page).locator('canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await expect(rain(page).locator('canvas')).toHaveCount(1);
});

test('desktop typing and the Terminal greeting make Mochi wave with the Sinhala bubble', async ({ page }) => {
  await ready(page); await page.getByRole('region', { name: 'Desktop surface' }).click({ position: { x: 850, y: 560 } });
  await page.keyboard.type('ayubowan'); await expect(page.locator('[data-mochi-bubble]')).toHaveText('ආයුබෝවන්!');
  await expect(page.locator('[data-mochi]')).toHaveAttribute('data-mood', 'wave');
  await openApp(page, 'Terminal'); const input = page.getByRole('textbox', { name: 'Terminal command' });
  await input.fill('ayubowan'); await input.press('Enter');
  await expect(page.locator('[data-window-id="terminal"]')).toContainText('Sinhala: "may you live long"');
  await expect(page.locator('[data-mochi-bubble]')).toHaveText('ආයුබෝවන්!');
});

test('seven avatar clicks unlock persisted Developer mode and working controls', async ({ page }) => {
  const actions: string[] = []; page.on('console', message => { if (message.type() === 'debug' && message.text().startsWith('[Serendib] Window actions')) actions.push(message.text()); });
  await ready(page, '/about'); const avatar = page.locator('[data-window-id="about"]').getByRole('button', { name: "Nipun Theekshana's portrait" });
  for (let i = 0; i < 6; i++) await avatar.click(); await expect(fps(page)).toHaveCount(0); await avatar.click();
  await expect(page.getByText('You are now a developer. Again.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('serendib:dev'))).toBe('true');
  await expect(fps(page)).toHaveText(/^[1-9]\d* FPS$/); await developer(page);
  const bounds = settings(page).getByRole('switch', { name: 'Show layout bounds' }); await bounds.focus(); await bounds.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-dev-bounds', '');
  await expect(settings(page)).toHaveCSS('outline-width', '1px');
  const meter = settings(page).getByRole('switch', { name: 'Show FPS meter' }); await meter.click(); await expect(fps(page)).toHaveCount(0);
  await meter.click(); await expect(fps(page)).toHaveText(/^[1-9]\d* FPS$/);
  const log = settings(page).getByRole('switch', { name: 'Log window actions' }); await log.click();
  await openApp(page, 'Terminal'); await expect.poll(() => actions.length).toBeGreaterThan(0);
  await developer(page); await log.click(); const count = actions.length; await openApp(page, 'Projects');
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible(); expect(actions.length).toBe(count);
  await page.reload(); await expect(fps(page)).toHaveText(/^[1-9]\d* FPS$/);
  await developer(page); await expect(bounds).toHaveAttribute('aria-checked', 'false');
});

test('FPS pauses when hidden and revoking Developer mode cleans meter and bounds', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('serendib:dev', 'true')); await ready(page); await developer(page);
  await settings(page).getByRole('switch', { name: 'Show layout bounds' }).click(); await expect(fps(page)).toHaveText(/^[1-9]\d* FPS$/);
  await hidden(page, true); const value = await fps(page).getAttribute('aria-valuenow'); await page.clock.install(); await page.clock.fastForward(2000);
  expect(await fps(page).getAttribute('aria-valuenow')).toBe(value); await expect(fps(page)).toBeHidden();
  await hidden(page, false); await page.clock.runFor(1000); await expect(fps(page)).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'serendib:dev', newValue: 'false', storageArea: localStorage })));
  await expect(fps(page)).toHaveCount(0); await expect(page.locator('html')).not.toHaveAttribute('data-dev-bounds');
  await expect(settings(page).getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Developer' })).toHaveCount(0);
});

test('a real perfect Pin the city final emits 40 coconut particles for 1.5 seconds', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }));
  await ready(page, '/maps/play'); const app = page.locator('[data-window-id="maps"]'); await expect(app.locator('.maps-view')).toHaveAttribute('data-surface', 'svg');
  for (let round = 1; round <= 5; round++) {
    await expect(app.getByText(`Round ${round} / 5`, { exact: true })).toBeVisible();
    const name = await app.locator('.maps-game h2').textContent(); const place = PLACES.find(place => place.name === name)!;
    const [x, y] = toScene(place.lon, place.lat);
    const point = await app.locator('[data-map-world]').evaluate((world, point) => {
      const at = new DOMPoint(point.x, point.y).matrixTransform((world as SVGGraphicsElement).getScreenCTM()!); return { x: at.x, y: at.y };
    }, { x, y });
    await app.getByRole('group', { name: 'Pin the city map' }).dispatchEvent('click', { clientX: point.x, clientY: point.y });
    await expect(app.getByText(/^Bullseye\. \+\d+$/)).toBeVisible();
    await app.getByRole('button', { name: round === 5 ? 'See my score' : 'Next city', exact: true }).click();
  }
  await expect(app.getByText('Survey Department material', { exact: true })).toBeVisible();
  const confetti = page.locator('[data-egg="confetti"]'); await expect(confetti.locator('i')).toHaveCount(40);
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, 'coconut-confetti.png') });
  await expect(confetti.locator('.egg-coconut-brown')).toHaveCount(20); await expect(confetti.locator('.egg-coconut-green')).toHaveCount(20);
  await expect(confetti).toHaveCSS('pointer-events', 'none'); await expect(confetti).toHaveCount(0, { timeout: 3000 });
});

test('coconut confetti stays static for reduced motion and pauses its lifetime while hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page); await page.clock.install();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('serendib:pin-perfect', { detail: { score: 5000, windowId: 'maps' } })));
  const confetti = page.locator('[data-egg="confetti"]'); await expect(confetti.locator('i')).toHaveCount(40);
  const transform = await confetti.locator('i').first().getAttribute('style'); await page.clock.runFor(500);
  expect(await confetti.locator('i').first().getAttribute('style')).toBe(transform);
  await hidden(page, true); await page.clock.fastForward(5000); await expect(confetti).toHaveCount(1);
  await hidden(page, false); await page.clock.fastForward(1100); await expect(confetti).toHaveCount(0);
});

test('simple view cancels an effect that is still loading', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void; const started = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/rain.*.js', async route => { requested(); await hold; await route.continue(); });
  try {
    await ready(page); await konami(page); await started;
    await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'serendib:view', newValue: '"simple"', storageArea: localStorage })));
    await expect(page.locator('html')).toHaveAttribute('data-view', 'simple'); release();
    await expect(page.locator('[data-egg]')).toHaveCount(0); await expect(page.getByText('Monsoon season.', { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test('shell teardown removes all egg layers, timers and trigger listeners', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('serendib:dev', 'true'));
  await ready(page, '/settings?section=developer');
  await settings(page).getByRole('switch', { name: 'Show layout bounds' }).click(); await expect(fps(page)).toBeVisible();
  await page.clock.install(); await konami(page); await expect(rain(page)).toBeVisible();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('serendib:pin-perfect', { detail: { score: 5000, windowId: 'settings' } })));
  await expect(page.locator('[data-egg="confetti"]')).toBeVisible();
  await page.evaluate(() => {
    document.querySelector('astro-island[component-url*="Desktop"]')!.remove();
    document.dispatchEvent(new Event('astro:after-swap'));
  });
  await expect(page.locator('html')).not.toHaveClass(/os-ready/);
  await expect(page.locator('[data-egg]')).toHaveCount(0); await expect(page.locator('html')).not.toHaveAttribute('data-dev-bounds');
  await konami(page); await page.evaluate(() => {
    for (const name of ['ayubowan', 'about:avatar7', 'serendib:pin-perfect']) document.dispatchEvent(new CustomEvent(name, { detail: { score: 5000, windowId: 'settings' } }));
    document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('resize'));
  });
  await page.clock.runFor(11_000); await expect(page.locator('[data-egg]')).toHaveCount(0);
});

for (const width of [1440, 390]) for (const theme of ['light', 'dark'] as const) {
  test(`Developer fits ${width}px in ${theme} with accessible controls @visual @a11y`, async ({ page }) => {
    mkdirSync(artifacts, { recursive: true }); await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ colorScheme: theme }); await page.addInitScript(() => localStorage.setItem('serendib:dev', 'true'));
    await ready(page, '/settings?section=developer'); await expect(settings(page).getByRole('switch', { name: 'Show layout bounds' })).toBeVisible();
    expect(await settings(page).locator('.settings-app').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).setLegacyMode().include('[data-window-id="settings"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations).toEqual([]); await page.mouse.move(0, 0); await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: resolve(artifacts, `developer-${theme}-${width}.png`) });
  });
}
