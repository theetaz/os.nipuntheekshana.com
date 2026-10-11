import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../../src/os/lib/fetch-json';
import { readInitialData } from '../../src/os/lib/initial-data';
afterEach(() => vi.unstubAllGlobals());
describe('JSON data utilities', () => {
  it('deduplicates pending requests and caches successful responses', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal('fetch', fetch);
    const one = fetchJson('/test/dedup'); const two = fetchJson('/test/dedup');
    expect(two).toBe(one); expect(fetch).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ value: 42 })));
    expect(await one).toEqual({ value: 42 }); expect(await fetchJson('/test/dedup')).toEqual({ value: 42 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('allows retry after HTTP and malformed JSON failures', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('offline', { status: 503 }))
      .mockResolvedValueOnce(new Response('not json')).mockResolvedValueOnce(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchJson('/test/retry')).rejects.toThrow('503');
    await expect(fetchJson('/test/retry')).rejects.toThrow();
    expect(await fetchJson('/test/retry')).toEqual({ ok: true }); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('returns no embedded data during SSR', () => expect(readInitialData('profile')).toBeNull());
});
