export type PostcardColor = 'paper' | 'thambili' | 'lagoon' | 'lotus' | 'tea';
export type PostcardFont = 'sans' | 'serif' | 'handwriting';
export interface Postcard {
  id: string; created_at: number; name: string; body: string; color: PostcardColor; font: PostcardFont; rotation: number; country: string | null;
}
export interface PostcardPage { items: Postcard[]; next: string | null }
export interface ComposePostcard { name: string; body: string; email?: string; color: PostcardColor; font: PostcardFont; turnstileToken?: string }
export type PostcardResult = { status: 'published'; postcard: Postcard } | { status: 'pending'; message: string };
export type PostcardFailure = { error: 'profanity'; lang: 'en' | 'si'; joke: string } | { error: 'link' | 'turnstile' | 'origin' | 'unavailable' | 'unexpected' }
  | { error: 'invalid'; fields: Record<string, string> } | { error: 'rate_limited'; retryAfter: number };
export class PostcardError extends Error {
  constructor(public readonly detail: PostcardFailure, public readonly status: number) { super(detail.error); }
}
async function response<T>(request: Promise<Response>): Promise<T> {
  const result = await request;
  const data = await result.json().catch(() => ({ error: 'unexpected' }));
  if (!result.ok) throw new PostcardError(data as PostcardFailure, result.status);
  if (data.error) throw new PostcardError({ error: 'unexpected' }, result.status);
  return data as T;
}
export function getPostcards(cursor?: string | null, signal?: AbortSignal): Promise<PostcardPage> {
  return response(fetch(`/api/postcards?limit=40${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal, cache: 'no-store' }));
}
export async function postPostcard(input: ComposePostcard, signal?: AbortSignal): Promise<PostcardResult> {
  const controller = new AbortController(); const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let release = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    const abort = () => reject(combined.reason);
    combined.addEventListener('abort', abort, { once: true }); release = () => combined.removeEventListener('abort', abort);
    if (combined.aborted) abort();
  });
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), 15000);
  try {
    // Some transports do not reject fetch promptly on abort. The UI deadline
    // still settles, and a late response cannot insert a second note in the UI.
    return await Promise.race([response<PostcardResult>(fetch('/api/postcards', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input), signal: combined })), interrupted]);
  } finally { clearTimeout(timer); release(); }
}
export function turnstileSiteKey(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="turnstile-site-key"]')?.content ?? '';
}
let health: Promise<boolean> | undefined;
export function boardAvailable(): Promise<boolean> {
  return health ??= fetch('/api/health', { signal: AbortSignal.timeout(15000) }).then(async result => {
    if (!result.ok) throw new Error('Health unavailable');
    return (await result.json()).postcards === true;
  }).catch(error => { health = undefined; throw error; });
}

export const fieldMessages = {
  body: 'Write something first, up to 300 characters.',
  name: 'Sign it with a name, up to 40 characters.',
  email: "That email doesn't look right. It's optional, so you can leave it empty.",
  color: 'Press Random and try again.', font: 'Press Random and try again.',
  request: 'Something went wrong with that note. Try again.',
};
export const linkMessage = 'No links on the board, machan. Describe it in words instead.';
export const blockedMessage = "The human check didn't load (an ad blocker?). Allow challenges.cloudflare.com, or email Nipun instead.";
export type BoardFailure = { kind: string; message: string; fields?: Record<string, string>; retryAfter?: number; lang?: 'en' | 'si' };
export const countdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
export function mapPostcardError(error: unknown): BoardFailure {
  if (!(error instanceof PostcardError)) return { kind: 'network', message: 'No signal. Check your connection; your note is still here.' };
  const value = error.detail;
  if (error.status === 422 && value.error === 'profanity') return { kind: 'profanity', message: value.joke, lang: value.lang };
  if (error.status === 422 && value.error === 'link') return { kind: 'link', message: linkMessage };
  if (error.status === 400 && value.error === 'invalid') {
    const fields = Object.fromEntries(Object.keys(value.fields).map(field => [field, fieldMessages[field as keyof typeof fieldMessages] ?? fieldMessages.request]));
    return { kind: 'invalid', message: '', fields };
  }
  if (error.status === 429 && value.error === 'rate_limited' && Number.isFinite(value.retryAfter) && value.retryAfter >= 0) {
    const seconds = Math.ceil(value.retryAfter);
    return seconds > 3600 ? { kind: 'daily', message: "That's five notes today. The board needs a rest; come back tomorrow." }
      : { kind: 'rate', message: `Easy, machan. One note a minute. Try again in ${countdown(seconds)}.`, retryAfter: seconds };
  }
  if (error.status === 403 && value.error === 'turnstile') return { kind: 'turnstile', message: "We couldn't confirm you're human. Try once more." };
  if (error.status === 403 && value.error === 'origin') return { kind: 'origin', message: 'This note came from somewhere unexpected. Reload the page and try again.' };
  if (error.status === 503 && value.error === 'unavailable') return { kind: 'unavailable', message: 'The board is having a tea break. Your note is safe here; try again in a minute.' };
  return { kind: 'unexpected', message: fieldMessages.request };
}
