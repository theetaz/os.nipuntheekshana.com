import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
// These two acceptance routes are temporary and never become part of the site.
const root = fileURLToPath(new URL('../../', import.meta.url));
let routes: string[];
let origin: string;
let fixturePort: number;
let server: ChildProcess;
test.beforeAll(async ({}, info) => {
  fixturePort = 4400 + info.workerIndex;
  origin = `http://localhost:${fixturePort}`;
  routes = [`p2-ui-static-${info.workerIndex}`, `p2-ui-hydrated-${info.workerIndex}`];
  for (const name of routes) await writeFile(`${root}src/pages/${name}.astro`, `---
import UiKit from '../../tests/fixtures/ui-kit/UiKit';
import '../styles/global.css';
---
<!doctype html><html lang="en" data-motion="reduce"><head><meta charset="UTF-8" /><title>UI kit verification</title></head><body style="overflow:auto;height:auto">
${name.startsWith('p2-ui-hydrated') ? '<script is:inline type="application/json" id="os-initial-data" data-key="fixture">{"title":"Embedded data"}</script>' : ''}
<UiKit ${name.startsWith('p2-ui-hydrated') ? 'interactive client:load' : ''} /></body></html>`);
  server = spawn('npm', ['run', 'dev', '--', '--ignore-lock', '--host', 'localhost', '--port', String(fixturePort)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  // Wait on Astro's readiness output, never on a fixed startup delay.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('UI fixture server did not become ready')), 60_000);
    const output = (chunk: Buffer) => { if (chunk.toString().includes(`localhost:${fixturePort}`)) { clearTimeout(timer); resolve(); } };
    server.stdout?.on('data', output); server.stderr?.on('data', output);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Fixture server exited: ${code}`)); });
  });
});
test.afterAll(async () => {
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    await new Promise<void>(resolve => { if (server.exitCode !== null || server.signalCode !== null) resolve(); else server.once('exit', () => resolve()); });
  }
  await Promise.all(routes.map(name => unlink(`${root}src/pages/${name}.astro`).catch(() => {})));
});
async function openFixture(page: import('@playwright/test').Page) {
  await page.goto(`${origin}/${routes[1]}`);
  await expect(page.getByTestId('app-data')).toHaveText('Embedded data');
}
test('all primitives render without hydration and the hydrated page has no console errors', async ({ page, browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const staticPage = await context.newPage();
  expect((await staticPage.goto(`${origin}/${routes[0]}`))?.status()).toBe(200);
  await expect(staticPage.getByRole('heading', { name: 'UI kit verification' })).toBeVisible();
  await expect(staticPage.getByRole('menu', { name: 'Actions menu' })).toBeVisible();
  await expect(staticPage.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
  await expect(staticPage.locator('astro-island')).toHaveCount(0); await context.close();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openFixture(page); await expect(page.getByRole('img', { name: 'Projects icon' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('Segmented skips disabled choices, wraps, and responds to Home/End', async ({ page }) => {
  await openFixture(page); const icons = page.getByRole('radio', { name: 'Icons', exact: true }); const list = page.getByRole('radio', { name: 'List', exact: true });
  await icons.focus(); await page.keyboard.press('ArrowRight'); await expect(list).toBeFocused(); await expect(list).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight'); await expect(icons).toBeFocused();
  await page.keyboard.press('End'); await expect(list).toBeFocused(); await page.keyboard.press('Home'); await expect(icons).toBeFocused();
});
test('native Switch, Slider, SearchField, and Chip support keyboard input', async ({ page }) => {
  await openFixture(page); const sound = page.getByRole('switch', { name: 'Sound' });
  await sound.focus(); await page.keyboard.press('Space'); await expect(sound).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter'); await expect(sound).toHaveAttribute('aria-checked', 'false');
  const volume = page.getByRole('slider', { name: 'Volume' }); await volume.focus(); await page.keyboard.press('ArrowRight'); await expect(volume).toHaveValue('55');
  await page.keyboard.press('End'); await expect(volume).toHaveValue('100'); await page.keyboard.press('Home'); await expect(volume).toHaveValue('0');
  await page.getByRole('searchbox', { name: 'Search projects' }).fill('map');
  await page.getByRole('button', { name: 'Active chip' }).click(); await expect(sound).toHaveAttribute('aria-checked', 'true');
});
test('Menu has roving focus, typeahead, nested submenus, checked roles, and focus return', async ({ page }) => {
  await openFixture(page); const trigger = page.getByRole('button', { name: 'Menu trigger' });
  const menu = page.getByRole('menu', { name: 'Actions menu' });
  await trigger.click(); await expect(page.getByRole('menuitem', { name: 'Open', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); const checkbox = page.getByRole('menuitemcheckbox', { name: 'Show status bar' });
  await expect(checkbox).toBeFocused(); await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter'); await expect(menu).toBeHidden(); await expect(page.getByTestId('command')).toHaveText('status');
  await trigger.click(); await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('l'); const list = page.getByRole('menuitemradio', { name: 'List' }); await expect(list).toBeFocused();
  await page.keyboard.press('Space'); await trigger.click(); await expect(list).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('End'); await expect(page.getByRole('menuitem', { name: 'Window one' })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'Open', exact: true })).toBeFocused();
  await page.keyboard.press('s'); await page.keyboard.press('s'); await expect(page.getByRole('menuitem', { name: 'Sort by' })).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('menuitem', { name: 'Name', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('menuitem', { name: 'Year' })).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('menuitem', { name: 'More' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('menuitem', { name: 'Sort by' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(menu).toBeHidden(); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole('button', { name: 'Primary', exact: true }).click(); await expect(menu).toBeHidden();
});
test('submenu flips inside the viewport; menu closes on blur and Tab', async ({ page }) => {
  await openFixture(page); const trigger = page.getByRole('button', { name: 'Menu trigger' });
  await trigger.evaluate(element => { element.style.position = 'fixed'; element.style.right = '8px'; element.style.bottom = '8px'; });
  await trigger.click(); await page.getByRole('menuitem', { name: 'Sort by' }).hover();
  const submenu = page.getByRole('menu', { name: 'Sort by' }); await expect(submenu).toBeVisible();
  const box = await submenu.boundingBox(); const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await expect(page.getByRole('menu', { name: 'Actions menu' })).toBeHidden();
  await trigger.click(); await page.keyboard.press('Tab'); await expect(page.getByRole('menu', { name: 'Actions menu' })).toBeHidden();
});
test('Tooltip shows immediately on focus, has a description, and dismisses with Escape', async ({ page }) => {
  await openFixture(page); const trigger = page.getByRole('button', { name: 'Tooltip trigger' }); await trigger.focus();
  await expect(page.getByRole('tooltip')).toHaveText('A helpful description'); await expect(trigger).toHaveAccessibleDescription('A helpful description');
  await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toBeHidden(); await expect(trigger).toBeFocused();
});
test('Popover dismisses and returns focus, and modal Tab wraps', async ({ page }) => {
  await openFixture(page); const trigger = page.getByRole('button', { name: 'Popover trigger' }); await trigger.click();
  await expect(page.getByRole('button', { name: 'Close information' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Information', exact: true })).toBeHidden(); await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Modal trigger' }).click(); await expect(page.getByRole('button', { name: 'First modal' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'Last modal' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'First modal' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Modal trigger' })).toBeFocused();
});
test('focus helpers exclude disabled, hidden and inert controls and wrap Tab', async ({ page }) => {
  await openFixture(page); await page.getByRole('button', { name: 'Count focusable' }).click(); await expect(page.getByTestId('focus-count')).toHaveText('2');
  const first = page.getByRole('button', { name: 'Focus first' }); const last = page.getByRole('button', { name: 'Focus last' });
  await first.focus(); await page.keyboard.press('Shift+Tab'); await expect(last).toBeFocused(); await page.keyboard.press('Tab'); await expect(first).toBeFocused();
});
test('Prose intercepts ordinary internal links and preserves modified/download navigation', async ({ page }) => {
  await openFixture(page); await page.getByRole('link', { name: 'Internal link', exact: true }).click(); await expect(page.getByTestId('links')).toHaveText('1');
  for (const [name, modifiers] of [['Internal link', { ctrlKey: true }], ['Download', {}], ['External link', {}]] as const) {
    const prevented = await page.getByRole('link', { name, exact: true }).evaluate((anchor, options) => {
      let handled = false;
      // Observe React's decision before suppressing native navigation in this test.
      document.addEventListener('click', event => { handled = event.defaultPrevented; event.preventDefault(); }, { once: true });
      anchor.dispatchEvent(new MouseEvent('click', { ...options, button: 0, bubbles: true, cancelable: true }));
      return handled;
    }, modifiers);
    expect(prevented).toBe(false);
    await expect(page.getByTestId('links')).toHaveText('1');
  }
});
test('initial data matches the key; failed network data retries without duplicate requests', async ({ page }) => {
  let requests = 0;
  await page.route('**/__ui-data.json', route => { requests++; return route.fulfill({ status: requests === 1 ? 503 : 200, contentType: 'application/json', body: '{"title":"Fetched data"}' }); });
  await openFixture(page); expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Retry data' }).click(); await expect(page.getByTestId('app-data')).toContainText('503');
  await page.getByRole('button', { name: 'Retry data' }).click(); await expect(page.getByTestId('app-data')).toHaveText('Fetched data'); expect(requests).toBe(2);
});
test('reduced motion suppresses spatial overlays and skeleton shimmer; axe passes', async ({ page }) => {
  await openFixture(page); await page.getByRole('button', { name: 'Menu trigger' }).click();
  expect(await page.getByRole('menu', { name: 'Actions menu' }).evaluate(element => element.getAnimations().flatMap(animation => (animation.effect as KeyframeEffect).getKeyframes()).some(frame => 'transform' in frame))).toBe(false);
  expect(await page.locator('.os-skeleton-part').first().evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  const result = await new AxeBuilder({ page }).analyze(); expect(result.violations).toEqual([]);
});
test('focus rings and overlay motion follow system preference and live Settings overrides', async ({ page }) => {
  await openFixture(page);
  const trigger = page.getByRole('button', { name: 'Menu trigger' });
  await trigger.focus(); expect(await trigger.evaluate(element => getComputedStyle(element).outlineWidth)).toBe('2px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => delete document.documentElement.dataset.motion);
  await trigger.click();
  expect(await page.getByRole('menu', { name: 'Actions menu' }).evaluate(element => element.getAnimations().flatMap(animation => (animation.effect as KeyframeEffect).getKeyframes()).some(frame => 'transform' in frame))).toBe(false);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.documentElement.dataset.motion = 'full'; });
  await trigger.click();
  // Live reduction completes an in-progress spatial transition and removes its transform.
  await page.evaluate(() => { document.documentElement.dataset.motion = 'reduce'; });
  await expect(page.getByRole('menu', { name: 'Actions menu' })).toHaveCSS('transform', 'none');
});
test('light and dark accents pass axe with active chips and overlay roles', async ({ page }) => {
  await openFixture(page); await page.getByRole('button', { name: 'Active chip' }).click();
  await page.getByRole('button', { name: 'Menu trigger' }).click();
  for (const theme of ['light', 'dark']) {
    for (const accent of ['thambili', 'lagoon', 'lotus', 'tea']) {
      await page.evaluate(({ theme, accent }) => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = accent; }, { theme, accent });
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.failureSummary) })), `${theme}/${accent}`).toEqual([]);
    }
  }
});
