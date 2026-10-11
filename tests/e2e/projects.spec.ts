import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const artifacts = resolve('.astro/p3-1-artifacts');
async function index(page: Page) {
  await page.goto('/projects');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  return page.locator('[data-window-id="projects"]');
}

test('the first visible case-study screenshot is requested before app hydration', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(done => { release = done; });
  await page.route('**/ProjectsApp.*.js', async route => { await held; await route.continue(); });
  const firstImage = page.waitForResponse(response => /\/salli-home\.[^/]+\.avif$/.test(new URL(response.url()).pathname));
  try {
    await page.goto('/projects/salli', { waitUntil: 'domcontentloaded' });
    expect((await firstImage).status()).toBe(200);
    const staticImages = page.locator('#static-window .project-screens img');
    await expect(staticImages.first()).toHaveAttribute('loading', 'eager');
    await expect(staticImages.first()).toHaveAttribute('fetchpriority', 'high');
    await expect(staticImages.nth(1)).toHaveAttribute('loading', 'lazy');
    release(); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    await expect(page.locator('[data-window-id="projects"] .project-screens img').first()).toHaveAttribute('fetchpriority', 'high');
  } finally { release(); }
});

test('category anchors, scroll spy, incubating, featured, search and archive', async ({ page }) => {
  const win = await index(page);
  const folders = win.getByRole('navigation', { name: 'Project folders' });
  await win.getByRole('radio', { name: 'List', exact: true }).click();
  await folders.getByRole('link', { name: 'Hardware' }).click();
  await expect(win.locator('.projects-icons')).toBeVisible();
  await expect(folders.getByRole('link', { name: 'Hardware' })).toHaveAttribute('aria-current', 'location');
  await folders.getByRole('link', { name: 'Data & geo' }).click();
  expect(await win.locator('[data-scroll-root]').evaluate(el => el.scrollTop)).toBe(0);
  await folders.getByRole('link', { name: 'Incubating' }).click();
  await expect(win.getByRole('option')).toHaveCount(5); await expect(win.getByRole('status')).toContainText('5 of 18 projects');
  await expect(win.locator('.project-incubating')).toHaveCount(5);
  await folders.getByRole('link', { name: 'Featured' }).click(); await expect(win.getByRole('option')).toHaveCount(6);
  await folders.getByRole('link', { name: 'All projects' }).click();
  await win.getByRole('searchbox', { name: 'Search projects' }).fill('Go');
  const data = await (await page.request.get('/data/projects.json')).json();
  for (const project of data.projects.filter((project: { stack: string[] }) => project.stack.includes('Go'))) {
    await expect(win.locator(`[data-project="${project.slug}"]`)).toBeVisible();
  }
  await win.getByRole('searchbox').fill('xyz'); await expect(win.getByText('No projects match "xyz".')).toBeVisible();
  await win.getByRole('searchbox').fill('');
  await folders.getByRole('link', { name: 'Before open source' }).click();
  await expect(win.locator('.projects-archive tbody tr')).toHaveCount(8);
  await expect(win.locator('.projects-archive a')).toHaveCount(0);
});

test('category navigation waits for icon groups after switching from Gallery', async ({ page }) => {
  const win = await index(page);
  const folders = win.getByRole('navigation', { name: 'Project folders' });
  await win.getByRole('radio', { name: 'Gallery', exact: true }).click();
  await folders.getByRole('link', { name: 'Hardware' }).click();
  await expect(win.locator('.projects-icons')).toBeVisible();
  await expect(folders.getByRole('link', { name: 'Hardware' })).toHaveAttribute('aria-current', 'location');
  await folders.getByRole('link', { name: 'Data & geo' }).click();
  await expect.poll(() => win.locator('[data-scroll-root]').evaluate(el => el.scrollTop)).toBe(0);
  await win.locator('[data-scroll-root]').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await folders.getByRole('link', { name: 'Data & geo' }).click();
  await expect.poll(() => win.locator('[data-scroll-root]').evaluate(el => el.scrollTop)).toBe(0);
});

test('List sorts by Year; Gallery inspector provides links and opens the selected project', async ({ page }) => {
  const win = await index(page);
  await win.getByRole('radio', { name: 'List', exact: true }).click();
  await win.getByRole('button', { name: 'Year' }).click();
  await expect(win.getByRole('columnheader', { name: 'Year' })).toHaveAttribute('aria-sort', 'descending');
  const years = await win.locator('.projects-list tbody tr td:nth-child(4)').allTextContents();
  expect(years).toEqual([...years].sort((a, b) => Number(b) - Number(a)));
  await win.getByRole('button', { name: 'Year' }).click();
  await expect(win.getByRole('columnheader', { name: 'Year' })).toHaveAttribute('aria-sort', 'ascending');
  await win.getByRole('row').filter({ has: page.locator('[data-project="salli"]') }).getByRole('cell').nth(1).click();
  await expect(win.locator('[data-project="salli"]')).toBeFocused();
  await win.getByRole('radio', { name: 'Gallery', exact: true }).click();
  const inspector = win.getByRole('complementary', { name: 'Project inspector' });
  await expect(inspector.getByRole('heading', { name: 'Salli' })).toBeVisible();
  await expect(inspector.getByRole('link', { name: 'Live' })).toHaveAttribute('href', /^https:/);
  await expect(inspector.getByRole('link', { name: 'Source' })).toHaveAttribute('href', /github/);
  await inspector.getByRole('link', { name: 'Open project' }).click(); await expect(page).toHaveURL(/\/projects\/salli$/);
});

test('Salli detail facts, screen 2 Quick Look, Back preserves selection and scroll, Forward returns', async ({ page }) => {
  const win = await index(page);
  const salli = win.getByRole('option', { name: 'Salli', exact: true }); await salli.scrollIntoViewIfNeeded();
  await salli.click(); const scroll = await win.locator('[data-scroll-root]').evaluate(el => el.scrollTop);
  await salli.dblclick(); await expect(page).toHaveURL(/\/projects\/salli$/);
  await expect(win.getByRole('heading', { name: 'Salli', exact: true })).toBeVisible();
  await expect(win.getByRole('definition').filter({ hasText: '99.52%' })).toBeVisible();
  const factTops = await win.locator('.project-facts dd').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top));
  expect(Math.max(...factTops) - Math.min(...factTops)).toBeLessThanOrEqual(1);
  await win.getByRole('button', { name: 'Open screen 2 of 3: Activity', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Quick Look — Salli' });
  await expect(preview.getByRole('status')).toHaveText('2 of 3'); await expect(page).toHaveURL(/\?shot=1$/);
  await page.keyboard.press('Escape'); await expect(preview).toBeHidden();
  await win.getByRole('button', { name: 'Back', exact: true }).click(); await expect(page).toHaveURL(/\/projects$/);
  await expect(salli).toHaveAttribute('aria-selected', 'true');
  expect(await win.locator('[data-scroll-root]').evaluate(el => el.scrollTop)).toBe(scroll);
  await win.getByRole('button', { name: 'Forward', exact: true }).click(); await expect(page).toHaveURL(/\/projects\/salli$/);
});

test('keyboard grid arrows, type-ahead, search shortcut, Return and Space Quick Look UI flow', async ({ page }) => {
  const win = await index(page); const first = win.getByRole('option').first(); await first.focus();
  await page.keyboard.press('ArrowRight'); await expect(win.getByRole('option').nth(1)).toBeFocused();
  await page.keyboard.press('Home'); await expect(first).toBeFocused();
  const columns = await win.locator('.projects-grid').first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await page.keyboard.press('ArrowDown'); await expect(win.getByRole('option').nth(columns)).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(first).toBeFocused();
  await page.keyboard.type('salli'); const salli = win.getByRole('option', { name: 'Salli', exact: true }); await expect(salli).toBeFocused();
  await page.keyboard.press('Space'); const preview = page.getByRole('dialog', { name: 'Quick Look — Salli' });
  await expect(preview.getByRole('status')).toHaveText('1 of 3'); await page.keyboard.press('Space'); await expect(preview).toBeHidden();
  await win.getByRole('button', { name: 'Back', exact: true }).click(); await expect(salli).toBeFocused();
  await page.keyboard.press('/'); await expect(win.getByRole('searchbox')).toBeFocused();
  await win.getByRole('searchbox').fill('Salli'); await win.getByRole('option', { name: 'Salli', exact: true }).focus();
  await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/projects\/salli$/);
});

test('context menu routes project actions; View menus drive checked state and status bar', async ({ page }) => {
  const win = await index(page); await win.getByRole('option', { name: 'Salli', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Quick Look', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Quick Look — Salli' }).getByRole('status')).toHaveText('1 of 3');
  await page.keyboard.press('Escape'); await win.getByRole('button', { name: 'Back', exact: true }).click();
  const menu = page.getByRole('menubar'); await menu.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'as List', exact: true }).click(); await expect(win.locator('.projects-list')).toBeVisible();
  await menu.getByRole('menuitem', { name: 'View', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: 'as List', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemcheckbox', { name: 'Show status bar' }).click(); await expect(win.locator('.projects-statusbar')).toHaveCount(0);
});

test('unknown client project and recoverable data errors', async ({ page }) => {
  await page.goto('/?open=projects/unknown'); const win = page.locator('[data-window-id="projects"]');
  await expect(win.getByRole('heading', { name: 'No project called "unknown".' })).toBeVisible();
  await win.getByRole('link', { name: 'All projects', exact: true }).click(); await expect(win.getByRole('option')).toHaveCount(18);
  let count = 0; await page.route('**/data/projects.json', async route => { if (++count === 1) await route.abort(); else await route.continue(); });
  await page.goto('/?open=projects'); await expect(page.getByRole('alert').filter({ hasText: "Couldn't load projects." })).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(page.locator('[data-window-id="projects"]').getByRole('option')).toHaveCount(18);
});

for (const theme of ['light', 'dark'] as const) test.describe(`${theme} Projects accessibility and screenshots`, () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(theme => localStorage.setItem('serendib:theme', JSON.stringify(theme)), theme);
    mkdirSync(artifacts, { recursive: true });
  });
  for (const view of ['Icons', 'List', 'Gallery']) test(`${view} has no serious violations or console errors`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const win = await index(page);
    await win.getByRole('radio', { name: view, exact: true }).click();
    const result = await new AxeBuilder({ page }).include('[data-window-id="projects"]').analyze();
    expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await page.screenshot({ path: resolve(artifacts, `projects-${view.toLowerCase()}-${theme}-1440x900.png`) });
    expect(errors).toEqual([]);
  });
  for (const slug of ['salli', 'geopop']) test(`${slug} detail and Info card are accessible`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/projects/${slug}`); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    const result = await new AxeBuilder({ page }).include('[data-window-id="projects"]').analyze();
    expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await page.screenshot({ path: resolve(artifacts, `projects-${slug}-${theme}-1440x900.png`) });
    await page.locator('[data-window-id="projects"] .project-info').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(artifacts, `projects-${slug}-info-${theme}-1440x900.png`) });
    if (slug === 'geopop') {
      await page.locator('[data-window-id="projects"] [data-scroll-root]').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.locator('[data-window-id="projects"] .project-api-card').scrollIntoViewIfNeeded();
      await expect(page.locator('[data-window-id="projects"] .project-api-card')).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: resolve(artifacts, `projects-geopop-api-${theme}-1440x900.png`) });
    }
    expect(errors).toEqual([]);
  });
});

test('390px content fits and preserves the detail flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const win = await index(page);
  expect(await win.locator('.projects-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, 'projects-index-mobile-390x844.png') });
  await win.getByRole('option', { name: 'Salli', exact: true }).click(); await expect(win.getByRole('heading', { name: 'Salli', exact: true })).toBeVisible();
  const root = win.locator('.project-detail-scroll'); expect(await root.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: resolve(artifacts, 'projects-salli-mobile-390x844.png') });
  await win.locator('.project-info').scrollIntoViewIfNeeded();
  const info = await win.locator('.project-info').boundingBox(); const prose = await win.locator('.project-story').boundingBox(); expect(info!.y).toBeLessThan(prose!.y);
  mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: resolve(artifacts, 'projects-mobile-390x844.png') });
});

test('static index keeps every project and category anchors without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } }); const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/projects`); await expect(page.locator('#static-window').getByRole('option')).toHaveCount(18);
    await page.locator('#static-window').getByRole('link', { name: 'Hardware' }).click();
    await expect(page).toHaveURL(/#projects-group-hardware$/);
  } finally { await context.close(); }
});

const staticProjects: { slug: string; title: string }[] = JSON.parse(readFileSync('dist/data/projects.json', 'utf8')).projects;
for (let start = 0; start < staticProjects.length; start += 6) {
  const projects = staticProjects.slice(start, start + 6);
  test(`static case studies ${projects.map(project => project.slug).join(', ')} keep all content without JavaScript`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } }); const page = await context.newPage();
    try {
      for (const project of projects) {
        await page.goto(`${baseURL}/projects/${project.slug}`); const win = page.locator('#static-window');
        await expect(win.getByRole('heading', { name: project.title, exact: true })).toBeVisible();
        const work = await (await page.request.get(`${baseURL}/data/work/${project.slug}.json`)).json();
        expect(await win.locator('.prose').innerHTML()).toBe(work.html);
        await expect(win.locator('.project-lede')).toHaveText(work.lede);
        await expect(win.getByRole('complementary', { name: 'Project information' })).toHaveCount(1);
      }
    } finally { await context.close(); }
  });
}

for (const path of ['/projects', '/projects/salli']) test(`${path} adopts identical content geometry with zero CLS`, async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { projectsCls: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { projectsCls: number }).projectsCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/ProjectsApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-window-id="projects"]')).toHaveAttribute('data-adopting', '');
    const selector = path === '/projects' ? '.projects-toolbar-title' : '.project-heading h1';
    const heading = page.locator(`#static-window ${selector}`); const text = await heading.textContent(); const before = await heading.boundingBox();
    const paragraph = path === '/projects' ? null : await page.locator('#static-window .project-description').textContent();
    release(); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    const managed = page.locator(`[data-window-id="projects"] ${selector}`); await expect(managed).toHaveText(text!);
    const after = await managed.boundingBox();
    for (const field of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after![field] - before![field])).toBeLessThanOrEqual(1);
    if (paragraph) await expect(page.locator('[data-window-id="projects"] .project-description')).toHaveText(paragraph);
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
    expect(await page.evaluate(() => (window as unknown as { projectsCls: number }).projectsCls)).toBe(0);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
});
