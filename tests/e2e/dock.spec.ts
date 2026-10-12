import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

const dock = (page: Page) => page.locator('.os-dock:visible');
const link = (page: Page, name: string) => dock(page).getByRole('link', { name, exact: true });
async function ready(page: Page) {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  test.skip(await page.locator('html').getAttribute('data-mode') === 'mobile', 'Desktop Dock magnification and window controls are desktop-only.');
  await expect(page.locator('[data-shell="mobile"]')).toHaveCount(0);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
}
async function width(page: Page, name: string) { return link(page, name).evaluate(element => element.getBoundingClientRect().width); }

let consoleErrors: string[];
test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
});
test.afterEach(({}, info) => { if (info.expectedStatus !== 'skipped') expect(consoleErrors).toEqual([]); });

test('the first revealed Dock retains pointer intent while its controller loads', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(done => { release = done; });
  await page.route('**/dock-magnification.*.js', async route => { await held; await route.continue(); });
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const nav = document.querySelector<HTMLElement>('.os-dock'); const icon = nav?.querySelector<HTMLElement>('[data-dock-app="projects"]');
      if (!nav || !icon || !document.documentElement.classList.contains('os-ready')) return;
      observer.disconnect(); const rect = icon.getBoundingClientRect();
      nav.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
      Object.assign(window, { earlyDockHover: true });
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  });
  try {
    await ready(page); await expect.poll(() => page.evaluate(() => (window as unknown as { earlyDockHover?: boolean }).earlyDockHover)).toBe(true);
    expect(await width(page, 'Projects')).toBe(48); release();
    await expect.poll(() => width(page, 'Projects')).toBeGreaterThanOrEqual(71);
  } finally { release(); }
});

test('resting dock exactly replaces the static dock with zero hydration CLS', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/Desktop.*.js', async route => { await hold; await route.continue(); });
  await page.addInitScript(() => {
    Object.assign(window, { dockCls: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { dockCls: number }).dockCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const before = await page.locator('body > .static-dock').boundingBox();
    const icons = await page.locator('body > .static-dock a').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
    release(); await expect(page.locator('html')).toHaveClass(/os-ready/);
    const after = await dock(page).boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(after![key]).toBe(before![key]);
    expect(after!.height).toBe(64); expect(after!.y + after!.height).toBe(890);
    expect(await dock(page).locator('[data-dock-item]').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }))).toEqual(icons);
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
    expect(await page.evaluate(() => (window as unknown as { dockCls: number }).dockCls)).toBe(0);
    const projects = await link(page, 'Projects').boundingBox();
    await page.mouse.move(projects!.x + 24, projects!.y + 24);
    // Default polling backs off past the deadline; sample the spring each frame.
    await expect.poll(() => width(page, 'Projects'), { timeout: 500, intervals: [16] }).toBeGreaterThanOrEqual(71);
  } finally { release(); }
});

test('magnifies to 72 px within 500 ms without React commits and settles on leave', async ({ page }) => {
  await page.addInitScript(() => {
    type Fiber = { memoizedProps?: Record<string, unknown>; child?: Fiber; sibling?: Fiber };
    const state = { commits: 0 }; let previous: Record<string, unknown> | undefined;
    const dockProps = (fiber: Fiber | undefined): Record<string, unknown> | undefined => {
      if (!fiber) return;
      if (fiber.memoizedProps?.['data-dock-mode'] === 'desktop') return fiber.memoizedProps;
      return dockProps(fiber.child) ?? dockProps(fiber.sibling);
    };
    Object.assign(window, { dockReact: state, __REACT_DEVTOOLS_GLOBAL_HOOK__: {
      supportsFiber: true, inject: () => 1,
      onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
        // LazyMotion and the clock can commit elsewhere; magnification must never render Dock.
        const props = dockProps(root.current);
        if (props && props !== previous) state.commits++;
        previous = props;
      }, onCommitFiberUnmount: () => {},
    } });
  });
  await ready(page);
  const commits = await page.evaluate(() => (window as unknown as { dockReact: { commits: number } }).dockReact.commits);
  expect(commits).toBeGreaterThan(0);
  const box = await link(page, 'Projects').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(() => width(page, 'Projects'), { timeout: 500, intervals: [16] }).toBeGreaterThanOrEqual(71);
  expect(await width(page, 'Projects')).toBeLessThanOrEqual(73);
  expect(await page.evaluate(() => (window as unknown as { dockReact: { commits: number } }).dockReact.commits)).toBe(commits);
  const expanded = await dock(page).boundingBox(); expect(expanded!.height).toBe(64); expect(expanded!.width).toBeGreaterThan(788);
  await page.mouse.move(100, 100);
  await expect.poll(() => width(page, 'Projects')).toBe(48);
});

test('the 24 px slack above the resting dock still magnifies icons', async ({ page }) => {
  await ready(page); const box = await link(page, 'Projects').boundingBox(); const nav = await dock(page).boundingBox();
  await page.mouse.move(box!.x + 24, nav!.y - 12);
  await expect.poll(() => width(page, 'Projects')).toBeGreaterThanOrEqual(71);
});

test('magnification shifts only dock nodes and keeps windows fixed', async ({ page }) => {
  await ready(page); await link(page, 'Terminal').click();
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-window-id="terminal"]')).toBeVisible();
  await expect(page.locator('[data-window-id="terminal"]')).not.toHaveAttribute('data-transition');
  const terminal = await page.locator('[data-window-id="terminal"]').boundingBox();
  await expect.poll(async () => (await dock(page).boundingBox())!.width).toBe(788);
  await page.evaluate(() => {
    const state = { outside: [] as string[] };
    Object.assign(window, { dockShifts: state });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { sources: { node?: Node }[] };
      for (const source of shift.sources) {
        const element = source.node instanceof Element ? source.node : source.node?.parentElement;
        if (element && !element.closest('.os-dock')) state.outside.push(element.tagName);
      }
    } }).observe({ type: 'layout-shift' });
  });
  await link(page, 'Projects').hover(); await expect.poll(() => width(page, 'Projects')).toBeGreaterThanOrEqual(71);
  await link(page, 'Kooda').hover(); await page.mouse.move(0, 0); await expect.poll(async () => (await dock(page).boundingBox())!.width).toBe(788);
  expect(await page.locator('[data-window-id="terminal"]').boundingBox()).toEqual(terminal);
  expect(await page.evaluate(() => (window as unknown as { dockShifts: { outside: string[] } }).dockShifts.outside)).toEqual([]);
});

test('reduced motion disables magnification and bounce while preserving tooltips', async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Object.assign(window, { dockBlinks: [] });
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains('os-dock-indicator')) (window as unknown as { dockBlinks: unknown[] }).dockBlinks.push({ frames, options });
      return animate.call(this, frames, options);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page);
  await expect(dock(page)).toHaveAttribute('data-reduced-motion', 'true');
  await link(page, 'Projects').hover(); await expect(link(page, 'Projects').getByRole('tooltip')).toBeVisible();
  expect(await dock(page).locator('[data-dock-item]').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width))).toEqual(Array(14).fill(48));
  await link(page, 'Terminal').dispatchEvent('click', { button: 0 }); await expect(page.getByRole('dialog', { name: 'Terminal', exact: true })).toBeVisible();
  expect(await link(page, 'Terminal').locator('svg').evaluate(element => element.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { dockBlinks: unknown[] }).dockBlinks)).toEqual([
    { frames: [{ opacity: .7 }, { opacity: .2 }, { opacity: .7 }], options: { duration: 120 } },
  ]);
});

test('motion overrides respond live and force full motion over a system reduction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('serendib:motion', '"full"')); await ready(page);
  await expect(dock(page)).toHaveAttribute('data-reduced-motion', 'false');
  await link(page, 'Projects').hover(); await expect.poll(() => width(page, 'Projects')).toBeGreaterThanOrEqual(71);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'serendib:motion', newValue: '"reduce"', storageArea: localStorage })));
  await expect(dock(page)).toHaveAttribute('data-reduced-motion', 'true'); expect(await width(page, 'Projects')).toBe(48);
});

test('coarse pointers keep every icon at its resting size', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  try {
    await context.addInitScript(() => localStorage.setItem('serendib:booted', 'true'));
    const page = await context.newPage(); await page.goto(baseURL!); await expect(page.locator('html')).toHaveClass(/os-ready/);
    await link(page, 'Projects').hover(); await expect(link(page, 'Projects').getByRole('tooltip')).toBeVisible();
    expect(await width(page, 'Projects')).toBe(48);
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
      await link(page, 'Terminal').click(options); await expect(page).toHaveURL(/\/terminal$/);
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
    const nav = page.getByRole('navigation', { name: 'Dock', exact: true }); await expect(nav.getByRole('link')).toHaveCount(14);
    await nav.getByRole('link', { name: 'Projects', exact: true }).click(); await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator('#static-window')).toBeVisible();
  } finally { await context.close(); }
});

test('captures light, dark and mobile docks and checks dock accessibility @visual @a11y', async ({ page }) => {
  const artifacts = resolve('.astro/p2-6-artifacts'); mkdirSync(artifacts, { recursive: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme }); await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
      await page.mouse.move(0, 0); await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
      const result = await new AxeBuilder({ page }).include(viewport.width===390?'.phone-dock':'.os-dock').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations).toEqual([]);
      if (viewport.width === 390) await expect(page.locator('[data-shell="mobile"] .phone-dock [data-phone-icon]')).toHaveCount(4);
      await page.screenshot({ path: resolve(artifacts, `${theme}-${viewport.width}x${viewport.height}.png`) });
    }
  }
});
