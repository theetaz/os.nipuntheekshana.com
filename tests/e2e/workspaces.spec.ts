import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// Workspaces are desktop controls; exercise their geometry in each browser engine.
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const group = (page: Page) => page.getByRole('navigation', { name: 'Workspaces', exact: true });
const dot = (page: Page, number: number) => group(page).getByRole('button', { name: new RegExp(`^Workspace ${number}:`) });
async function ready(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await expect(dot(page, 1)).toHaveAttribute('aria-current', 'true');
}
async function runtime(page: Page) {
  await expect(group(page)).toHaveAttribute('data-workspaces-ready', 'true');
  await dot(page, 1).focus(); await page.keyboard.press('3');
  await expect(dot(page, 3)).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Home'); await expect(dot(page, 1)).toHaveAttribute('aria-current', 'true');
}
async function target(page: Page, id: string, number: number) {
  await expect.poll(() => page.locator(`#${id}`).evaluate(node => Math.round(node.getBoundingClientRect().top))).toBeGreaterThanOrEqual(36);
  await expect.poll(() => page.locator(`#${id}`).evaluate(node => Math.round(node.getBoundingClientRect().top))).toBeLessThanOrEqual(44);
  await expect(dot(page, number)).toHaveAttribute('aria-current', 'true');
}

test('five workspace dots are centred and modules have the specified border and hard shadow', async ({ page }) => {
  await ready(page); await expect(group(page).getByRole('button')).toHaveCount(5);
  const box = (await group(page).boundingBox())!; expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThanOrEqual(2);
  const modules = await page.locator('.mb-bar .mb-module').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node); return { height: node.getBoundingClientRect().height, border: style.borderTopWidth, shadow: style.boxShadow };
  }));
  expect(modules).toHaveLength(6);
  for (const module of modules) { expect(module.height).toBe(26); expect(module.border).toBe('2px'); expect(module.shadow).toMatch(/2px 2px 0px/); }
  await runtime(page); await dot(page, 4).click(); await target(page, 'ws-projects', 4);
  await page.evaluate(() => document.getElementById('ws-work')!.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await target(page, 'ws-work', 3);
});

for (const platform of ['Linux x86_64', 'MacIntel']) test(`${platform} workspace shortcuts leave browser shortcuts and editable fields alone`, async ({ page }) => {
  await page.addInitScript(platform => {
    Object.defineProperty(navigator, 'userAgentData', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
  }, platform);
  await ready(page); await runtime(page); await page.locator('.mb-bar .simple-entry').focus();
  await page.keyboard.press(platform === 'MacIntel' ? 'Control+5' : 'Meta+3');
  await target(page, platform === 'MacIntel' ? 'ws-board' : 'ws-work', platform === 'MacIntel' ? 5 : 3);
  const prevented = await page.evaluate(platform => {
    const event = new KeyboardEvent('keydown', { code: 'Digit2', key: '2', bubbles: true, cancelable: true, metaKey: platform === 'MacIntel', ctrlKey: platform !== 'MacIntel' });
    document.body.dispatchEvent(event); return event.defaultPrevented;
  }, platform);
  expect(prevented).toBe(false);
  expect(await page.evaluate(platform => {
    const input = document.createElement('input'); document.body.append(input); input.focus();
    const event = new KeyboardEvent('keydown', { code: 'Digit1', key: '1', bubbles: true, cancelable: true, metaKey: platform !== 'MacIntel', ctrlKey: platform === 'MacIntel' });
    input.dispatchEvent(event); input.remove(); return event.defaultPrevented;
  }, platform)).toBe(false);
});

test('workspace digits, arrows, Home, End, Enter and Space rove with instant reduced-motion jumps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page); await runtime(page);
  await page.evaluate(() => {
    const native = Element.prototype.scrollIntoView;
    Object.assign(window, { workspaceScroll: [] });
    Element.prototype.scrollIntoView = function(options) {
      (window as unknown as { workspaceScroll: unknown[] }).workspaceScroll.push(options); native.call(this, options);
    };
  });
  await dot(page, 1).focus(); await page.keyboard.press('3'); await expect(dot(page, 3)).toBeFocused(); await target(page, 'ws-work', 3);
  await page.keyboard.press('ArrowRight'); await expect(dot(page, 4)).toBeFocused();
  await page.keyboard.press('End'); await expect(dot(page, 5)).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(dot(page, 1)).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(dot(page, 5)).toBeFocused();
  await page.keyboard.press('Home'); await expect(dot(page, 1)).toBeFocused();
  await page.keyboard.press('Enter'); await page.keyboard.press('Space');
  await expect(group(page).locator('[tabindex="0"]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { workspaceScroll: { behavior: string }[] }).workspaceScroll.every(options => options.behavior === 'auto'))).toBe(true);
  await dot(page, 4).click(); await target(page, 'ws-projects', 4);
  expect(await dot(page, 4).locator('span').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});

test('workspace runtime disposal stops group keyboard handling', async ({ page }) => {
  await ready(page); await runtime(page);
  expect(await page.evaluate(async () => {
    const original = document.querySelector<HTMLElement>('nav[aria-label="Workspaces"]')!;
    original.setAttribute('aria-label', 'Original workspaces');
    const clone = original.cloneNode(true) as HTMLElement; clone.setAttribute('aria-label', 'Workspaces'); document.body.append(clone);
    const url = performance.getEntriesByType('resource').find(entry => /story-workspaces\.[^/]+\.js/.test(entry.name))!.name;
    const module = await import(url); const clean = module.start(document.getElementById('story'));
    const button = clone.querySelector<HTMLButtonElement>('button')!; button.focus();
    const before = new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true });
    button.dispatchEvent(before); clean(); button.focus();
    const after = new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true, cancelable: true });
    button.dispatchEvent(after); clone.remove(); original.setAttribute('aria-label', 'Workspaces');
    return { before: before.defaultPrevented, after: after.defaultPrevented };
  })).toEqual({ before: true, after: false });
});

test('workspace controls reconnect after changing between desktop and phone widths', async ({ page }) => {
  await ready(page); await runtime(page);
  await page.setViewportSize({ width: 390, height: 844 }); await expect(group(page)).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 }); await expect(group(page)).toHaveAttribute('data-workspaces-ready', 'true');
  await dot(page, 1).focus(); await page.keyboard.press('4'); await target(page, 'ws-projects', 4);
});

test('top bar fits at 1100 and 1440 in both themes, with zero CLS and accessible modules @visual', async ({ browser }, info) => {
  const directory = resolve('.astro/k4-artifacts/screenshots'); await mkdir(directory, { recursive: true });
  for (const theme of ['light', 'dark'] as const) for (const width of [1440, 1100]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', isMobile: false, hasTouch: false });
    await context.addInitScript(() => {
      localStorage.setItem('serendib:booted', 'true');
      const supported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');
      Object.assign(window, { k4CLS: supported ? 0 : null });
      if (supported) new PerformanceObserver(list => { for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as unknown as { k4CLS: number }).k4CLS += shift.value;
      } }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${info.project.use.baseURL ?? process.env.BASE_URL}/`); await expect(page.locator('html')).toHaveClass(/os-ready/);
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
    const workspace = (await group(page).boundingBox())!; const menus = (await page.locator('.mb-nav').boundingBox())!;
    if (width === 1100) { expect(workspace.x).toBeGreaterThanOrEqual(menus.x + menus.width); expect(await group(page).evaluate(node => getComputedStyle(node).position)).toBe('static'); }
    expect((await page.locator('.mb-status').boundingBox())!.x).toBeGreaterThanOrEqual(workspace.x + workspace.width);
    expect((await new AxeBuilder({ page }).include('.mb-bar').analyze()).violations).toEqual([]);
    const cls = await page.evaluate(() => (window as unknown as { k4CLS: number | null }).k4CLS);
    if (cls !== null) expect(cls).toBe(0);
    else console.log(`${info.project.name}: layout-shift observation unavailable; geometry and accessibility checked`);
    expect(errors).toEqual([]);
    await page.screenshot({ path: resolve(directory, `topbar-${theme}-${width}-${info.project.name}.png`) }); await context.close();
  }
});
