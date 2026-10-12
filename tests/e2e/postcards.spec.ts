import { test, expect } from '@playwright/test';
test.use({ baseURL: process.env.POSTCARDS_BASE_URL ?? 'http://localhost:8788' });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('serendib:booted', 'true')); });
const input = { name: 'Visitor', body: 'A friendly hello from the postcard tests 🌴', color: 'paper', font: 'sans', email: 'private@example.com', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' };
const admin = { Authorization: `Bearer ${process.env.POSTCARDS_ADMIN_TOKEN ?? 'local-postcards-test-admin-token'}` };
test('local postcards API publishes, paginates, rejects filters, rate limits and supports owner hiding', async ({ request, baseURL }, info) => {
  const ip = `203.0.113.${20 + info.project.name.length + info.workerIndex}`;
  const headers = { Origin: baseURL!, 'CF-Connecting-IP': ip };
  const ids: string[] = [];
  for (let index = 0; index < 3; index++) {
    const result = await request.post('/api/postcards', { headers, data: { ...input, body: `${input.body} ${info.project.name} ${index}` } });
    expect(result.status()).toBe(201); const value = await result.json(); expect(value.status).toBe('published'); ids.push(value.postcard.id);
    expect(JSON.stringify(value)).not.toMatch(/email|ip_hash|private@example/);
  }
  const rate = await request.post('/api/postcards', { headers, data: input }); expect(rate.status()).toBe(429); expect(await rate.json()).toMatchObject({ error: 'rate_limited', retryAfter: 60 });
  for (const [body, error, lang] of [['fuck', 'profanity', 'en'], ['හුත්ත', 'profanity', 'si'], ['example.com', 'link', undefined]]) {
    const rejected = await request.post('/api/postcards', { headers, data: { ...input, body } }); expect(rejected.status()).toBe(422);
    const value = await rejected.json(); expect(value.error).toBe(error); if (lang) { expect(value.lang).toBe(lang); expect(typeof value.joke).toBe('string'); }
  }
  expect((await request.post('/api/postcards', { headers: { ...headers, Origin: 'https://evil.example' }, data: input })).status()).toBe(403);
  expect((await request.post('/api/postcards', { headers, data: { ...input, body: '' } })).status()).toBe(400);
  const first = await (await request.get('/api/postcards?limit=1')).json(); expect(first.items).toHaveLength(1); expect(first.next).toBeTruthy();
  const second = await (await request.get(`/api/postcards?limit=1&cursor=${encodeURIComponent(first.next)}`)).json(); expect(second.items[0].id).not.toBe(first.items[0].id);
  expect((await request.get('/api/postcards/pending')).status()).toBe(401);
  expect((await request.get('/api/postcards/pending', { headers: admin })).status()).toBe(200);
  for (const id of ids) {
    expect((await request.post(`/api/postcards/${id}/approve`, { headers: admin })).status()).toBe(200);
    expect((await request.post(`/api/postcards/${id}/hide`, { headers: admin })).status()).toBe(200);
  }
});
test('real Turnstile test widget posts a postcard that appears immediately', async ({ page, request }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/postcards'); const dialog = page.getByRole('dialog', { name: 'Postcards', exact: true }); await expect(dialog).toBeVisible();
  // A production artifact may contain the real public key. Use Cloudflare's
  // real test widget with the local test secret, without stubbing verification.
  await page.locator('meta[name="turnstile-site-key"]').evaluate(meta => meta.setAttribute('content', '1x00000000000000000000AA'));
  await dialog.getByRole('button', { name: 'Write a postcard' }).click();
  await dialog.getByLabel('Name', { exact: true }).fill(`Visitor ${info.project.name}`);
  const text = `A fresh postcard from ${info.project.name} ${Date.now()} 🌴`;
  await dialog.getByLabel('Postcard', { exact: true }).fill(text); await dialog.getByLabel('Email (optional, private)', { exact: true }).fill('private@example.com');
  const post = dialog.getByRole('button', { name: 'Post', exact: true }); await expect(post).toBeEnabled({ timeout: 30000 });
  const response = page.waitForResponse(response => response.url().endsWith('/api/postcards') && response.request().method() === 'POST');
  await post.click(); const result = await response; expect(result.status()).toBe(201);
  const value = await result.json(); await expect(dialog.getByRole('status')).toHaveText('Your postcard is published.');
  await expect(dialog.getByRole('list', { name: 'Published postcards' }).getByText(text, { exact: true })).toBeVisible();
  expect(errors).toEqual([]); await request.post(`/api/postcards/${value.postcard.id}/hide`, { headers: admin });
});
