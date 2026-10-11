import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, openApp } from './fixtures';

const questions = ['What are you building?', "What's Prabhava Labs?", 'Can we work together?', "What's your stack?", 'Where are you based?', 'How do I reach you?'];
const managed = (page: Page) => page.locator('[data-window-id="messages"]');
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = []; errors.set(page, list);
  page.on('pageerror', error => list.push(error.message));
  page.on('console', message => { if (message.type() === 'error') list.push(message.text()); });
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function conversation(page: Page) {
  await page.goto('/messages');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(managed(page).getByRole('textbox', { name: 'Write to Nipun' })).toBeEnabled();
  return managed(page);
}
async function axe(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
}

test('no-JS transcript includes all six questions, real answers and direct email', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('/messages');
    const content = page.locator('#static-window');
    await expect(content.getByRole('heading', { name: 'Nipun · scripted' })).toBeVisible();
    for (const question of questions) await expect(content.locator('.messages-bubble--user').filter({ hasText: question })).toHaveCount(1);
    await expect(content.locator('.messages-bubble--assistant')).toHaveCount(7);
    await expect(content).toContainText('Growing Prabhava Labs');
    await expect(content).toContainText('Solidity, TypeScript, JavaScript, Go, Rust, Java, and a soldering iron.');
    await expect(content.getByRole('link', { name: 'email Nipun directly' })).toHaveAttribute('href', 'mailto:theekshana2@gmail.com');
    await content.getByRole('link', { name: questions[5], exact: true }).click();
    await expect(content.locator('#messages-question-contact')).toBeInViewport();
  } finally { await context.close(); }
});

test('script-free static transcript is accessible', async ({ page }) => {
  // Axe uses asynchronous JavaScript; keep the HTML script-free while allowing
  // the audit itself to run. The preceding test disables browser JS entirely.
  await page.route('**/messages', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    await route.fulfill({ response, body });
  });
  await page.goto('/messages');
  await expect(page.locator('html')).toHaveClass('no-js');
  await axe(page, '#static-window');
});

for (const [index, question] of questions.entries()) {
  test(`scripted chip: ${question}`, async ({ page, request }) => {
    const win = await conversation(page);
    const profile = await (await request.get('/data/profile.json')).json();
    const expected = [profile.now.items[0], profile.experience.find((item: { org: string }) => item.org === 'Prabhava Labs').summary,
      "The best way is email. Tell me what you have in mind and I'll reply.",
      'Solidity, TypeScript, JavaScript, Go, Rust, Java, and a soldering iron.', "Colombo, Sri Lanka. It's 23:11 here right now.",
      'Email is the best way to reach me. You can also find me on GitHub and LinkedIn.'][index];
    await win.getByRole('button', { name: question, exact: true }).click();
    await expect(win.getByRole('status', { name: 'Nipun is typing' })).toBeVisible();
    await expect(win.locator('.messages-bubble--user').last()).toHaveText(`You: ${question}`);
    await expect(win.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await expect(win.getByRole('status', { name: 'Nipun is typing' })).toHaveCount(0);
    await expect(win.locator('.messages-bubble--assistant').last()).toContainText(expected);
    const links = win.locator('.messages-bubble--assistant').last().getByRole('link');
    if (index === 0) await expect(links).toHaveAttribute('href', '/now');
    if (index === 1) await expect(links).toHaveAttribute('href', profile.links.prabhava);
    if (index === 2) await expect(links).toHaveAttribute('href', 'mailto:theekshana2@gmail.com');
    if (index === 3) await expect(links).toHaveAttribute('href', '/about#toolbox');
    if (index === 5) await expect(links).toHaveCount(3);
  });
}

test('free-text hello offers the exact email hand-off and copies its text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const win = await conversation(page);
  const composer = win.getByRole('textbox', { name: 'Write to Nipun' });
  await expect(win.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await composer.fill('hello'); await composer.press('Enter');
  await expect(win.getByRole('status', { name: 'Nipun is typing' })).toBeVisible();
  const email = win.getByRole('link', { name: 'Open email' });
  await expect(email).toHaveAttribute('href', /^mailto:theekshana2@gmail.com\?subject=Hello%20from%20Serendib/);
  const params = new URLSearchParams((await email.getAttribute('href'))!.split('?')[1]);
  expect(params.get('body')).toBe('hello\n\n— sent from os.nipuntheekshana.com');
  await win.getByRole('button', { name: 'Copy text' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('hello');
  await expect(composer).toHaveValue('');
});

test('keyboard main flow: switch thread, pet, map an intent and compose multiple lines', async ({ page }) => {
  const win = await conversation(page);
  const nipun = win.getByRole('button', { name: 'Nipun conversation' });
  await nipun.focus(); await nipun.press('ArrowDown');
  await expect(win.getByRole('button', { name: 'Mochi conversation' })).toBeFocused();
  await page.keyboard.press('Enter');
  const pet = win.getByRole('button', { name: 'Pet', exact: true });
  await pet.focus(); await page.keyboard.press('Enter');
  await expect(win.locator('.messages-bubble--assistant').last()).toContainText('1 pet so far');
  await nipun.focus(); await page.keyboard.press('Enter');
  const composer = win.getByRole('textbox', { name: 'Write to Nipun' });
  await composer.focus(); await page.keyboard.type('what languages do you use?'); await page.keyboard.press('Enter');
  await expect(win.locator('.messages-bubble--assistant').last()).toContainText('soldering iron');
  await composer.focus(); await page.keyboard.type('hello'); await page.keyboard.press('Shift+Enter'); await page.keyboard.type('from Berlin');
  await expect(composer).toHaveValue('hello\nfrom Berlin');
  await expect(win.getByRole('link', { name: 'Open email' })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(win.getByRole('link', { name: 'Open email' })).toBeVisible();
});

test('Mochi pet count reaches the shared Settings preference and persists once', async ({ page }) => {
  const win = await conversation(page);
  await win.getByRole('button', { name: 'Mochi conversation' }).click();
  await win.getByRole('button', { name: 'Pet', exact: true }).click();
  await expect(win.getByRole('status', { name: 'Mochi is typing' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('serendib:mochi')!).pets)).toBe(1);
  await page.reload();
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(win.locator('.messages-bubble--assistant').last()).toContainText('1 pet so far');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:mochi')!).pets)).toBe(1);
  await win.getByRole('button', { name: 'How are you?', exact: true }).click();
  await expect(win.locator('.messages-bubble--assistant').last()).toContainText("I've had 1 pet");
  await win.getByRole('button', { name: 'Give tea', exact: true }).click();
  await expect(win.locator('.messages-bubble--assistant').last()).toContainText('Tea received');
  await openApp(page, 'Settings');
  await expect(page.locator('[data-window-id="settings"]')).toBeVisible();
});

test('session history and drafts survive reload and new messages keep unique IDs', async ({ page }) => {
  const win = await conversation(page);
  await win.getByRole('textbox', { name: 'Write to Nipun' }).fill('hello one');
  await win.getByRole('button', { name: 'Send message' }).click();
  await expect(win.getByRole('link', { name: 'Open email' })).toBeVisible();
  await win.getByRole('textbox', { name: 'Write to Nipun' }).fill('unsent draft');
  await page.reload();
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(win.getByRole('textbox', { name: 'Write to Nipun' })).toHaveValue('unsent draft');
  await expect(win.getByRole('link', { name: 'Open email' })).toHaveCount(1);
  await win.getByRole('textbox', { name: 'Write to Nipun' }).fill('hello two');
  await win.getByRole('button', { name: 'Send message' }).click();
  await expect(win.getByRole('link', { name: 'Open email' })).toHaveCount(2);
  const ids = await win.locator('[data-message-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id')));
  expect(new Set(ids).size).toBe(ids.length);
});

test('closing guards drafts in either thread and cancellation preserves text', async ({ page }) => {
  const win = await conversation(page);
  await win.getByRole('textbox', { name: 'Write to Nipun' }).fill('keep this draft');
  await win.getByRole('button', { name: 'Mochi conversation' }).click();
  await win.getByRole('button', { name: 'Close Messages', exact: true }).click();
  const sheet = page.getByRole('alertdialog', { name: 'Discard your message?' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await win.getByRole('button', { name: 'Nipun conversation' }).click();
  await expect(win.getByRole('textbox', { name: 'Write to Nipun' })).toHaveValue('keep this draft');
  await win.getByRole('button', { name: 'Close Messages', exact: true }).click();
  await sheet.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(win).toHaveCount(0);
  await openApp(page, 'Messages');
  await expect(win.getByRole('textbox', { name: 'Write to Nipun' })).toHaveValue('');
});

test('registered app menus switch conversations, focus composer and send', async ({ page }) => {
  const win = await conversation(page);
  const bar = page.locator('[data-shell="desktop"]').getByRole('menubar');
  await bar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Mochi conversation' }).click();
  await expect(win.getByRole('heading', { name: 'Mochi · desk buddy' })).toBeVisible();
  await bar.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Focus composer', exact: true }).click();
  const composer = win.getByRole('textbox', { name: 'Write to Mochi' });
  await expect(composer).toBeFocused(); await composer.fill('Pet');
  await bar.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Send message', exact: true }).click();
  await expect(win.locator('.messages-bubble--assistant').last()).toContainText('1 pet so far');
});

test('thread search, composer bounds and blocked storage remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem; const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) { if (key === 'serendib:messages:v1') throw new Error('denied'); return originalGet.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === 'serendib:messages:v1') throw new Error('denied'); originalSet.call(this, key, value); };
  });
  const win = await conversation(page);
  const search = win.getByRole('searchbox', { name: 'Search conversations' });
  await search.fill('nobody'); await expect(win.getByText('No conversations found.')).toBeVisible();
  await search.fill('mochi'); await expect(win.getByRole('button', { name: 'Nipun conversation' })).toHaveCount(0);
  await search.fill('');
  const composer = win.getByRole('textbox', { name: 'Write to Nipun' });
  await composer.fill('x'.repeat(1100)); await expect(composer).toHaveValue('x'.repeat(1000));
  await composer.fill('hello'); await composer.press('Enter');
  await expect(win.getByRole('link', { name: 'Open email' })).toBeVisible();
});

test('reduced motion uses static dots and 300ms scripted replies', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const win = await conversation(page);
  await page.clock.install({ time: new Date('2026-10-11T17:41:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T17:41:01Z'));
  await win.getByRole('button', { name: questions[4], exact: true }).click();
  const typing = win.getByRole('status', { name: 'Nipun is typing' });
  await expect(typing).toBeVisible();
  await expect(typing.locator('span').first()).toHaveCSS('animation-name', 'none');
  await page.clock.runFor(299); await expect(typing).toBeVisible();
  await page.clock.runFor(1); await expect(typing).toHaveCount(0);
  await expect(win.locator('.messages-bubble--assistant').last()).toContainText('Colombo, Sri Lanka.');
});

test('static adoption preserves transcript geometry, scroll, focus and zero CLS', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/MessagesApp.*.js', async route => { await held; await route.continue(); });
  await page.addInitScript(() => {
    (window as any).messagesCls = 0;
    new PerformanceObserver(list => list.getEntries().forEach((entry: any) => { if (!entry.hadRecentInput) (window as any).messagesCls += entry.value; }))
      .observe({ type: 'layout-shift', buffered: true });
  });
  try {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    const original = page.locator('#static-window');
    await expect(managed(page)).toHaveAttribute('data-adopting', '');
    const before = await original.boundingBox();
    const heading = await original.getByRole('heading').textContent();
    const paragraph = await original.locator('.messages-thread-header p').textContent();
    const log = original.locator('.messages-log');
    await log.evaluate(node => { node.scrollTop = 123; (node as HTMLElement).focus(); });
    const first = await original.locator('.messages-bubble').first().boundingBox();
    release(); await expect(original).toHaveAttribute('hidden', '');
    const after = await managed(page).boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before![key] - after![key])).toBeLessThanOrEqual(1);
    await expect(managed(page).getByRole('heading')).toHaveText(heading!);
    await expect(managed(page).locator('.messages-thread-header p')).toHaveText(paragraph!);
    expect(await managed(page).locator('.messages-log').evaluate(node => node.scrollTop)).toBe(123);
    const adoptedFirst = await managed(page).locator('.messages-bubble').first().boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(first![key] - adoptedFirst![key])).toBeLessThanOrEqual(1);
    expect(await managed(page).evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    expect(await page.evaluate(() => (window as any).messagesCls)).toBe(0);
  } finally { release(); }
});

for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} ${mode}: themes, accents and accessibility @visual`, async ({ page }) => {
      const directory = resolve('.astro/p3-9-artifacts'); mkdirSync(directory, { recursive: true });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme });
      const win = await conversation(page);
      await page.evaluate(() => document.fonts.ready);
      await axe(page, '[data-window-id="messages"]');
      const root = win.locator('.messages-app');
      expect(await root.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await expect(win.getByRole('textbox', { name: 'Write to Nipun' })).toBeInViewport();
      await page.screenshot({ path: resolve(directory, `messages-${theme}-${mode}.png`) });
      for (const accent of ['thambili', 'lagoon', 'lotus', 'tea']) {
        await page.evaluate(value => { document.documentElement.dataset.accent = value; }, accent);
        await axe(page, '[data-window-id="messages"]');
      }
    });
  }
}
