import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockedMessage, boardAvailable, fieldMessages, getPostcards, mapPostcardError, PostcardError, postPostcard, turnstileSiteKey } from '../../src/os/apps/guestbook/api';
import { codePoints, DRAFT_KEY, emptyDraft, hasLink, mostlySinhala, noteSize, PENDING_KEY, pendingNotes, pinNote, readDraft, saveStored, trimInput, validateDraft } from '../../src/os/apps/guestbook/board';
const postcard = { id: 'note-1', name: 'Ama', body: 'Hello 🌴', created_at: 1000, color: 'paper' as const, font: 'handwriting' as const, rotation: -2, country: 'LK' };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('board response mapping', () => {
  it.each([
    [422, { error: 'profanity', lang: 'si', joke: 'ලියුමට සීනි ටිකක් දාලා ආයෙත් එවන්න.' }, 'profanity', 'ලියුමට සීනි ටිකක් දාලා ආයෙත් එවන්න.'],
    [422, { error: 'link' }, 'link', 'No links on the board, machan. Describe it in words instead.'],
    [429, { error: 'rate_limited', retryAfter: 42 }, 'rate', 'Easy, machan. One note a minute. Try again in 0:42.'],
    [429, { error: 'rate_limited', retryAfter: 3600 }, 'rate', 'Easy, machan. One note a minute. Try again in 60:00.'],
    [429, { error: 'rate_limited', retryAfter: 3601 }, 'daily', "That's five notes today. The board needs a rest; come back tomorrow."],
    [403, { error: 'turnstile' }, 'turnstile', "We couldn't confirm you're human. Try once more."],
    [403, { error: 'origin' }, 'origin', 'This note came from somewhere unexpected. Reload the page and try again.'],
    [503, { error: 'unavailable' }, 'unavailable', 'The board is having a tea break. Your note is safe here; try again in a minute.'],
    [500, { error: 'unexpected' }, 'unexpected', fieldMessages.request],
    [200, { error: 'link' }, 'unexpected', fieldMessages.request],
    [429, { error: 'rate_limited', retryAfter: -1 }, 'unexpected', fieldMessages.request],
  ])('maps %s %j without using server prose', (status, detail, kind, message) => {
    expect(mapPostcardError(new PostcardError(detail as never, status as number))).toMatchObject({ kind, message });
  });
  it('maps every field and preserves first-error order', () => {
    const detail = mapPostcardError(new PostcardError({ error: 'invalid', fields: { email: 'private server text', name: '', body: '', color: '', font: '', request: '', other: '' } }, 400));
    expect(Object.keys(detail.fields!)[0]).toBe('email'); expect(detail.fields).toEqual({ ...fieldMessages, other: fieldMessages.request });
  });
  it('maps rejected requests and timeouts to the network state', () => {
    for (const error of [new TypeError('Failed to fetch'), new DOMException('Timed out', 'TimeoutError')]) expect(mapPostcardError(error)).toEqual({ kind: 'network', message: 'No signal. Check your connection; your note is still here.' });
    expect(blockedMessage).toContain('Allow challenges.cloudflare.com');
  });
  it('uses the unchanged list cursor, limit 40 and exact POST shape', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ items: [postcard], next: 'opaque_cursor' }))
      .mockResolvedValueOnce(Response.json({ status: 'published', postcard }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ status: 'pending', message: 'Your postcard awaits approval.' }, { status: 202 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getPostcards('opaque cursor/')).toEqual({ items: [postcard], next: 'opaque_cursor' });
    expect(fetcher.mock.calls[0]![0]).toBe('/api/postcards?limit=40&cursor=opaque%20cursor%2F');
    const input = { ...emptyDraft, name: 'Ama', body: 'Hello', turnstileToken: 'token' };
    expect(await postPostcard(input)).toEqual({ status: 'published', postcard });
    expect(await postPostcard(input)).toMatchObject({ status: 'pending' });
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual(input);
  });
  it('handles non-JSON failures and enforces the 15 second request deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('upstream', { status: 502 }))
      .mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)))));
    expect(mapPostcardError(await getPostcards().catch(error => error)).kind).toBe('unexpected');
    const result = postPostcard({ ...emptyDraft, turnstileToken: 'token' }).catch(error => error);
    const signal = vi.mocked(fetch).mock.calls[1]![1]!.signal!;
    await vi.advanceTimersByTimeAsync(14999); expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(signal.aborted).toBe(true);
    expect(mapPostcardError(await result).kind).toBe('network'); expect(vi.getTimerCount()).toBe(0);
  });
  it('settles at the deadline even when fetch ignores abort, and cancels immediately on disposal', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const input = { ...emptyDraft, turnstileToken: 'token' };
    const expired = postPostcard(input).catch(error => error);
    await vi.advanceTimersByTimeAsync(15000); expect(mapPostcardError(await expired).kind).toBe('network'); expect(vi.getTimerCount()).toBe(0);
    const controller = new AbortController(); const disposed = postPostcard(input, controller.signal).catch(error => error);
    controller.abort(); expect((await disposed).name).toBe('AbortError'); expect(vi.getTimerCount()).toBe(0);
  });
  it('caches health per page and reads P7’s public-key meta tag', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ai: false, postcards: true })); vi.stubGlobal('fetch', fetcher);
    expect(await boardAvailable()).toBe(true); expect(await boardAvailable()).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1);
    vi.stubGlobal('document', { querySelector: () => ({ content: 'public-key' }) }); expect(turnstileSiteKey()).toBe('public-key');
  });
});
describe('Unicode drafts and session notes', () => {
  function storage() {
    const values = new Map<string, string>(); vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }); return values;
  }
  it('counts trimmed code points and keeps an emoji intact at 300', () => {
    const text = 'a'.repeat(299) + '🌴'; expect(codePoints(`  ${text}  `)).toBe(300);
    expect(trimInput(text + 'x', 300)).toBe(text); expect(trimInput('  🌴🌴 ', 1)).toBe('  🌴');
    expect(noteSize('a'.repeat(240), 'sans')).toBe(13); expect(noteSize('a'.repeat(150), 'sans')).toBe(15);
  });
  it('validates fields without truncating Sinhala ZWJ or interpreting markup', () => {
    expect(validateDraft(emptyDraft)).toEqual({ body: 'body', name: 'name' });
    expect(validateDraft({ ...emptyDraft, name: 'Ama', body: '<script>hello</script> ශ්‍රී', email: 'bad' })).toEqual({ email: 'email' });
    expect(hasLink('www.example.com')).toBe(true); expect(hasLink('https://example.lk')).toBe(true); expect(hasLink('ftp://example.ai')).toBe(true); expect(hasLink('example.ai')).toBe(true); expect(hasLink('A friendly hello.')).toBe(false);
    expect(mostlySinhala('ආයුබෝවන්!')).toBe(true); expect(mostlySinhala('Hello ශ්‍රී')).toBe(false);
  });
  it('recovers valid drafts, bounds corrupt input, and tolerates disabled storage', () => {
    const values = storage(); saveStored(DRAFT_KEY, { ...emptyDraft, body: 'Hello 🌴', name: 'Ama', email: 'private@example.com' });
    expect(readDraft()).toMatchObject({ body: 'Hello 🌴', name: 'Ama', email: 'private@example.com' });
    values.set(DRAFT_KEY, '{'); expect(readDraft()).toEqual(emptyDraft);
    values.set(DRAFT_KEY, JSON.stringify({ ...emptyDraft, body: 'a'.repeat(301), color: 'evil', font: 'evil' }));
    expect(readDraft().body).toHaveLength(300); expect(readDraft().color).toBe('paper');
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); }, removeItem: () => { throw new Error(); } });
    expect(readDraft()).toEqual(emptyDraft); expect(() => saveStored(DRAFT_KEY, null)).not.toThrow();
  });
  it('retains at most five session-only pending public notes and rejects malformed styling', async () => {
    storage(); vi.stubGlobal('document', { dispatchEvent: vi.fn() });
    for (let i = 0; i < 8; i++) await pinNote({ ...postcard, id: `pending-${i}` }, true);
    expect(pendingNotes().map(item => item.id)).toEqual(['pending-7', 'pending-6', 'pending-5', 'pending-4', 'pending-3']);
    saveStored(PENDING_KEY, [{ ...postcard, color: 'url(evil)' }]); expect(pendingNotes()).toEqual([]);
  });
});
