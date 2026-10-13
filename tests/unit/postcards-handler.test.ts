import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listPostcards, postPostcard, moderatePostcard } from '../../src/lib/server/postcards';
import type { BackendEnv } from '../../src/lib/server/env';
import { GUARD_MODEL, aiModeration } from '../../src/lib/server/moderate';
let db: DatabaseSync; let env: BackendEnv;
let ai: ReturnType<typeof vi.fn>;
const form = { name: 'Nipun', body: 'Hello 🌴 ශ්‍රී ලංකාව', email: 'private@example.com', color: 'paper', font: 'sans', turnstileToken: 'test-token' };
const request = (data: unknown = form, headers: Record<string, string> = {}) => new Request('http://localhost:8788/api/postcards', { method: 'POST', headers: { Origin: 'http://localhost:8788', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.1', ...headers }, body: JSON.stringify(data) });
const siteverify = vi.fn(async () => Response.json({ success: true, hostname: 'dummy', action: 'test' })) as unknown as typeof fetch;
function d1() {
  return { prepare(sql: string) {
    let params: (string | number | null)[] = [];
    const statement = {
      bind(...values: (string | number | null)[]) { params = values; return statement; },
      async first() { return db.prepare(sql).get(...params) ?? null; },
      async all() { return { results: db.prepare(sql).all(...params), success: true }; },
    }; return statement;
  } } as unknown as BackendEnv['DB'];
}
beforeEach(() => {
  db = new DatabaseSync(':memory:'); db.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
  ai = vi.fn(async () => ({ response: 'safe' }));
  env = { DB: d1(), AI: { run: ai } as unknown as BackendEnv['AI'], RL_POSTCARDS: { limit: vi.fn(async () => ({ success: true })) } as unknown as BackendEnv['RL_POSTCARDS'],
    TURNSTILE_SECRET: '1x0000000000000000000000000000000AA', TURNSTILE_SITE_KEY: '1x00000000000000000000AA', IP_HASH_SALT: 'salt', ADMIN_TOKEN: 'owner' };
});
afterEach(() => { db.close(); vi.restoreAllMocks(); });
const adminRequest = (token = 'owner') => new Request('http://localhost:8788/api/postcards/pending', { headers: { Authorization: `Bearer ${token}` } });
describe('postcards handlers with SQLite-backed mocked D1 and AI', () => {
  it('publishes without a token or Siteverify when no secret is configured, retaining origin, validation, filters and rate limits', async () => {
    delete env.TURNSTILE_SECRET; delete env.TURNSTILE_SITE_KEY;
    const { turnstileToken: _token, ...input } = form;
    const fetcher = vi.fn();
    expect((await postPostcard(request(input), env, fetcher)).status).toBe(201);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await postPostcard(request(input, { Origin: 'https://evil.com' }), env, fetcher)).status).toBe(403);
    expect((await postPostcard(request({ ...input, body: '' }), env, fetcher)).status).toBe(400);
    expect((await postPostcard(request({ ...input, body: 'fuck' }), env, fetcher)).status).toBe(422);
    expect((await postPostcard(request({ ...input, body: 'example.com' }), env, fetcher)).status).toBe(422);
    env.RL_POSTCARDS = { limit: async () => ({ success: false }) } as BackendEnv['RL_POSTCARDS'];
    expect((await postPostcard(request(input), env, fetcher)).status).toBe(429);
    expect(db.prepare('SELECT COUNT(*) AS count FROM postcards').get()!.count).toBe(1);
  });
  it('keeps token verification required when a secret exists, even without a public-key server variable', async () => {
    delete env.TURNSTILE_SITE_KEY;
    const fetcher = vi.fn(async () => Response.json({ success: false }));
    expect((await postPostcard(request(), env, fetcher)).status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const { turnstileToken: _token, ...input } = form;
    expect((await postPostcard(request(input), env, fetcher)).status).toBe(400);
    expect(db.prepare('SELECT COUNT(*) AS count FROM postcards').get()!.count).toBe(0);
  });
  it('uses an atomic D1 minute cap when the optional rate-limit binding is absent', async () => {
    delete env.TURNSTILE_SECRET; delete env.RL_POSTCARDS;
    const { turnstileToken: _token, ...input } = form;
    const responses = await Promise.all(Array.from({ length: 12 }, () => postPostcard(request(input), env, vi.fn())));
    expect(responses.filter(response => response.status === 201)).toHaveLength(3);
    expect(responses.filter(response => response.status === 429)).toHaveLength(9);
    expect(db.prepare('SELECT COUNT(*) AS count FROM postcards').get()!.count).toBe(3);
  });
  it('publishes immediately, keeps private fields out of GET/POST, and preserves Sinhala joiners', async () => {
    const response = await postPostcard(request(), env, siteverify); expect(response.status).toBe(201); const result = await response.json();
    expect(result.status).toBe('published'); expect(result.postcard.body).toBe(form.body); expect(Object.keys(result.postcard).sort()).toEqual(['body','color','country','created_at','font','id','name','rotation']);
    const row = db.prepare('SELECT * FROM postcards').get()!; expect(row.email).toBe(form.email); expect(row.ip_hash).toMatch(/^[a-f0-9]{64}$/); expect(row.ip_hash).not.toContain('203.0.113');
    expect(ai).toHaveBeenCalledWith(GUARD_MODEL, expect.objectContaining({ messages: [{ role: 'user', content: `Name: ${form.name}\nPostcard: ${form.body}` }] }));
    const listing = await listPostcards(new Request('http://localhost/api/postcards'), env); const text = await listing.text();
    expect(text).not.toMatch(/email|ip_hash|203\.0\.113|private@example/); expect(JSON.parse(text).items).toHaveLength(1);
    expect(listing.headers.get('Cache-Control')).toBe('public, max-age=30');
  });
  it('stores unsafe AI classifications pending and keeps them out of the public board', async () => {
    ai.mockResolvedValue({ response: 'unsafe\nS1' }); const response = await postPostcard(request(), env, siteverify);
    expect(response.status).toBe(202); expect(await response.json()).toEqual({ status: 'pending', message: 'Your postcard awaits approval.' });
    expect(db.prepare('SELECT status FROM postcards').get()!.status).toBe('pending'); expect((await (await listPostcards(new Request('http://localhost'), env)).json()).items).toHaveLength(0);
  });
  it.each(['missing', 'failure', 'invalid'])('fails open and logs on AI %s', async mode => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (mode === 'missing') delete env.AI; else if (mode === 'failure') ai.mockRejectedValue(new Error('unavailable')); else ai.mockResolvedValue({ response: '' });
    expect((await postPostcard(request(), env, siteverify)).status).toBe(201); expect(warn).toHaveBeenCalled();
  });
  it('bounds a stalled AI check and fails open without leaving a timer', async () => {
    vi.useFakeTimers(); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ai.mockImplementation(() => new Promise(() => {}));
    try {
      const pending = aiModeration(env, 'Visitor', 'Hello');
      await vi.advanceTimersByTimeAsync(8000);
      expect(await pending).toBe('published'); expect(warn).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it.each([[{ name: 'fuck' }, 'profanity', 'en'], [{ body: 'හුත්ත' }, 'profanity', 'si'], [{ name: 'example.com' }, 'link', undefined]])('rejects locally before AI: %j', async (fields, error, lang) => {
    const result = await postPostcard(request({ ...form, ...fields }), env, siteverify); expect(result.status).toBe(422); const detail = await result.json();
    expect(detail.error).toBe(error); if (lang) { expect(detail.lang).toBe(lang); expect(typeof detail.joke).toBe('string'); }
    expect(ai).not.toHaveBeenCalled(); expect(db.prepare('SELECT COUNT(*) AS count FROM postcards').get()!.count).toBe(0);
  });
  it('rejects origin, bad input, failed Turnstile and unavailable secrets without writes', async () => {
    expect((await postPostcard(request(form, { Origin: 'https://evil.com' }), env, siteverify)).status).toBe(403);
    expect((await postPostcard(request({ ...form, body: '' }), env, siteverify)).status).toBe(400);
    const failed = vi.fn(async () => Response.json({ success: false })) as unknown as typeof fetch;
    expect(await (await postPostcard(request(), env, failed)).json()).toEqual({ error: 'turnstile' });
    delete env.IP_HASH_SALT; expect((await postPostcard(request(), env, siteverify)).status).toBe(503); expect(ai).not.toHaveBeenCalled();
  });
  it('returns stable rate-limit codes and header, without running AI', async () => {
    env.RL_POSTCARDS = { limit: async () => ({ success: false }) } as BackendEnv['RL_POSTCARDS']; const response = await postPostcard(request(), env, siteverify);
    expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('60'); expect(await response.json()).toEqual({ error: 'rate_limited', retryAfter: 60 }); expect(ai).not.toHaveBeenCalled();
  });
  it('atomically caps simultaneous submissions at five, across all statuses', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => postPostcard(request(), env, siteverify)));
    expect(responses.filter(response => response.status === 201)).toHaveLength(5); expect(responses.filter(response => response.status === 429)).toHaveLength(7);
    db.exec("UPDATE postcards SET status = 'hidden'"); expect((await postPostcard(request(), env, siteverify)).status).toBe(429);
  });
  it('paginates by timestamp and ULID tie-break without duplicates and rejects invalid cursors', async () => {
    for (let i = 0; i < 5; i++) await postPostcard(request({ ...form, body: `hello ${i}` }), env, siteverify);
    db.exec('UPDATE postcards SET created_at = 1234'); let next: string | null = null; const ids: string[] = [];
    do { const page = await (await listPostcards(new Request(`http://localhost/?limit=2${next ? `&cursor=${next}` : ''}`), env)).json(); ids.push(...page.items.map((item: { id: string }) => item.id)); next = page.next; } while (next);
    expect(ids).toHaveLength(5); expect(new Set(ids).size).toBe(5); expect(ids).toEqual([...ids].sort().reverse());
    for (const query of ['cursor=bad', 'limit=61', 'limit=-1', 'limit=oops']) expect((await listPostcards(new Request(`http://localhost/?${query}`), env)).status).toBe(400);
  });
  it('guards pending/approve/hide, never returns private fields, and hides published cards', async () => {
    ai.mockResolvedValue({ response: 'unsafe\nS1' }); await postPostcard(request(), env, siteverify); const id = String(db.prepare('SELECT id FROM postcards').get()!.id);
    expect((await listPostcards(adminRequest('wrong'), env, 'pending')).status).toBe(401);
    const pending = await listPostcards(adminRequest(), env, 'pending'); expect(pending.headers.get('Cache-Control')).toBe('no-store'); expect((await pending.json()).items).toHaveLength(1);
    expect((await moderatePostcard(adminRequest('wrong'), env, id, 'approve')).status).toBe(401);
    const approved = await moderatePostcard(adminRequest(), env, id, 'approve'); expect((await approved.json()).status).toBe('published');
    expect((await (await listPostcards(new Request('http://localhost'), env)).json()).items).toHaveLength(1);
    expect(await (await moderatePostcard(adminRequest(), env, id, 'hide')).json()).toEqual({ status: 'hidden', id });
    expect((await (await listPostcards(new Request('http://localhost'), env)).json()).items).toHaveLength(0);
    expect((await moderatePostcard(adminRequest(), env, id, 'remove')).status).toBe(400);
    expect((await moderatePostcard(adminRequest(), env, '00000000000000000000000000', 'hide')).status).toBe(404);
  });
});
