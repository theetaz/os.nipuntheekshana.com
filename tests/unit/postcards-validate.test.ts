import { describe, expect, it, vi } from 'vitest';
import { validate, readJson } from '../../src/lib/server/validate';
import { hashIp } from '../../src/lib/server/ip-hash';
import { ulid, isUlid } from '../../src/lib/server/ulid';
import { checkRateLimit, dailyRetryAfter } from '../../src/lib/server/rate-limit';
import { featureHealth, type BackendEnv } from '../../src/lib/server/env';
import { validOrigin, verifyTurnstile } from '../../src/lib/server/turnstile';
import { isAdmin } from '../../src/lib/server/admin';
const input = { name: 'Nipun', body: 'Hello 🌴', color: 'paper', font: 'sans', turnstileToken: 'token' };
describe('validation', () => {
  it('trims edges while keeping original case and Sinhala joiners', () => {
    expect(validate({ ...input, name: ' Nipun ', body: ' ශ්‍රී ලංකාව ' })).toMatchObject({ ok: true, value: { name: 'Nipun', body: 'ශ්‍රී ලංකාව', email: null } });
  });
  it('counts Unicode code points and accepts a 300 character body', () => {
    expect(validate({ ...input, body: '🌴'.repeat(300) }).ok).toBe(true); expect(validate({ ...input, body: '🌴'.repeat(301) }).ok).toBe(false);
  });
  it.each([{ name: '' }, { name: 'a'.repeat(41) }, { body: '' }, { body: 'a'.repeat(301) }, { email: 'nope' }, { email: 42 }, { color: 'red' }, { font: 'comic' }, { turnstileToken: '' }, { turnstileToken: 'a'.repeat(2049) }, { name: 'a\0b' }])('rejects invalid fields %j', fields => expect(validate({ ...input, ...fields }).ok).toBe(false));
  it.each([null, [], 'hello', 42])('rejects nonobjects %j', value => expect(validate(value).ok).toBe(false));
  it('accepts a private email and treats omission as null', () => { expect(validate({ ...input, email: 'friend@example.com' })).toMatchObject({ ok: true, value: { email: 'friend@example.com' } }); });
  it('rejects invalid JSON, media types and oversized chunked bodies', async () => {
    await expect(readJson(new Request('http://localhost', { method: 'POST', body: 'bad', headers: { 'Content-Type': 'application/json' } }))).rejects.toThrow();
    await expect(readJson(new Request('http://localhost', { method: 'POST', body: '{}' }))).rejects.toThrow();
    await expect(readJson(new Request('http://localhost', { method: 'POST', body: ' '.repeat(8193), headers: { 'Content-Type': 'application/json' } }))).rejects.toThrow('size');
  });
});
describe('protection', () => {
  it('hashes into a salted, day-specific 64 digit digest', async () => {
    const digest = await hashIp('203.0.113.1', 'salt', '2026-10-12'); expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashIp('203.0.113.1', 'salt', '2026-10-12')).toBe(digest);
    expect(await hashIp('203.0.113.1', 'salt2', '2026-10-12')).not.toBe(digest); expect(await hashIp('203.0.113.1', 'salt', '2026-10-13')).not.toBe(digest);
  });
  it('issues valid time-sortable ULIDs with distinct random suffixes', () => {
    const values = Array.from({ length: 100 }, () => ulid(1000)); expect(new Set(values).size).toBe(100);
    expect(values.every(isUlid)).toBe(true); expect(ulid(1000) < ulid(1001)).toBe(true); expect(() => ulid(-1)).toThrow();
  });
  it('uses the minute limiter before D1, then counts all statuses for the UTC day', async () => {
    const first = vi.fn(async () => ({ count: 5 })); const bind = vi.fn(() => ({ first })); const prepare = vi.fn(() => ({ bind }));
    const limit = vi.fn(async () => ({ success: false })); const env = { DB: { prepare }, RL_POSTCARDS: { limit } } as unknown as BackendEnv;
    expect(await checkRateLimit(env, 'hash', Date.parse('2026-10-12T23:59:58Z'))).toBe(60); expect(prepare).not.toHaveBeenCalled();
    limit.mockResolvedValue({ success: true }); expect(await checkRateLimit(env, 'hash', Date.parse('2026-10-12T23:59:58Z'))).toBe(2);
    expect(bind).toHaveBeenCalledWith('hash', Date.parse('2026-10-12')); first.mockResolvedValue({ count: 4 }); expect(await checkRateLimit(env, 'hash')).toBeNull();
  });
  it('provides a positive retry interval on UTC day rollover', () => expect(dailyRetryAfter(Date.parse('2026-10-12T23:59:59.999Z'))).toBe(1));
  it('keeps health false when secrets are missing and AI Messages disabled', () => {
    expect(featureHealth({})).toEqual({ ai: false, postcards: false });
    expect(featureHealth({ AI_MESSAGES_ENABLED: 'false' })).toEqual({ ai: false, postcards: false });
  });
  it('requires the exact same origin and rejects arbitrary production hosts', () => {
    expect(validOrigin(new Request('https://os.nipuntheekshana.com/api/postcards', { headers: { Origin: 'https://os.nipuntheekshana.com' } }))).toBe(true);
    expect(validOrigin(new Request('http://localhost:8788/api/postcards', { headers: { Origin: 'http://localhost:8788' } }))).toBe(true);
    expect(validOrigin(new Request('http://localhost:8788/api/postcards', { headers: { Origin: 'https://evil.com' } }))).toBe(false);
    expect(validOrigin(new Request('https://evil.com/api/postcards', { headers: { Origin: 'https://evil.com' } }))).toBe(false);
  });
  it('checks Siteverify hostname and action, including actual dummy secret verification', async () => {
    const fetcher = vi.fn(async () => Response.json({ success: true, hostname: 'os.nipuntheekshana.com', action: 'postcard' })) as unknown as typeof fetch;
    expect(await verifyTurnstile('token', 'secret', 'ip', 'https://os.nipuntheekshana.com', fetcher)).toBe(true);
    expect(await verifyTurnstile('token', 'secret', 'ip', 'https://wrong.com', fetcher)).toBe(false);
    const dummy = vi.fn(async () => Response.json({ success: true, hostname: 'dummy', action: 'test' })) as unknown as typeof fetch;
    expect(await verifyTurnstile('token', '1x0000000000000000000000000000000AA', 'ip', 'http://localhost:8788', dummy)).toBe(true);
    expect(await verifyTurnstile('token', 'secret', 'ip', 'http://localhost:8788', dummy)).toBe(false);
    const error = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    expect(await verifyTurnstile('token', 'secret', 'ip', 'http://localhost:8788', error)).toBe(false);
  });
  it('requires an exact bearer token including when lengths differ', async () => {
    const request = (token: string) => new Request('http://localhost', { headers: { Authorization: token } });
    expect(await isAdmin(request('Bearer owner'), 'owner')).toBe(true);
    for (const value of ['Bearer owne', 'Bearer ownerx', 'Basic owner', 'Bearer wrong', '']) expect(await isAdmin(request(value), 'owner')).toBe(false);
    expect(await isAdmin(request('Bearer owner'))).toBe(false);
  });
});
