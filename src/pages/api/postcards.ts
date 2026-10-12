/** JSON contract (UI): GET ?cursor=&limit=1..60 -> { items, next }, published,
 * newest first. Public Postcard: id, created_at (ms), name, body, color, font,
 * rotation, country. No email, IP or hash is ever returned.
 * POST { name:1..40, body:1..300, email?, color:paper|thambili|lagoon|lotus|tea,
 * font:sans|serif|handwriting, turnstileToken } -> 201 {status:'published',postcard}
 * or 202 {status:'pending',message}. Errors: 422 {error:'profanity',lang:'en'|'si',joke}
 * / {error:'link'}; 400 {error:'invalid',fields}; 429 {error:'rate_limited',retryAfter}
 * (seconds, also Retry-After); 403 {error:'turnstile'|'origin'}; 503 {error:'unavailable'}.
 * Owner: GET /pending -> {items,next}; POST /:id/approve -> {status,postcard},
 * POST /:id/hide -> {status:'hidden',id}. Bearer ADMIN_TOKEN required (401),
 * invalid id/action (400), missing card (404). Owner responses are no-store.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listPostcards, postPostcard } from '../../lib/server/postcards';
import { json } from '../../lib/server/env';
export const prerender = false;
export const GET: APIRoute = ({ request }) => listPostcards(request, env);
export const POST: APIRoute = ({ request }) => postPostcard(request, env);
export const ALL: APIRoute = () => json({ error: 'method' }, 405, { Allow: 'GET, POST' });
