import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, openApp } from './fixtures';

const app = (page: Page) => page.locator('[data-window-id="about"]');
const artifacts = resolve('.astro/p3-3-artifacts');

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  Object.assign(page, { aboutErrors: errors });
});
test.afterEach(async ({ page }, info) => {
  if (info.expectedStatus === 'skipped') return;
  expect((page as Page & { aboutErrors: string[] }).aboutErrors).toEqual([]);
});

test('Overview derives the spec sheet from the profile and opens CV', async ({ page }) => {
  await page.goto('/about');
  await expect(app(page).getByRole('heading', { name: 'Nipun Theekshana', exact: true })).toBeVisible();
  await expect(app(page).getByText('10 years, since 2016', { exact: true })).toBeVisible();
  await expect(app(page).getByText('50+ engineers', { exact: true })).toBeVisible();
  await expect(app(page).getByText('1,000+ smart contracts', { exact: true })).toBeVisible();
  await expect(app(page).getByText('0 critical security incidents', { exact: true })).toBeVisible();
  await expect(app(page).getByText('Colombo, Sri Lanka · 23:11 there', { exact: true })).toBeVisible();
  await expect(app(page).locator('[lang="si"]')).toHaveText('නිපුන් තීක්ෂණ');
  await app(page).getByRole('link', { name: 'Read the CV', exact: true }).click();
  await expect(page.locator('[data-window-id="cv"]')).toBeVisible();
  await expect(page).toHaveURL(/\/cv/);
});

test('sidebar and arrow keys select all five views with roving focus', async ({ page }) => {
  await page.goto('/about');
  const sidebar = app(page).getByRole('tablist', { name: 'About sections' });
  const overview = sidebar.getByRole('tab', { name: 'Overview', exact: true });
  await overview.focus();
  await overview.press('ArrowDown');
  await expect(sidebar.getByRole('tab', { name: 'Story', exact: true })).toBeFocused();
  await expect(app(page).getByRole('heading', { name: 'Story', exact: true })).toBeVisible();
  await expect(app(page).locator('.about-timeline li')).toHaveCount(6);
  await sidebar.getByRole('tab', { name: 'Story', exact: true }).press('ArrowDown');
  await expect(app(page).getByRole('heading', { name: 'Principles', exact: true })).toBeVisible();
  await expect(app(page).locator('.about-panel:not([hidden]) .about-card')).toHaveCount(6);
  await sidebar.getByRole('tab', { name: 'Toolbox', exact: true }).click();
  await expect(app(page).getByRole('heading', { name: 'Languages', exact: true })).toBeVisible();
  await expect(app(page).locator('.about-chips').getByText('Rust', { exact: true })).toBeVisible();
  await sidebar.getByRole('tab', { name: 'Toolbox', exact: true }).press('End');
  await expect(sidebar.getByRole('tab', { name: 'Life', exact: true })).toBeFocused();
  await expect(app(page).locator('.about-panel:not([hidden]) .about-card')).toHaveCount(6);
  await expect(app(page).getByRole('heading', { name: 'Hardware', exact: true })).toBeVisible();
  await sidebar.getByRole('tab', { name: 'Life', exact: true }).press('ArrowDown');
  await expect(overview).toBeFocused();
  await overview.press('ArrowUp');
  await expect(sidebar.getByRole('tab', { name: 'Life', exact: true })).toBeFocused();
  await sidebar.getByRole('tab', { name: 'Life', exact: true }).press('Home');
  await expect(overview).toBeFocused();
  await expect(sidebar.locator('[tabindex="0"]')).toHaveCount(1);
  await overview.press('Tab');
  await expect(app(page).getByRole('tabpanel', { name: 'Overview', exact: true })).toBeFocused();
  await app(page).getByRole('link', { name: 'More info…', exact: true }).click();
  await expect(sidebar.getByRole('tab', { name: 'Story', exact: true })).toBeFocused();
  await sidebar.getByRole('tab', { name: 'Story', exact: true }).press('Home');
  await overview.press('Tab');
  await page.keyboard.press('Tab');
  await expect(app(page).getByRole('button', { name: "Nipun Theekshana's portrait", exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const cv = app(page).getByRole('link', { name: 'Read the CV', exact: true });
  await expect(cv).toBeFocused();
  await cv.press('Enter');
  await expect(page.locator('[data-window-id="cv"]')).toBeVisible();
});

test('per-window View and File menus route commands and track the selected section', async ({ page }) => {
  await page.goto('/about');
  await expect(app(page).getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  const menubar = page.getByRole('menubar', { name: 'Application menus' });
  await menubar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Life', exact: true }).click();
  await expect(app(page).getByRole('heading', { name: 'Life', exact: true })).toBeVisible();
  await menubar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Life', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await menubar.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Read the CV', exact: true }).click();
  await expect(page.locator('[data-window-id="cv"]')).toBeVisible();
});

test('dock opening fetches the profile and computes facts rather than hardcoding them', async ({ page }) => {
  let requests = 0;
  await page.route('**/data/profile.json', async route => {
    requests++;
    const response = await route.fetch();
    const profile = await response.json();
    profile.site.careerStart = 2010;
    profile.highlights.find((value: { label: string }) => value.label === 'Engineers led').value = '77+';
    await route.fulfill({ response, json: profile });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/os-ready/);
  await openApp(page, 'About');
  await expect(app(page).getByText('16 years, since 2010', { exact: true })).toBeVisible();
  await expect(app(page).getByText('77+ engineers', { exact: true })).toBeVisible();
  expect(requests).toBe(1);
});

test('a failed profile response offers a working retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/data/profile.json', async route => {
    if (++requests === 1) await route.fulfill({ status: 200, contentType: 'application/json', body: '{invalid' });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/os-ready/);
  await openApp(page, 'About');
  await expect(app(page).getByRole('heading', { name: "About couldn't load.", exact: true })).toBeVisible();
  await app(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(app(page).getByText('50+ engineers', { exact: true })).toBeVisible();
  expect(requests).toBe(2);
});

test('the portrait emits the integration event only on seven clicks within four seconds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/about');
  const avatar = app(page).getByRole('button', { name: "Nipun Theekshana's portrait", exact: true });
  await expect(avatar).toBeVisible();
  await page.evaluate(() => {
    // Control the gesture clock so automation/host load cannot lengthen the intended four-second burst.
    Object.assign(window, { avatarEvents: [], avatarTime: performance.now() });
    Object.defineProperty(performance, 'now', { configurable: true, value: () => (window as unknown as { avatarTime: number }).avatarTime });
    document.addEventListener('about:avatar7', event => {
      (window as unknown as { avatarEvents: unknown[] }).avatarEvents.push((event as CustomEvent).detail);
    });
  });
  for (let click = 0; click < 6; click++) await avatar.click();
  expect(await page.evaluate(() => (window as unknown as { avatarEvents: unknown[] }).avatarEvents)).toEqual([]);
  await avatar.focus(); await avatar.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { avatarEvents: unknown[] }).avatarEvents)).toEqual([{ windowId: 'about' }]);
  for (let click = 0; click < 6; click++) await avatar.click();
  await page.evaluate(() => {
    (window as unknown as { avatarTime: number }).avatarTime += 4001;
  });
  await avatar.click();
  expect(await page.evaluate(() => (window as unknown as { avatarEvents: unknown[] }).avatarEvents)).toHaveLength(1);
  for (let click = 0; click < 6; click++) await avatar.click();
  expect(await page.evaluate(() => (window as unknown as { avatarEvents: unknown[] }).avatarEvents)).toHaveLength(2);
});

test('static adoption preserves headings, first paragraph, geometry, scroll and focus', async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(done => { release = done; });
  await page.route('**/AboutApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await expect(app(page)).toHaveAttribute('data-adopting', '');
    const staticWin = page.locator('#static-window');
    await page.evaluate(async () => {
      await document.fonts.load('450 32px "Fraunces"');
      await document.fonts.load('450 13px "Instrument Sans"');
    });
    const heading = await staticWin.getByRole('heading', { level: 1 }).textContent();
    const paragraph = await staticWin.locator('p:visible').first().textContent();
    const before = await staticWin.boundingBox();
    const identity = await staticWin.locator('.about-identity').boundingBox();
    await page.addStyleTag({ content: '.about-scroll::after { content: ""; display: block; height: 2000px; }' });
    await staticWin.locator('.about-scroll').evaluate(element => { (element as HTMLElement).focus({ preventScroll: true }); element.scrollTop = 123; });
    release();
    await expect(staticWin).toHaveAttribute('hidden', '');
    await expect(app(page)).not.toHaveAttribute('data-adopting');
    expect(await app(page).getByRole('heading', { level: 1 }).textContent()).toBe(heading);
    expect(await app(page).locator('p:visible').first().textContent()).toBe(paragraph);
    const after = await app(page).boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - after![key])).toBeLessThanOrEqual(1);
    expect(await app(page).locator('[data-scroll-root]').evaluate(element => element.scrollTop)).toBe(123);
    expect(await app(page).evaluate(element => element.contains(document.activeElement))).toBe(true);
    await app(page).locator('[data-scroll-root]').evaluate(element => { element.scrollTop = 0; });
    const adoptedIdentity = await app(page).locator('.about-identity').boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(identity![key] - adoptedIdentity![key])).toBeLessThanOrEqual(1);
  } finally { release(); }
});

test('without JavaScript the real content and all five section links work', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/about`);
    const staticWin = page.locator('#static-window');
    await expect(staticWin.getByText('10 years, since 2016', { exact: true })).toBeVisible();
    await expect(staticWin.getByRole('link', { name: 'Read the CV', exact: true })).toHaveAttribute('href', '/cv');
    for (const section of ['Story', 'Principles', 'Toolbox', 'Life', 'Overview']) {
      await staticWin.getByRole('navigation', { name: 'About sections' }).getByRole('link', { name: section, exact: true }).click();
      await expect(staticWin.getByRole('heading', { level: section === 'Overview' ? 1 : 2, name: section === 'Overview' ? 'Nipun Theekshana' : section, exact: true })).toBeVisible();
    }
  } finally { await context.close(); }
});

test('the static no-JS document is accessible in all five sections', async ({ page }) => {
  // Allow the audit's own JavaScript, while retaining the exact static application DOM.
  await page.route('**/about', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    await route.fulfill({ response, body: html });
  });
  await page.goto('/about');
  await expect(page.locator('html')).toHaveClass('no-js');
  await expect(app(page)).toHaveCount(0);
  for (const section of ['Overview', 'Story', 'Principles', 'Toolbox', 'Life']) {
    await page.getByRole('navigation', { name: 'About sections' }).getByRole('link', { name: section, exact: true }).click();
    const scan = await new AxeBuilder({ page }).include('#static-window').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  }
});

test('all accents and reduced transparency retain readable controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/about');
  await expect(app(page).getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const accent of ['thambili', 'lagoon', 'lotus', 'tea']) {
      await page.evaluate(value => { document.documentElement.dataset.accent = value; document.documentElement.dataset.transparency = 'reduce'; }, accent);
      const scan = await new AxeBuilder({ page }).include('[data-window-id="about"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
      expect(await app(page).locator('.about-sidebar').evaluate(element => getComputedStyle(element).backgroundColor)).not.toContain('rgba');
    }
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`all sections have accessible contrast in ${theme}, with theme artifacts @visual`, async ({ page }) => {
    mkdirSync(artifacts, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/about');
    await expect(app(page).getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: resolve(artifacts, `about-${theme}-desktop.png`) });
    for (const section of ['Overview', 'Story', 'Principles', 'Toolbox', 'Life']) {
      await app(page).getByRole('tab', { name: section, exact: true }).click();
      const scan = await new AxeBuilder({ page }).include('[data-window-id="about"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
      await page.screenshot({ path: resolve(artifacts, `about-${theme}-${section.toLowerCase()}.png`) });
    }
  });
}

test('adoption has zero CLS and narrow content fits a 390px host in both themes @visual', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Chromium supplies the layout-shift metric.');
  mkdirSync(artifacts, { recursive: true });
  await page.addInitScript(() => {
    Object.assign(window, { aboutCls: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { aboutCls: number }).aboutCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/about');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
  expect(await page.evaluate(() => (window as unknown as { aboutCls: number }).aboutCls)).toBe(0);
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    // Phase 4 will host this same content in Pocket sheets; exercise the named window container today.
    await app(page).evaluate(element => { (element as HTMLElement).style.width = '390px'; });
    await expect(app(page).getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    for (const section of ['Overview', 'Story', 'Principles', 'Toolbox', 'Life']) {
      await app(page).getByRole('tab', { name: section, exact: true }).click();
      expect(await app(page).locator('.about-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/about');
    await expect(app(page).getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: resolve(artifacts, `about-${theme}-phone.png`) });
    expect(await app(page).locator('.about-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { aboutCls: number }).aboutCls)).toBe(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/about');
    await expect(app(page).getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  }
});
