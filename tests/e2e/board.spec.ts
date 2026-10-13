import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
const shots = resolve('.astro/k10-artifacts/screenshots'); mkdirSync(shots, { recursive: true });
const notes = [
  { id: 'note-one', created_at: Date.now() - 5 * 60000, name: 'Ama', body: 'Ela site! Hello from Colombo.', color: 'paper', font: 'handwriting', rotation: -3, country: 'LK' },
  { id: 'note-two', created_at: Date.now() - 86400000, name: 'Sam', body: '<img src=x onerror=alert(1)> This is only text.', color: 'lagoon', font: 'sans', rotation: 2, country: 'GB' },
  { id: 'note-three', created_at: Date.now() - 3 * 86400000, name: 'දිනුක', body: 'ආයුබෝවන්! හරිම ලස්සනයි.', color: 'lotus', font: 'serif', rotation: -1, country: null },
];
const published = { ...notes[0]!, id: 'new-note', created_at: Date.now(), name: 'Visitor', body: 'A kind new note 🌴', rotation: 3 };
const fakeWidget = `window.k10WidgetLog=[];window.turnstile={render(el,options){window.k10WidgetOptions=options;window.k10WidgetLog.push('render');return 'k10-widget'},execute(id){window.k10WidgetLog.push('execute');queueMicrotask(()=>window.k10WidgetOptions.callback('test-token'))},reset(id){window.k10WidgetLog.push('reset')},remove(id){window.k10WidgetLog.push('remove')}};`;
async function capture(page: Page, info: TestInfo, name: string) {
  if (info.project.name === 'mobile-webkit') return;
  await page.screenshot({ path: resolve(shots, `${name}-${info.project.name}.png`), scale: 'css' });
}
async function mocks(page: Page, options: { health?: boolean; listStatus?: number; items?: typeof notes; visitStatus?: number; postStatus?: number; post?: unknown; blocked?: boolean; network?: boolean } = {}) {
  await page.route('**/api/health', route => route.fulfill({ json: { ai: false, postcards: options.health ?? true } }));
  await page.route('**/api/visits', route => route.fulfill({ status: options.visitStatus ?? 200, json: options.visitStatus ? { error: 'unavailable' } : { count: 4977, counted: true } }));
  await page.route('**/api/postcards*', route => {
    if (route.request().method() === 'POST') return options.network ? route.abort('failed') : route.fulfill({ status: options.postStatus ?? 201, json: options.post ?? { status: 'published', postcard: published } });
    return route.fulfill({ status: options.listStatus ?? 200, json: options.listStatus ? { error: 'unavailable' } : { items: options.items ?? notes, next: null } });
  });
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => options.blocked ? route.abort('blockedbyclient') : route.fulfill({ contentType: 'application/javascript', body: fakeWidget }));
}
async function board(page: Page) {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  // Expose document flow while the legacy fixed phone home is still present.
  if (await page.locator('html').getAttribute('data-mode') === 'mobile') await page.addStyleTag({ content: '.phone-home{display:none!important} #story{display:block!important}' });
  await page.locator('[data-k-board]').scrollIntoViewIfNeeded();
  return page.locator('[data-k-board]');
}
async function compose(page: Page) {
  await page.goto('/postcards'); await expect(page.locator('html')).toHaveClass(/os-ready/); await expect(page.locator('.guestbook-app')).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'New note', exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByLabel('Your note', { exact: true }).fill('A kind new note 🌴');
  await dialog.getByLabel('Your name', { exact: true }).fill('Visitor');
  return dialog;
}
async function pin(page: Page) {
  const button = page.getByRole('button', { name: 'Pin it', exact: true }); await expect(button).toBeEnabled(); await button.click();
}
test.beforeEach(async ({ page }, info) => {
  if (info.project.name.startsWith('mobile')) await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('serendib:booted', 'true'));
});

test('board loads ten skeletons, safely renders styling and country stamps, paginates and ends', async ({ page }, info) => {
  await mocks(page); let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  await page.route('**/api/postcards*', async route => {
    requests.push(route.request().url());
    if (!route.request().url().includes('cursor=')) { await held; await route.fulfill({ json: { items: notes, next: 'opaque cursor/' } }); }
    else await route.fulfill({ json: { items: [{ ...notes[0]!, id: 'older-note' }], next: null } });
  });
  const panel = await board(page); await expect(panel.locator('.k-note-skeleton')).toHaveCount(10); await expect(panel.getByRole('status')).toHaveText('Loading notes…');
  const loadingHeight = await panel.evaluate(el => el.getBoundingClientRect().height);
  release(); await expect(panel.getByRole('article')).toHaveCount(3);
  expect(await panel.evaluate(el => el.getBoundingClientRect().height)).toBe(loadingHeight);
  expect(requests[0]).toContain('limit=40');
  const first = panel.getByRole('article').first(); await expect(first).toHaveCSS('rotate', '-3deg'); await expect(first).toHaveCSS('background-color', 'rgb(255, 226, 122)');
  await expect(first.locator('.k-country')).toHaveText('LK'); await expect(first).toHaveAttribute('aria-label', /Note from Ama, Sri Lanka,.*Ela site/);
  await expect(first.locator('p')).toHaveCSS('font-size', info.project.name === 'chromium' ? '20px' : '18px');
  const second = panel.getByRole('article').nth(1); await expect(second).toHaveCSS('background-color', 'rgb(138, 219, 216)'); await expect(second.locator('p')).toHaveCSS('font-weight', '500');
  await expect(second.locator('img')).toHaveCount(0); await expect(second).toContainText('<img src=x onerror=alert(1)>');
  await expect(panel.getByRole('article').nth(2).locator('p')).toHaveAttribute('lang', 'si'); await expect(panel.getByRole('article').nth(2).locator('p')).toHaveCSS('font-style', 'italic');
  for (const article of await panel.getByRole('article').all()) {
    const bounds = await article.evaluate(el => ({ name: el.getAttribute('aria-label'),
      paper: el.getBoundingClientRect().bottom, footer: el.querySelector('footer')!.getBoundingClientRect().bottom,
      height: el.clientHeight, content: el.scrollHeight }));
    expect(bounds.footer, bounds.name!).toBeLessThanOrEqual(bounds.paper);
    expect(bounds.content, bounds.name!).toBeLessThanOrEqual(bounds.height);
  }
  await capture(page, info, 'board-notes-light');
  await panel.getByRole('button', { name: 'Show older notes' }).click(); await expect(panel.getByRole('article')).toHaveCount(4);
  expect(requests[1]).toContain('cursor=opaque%20cursor%2F'); await expect(panel).toContainText("That's every note. Thank you for reading them all!");
});

test('long notes and forty-character signatures stay inside their paper', async ({ page }, info) => {
  if (info.project.name.startsWith('mobile')) await page.setViewportSize({ width: 320, height: 844 });
  await mocks(page, { items: [
    { ...notes[0]!, body: 'A kind sentence for the board. '.repeat(10).slice(0, 300), name: 'Long name '.repeat(4) },
    { ...notes[1]!, body: 'An unbroken line '.repeat(20).slice(0, 300), name: 'A'.repeat(40) },
    { ...notes[2]!, body: 'ආයුබෝවන්! ලස්සනයි. '.repeat(16).slice(0, 300), name: 'දිනුක'.repeat(8) },
  ] });
  const panel = await board(page); await expect(panel.getByRole('article')).toHaveCount(3);
  for (const article of await panel.getByRole('article').all()) {
    const bounds = await article.evaluate(el => ({ paper: el.getBoundingClientRect().bottom,
      footer: el.querySelector('footer')!.getBoundingClientRect().bottom, height: el.clientHeight, content: el.scrollHeight }));
    expect(bounds.footer).toBeLessThanOrEqual(bounds.paper); expect(bounds.content).toBeLessThanOrEqual(bounds.height);
  }
});

test('empty board has a dashed invitation and a real compose route', async ({ page }, info) => {
  await mocks(page, { items: [] }); const panel = await board(page); await expect(panel).toContainText('Nothing pinned yet. Be the first one to say hi!');
  await expect(panel.locator('.k-board-empty')).toHaveCSS('border-top-style', 'dashed'); await expect(panel.getByRole('link', { name: '+ leave a message', exact: true })).toHaveAttribute('href', '/postcards');
  await capture(page, info, 'board-empty');
});
for (const closed of ['health', '503'] as const) test(`board is closed on ${closed} and cannot open compose`, async ({ page }, info) => {
  await mocks(page, closed === 'health' ? { health: false } : { listStatus: 503 }); const panel = await board(page);
  await expect(panel).toContainText('The board is having a tea break. Back soon.');
  const link = panel.getByRole('link', { name: '+ leave a message', exact: true }); await expect(link).toHaveAttribute('aria-disabled', 'true'); await expect(link).toHaveAttribute('title', 'The board is resting');
  await link.evaluate(el => (el as HTMLElement).click()); await expect(page.locator('.guestbook-app')).toHaveCount(0); await capture(page, info, `board-closed-${closed}`);
});
test('list failure retries the same page and pagination failure keeps earlier notes', async ({ page }) => {
  await mocks(page); let attempts = 0; const cursors: string[] = [];
  await page.route('**/api/postcards*', route => {
    const url = new URL(route.request().url()); cursors.push(url.searchParams.get('cursor') ?? ''); attempts++;
    return route.fulfill(attempts === 1 || attempts === 3 ? { status: 500, json: { error: 'failure' } } : { json: { items: attempts === 2 ? notes : [{ ...notes[0]!, id: 'older' }], next: attempts === 2 ? 'cursor' : null } });
  });
  const panel = await board(page); await expect(panel.getByRole('alert')).toHaveText("The board didn't load."); await panel.getByRole('button', { name: 'Try again' }).click();
  await expect(panel.getByRole('article')).toHaveCount(3); await panel.getByRole('button', { name: 'Show older notes' }).click();
  await expect(panel.getByRole('article')).toHaveCount(3); await panel.getByRole('button', { name: 'Try again' }).click(); await expect(panel.getByRole('article')).toHaveCount(4);
  expect(cursors).toEqual(['', '', 'cursor', 'cursor']);
});
test('dark board and compose have no serious accessibility violations or page errors', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await page.emulateMedia({ colorScheme: 'dark' });
  await mocks(page); const panel = await board(page); await expect(panel.getByRole('article')).toHaveCount(3); await capture(page, info, 'board-notes-dark');
  const result = await new AxeBuilder({ page }).include('[data-k-board]').analyze(); expect(result.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]);
  await compose(page); const form = page.locator('.k-compose'); const check = await new AxeBuilder({ page }).include('.guestbook-app').analyze();
  expect(check.violations.filter(value => ['serious', 'critical'].includes(value.impact ?? ''))).toEqual([]); await capture(page, info, 'compose-idle-dark'); expect(errors).toEqual([]);
  await expect(form).toHaveAttribute('aria-label', 'New note');
});

test('compose uses the standard window or phone sheet, keyboard order, Random and explicit Turnstile', async ({ page }, info) => {
  await mocks(page); const dialog = await compose(page); await capture(page, info, 'compose-idle-light');
  if (info.project.name.startsWith('mobile')) await expect(dialog).toHaveAttribute('data-sheet');
  else { const size = await dialog.boundingBox(); expect(size!.width).toBe(560); await expect(dialog.getByRole('button', { name: 'Maximise New note' })).toBeDisabled(); }
  const body = dialog.getByLabel('Your note', { exact: true }); await body.focus(); await page.keyboard.press('Tab'); await expect(dialog.getByLabel('Your name', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByLabel('Email (optional, never shown)', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Random colour and font' })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Pin it', exact: true })).toBeFocused();
  const note = dialog.locator('.k-compose-note'); const color = await note.getAttribute('data-color'); const font = await note.getAttribute('data-font');
  await dialog.getByRole('button', { name: 'Random colour and font' }).click(); expect(await note.getAttribute('data-color')).not.toBe(color); expect(await note.getAttribute('data-font')).not.toBe(font);
  const options = await page.evaluate(() => (window as unknown as { k10WidgetOptions: { execution: string; appearance: string; action: string } }).k10WidgetOptions);
  expect(options).toMatchObject({ execution: 'execute', appearance: 'interaction-only', action: 'postcard' });
});
test('compose counts trimmed Unicode code points at 280 and 300 and blocks the next input', async ({ page }) => {
  await mocks(page); const dialog = await compose(page); const body = dialog.getByLabel('Your note', { exact: true });
  await expect(body).not.toHaveAttribute('maxlength'); await body.fill('a'.repeat(280)); await expect(dialog.locator('#board-counter')).toHaveText('280/300 · 20 left');
  await body.fill('a'.repeat(299) + '🌴'); await expect(dialog.locator('#board-counter')).toHaveText("300/300 · That's the limit");
  await body.press('End'); await body.press('x'); await expect(body).toHaveValue('a'.repeat(299) + '🌴');
  await body.fill('  hello 🌴  '); await expect(dialog.locator('#board-counter')).toHaveText('7/300');
  await body.evaluate(el => { const event = new Event('paste', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'clipboardData', { value: { getData: () => 'x'.repeat(400) } }); (el as HTMLTextAreaElement).select(); el.dispatchEvent(event); });
  await expect(body).toHaveValue('x'.repeat(300)); await expect(dialog.getByRole('status').filter({ hasText: 'Pasted text' })).toHaveText('Pasted text was trimmed to 300 characters.');
});
test('draft is restored on reload and after guarded close, and Keep writing cancels close', async ({ page }) => {
  await mocks(page); let dialog = await compose(page); await dialog.getByLabel('Email (optional, never shown)', { exact: true }).fill('private@example.com');
  await page.reload(); dialog = page.getByRole('dialog', { name: 'New note', exact: true }); await expect(dialog.getByLabel('Your note', { exact: true })).toHaveValue('A kind new note 🌴');
  const close = async () => {
    if (await dialog.getAttribute('data-sheet') !== null) await dialog.getByRole('link', { name: 'Home', exact: true }).click();
    else await dialog.getByRole('button', { name: 'Close New note', exact: true }).click();
  };
  await close(); const guard = page.getByRole('alertdialog', { name: 'Throw away this note?', exact: true }); await expect(guard).toBeVisible(); await guard.getByRole('button', { name: 'Keep writing', exact: true }).click(); await expect(dialog).toBeVisible();
  await close(); await guard.getByRole('button', { name: 'Discard', exact: true }).click(); await expect(dialog).not.toBeVisible();
  await page.goto('/postcards'); dialog = page.getByRole('dialog', { name: 'New note', exact: true }); await expect(dialog.getByLabel('Your note', { exact: true })).toHaveValue('A kind new note 🌴'); await expect(dialog.getByLabel('Email (optional, never shown)', { exact: true })).toHaveValue('private@example.com');
});
for (const field of ['body', 'name'] as const) test(`empty ${field} disables Pin it`, async ({ page }) => {
  await mocks(page); const dialog = await compose(page); await dialog.getByLabel(field === 'body' ? 'Your note' : 'Your name', { exact: true }).fill('  '); await expect(dialog.getByRole('button', { name: 'Pin it', exact: true })).toBeDisabled();
});
test('client email and link validation prevent requests and focus the invalid field', async ({ page }) => {
  await mocks(page); let posts = 0; page.on('request', request => { if (request.url().includes('/api/postcards') && request.method() === 'POST') posts++; });
  const dialog = await compose(page); const email = dialog.getByLabel('Email (optional, never shown)', { exact: true }); await email.fill('bad'); await pin(page);
  await expect(email).toBeFocused(); await expect(dialog.getByRole('alert')).toHaveText("That email doesn't look right. It's optional, so you can leave it empty.");
  await email.fill(''); await dialog.getByLabel('Your note', { exact: true }).fill('Visit https://example.com'); await pin(page);
  await expect(dialog.getByRole('alert')).toHaveText('No links on the board, machan. Describe it in words instead.'); expect(posts).toBe(0);
});

for (const result of ['published', 'pending'] as const) test(`${result} note closes compose, clears the draft, appears first and resets verification`, async ({ page }, info) => {
  await mocks(page, result === 'pending' ? { postStatus: 202, post: { status: 'pending', message: 'Your postcard awaits approval.' } } : {});
  const panel = await board(page); await expect(panel.getByRole('article')).toHaveCount(3);
  await panel.getByRole('link', { name: '+ leave a message', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New note', exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByLabel('Your note', { exact: true }).fill('A kind new note 🌴'); await dialog.getByLabel('Your name', { exact: true }).fill('Visitor');
  await expect(dialog.getByRole('button', { name: 'Pin it', exact: true })).toBeEnabled(); await dialog.getByLabel('Your name', { exact: true }).press('Control+Enter');
  await expect(dialog).not.toBeVisible(); await expect(panel.getByRole('article').first()).toContainText('A kind new note 🌴');
  expect(await page.evaluate(() => sessionStorage.getItem('serendib:board:draft'))).toBeNull();
  if (result === 'pending') {
    await expect(panel.getByRole('article').first()).toHaveCSS('border-top-style', 'dashed'); await expect(panel.getByRole('article').first()).toContainText('Waiting for a quick check · only you can see this');
    expect(JSON.parse((await page.evaluate(() => sessionStorage.getItem('serendib:board:pending')))!)).toHaveLength(1);
    await expect(page.getByText('Got it. Your note is waiting for a quick check before it goes up.', { exact: true })).toBeVisible();
  } else {
    await expect(panel.getByRole('article').first()).toHaveAttribute('data-new'); await expect(page.getByText('Pinned. Thanks, Visitor!', { exact: true })).toBeVisible();
    if (!info.project.name.startsWith('mobile')) await expect(panel.getByRole('link', { name: '+ leave a message', exact: true })).toBeFocused();
  }
  expect(await page.evaluate(() => (window as unknown as { k10WidgetLog: string[] }).k10WidgetLog)).toContain('reset'); await capture(page, info, `response-${result}`);
});
const responses: { name: string; status?: number; response?: unknown; kind: string; copy: string; blocked?: boolean; network?: boolean; disabled?: boolean }[] = [
  { name: 'profanity', status: 422, response: { error: 'profanity', lang: 'en', joke: 'The kottu chef stopped chopping to read that. He says: rephrase, please.' }, kind: 'profanity', copy: 'The kottu chef stopped chopping to read that. He says: rephrase, please.' },
  { name: 'Sinhala-profanity', status: 422, response: { error: 'profanity', lang: 'si', joke: 'ලියුමට සීනි ටිකක් දාලා ආයෙත් එවන්න.' }, kind: 'profanity', copy: 'ලියුමට සීනි ටිකක් දාලා ආයෙත් එවන්න.' },
  { name: 'link', status: 422, response: { error: 'link' }, kind: 'link', copy: 'No links on the board, machan. Describe it in words instead.' },
  { name: 'rate', status: 429, response: { error: 'rate_limited', retryAfter: 42 }, kind: 'rate', copy: 'Easy, machan. One note a minute. Try again in 0:42.', disabled: true },
  { name: 'daily', status: 429, response: { error: 'rate_limited', retryAfter: 86400 }, kind: 'daily', copy: "That's five notes today. The board needs a rest; come back tomorrow.", disabled: true },
  { name: 'turnstile', status: 403, response: { error: 'turnstile' }, kind: 'turnstile', copy: "We couldn't confirm you're human. Try once more." },
  { name: 'origin', status: 403, response: { error: 'origin' }, kind: 'origin', copy: 'This note came from somewhere unexpected. Reload the page and try again.', disabled: true },
  { name: 'unavailable', status: 503, response: { error: 'unavailable' }, kind: 'unavailable', copy: 'The board is having a tea break. Your note is safe here; try again in a minute.' },
  { name: 'network', network: true, kind: 'network', copy: 'No signal. Check your connection; your note is still here.' },
  { name: 'blocked', blocked: true, kind: 'blocked', copy: "The human check didn't load (an ad blocker?). Allow challenges.cloudflare.com, or email Nipun instead.", disabled: true },
  { name: 'unexpected', status: 500, response: { error: 'unexpected' }, kind: 'unexpected', copy: 'Something went wrong with that note. Try again.' },
];
for (const response of responses) test(`response ${response.name} preserves text and shows its exact state`, async ({ page }, info) => {
  await mocks(page, { postStatus: response.status, post: response.response, network: response.network, blocked: response.blocked }); const dialog = await compose(page);
  if (!response.blocked) await pin(page);
  const failure = dialog.locator(`[data-failure="${response.kind}"]`); await expect(failure).toContainText(response.copy);
  await expect(dialog.getByLabel('Your note', { exact: true })).toHaveValue('A kind new note 🌴');
  if (response.disabled) await expect(dialog.getByRole('button', { name: response.name === 'rate' ? '0:42' : 'Pin it', exact: true })).toBeDisabled();
  else await expect(dialog.getByRole('button', { name: 'Pin it', exact: true })).toBeEnabled();
  if (response.name === 'Sinhala-profanity') await expect(failure.getByRole('alert')).toHaveAttribute('lang', 'si');
  if (response.kind === 'profanity') {
    await expect(dialog.locator('.k-compose-note')).toHaveAttribute('data-feedback', 'profanity'); await expect(failure.getByRole('alert')).toHaveText(response.copy);
    await expect(failure).toContainText('Edit your note and try again.');
    await expect(failure).toHaveCSS('opacity', '1');
  }
  if (response.name === 'origin') await expect(failure.getByRole('button', { name: 'Reload' })).toBeVisible();
  if (response.name === 'blocked') await expect(failure.getByRole('link', { name: 'Email Nipun instead' })).toHaveAttribute('href', 'mailto:theekshana2@gmail.com');
  await capture(page, info, `response-${response.name}`);
  if (response.kind === 'profanity') { await dialog.getByLabel('Your note', { exact: true }).fill('A kinder version'); await expect(failure).toHaveCount(0); }
});
test('400 shows every mapped field error and focuses the first one', async ({ page }, info) => {
  await mocks(page, { postStatus: 400, post: { error: 'invalid', fields: { email: 'server', name: 'server', body: 'server', color: 'server', request: 'server' } } }); const dialog = await compose(page); await pin(page);
  await expect(dialog.getByLabel('Email (optional, never shown)', { exact: true })).toBeFocused();
  await expect(dialog.getByRole('alert')).toHaveCount(5); await expect(dialog.locator('#board-name-error')).toHaveText('Sign it with a name, up to 40 characters.'); await expect(dialog.locator('#board-body-error')).toHaveText('Write something first, up to 300 characters.');
  await expect(dialog).toContainText('Press Random and try again.'); await capture(page, info, 'response-invalid');
  await page.route('**/api/postcards*', route => route.fulfill({ status: 400, json: { error: 'invalid', fields: { color: 'server' } } }));
  await pin(page); await expect(dialog.getByRole('button', { name: 'Random colour and font' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Random colour and font' })).toHaveAttribute('aria-invalid', 'true');
});
test('countdown reaches zero politely and daily cap survives reopening', async ({ page }) => {
  await page.clock.install(); await mocks(page, { postStatus: 429, post: { error: 'rate_limited', retryAfter: 2 } }); await compose(page); await pin(page);
  await expect(page.getByRole('button', { name: '0:02', exact: true })).toBeDisabled(); await page.clock.runFor(2100);
  await expect(page.getByRole('button', { name: 'Pin it', exact: true })).toBeEnabled(); await expect(page.locator('.k-compose-status')).toHaveText('You can pin again.');
  await page.route('**/api/postcards*', route => route.fulfill({ status: 429, json: { error: 'rate_limited', retryAfter: 86400 } })); await pin(page);
  await expect(page.locator('[data-failure="daily"]')).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'Pin it', exact: true })).toBeDisabled();
});
test('network retry works, sending locks fields, and a 15 second timeout preserves the draft', async ({ page }, info) => {
  await mocks(page, { network: true }); const dialog = await compose(page); await pin(page); await expect(dialog.locator('[data-failure="network"]')).toBeVisible();
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/postcards*', async route => { await held; await route.abort().catch(() => {}); });
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(dialog.getByRole('button', { name: 'Pinning…', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Your note', { exact: true })).toHaveAttribute('readonly'); await expect(dialog.getByLabel('Your name', { exact: true })).toHaveAttribute('readonly'); await capture(page, info, 'compose-pinning');
  await expect(dialog.locator('[data-failure="network"]')).toBeVisible({ timeout: 20000 });
  await expect(dialog.getByLabel('Your note', { exact: true })).toHaveValue('A kind new note 🌴');
  await expect(dialog.getByRole('button', { name: 'Pin it', exact: true })).toBeEnabled(); release();
});
test('reduced motion uses a border flash and suppresses shake, tape peel and dice spin', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mocks(page, { postStatus: 422, post: { error: 'profanity', lang: 'en', joke: 'Hari hari. Deep breath, sip of tea, try again.' } }); const dialog = await compose(page); await pin(page);
  await expect(dialog.locator('.k-compose-note')).toHaveCSS('animation-name', 'k-note-flash'); await expect(dialog.locator('.k-compose-tape')).toHaveCSS('animation-name', 'none');
  await capture(page, info, 'response-profanity-reduced');
});
test('phone action row follows the keyboard viewport and form fits without horizontal overflow', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Keyboard viewport is a phone sheet contract');
  await mocks(page); const dialog = await compose(page); await dialog.evaluate(el => (el as HTMLElement).style.setProperty('--sheet-viewport-height', '450px'));
  await expect(dialog.locator('.guestbook-app')).toHaveCSS('max-height', '398px'); await dialog.getByRole('button', { name: 'Pin it', exact: true }).scrollIntoViewIfNeeded();
  const dimensions = await dialog.locator('.guestbook-app').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth })); expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await expect(dialog.locator('.k-compose-actions')).toHaveCSS('position', 'sticky'); await capture(page, info, 'compose-keyboard');
});
for (const reduced of [false, true]) test(`visit counter counts once per session, animates when visible (reduced=${reduced})`, async ({ page }, info) => {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' }); await mocks(page); const methods: string[] = [];
  await page.route('**/api/visits', route => { methods.push(route.request().method()); return route.fulfill({ json: { count: 4977, counted: true } }); });
  await board(page); const counter = page.locator('[data-k-visits]'); await counter.scrollIntoViewIfNeeded(); await expect(counter.locator('.k-digit')).toHaveCount(6);
  await expect.poll(() => counter.locator('.k-digit').allTextContents()).toEqual(['0', '0', '4', '9', '7', '7']); await expect(counter).toHaveAttribute('aria-label', 'This is visit №4,977 since launch.');
  await capture(page, info, `counter-${reduced ? 'reduced' : 'animated'}`);
  await page.reload(); if (await page.locator('html').getAttribute('data-mode') === 'mobile') await page.addStyleTag({ content: '.phone-home{display:none!important} #story{display:block!important}' });
  await counter.scrollIntoViewIfNeeded(); await expect.poll(() => methods).toEqual(['POST', 'GET']);
});
test('unavailable counter hides digits and honestly shows its tea break', async ({ page }, info) => {
  await mocks(page, { visitStatus: 503 }); await board(page); const counter = page.locator('[data-k-visits]'); await counter.scrollIntoViewIfNeeded();
  await expect(counter).toHaveText('The visit counter is on a tea break.'); await expect(counter.locator('.k-digit')).toHaveCount(0);
  await capture(page, info, 'counter-unavailable');
});
test('no-JavaScript compose explains the board and provides email without visitor snapshots', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage(); await page.goto('/postcards');
  await expect(page.getByRole('heading', { name: 'Leave a note' })).toBeVisible(); await expect(page.getByRole('link', { name: 'email Nipun', exact: true })).toHaveAttribute('href', /mailto:theekshana2@gmail.com/);
  await expect(page.locator('[data-k-board] .k-note')).toHaveCount(0); await context.close();
});
if (process.env.K10_REAL_E2E) test('real Turnstile test key publishes through local D1 and renders on the board', async ({ page, request }) => {
  await page.goto('/postcards'); const dialog = page.getByRole('dialog', { name: 'New note', exact: true }); await expect(dialog).toBeVisible();
  const text = `A real local hello ${Date.now()} 🌴`; await dialog.getByLabel('Your note', { exact: true }).fill(text); await dialog.getByLabel('Your name', { exact: true }).fill('Local visitor');
  const response = page.waitForResponse(response => response.url().includes('/api/postcards') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Pin it', exact: true }).click(); const posted = await response; expect(posted.status()).toBe(201); const value = await posted.json();
  await expect(dialog).not.toBeVisible(); await page.locator('[data-k-board]').scrollIntoViewIfNeeded(); await expect(page.getByRole('article').filter({ hasText: text })).toBeVisible();
  const hidden = await request.post(`/api/postcards/${value.postcard.id}/hide`, { headers: { Authorization: 'Bearer local-k10-admin-token' } }); expect(hidden.status()).toBe(200);
});
