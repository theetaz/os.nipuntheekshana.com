export type PostcardColor = 'paper' | 'thambili' | 'lagoon' | 'lotus' | 'tea';
export type PostcardFont = 'sans' | 'serif' | 'handwriting';
export interface Postcard {
  id: string; created_at: number; name: string; body: string; color: PostcardColor; font: PostcardFont; rotation: number; country: string | null;
}
export interface PostcardPage { items: Postcard[]; next: string | null }
export interface ComposePostcard { name: string; body: string; email?: string; color: PostcardColor; font: PostcardFont; turnstileToken: string }
export type PostcardResult = { status: 'published'; postcard: Postcard } | { status: 'pending'; message: string };
export type PostcardFailure = { error: 'profanity'; lang: 'en' | 'si'; joke: string } | { error: 'link' | 'turnstile' | 'origin' | 'unavailable' }
  | { error: 'invalid'; fields: Record<string, string> } | { error: 'rate_limited'; retryAfter: number };
export class PostcardError extends Error {
  constructor(public readonly detail: PostcardFailure, public readonly status: number) { super(detail.error); }
}
async function response<T>(request: Promise<Response>): Promise<T> {
  const result = await request; const data = await result.json();
  if (!result.ok) throw new PostcardError(data as PostcardFailure, result.status);
  return data as T;
}
export function getPostcards(cursor?: string | null, signal?: AbortSignal): Promise<PostcardPage> {
  return response(fetch(`/api/postcards${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal, cache: 'no-store' }));
}
export function postPostcard(input: ComposePostcard, signal?: AbortSignal): Promise<PostcardResult> {
  return response(fetch('/api/postcards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal }));
}
