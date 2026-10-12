import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const dock = (page: Page) => page.locator('.os-dock:visible');
const link = (page: Page, name: string) => dock(page).getByRole('link', { name, exact: true });
const artifacts = resolve('.astro/k5-artifacts/screenshots');
const frames = (page: Page) => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const translate = (page: Page) => link(page, 'Projects').evaluate(element => getComputedStyle(element).translate);
async function ready(page: Page) {
  const health = page.waitForResponse(response => response.url().endsWith('/api/health'));
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await (await health).finished();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'desktop');
  await frames(page);
}

let consoleErrors: string[];
test.beforeEach(async ({ page }) => {
  // Exercise desktop chrome in each engine; phone shells have separate coverage.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('serendib:booted', 'true'));
  consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
});
test.afterEach(({}, info) => { if (info.expectedStatus !== 'skipped') expect(consoleErrors).toEqual([]); });

test('launcher geometry, order, flat tiles and secure external links match the static replacement', async ({ page }) => {
  await ready(page);
  const rect = await dock(page).boundingBox();
  expect(rect!.height).toBeCloseTo(60, 0);
  expect(rect!.y + rect!.height).toBeCloseTo(888, 0);
  expect(rect!.x + rect!.width / 2).toBeCloseTo(720, 0);
  await expect(dock(page).getByRole('toolbar', { name: 'Apps' })).toBeVisible();
  const items = dock(page).locator('[data-dock-item]'); await expect(items).toHaveCount(13);
  expect(await items.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')))).toEqual([
    'Projects', 'About', 'Writing', 'Messages', 'Terminal', 'Island', 'Activity', 'CV', 'Settings', 'GitHub', 'LinkedIn', 'Prabhava Labs', 'Kooda',
  ]);
  expect(await items.evaluateAll(elements => elements.map(element => {
    const css = getComputedStyle(element); return [css.width, css.height, css.borderRadius, css.borderTopWidth];
  }))).toEqual(Array(13).fill(['40px', '40px', '11px', '2px']));
  expect(await dock(page).locator('.dock-divider').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(); return [rect.width, rect.height];
  }))).toEqual([[2, 30], [2, 30]]);
  const externals = dock(page).locator('a[target="_blank"]'); await expect(externals).toHaveCount(3);
  for (const external of await externals.all()) await expect(external).toHaveAttribute('rel', 'noopener');
  expect(readdirSync('dist/client/_astro').filter(file => /dock-magnification|magnify[.]/.test(file))).toEqual([]);
});

test('static-to-island launcher replacement preserves all bounds and produces zero CLS', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/Desktop.*.js', async route => { await hold; await route.continue(); });
  await page.addInitScript(() => {
    const supported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');
    Object.assign(window, { dockCls: supported ? 0 : null });
    if (!supported) return;
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { dockCls: number }).dockCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  const bounds = (selector: string) => page.locator(selector).evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' }); await frames(page);
    const before = await bounds('body > .static-dock, body > .static-dock [data-dock-item]');
    release(); await expect(page.locator('html')).toHaveClass(/os-ready/);
    expect(await bounds('.os-dock:visible, .os-dock:visible [data-dock-item]')).toEqual(before);
    await page.evaluate(() => document.fonts.ready); await frames(page);
    const cls = await page.evaluate(() => (window as unknown as { dockCls: number | null }).dockCls);
    if (cls === null) test.info().annotations.push({ type: 'CLS', description: 'Layout-shift API unavailable; exact replacement bounds verified.' });
    else { expect(cls).toBe(0); test.info().annotations.push({ type: 'CLS', description: String(cls) }); }
  } finally { release(); }
});

test('Projects hops within 400 ms without changing tile or launcher width', async ({ page }) => {
  await ready(page); test.skip(!await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), 'Hover hop is for fine pointers.');
  const before = await dock(page).boundingBox();
  await link(page, 'Projects').evaluate(element => {
    element.addEventListener('pointerenter', () => {
      const started = performance.now();
      const sample = () => {
        if (parseFloat(getComputedStyle(element).translate.split(' ')[1] ?? '0') < 0) Object.assign(window, { launcherHopMs: performance.now() - started });
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, { once: true });
  });
  await link(page, 'Projects').hover();
  await expect.poll(() => page.evaluate(() => (window as unknown as { launcherHopMs?: number }).launcherHopMs)).toBeDefined();
  const elapsed = await page.evaluate(() => (window as unknown as { launcherHopMs: number }).launcherHopMs);
  expect(elapsed).toBeLessThanOrEqual(400);
  test.info().annotations.push({ type: 'launcher-hop-ms', description: String(elapsed) });
  await expect.poll(() => translate(page)).toBe('0px -7px');
  expect(await link(page, 'Projects').evaluate(element => getComputedStyle(element).width)).toBe('40px');
  expect(await dock(page).boundingBox()).toEqual(before);
  expect(await link(page, 'Projects').evaluate(element => getComputedStyle(element).rotate)).toBe('-6deg');
  await page.mouse.move(0, 0); await expect.poll(() => translate(page)).toBe('none');
});

test('reduced motion disables the hop and bounce, preserving instant focus tooltips and the running blink', async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate; Object.assign(window, { dockBlinks: [] });
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains('os-dock-indicator')) (window as unknown as { dockBlinks: unknown[] }).dockBlinks.push({ frames, options });
      return animate.call(this, frames, options);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page);
  await expect(dock(page)).toHaveAttribute('data-reduced-motion', 'true');
  await link(page, 'Projects').focus(); await expect(link(page, 'Projects').getByRole('tooltip')).toBeVisible();
  await link(page, 'Projects').hover(); expect(await translate(page)).toBe('none');
  expect(await link(page, 'Projects').evaluate(element => getComputedStyle(element).rotate)).toBe('none');
  await link(page, 'Terminal').dispatchEvent('click', { button: 0 });
  await expect(page.getByRole('dialog', { name: 'Terminal', exact: true })).toBeVisible();
  expect(await link(page, 'Terminal').locator('svg').evaluate(element => element.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { dockBlinks: unknown[] }).dockBlinks)).toEqual([
    { frames: [{ opacity: .7 }, { opacity: .2 }, { opacity: .7 }], options: { duration: 120 } },
  ]);
});

test('motion preferences update live and full motion overrides system reduction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('serendib:motion', '"full"')); await ready(page);
  await expect(dock(page)).toHaveAttribute('data-reduced-motion', 'false');
  await link(page, 'Projects').hover();
  if (await page.evaluate(() => matchMedia('(pointer: fine)').matches)) await expect.poll(() => translate(page)).toBe('0px -7px');
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'serendib:motion', newValue: '"reduce"', storageArea: localStorage })));
  await expect(dock(page)).toHaveAttribute('data-reduced-motion', 'true'); expect(await translate(page)).toBe('none');
});

test('coarse pointers retain the resting tile without a hop', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  try {
    await context.addInitScript(() => localStorage.setItem('serendib:booted', 'true'));
    const page = await context.newPage(); await page.goto(baseURL!); await expect(page.locator('html')).toHaveClass(/os-ready/);
    await link(page, 'Projects').hover(); expect(await translate(page)).toBe('none');
    expect(await link(page, 'Projects').evaluate(element => getComputedStyle(element).width)).toBe('40px');
  } finally { await context.close(); }
});

test('single-window clicks minimise and restore without resetting a deep route', async ({ page }) => {
  await page.goto('/projects/salli'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const projects = link(page, 'Projects'); const window = page.locator('[data-window-id="projects"]');
  await expect(projects).toHaveAttribute('aria-current', 'page'); await projects.click();
  await expect(window).toBeHidden(); await expect(projects.locator('.os-dock-indicator')).toHaveAttribute('data-minimized', 'true');
  await expect(projects).toHaveAccessibleDescription(/Minimised/);
  await projects.click(); await expect(window).toBeVisible(); await expect(page).toHaveURL(/\/projects\/salli$/);
  await expect(projects).toHaveAccessibleDescription(/Running/);
});

test('Terminal shows a running dot, Option-click creates Terminal 2, and clicks cycle instances', async ({ page }) => {
  await ready(page); const terminal = link(page, 'Terminal'); await terminal.click();
  await expect(terminal.locator('.os-dock-indicator')).toBeVisible(); await expect(terminal).toHaveAccessibleDescription(/Running/);
  await terminal.click({ modifiers: ['Alt'] }); await expect(page.getByRole('dialog', { name: 'Terminal 2', exact: true })).toBeVisible();
  await expect(page.locator('[data-window-id]')).toHaveCount(2);
  await terminal.click(); await expect(page.locator('[data-window-id="terminal"]')).toHaveAttribute('data-focused', 'true');
  expect(await page.locator('[data-window-id="terminal"]').evaluate(el => +getComputedStyle(el).zIndex)).toBeGreaterThan(await page.locator('[data-window-id="terminal~2"]').evaluate(el => +getComputedStyle(el).zIndex));
  await page.keyboard.press('Alt+KeyM'); await page.keyboard.press('Alt+KeyM');
  await expect(terminal.locator('.os-dock-indicator')).toHaveAttribute('data-minimized', 'true');
  await expect(terminal).toHaveAccessibleDescription(/Minimised/);
  await terminal.click(); await expect(terminal.locator('.os-dock-indicator')).toHaveAttribute('data-minimized', 'false');
});

test('loading bounce is cancelled on ready and capped at three while loading is held', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/TerminalApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await ready(page);
    // Dispatch before hover or focus can prefetch the chunk.
    await link(page, 'Terminal').dispatchEvent('click', { button: 0 });
    await expect(link(page, 'Terminal')).toHaveAttribute('data-bouncing', '');
    const timing = await link(page, 'Terminal').locator('svg').evaluate(element => element.getAnimations()[0]!.effect!.getTiming());
    expect(timing.duration).toBe(450); expect(timing.iterations).toBe(3);
    await expect(link(page, 'Terminal')).not.toHaveAttribute('data-bouncing', { timeout: 2500 });
    await expect(page.getByText('Loading…', { exact: true })).toBeVisible();
    release(); await expect(page.getByRole('dialog', { name: 'Terminal', exact: true })).toBeVisible();
  } finally { release(); }
});

test('an already prefetched app does not bounce on launch', async ({ page }) => {
  await ready(page);
  const response = page.waitForResponse(response => /TerminalApp\..*\.js/.test(response.url()) && response.ok());
  await link(page, 'Terminal').focus(); await response;
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await link(page, 'Terminal').click();
  await expect(page.getByRole('dialog', { name: 'Terminal', exact: true })).toBeVisible();
  await expect(link(page, 'Terminal')).not.toHaveAttribute('data-bouncing');
  expect(await link(page, 'Terminal').locator('svg').evaluate(element => element.getAnimations().length)).toBe(0);
});

test('bounce stops immediately when a held module becomes ready', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/TerminalApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await ready(page); await link(page, 'Terminal').dispatchEvent('click', { button: 0 });
    await expect(link(page, 'Terminal')).toHaveAttribute('data-bouncing', '');
    release(); await expect(link(page, 'Terminal')).not.toHaveAttribute('data-bouncing');
    expect(await link(page, 'Terminal').locator('svg').evaluate(element => element.getAnimations().length)).toBe(0);
  } finally { release(); }
});

test('external links have secure native targets, a hover badge and Option-copy', async ({ page }) => {
  await ready(page);
  const externals = dock(page).locator('a[target="_blank"]'); await expect(externals).toHaveCount(3);
  for (const external of await externals.all()) await expect(external).toHaveAttribute('rel', /(?:^|\s)noopener(?:\s|$)/);
  const github = link(page, 'GitHub'); await github.hover(); await expect(github.locator('.os-dock-external')).toBeVisible();
  expect(await github.locator('.os-dock-external').evaluate(element => {
    const css = getComputedStyle(element); return [css.width, css.height];
  })).toEqual(['9px', '9px']);
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => Object.assign(window, { dockCopied: value }) } }); });
  await github.click({ modifiers: ['Alt'] });
  expect(await page.evaluate(() => (window as unknown as { dockCopied: string }).dockCopied)).toBe('https://github.com/theetaz');
  await expect(page).toHaveURL(/\/$/);
});

test('middle-click and platform-modified click retain native browser navigation', async ({ page, context, browserName }) => {
  await ready(page);
  for (const options of [{ button: 'middle' as const }, { modifiers: ['ControlOrMeta' as const] }]) {
    // Playwright's WebKit follows middle-click anchors in the current tab,
    // including on a plain HTML control page. Assert that native navigation.
    if (browserName === 'webkit' && 'button' in options) {
      await page.evaluate(() => Object.assign(window, { nativeNavigationMarker: true }));
      const health = page.waitForResponse(response => response.url().endsWith('/api/health'));
      await link(page, 'Terminal').click(options); await expect(page).toHaveURL(/\/terminal$/);
      await (await health).finished();
      expect(await page.evaluate(() => 'nativeNavigationMarker' in window)).toBe(false);
      await ready(page);
      continue;
    }
    const popup = context.waitForEvent('page'); await link(page, 'Terminal').click(options); const opened = await popup;
    try { await expect(opened).toHaveURL(/\/terminal$/); await expect(page.locator('[data-window-id]')).toHaveCount(0); }
    finally { await opened.close(); }
  }
});

test('roving focus supports arrows, wrap, Home, End, typeahead and Enter', async ({ page }) => {
  await ready(page); const projects = link(page, 'Projects'); await projects.focus();
  await page.keyboard.press('ArrowRight'); await expect(link(page, 'About')).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(projects).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(link(page, 'Kooda')).toBeFocused();
  await page.keyboard.press('Home'); await expect(projects).toBeFocused();
  await page.keyboard.press('End'); await expect(link(page, 'Kooda')).toBeFocused();
  await page.keyboard.press('t'); await expect(link(page, 'Terminal')).toBeFocused();
  await expect(dock(page).locator('[data-dock-item][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Enter'); await expect(page.getByRole('dialog', { name: 'Terminal', exact: true })).toBeVisible();
});

test('tooltips show on focus, dismiss on Escape, and right-click and Shift+F10 use the context API', async ({ page }) => {
  await ready(page); const projects = link(page, 'Projects'); await projects.focus();
  await expect(projects.getByRole('tooltip')).toBeVisible(); await page.keyboard.press('Escape'); await expect(projects.getByRole('tooltip')).toBeHidden();
  await page.evaluate(() => {
    Object.assign(window, { dockContextEvents: [] });
    document.addEventListener('contextmenu', event => (window as unknown as { dockContextEvents: boolean[] }).dockContextEvents.push(event.defaultPrevented));
  });
  await projects.click({ button: 'right' }); await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toBeHidden(); await expect(projects).toBeFocused();
  await page.keyboard.press('Shift+F10');
  expect(await page.evaluate(() => (window as unknown as { dockContextEvents: boolean[] }).dockContextEvents)).toEqual([true, true]);
});

test('dock links still navigate with JavaScript disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage(); await page.goto(baseURL!);
    const nav = page.getByRole('navigation', { name: 'Dock', exact: true }); await expect(nav.getByRole('link')).toHaveCount(13);
    await nav.getByRole('link', { name: 'Projects', exact: true }).click(); await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator('#static-window')).toBeVisible();
  } finally { await context.close(); }
});

test('light, dark, hover, running and minimised launcher states pass axe and retain opaque material @visual @a11y', async ({ page }, info) => {
  mkdirSync(artifacts, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme }); await ready(page); await page.mouse.move(0, 0);
    await page.evaluate(() => document.fonts.ready); await frames(page);
    expect(await dock(page).locator('ul').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(theme === 'light' ? 'rgb(255, 247, 232)' : 'rgb(36, 28, 61)');
    expect(await dock(page).locator('ul').evaluate(element => getComputedStyle(element).backdropFilter)).toBe('none');
    const result = await new AxeBuilder({ page }).include('.os-dock').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations).toEqual([]);
    if (info.project.name === 'chromium') await page.screenshot({ path: resolve(artifacts, `launcher-${theme}-1440x900.png`) });
  }
  await page.emulateMedia({ colorScheme: 'light' }); await ready(page);
  await link(page, 'Projects').hover();
  if (await page.evaluate(() => matchMedia('(pointer: fine)').matches)) await expect.poll(() => translate(page)).toBe('0px -7px');
  if (info.project.name === 'chromium') await page.screenshot({ path: resolve(artifacts, 'launcher-hover-1440x900.png') });
  await link(page, 'Terminal').click(); await page.mouse.move(0, 0);
  await expect(page.getByRole('dialog', { name: 'Terminal', exact: true })).toBeVisible();
  await expect(link(page, 'Terminal')).not.toHaveAttribute('data-bouncing');
  if (info.project.name === 'chromium') await page.screenshot({ path: resolve(artifacts, 'launcher-running-1440x900.png') });
  await link(page, 'Terminal').click(); await page.mouse.move(0, 0);
  await expect(link(page, 'Terminal').locator('.os-dock-indicator')).toHaveAttribute('data-minimized', 'true');
  if (info.project.name === 'chromium') await page.screenshot({ path: resolve(artifacts, 'launcher-minimised-1440x900.png') });
  await page.evaluate(() => document.documentElement.dataset.transparency = 'reduce');
  expect(await dock(page).locator('ul').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 247, 232)');
  await page.emulateMedia({ forcedColors: 'active' });
  if (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) {
    expect(await dock(page).locator('ul').evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('1px');
    await page.keyboard.press('Tab'); await link(page, 'Projects').focus();
    expect(await link(page, 'Projects').evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  }
});

test('the complete 21-symbol sheet renders at 16, 40 and 60 pixels @visual', async ({ page }, info) => {
  await ready(page); mkdirSync(artifacts, { recursive: true });
  for (const size of [16, 40, 60]) {
    await page.evaluate(size => {
      document.getElementById('k5-icon-sheet')?.remove();
      const sheet = document.createElement('section'); sheet.id = 'k5-icon-sheet'; sheet.setAttribute('aria-label', 'App icon sheet');
      Object.assign(sheet.style, { position: 'fixed', zIndex: '120', inset: '40px 40px auto', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '20px', padding: '24px', background: '#FFF7E8', color: '#1B1530' });
      for (const symbol of document.querySelectorAll('symbol[id^="app-"], symbol[id^="folder-"], symbol[id="doc-cv"], symbol[id^="link-"]')) {
        const cell = document.createElement('div'); cell.style.textAlign = 'center';
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 64 64'); icon.setAttribute('width', String(size)); icon.setAttribute('height', String(size));
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#' + symbol.id); icon.append(use);
        const label = document.createElement('p'); label.textContent = symbol.id; label.style.font = '12px var(--font-ui)'; cell.append(icon, label); sheet.append(cell);
      }
      document.body.append(sheet);
    }, size);
    await page.evaluate(() => document.fonts.ready); await frames(page);
    await expect(page.locator('#k5-icon-sheet svg')).toHaveCount(21);
    if (info.project.name === 'chromium') await page.locator('#k5-icon-sheet').screenshot({ path: resolve(artifacts, `icons-${size}px.png`) });
  }
});
