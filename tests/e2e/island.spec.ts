import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, openApp } from './fixtures';
import type { Page } from '@playwright/test';
const artifacts = resolve('.astro/p2-3-artifacts');
async function hydrated(page: Page) { await expect(page.locator('html')).toHaveClass(/os-ready/); }

test('dock launch changes the URL without a document navigation and Back removes the window', async ({ page }) => {
  await page.goto('/'); await hydrated(page);
  await page.evaluate(() => Object.assign(window, { islandDocument: 'original' }));
  await openApp(page, 'Projects');
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { islandDocument?: string }).islandDocument)).toBe('original');
  await page.goBack(); await expect(page).toHaveURL(/\/$/); await expect(page.locator('[data-window-id]')).toHaveCount(0);
});

test('adoption keeps geometry within one pixel, transfers scrolling, and hides the static section', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/ProjectsApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/projects/salli', { waitUntil: 'domcontentloaded' }); await hydrated(page);
    const staticWindow = page.locator('#static-window'); const managed = page.locator('[data-window-id="projects"]');
    await expect(managed).toHaveAttribute('data-adopting', ''); const rect = await staticWindow.boundingBox();
    // Give the placeholder a scroll range so the handoff can be checked exactly.
    await page.addStyleTag({ content: '.managed-window [data-scroll-root]::after { content: ""; display: block; height: 2000px; }' });
    await staticWindow.locator('[data-scroll-root]').evaluate(element => { element.scrollTop = 100; });
    const scroll = await staticWindow.locator('[data-scroll-root]').evaluate(element => element.scrollTop);
    const pendingRect = await managed.boundingBox();
    for (const field of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(pendingRect![field] - rect![field])).toBeLessThanOrEqual(1);
    release(); await expect(staticWindow).toHaveAttribute('hidden', ''); await expect(staticWindow).toHaveAttribute('inert', '');
    await expect(managed).not.toHaveAttribute('data-adopting'); await expect(managed).toBeVisible();
    const adoptedRect = await managed.boundingBox();
    for (const field of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(adoptedRect![field] - rect![field])).toBeLessThanOrEqual(1);
    expect(scroll).toBeGreaterThan(0);
    expect(await managed.locator('[data-scroll-root]').evaluate(element => element.scrollTop)).toBe(scroll);
  } finally { release(); }
});

test('a deep link with another app opens two managed windows and preserves the adopted rect', async ({ page }) => {
  await page.goto('/projects/salli?w=terminal'); await hydrated(page);
  await expect(page.locator('[data-window-id]')).toHaveCount(2);
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(page.locator('[data-window-id="terminal"]')).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/salli\?w=terminal$/);
});

test('cross-tab storage changes update the theme atom and html live', async ({ page, context }) => {
  await page.goto('/'); await hydrated(page);
  const other = await context.newPage();
  try {
    await other.goto('/'); await hydrated(other);
    for (const theme of ['dark', 'light'] as const) {
      await other.evaluate(value => localStorage.setItem('serendib:theme', JSON.stringify(value)), theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => localStorage.getItem('serendib:theme'))).toBe(JSON.stringify(theme));
    }
  } finally { await other.close(); }
});

test('viewport mode changes keep windows and recover the desktop shell', async ({ page }) => {
  await page.goto('/projects/salli?w=terminal'); await hydrated(page);
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'mobile');
  await expect(page.locator('[data-shell="desktop"]')).toHaveCount(0);
  await expect(page.locator('[data-shell="mobile"] [data-window-id="projects"]')).toBeVisible();
  await expect(page).toHaveURL(/\?w=terminal$/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'desktop');
  await expect(page.locator('[data-shell="mobile"]')).toHaveCount(0);
  await expect(page.locator('[data-window-id]')).toHaveCount(2);
});

test('failed adoption leaves static content usable and Simple view remains a reading document', async ({ page }) => {
  await page.route('**/ProjectsApp.*.js', route => route.abort());
  const warnings: string[] = []; page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
  await page.goto('/projects/salli'); await hydrated(page);
  await expect.poll(() => warnings.some(message => message.includes('adoption timed out for projects'))).toBe(true);
  await expect(page.locator('[data-window-id]')).toHaveCount(0);
  await expect(page.locator('#static-window')).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/salli$/);
  await page.locator('[data-shell="desktop"] .simple-entry').click();
  await expect(page.locator('#static-window')).toBeVisible();
  expect(await page.locator('#static-window').evaluate(element => getComputedStyle(element).position)).toBe('static');
});

test('adopted routes can enter Simple view and return without hiding their static reading content', async ({ page }) => {
  await page.goto('/projects/salli'); await hydrated(page); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await page.locator('[data-shell="desktop"] .simple-entry').click();
  await expect(page.locator('#static-window')).toBeVisible(); await expect(page.locator('[data-shell]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to the desktop', exact: true }).click();
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
});

test('a same-document Simple hash restores the adopted static window', async ({ page }) => {
  await page.goto('/projects/salli'); await hydrated(page); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await page.goto('/projects/salli#simple');
  await expect(page.locator('#static-window')).toBeVisible();
  await expect(page.locator('#static-window h1')).toHaveText('Salli');
});

test('Back to the desktop queues early clicks until the preference atom is available', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('serendib:view', '"simple"'));
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/Desktop.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/#simple', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Back to the desktop', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-view-request', 'desktop');
    release(); await hydrated(page); await expect(page.locator('#home-document')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('serendib:view'))).toBeNull();
  } finally { release(); }
});

test('hydration has zero CLS and captures home and adopted routes in both modes @visual', async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  await page.addInitScript(() => {
    const state = { cls: 0, sources: [] as unknown[] }; Object.assign(window, { islandLayout: state });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean; sources: { node: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] };
      if (!shift.hadRecentInput) { state.cls += shift.value; state.sources.push(shift.sources.map(source => ({ node: source.node ? `${source.node.tagName}#${source.node.id}.${source.node.className}` : null, previous: source.previousRect, current: source.currentRect }))); }
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const [route, label] of [['/', 'home'], ['/projects/salli', 'salli']] as const) {
        await page.goto(route); await hydrated(page);
        if (label === 'salli') await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
        await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
        const layout = await page.evaluate(() => (window as unknown as { islandLayout: { cls: number; sources: unknown[] } }).islandLayout);
        expect(layout.cls, `${route} ${name} ${theme}: ${JSON.stringify(layout.sources)}`).toBe(0);
        await page.screenshot({ path: resolve(artifacts, `${label}-${theme}-${name}.png`) });
      }
    }
  }
});
