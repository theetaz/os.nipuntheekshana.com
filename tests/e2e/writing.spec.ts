import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, openApp, openMenu } from './fixtures';
import { expectAccessibleSheet, expectNoHorizontalOverflow, expectTapTargets, openFromHome, phoneOnly } from './phone-sheet-checks';

const island = 'an-island-made-of-points';
const win = (page: Page) => page.locator('[data-window-id="writing"]');
const posts = (page: Page) => win(page).getByRole('list', { name: 'Posts', exact: true }).getByRole('link');
async function writing(page: Page, route = '') {
  await page.goto(`/writing${route ? `/${route}` : ''}`);
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(win(page)).not.toHaveAttribute('data-adopting');
  return win(page);
}
const isPhone = async (page: Page) => await page.locator('html').getAttribute('data-mode') === 'mobile';
/** Chooses a folder or tag. Phones reach them one level up from the list, through "‹ Folders". */
async function pick(page: Page, name: string, exact = false) {
  if (await isPhone(page)) await win(page).getByRole('button', { name: 'Folders', exact: true }).click();
  await win(page).getByRole('navigation', { name: 'Writing folders' }).getByRole('button', { name, exact }).click();
}
async function viewMenu(page: Page) {
  await openMenu(page, 'View');
  return page.getByRole('menu', { name: 'View', exact: true });
}

test('Engineering has one post and selection opens the real article @smoke', async ({ page }) => {
  const app = await writing(page); const phone = await isPhone(page);
  await expect(posts(page)).toHaveCount(2);
  if (phone) await app.getByRole('button', { name: 'Folders', exact: true }).click();
  await expect(app.getByRole('navigation', { name: 'Writing folders' }).getByRole('button', { name: 'Engineering 1' })).toBeVisible();
  await app.getByRole('button', { name: 'Engineering 1' }).click();
  await expect(posts(page)).toHaveCount(1);
  if (phone) {
    // The single column returns to the list, titled with its folder, and keeps focus there.
    await expect(app.getByRole('navigation', { name: 'Writing folders' })).toBeHidden();
    await expect(app.getByRole('heading', { level: 1 })).toHaveText('Writing · Engineering');
    await expect(app.getByRole('button', { name: 'Folders', exact: true })).toBeFocused();
  }
  await posts(page).first().click();
  await expect(page).toHaveURL(new RegExp(`/writing/${island}$`));
  await expect(app.getByRole('heading', { name: 'The outline is real, and tiny' })).toBeVisible();
  await expect(app.getByRole('heading', { level: 1 })).toHaveText('An island made of points');
  await expect(app.getByRole('heading', { level: 1 })).toBeFocused();
  if (phone) {
    await expect(app.locator('.writing-post-list')).toBeHidden();
    await app.getByRole('link', { name: 'Back to Writing', exact: true }).click();
    await expect(page).toHaveURL(/\/writing$/); await expect(posts(page)).toHaveCount(1);
  } else await expect(posts(page).first()).toHaveAttribute('aria-current', 'page');
});

test('folders, tags and search filter with honest empty states', async ({ page }) => {
  const app = await writing(page);
  await pick(page, 'Life 0');
  await expect(app.getByRole('heading', { name: 'Nothing in Life yet. Soon.' })).toBeVisible();
  await pick(page, 'Notes 1');
  await expect(posts(page)).toHaveCount(1); await expect(posts(page)).toContainText('Hello, world');
  await pick(page, 'All 2');
  await pick(page, 'meta', true);
  await expect(posts(page)).toHaveCount(1); await expect(posts(page)).toContainText('Hello, world');
  await app.getByRole('button', { name: 'Clear tag meta' }).click();
  const search = app.getByRole('searchbox', { name: 'Search writing' });
  await search.fill('WEBGL points'); await expect(posts(page)).toHaveCount(1);
  await search.fill('no-such-post'); await expect(app.getByRole('heading', { name: 'No posts match "no-such-post".' })).toBeVisible();
  await search.press('Escape'); await expect(search).toHaveValue(''); await expect(posts(page)).toHaveCount(2);
  await posts(page).first().focus(); await page.keyboard.press('End'); await expect(posts(page).last()).toBeFocused();
  await page.keyboard.press('Home'); await expect(posts(page).first()).toBeFocused();
});

test('A+ reaches 19 px, A− reaches 15 px and the local atom persists validated values', async ({ page }) => {
  const app = await writing(page, island);
  const prose = app.locator('.prose');
  await expect(prose).toHaveCSS('font-size', '17px');
  await app.getByRole('button', { name: 'Bigger text', exact: true }).click();
  await expect(prose).toHaveCSS('font-size', '19px');
  await expect(app.getByRole('button', { name: 'Bigger text', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('serendib:writing:text-size'))).toBe('19');
  await page.reload(); await expect(prose).toHaveCSS('font-size', '19px');
  await app.getByRole('button', { name: 'Smaller text', exact: true }).click();
  await app.getByRole('button', { name: 'Smaller text', exact: true }).click();
  await expect(prose).toHaveCSS('font-size', '15px');
  await expect(app.getByRole('button', { name: 'Smaller text', exact: true })).toBeDisabled();
  await page.evaluate(() => localStorage.setItem('serendib:writing:text-size', '16'));
  await page.reload(); await expect(prose).toHaveCSS('font-size', '17px');
});

test('View commands, shortcuts and checked/disabled state target Writing', async ({ page }) => {
  const app = await writing(page, island);
  await viewMenu(page); await page.getByRole('menuitem', { name: 'Bigger text', exact: true }).click();
  await expect(app.locator('.prose')).toHaveCSS('font-size', '19px');
  await viewMenu(page); await expect(page.getByRole('menuitem', { name: 'Bigger text', exact: true })).toHaveAttribute('aria-disabled', 'true');
  const folders = page.getByRole('menuitemcheckbox', { name: 'Show folders' });
  await expect(folders).toHaveAttribute('aria-checked', 'true'); await folders.click();
  await expect(page.getByRole('menu',{name:'View',exact:true})).toBeHidden();
  await expect(app.getByRole('navigation', { name: 'Writing folders' })).toBeHidden();
  const phone=await page.locator('html').getAttribute('data-mode')==='mobile';
  if(phone)await expect(app.getByRole('combobox', { name: 'Writing folder' })).toBeHidden();
  else await expect(app.getByRole('combobox', { name: 'Writing folder' })).toBeVisible();
  await viewMenu(page); await expect(folders).toHaveAttribute('aria-checked', 'false'); await folders.click();
  if(phone)await expect(app.getByRole('navigation', { name: 'Writing folders' })).toBeHidden();
  else await expect(app.getByRole('navigation', { name: 'Writing folders' })).toBeVisible();
  await app.locator('.writing-reader').focus(); await page.keyboard.press('Alt+Minus');
  await expect(app.locator('.prose')).toHaveCSS('font-size', '17px');
  await page.keyboard.press('Alt+Equal'); await expect(app.locator('.prose')).toHaveCSS('font-size', '19px');
});

test('780/560 container breakpoints and 520 px back flow preserve filters', async ({ page }) => {
  const app = await writing(page);
  // The window manager's public minimum is 600; simulate a narrower host for P4 sheets.
  const host = await page.addStyleTag({ content: '[data-window-id="writing"] { width: 760px !important; }' });
  await expect(app.getByRole('navigation', { name: 'Writing folders' })).toBeHidden();
  await app.getByRole('combobox', { name: 'Writing folder' }).selectOption('engineering');
  await expect(posts(page)).toHaveCount(1);
  await host.evaluate(node => { node.textContent = '[data-window-id="writing"] { width: 520px !important; }'; });
  await expect(app.locator('.writing-reader')).toBeHidden();
  await posts(page).first().click();
  await expect(app.locator('.writing-post-list')).toBeHidden();
  await expect(app.locator('.writing-reader')).toBeVisible();
  await expect(app.getByRole('heading', { name: 'An island made of points', exact: true })).toBeVisible();
  // Phone sheets drop the in-content link: the sheet header owns "‹ Writing".
  await app.getByRole('link', { name: await isPhone(page) ? 'Back to Writing' : 'All writing', exact: true }).click();
  await expect(page).toHaveURL(/\/writing$/); await expect(posts(page)).toHaveCount(1);
  expect(await app.locator('.writing-view').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test('reader links open app windows, external links keep a new-tab target and Copy link uses the route', async ({ page }) => {
  const app = await writing(page, 'hello-world');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { Object.assign(window, { copiedWritingLink: value }); } } }); });
  await app.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { copiedWritingLink: string }).copiedWritingLink)).toBe('https://os.nipuntheekshana.com/writing/hello-world');
  await expect(app.getByRole('link', { name: 'Open on nipuntheekshana.com ↗' })).toHaveAttribute('href', 'https://nipuntheekshana.com/writing/hello-world');
  await expect(app.getByRole('link', { name: 'Open on nipuntheekshana.com ↗' })).toHaveAttribute('target', '_blank');
  await app.locator('.prose').getByRole('link', { name: 'work page', exact: true }).click();
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  await expect(page).toHaveURL(await page.locator('html').getAttribute('data-mode')==='mobile'?/\/projects$/:/\/projects\?w=writing:hello-world$/);
  await openApp(page, 'Writing');
  await page.evaluate(() => { Object.assign(window, { openedWritingLink: null }); window.open = (url) => { Object.assign(window, { openedWritingLink: String(url) }); return null; }; });
  await app.locator('.prose').getByRole('link', { name: 'Prabhava Labs', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { openedWritingLink: string }).openedWritingLink)).toBe('https://prabhavalabs.com/');
});

test('post data failures can retry without losing the list', async ({ page }) => {
  let fail = true;
  await page.route(`**/data/writing/${island}.json`, route => fail ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
  const app = await writing(page);
  await posts(page).first().click(); await expect(app.getByRole('heading', { name: "Couldn't load this post." })).toBeVisible();
  // Phones show one column: the list waits one level up while the reader retries.
  const phone = await isPhone(page);
  if (phone) await expect(app.locator('.writing-post-list')).toBeHidden(); else await expect(posts(page)).toHaveCount(2);
  fail = false; await app.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'The outline is real, and tiny' })).toBeVisible();
  if (phone) { await app.getByRole('link', { name: 'Back to Writing', exact: true }).click(); await expect(posts(page)).toHaveCount(2); }
});

test('index data failures retry and unknown post routes are validated before fetching', async ({ page }) => {
  let fail = true; const unknownRequests: string[] = []; const errors: string[] = [];
  await page.route('**/data/writing.json', route => fail ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue());
  page.on('request', request => { if (request.url().includes('not-in-content.json')) unknownRequests.push(request.url()); });
  await page.goto('/'); await openApp(page, 'Writing');
  const app = win(page); await expect(app.getByRole('alert')).toContainText("Couldn't load writing.");
  fail = false; await app.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(posts(page)).toHaveCount(2);
  page.on('pageerror', error => errors.push(error.message));
  // A real intercepted internal link can carry an unknown, syntactically valid slug.
  await page.evaluate(() => {
    const anchor = document.createElement('a'); anchor.href = '/writing/not-in-content'; anchor.textContent = 'Missing post';
    document.querySelector('[data-window-id="writing"]')!.append(anchor);
  });
  await app.getByRole('link', { name: 'Missing post', exact: true }).click();
  await expect(app.getByRole('heading', { name: "This post isn't here." })).toBeVisible();
  expect(unknownRequests).toEqual([]); expect(errors).toEqual([]);
});

test('static adoption preserves article geometry, reader scroll and focus', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { await Promise.all([document.fonts.load('17px "Instrument Sans"'), document.fonts.load('44px "Fraunces"')]); });
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/WritingApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto(`/writing/${island}`, { waitUntil: 'domcontentloaded' });
    await expect(win(page)).toHaveAttribute('data-adopting', '');
    const staticWin = page.locator('#static-window'); const before = await staticWin.boundingBox();
    const heading = await staticWin.locator('h1').boundingBox();
    await staticWin.locator('[data-scroll-root]').evaluate(node => { (node as HTMLElement).focus(); node.scrollTop = 123; });
    release(); await expect(staticWin).toHaveAttribute('hidden', '');
    await expect(win(page)).not.toHaveAttribute('data-adopting');
    const after = await win(page).boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - after![key])).toBeLessThanOrEqual(1);
    expect(await win(page).locator('[data-scroll-root]').evaluate(node => node.scrollTop)).toBe(123);
    await win(page).locator('[data-scroll-root]').evaluate(node => { node.scrollTop = 0; });
    const adoptedHeading = await win(page).locator('h1').boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(heading![key] - adoptedHeading![key])).toBeLessThanOrEqual(1);
    expect(await win(page).evaluate(node => node.contains(document.activeElement))).toBe(true);
  } finally { release(); }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} ${viewport.width}px highlighting, accents, preferences and zero CLS @visual @a11y`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => {
        localStorage.setItem('serendib:transparency', '"reduce"');
        Object.assign(window, { writingCLS: 0, writingShifts: [] });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean;
            sources: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] };
          if (!shift.hadRecentInput) {
            const metrics = window as unknown as { writingCLS: number; writingShifts: unknown[] };
            metrics.writingCLS += shift.value; metrics.writingShifts.push({ value: shift.value, sources: shift.sources.map(source => ({
              node: (source.node instanceof Element ? source.node.outerHTML : source.node?.textContent)?.slice(0, 160),
              before: source.previousRect.toJSON(), after: source.currentRect.toJSON(),
            })) });
          }
        } }).observe({ type: 'layout-shift', buffered: true });
      });
      const artifacts = resolve('.astro/p3-2-artifacts'); mkdirSync(artifacts, { recursive: true });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const app = await writing(page, island);
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
      expect(await page.evaluate(() => (window as unknown as { writingCLS: number }).writingCLS),
        JSON.stringify(await page.evaluate(() => (window as unknown as { writingShifts: unknown[] }).writingShifts))).toBe(0);
      const pre = app.locator('.prose pre.shiki'); await pre.scrollIntoViewIfNeeded();
      const colour = await pre.locator('span').filter({ hasText: /^const$/ }).first().evaluate((node, theme) => {
        const token = node as HTMLElement; const probe = document.createElement('span');
        probe.style.color = theme === 'dark' ? token.style.getPropertyValue('--shiki-dark') : token.style.color;
        return { actual: getComputedStyle(token).color, expected: probe.style.color, light: token.style.color };
      }, theme);
      expect(colour.actual).toBe(colour.expected);
      if (theme === 'dark') expect(colour.actual).not.toBe(colour.light);
      for (const accent of ['thambili', 'lagoon', 'lotus', 'tea']) {
        await page.evaluate(value => { document.documentElement.dataset.accent = value; }, accent);
        expect((await new AxeBuilder({ page }).include('[data-window-id="writing"]').analyze()).violations, `${theme}/${accent}/${viewport.width}`).toEqual([]);
      }
      await page.evaluate(() => { document.documentElement.dataset.accent = 'thambili'; });
      await app.locator('.writing-reader').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: resolve(artifacts, `writing-${theme}-${viewport.width}x${viewport.height}.png`) });
      expect(await app.locator('.writing-view').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test('@mobile Writing opens from home as one column: folders → list → post, at 360 px', async ({ page }, info) => {
  test.skip(phoneOnly(info), 'Phone sheets are covered by the mobile projects.');
  await page.setViewportSize({ width: 360, height: 780 });
  const app = await openFromHome(page, '/writing');
  await expect(app).toHaveAttribute('data-app', 'writing');
  await expect(posts(page)).toHaveCount(2);
  // One column: no folder sidebar, no folder select and no reader beside the list.
  for (const hidden of [app.getByRole('navigation', { name: 'Writing folders' }), app.getByRole('combobox', { name: 'Writing folder' }), app.locator('.writing-reader')])
    await expect(hidden).toBeHidden();
  expect((await app.locator('.writing-post-list').boundingBox())!.width).toBeCloseTo((await app.boundingBox())!.width, 0);
  await expectNoHorizontalOverflow(app); await expectTapTargets(app); await expectAccessibleSheet(page);
  await app.getByRole('button', { name: 'Folders', exact: true }).tap();
  const folders = app.getByRole('navigation', { name: 'Writing folders' });
  await expect(folders).toBeVisible(); await expect(app.locator('.writing-post-list')).toBeHidden();
  await expect(folders.getByRole('button', { name: 'All 2' })).toBeFocused();
  await expectNoHorizontalOverflow(app); await expectTapTargets(app); await expectAccessibleSheet(page);
  await folders.getByRole('button', { name: 'webgl', exact: true }).tap();
  await expect(posts(page)).toHaveCount(1); await expect(app.getByRole('button', { name: 'Clear tag webgl' })).toBeVisible();
  await posts(page).first().tap();
  await expect(page).toHaveURL(new RegExp(`/writing/${island}$`));
  await expect(app.getByRole('heading', { level: 1 })).toHaveText('An island made of points');
  await expect(app.locator('.writing-post-list')).toBeHidden();
  await expect(app.getByRole('link', { name: 'All writing', exact: true })).toBeHidden();
  await expectNoHorizontalOverflow(app); await expectTapTargets(app); await expectAccessibleSheet(page);
  await app.getByRole('link', { name: 'Back to Writing', exact: true }).tap();
  await expect(page).toHaveURL(/\/writing$/); await expect(posts(page)).toHaveCount(1);
});

test.describe('crawlable static articles', () => {
  test.use({ javaScriptEnabled: false });
  for (const route of ['', 'hello-world', island]) {
    test(`${route || 'index'} has full no-JS content, metadata and simple view`, async ({ page, browser }) => {
      await page.goto(`/writing${route ? `/${route}` : ''}`);
      await expect(page.locator('h1:visible')).toHaveCount(1); await expect(page.locator('h1:visible')).toBeVisible();
      await expect(page.locator('#os-initial-data')).toHaveAttribute('data-key', `writing:${route || 'index'}`);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://nipuntheekshana.com/writing${route ? `/${route}` : ''}`);
      await expect(page.getByRole('button', { name: 'Bigger text' })).toHaveCount(0);
      if (route) {
        await expect(page.locator('article .prose')).toBeVisible();
        const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
        expect(schema.map(text => JSON.parse(text)).some(value => value['@type'] === 'BlogPosting')).toBe(true);
      }
      if (route === island) {
        await expect(page.getByRole('heading', { name: 'The outline is real, and tiny' })).toBeVisible();
        await expect(page.locator('.prose pre.shiki')).toHaveCount(1);
      }
      if (route === 'hello-world') {
        await expect(page.locator('.prose').getByRole('link', { name: 'Prabhava Labs', exact: true })).toHaveAttribute('target', '_blank');
        await expect(page.locator('.prose').getByRole('link', { name: 'work page', exact: true })).toHaveAttribute('href', '/projects');
      }
      // Axe needs timers. Audit the captured no-JS DOM in a fresh page with every site script removed.
      const html = (await page.content()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      const auditContext = await browser.newContext({ javaScriptEnabled: true });
      try {
        const audit = await auditContext.newPage();
        await audit.route(page.url(), request => request.fulfill({ contentType: 'text/html', body: html }));
        await audit.goto(page.url());
        await test.step('audit the captured static DOM', async () => {
          expect((await new AxeBuilder({ page: audit }).analyze()).violations).toEqual([]);
        });
      } finally { await auditContext.close().catch(() => {}); }
      await page.goto(`/writing${route ? `/${route}` : ''}#simple`);
      await expect(page.locator('h1:visible')).toBeVisible();
      await expect(page.locator('.writing-toolbar')).toBeHidden();
      if (route) await expect(page.locator('.writing-reader')).toHaveCSS('overflow-y', 'visible');
      if (!route) {
        await page.goto('/writing');
        await page.getByRole('link', { name: /An island made of points/ }).click();
        await expect(page).toHaveURL(new RegExp(`/writing/${island}$`));
      }
    });
  }
});
