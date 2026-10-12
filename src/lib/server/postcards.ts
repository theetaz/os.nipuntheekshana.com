import { featureHealth, json, type BackendEnv } from './env';
import { validate, readJson } from './validate';
import { validOrigin, verifyTurnstile } from './turnstile';
import { hashIp, utcDay } from './ip-hash';
import { checkRateLimit, dailyRetryAfter, DAILY_CAP } from './rate-limit';
import { ulid, isUlid } from './ulid';
import { localModeration, aiModeration } from './moderate';
import { pickJoke } from './jokes';
import { isAdmin } from './admin';
const PUBLIC_COLUMNS = 'id, created_at, name, body, color, font, rotation, country';
export interface PublicPostcard {
  id: string; created_at: number; name: string; body: string; color: string; font: string; rotation: number; country: string | null;
}
export async function listPostcards(request: Request, env: BackendEnv, status: 'published' | 'pending' = 'published'): Promise<Response> {
  if (status === 'pending' && !await isAdmin(request, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'unavailable' }, 503);
  const query = new URL(request.url).searchParams; const cursor = query.get('cursor'); const limitText = query.get('limit') ?? '60';
  const limit = Number(limitText); const parts = cursor?.split('_');
  if (!/^\d+$/.test(limitText) || !Number.isInteger(limit) || limit < 1 || limit > 60) return json({ error: 'invalid', fields: { limit: 'Use 1–60.' } }, 400);
  if (cursor && (!parts || parts.length !== 2 || !/^\d{1,15}$/.test(parts[0]!) || !Number.isSafeInteger(Number(parts[0])) || !isUlid(parts[1]!))) return json({ error: 'invalid', fields: { cursor: 'Invalid cursor.' } }, 400);
  const sql = `SELECT ${PUBLIC_COLUMNS} FROM postcards WHERE status = ?${cursor ? ' AND (created_at < ? OR (created_at = ? AND id < ?))' : ''} ORDER BY created_at DESC, id DESC LIMIT ?`;
  try {
    const args = cursor ? [status, Number(parts![0]), Number(parts![0]), parts![1]!, limit + 1] : [status, limit + 1];
    const result = await env.DB.prepare(sql).bind(...args).all<PublicPostcard>();
    const items = result.results.slice(0, limit); const last = items.at(-1);
    return json({ items, next: result.results.length > limit && last ? `${last.created_at}_${last.id}` : null }, 200,
      status === 'published' ? { 'Cache-Control': 'public, max-age=30' } : {});
  } catch { console.error('postcards: listing failed'); return json({ error: 'unavailable' }, 503); }
}
export async function postPostcard(request: Request, env: BackendEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  if (!validOrigin(request)) return json({ error: 'origin' }, 403);
  let input: unknown;
  try { input = await readJson(request); } catch { return json({ error: 'invalid', fields: { request: 'Use a JSON body of at most 8192 bytes.' } }, 400); }
  const validation = validate(input);
  if (!validation.ok) return json({ error: 'invalid', fields: validation.fields }, 400);
  const value = validation.value;
  // Matching normalisation is applied to both fields, never to persisted text.
  const rejection = localModeration(value.name, value.body);
  if (rejection === 'en' || rejection === 'si') return json({ error: 'profanity', lang: rejection, joke: pickJoke() }, 422);
  if (rejection === 'link') return json({ error: 'link' }, 422);
  if (!featureHealth(env).postcards) return json({ error: 'unavailable' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!await verifyTurnstile(value.turnstileToken, env.TURNSTILE_SECRET!, ip, new URL(request.url).origin, fetcher)) return json({ error: 'turnstile' }, 403);
  const now = Date.now(); const day = utcDay(now); const ipHash = await hashIp(ip, env.IP_HASH_SALT!, day);
  try {
    const retryAfter = await checkRateLimit(env, ipHash, now);
    if (retryAfter !== null) return limited(retryAfter);
    const status = await aiModeration(env, value.name, value.body);
    const id = ulid(now); const rotation = (crypto.getRandomValues(new Uint16Array(1))[0]! / 65535) * 8 - 4;
    const cf = (request as Request & { cf?: { country?: string } }).cf;
    const country = cf?.country && /^[A-Z]{2}$/.test(cf.country) ? cf.country : null;
    // One SQLite statement makes the cap atomic across concurrent requests,
    // including pending and hidden cards. RETURNING contains public fields only.
    const inserted = await env.DB!.prepare(`INSERT INTO postcards (id, created_at, name, body, email, color, font, rotation, country, ip_hash, status)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM postcards WHERE ip_hash = ? AND created_at >= ?) < ? RETURNING ${PUBLIC_COLUMNS}`)
      .bind(id, now, value.name, value.body, value.email, value.color, value.font, rotation, country, ipHash, status, ipHash, Date.parse(day), DAILY_CAP)
      .first<PublicPostcard>();
    if (!inserted) return limited(dailyRetryAfter(now));
    return status === 'pending' ? json({ status, message: 'Your postcard awaits approval.' }, 202) : json({ status, postcard: inserted }, 201);
  } catch { console.error('postcards: submission failed'); return json({ error: 'unavailable' }, 503); }
}
function limited(retryAfter: number): Response { return json({ error: 'rate_limited', retryAfter }, 429, { 'Retry-After': String(retryAfter) }); }
export async function moderatePostcard(request: Request, env: BackendEnv, id: string, action: string): Promise<Response> {
  if (!await isAdmin(request, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
  if (!isUlid(id) || !['approve', 'hide'].includes(action)) return json({ error: 'invalid', fields: { id: 'Use a ULID and approve or hide.' } }, 400);
  if (!env.DB) return json({ error: 'unavailable' }, 503);
  const status = action === 'approve' ? 'published' : 'hidden';
  try {
    const postcard = await env.DB.prepare(`UPDATE postcards SET status = ? WHERE id = ? RETURNING ${PUBLIC_COLUMNS}`).bind(status, id).first<PublicPostcard>();
    if (!postcard) return json({ error: 'not_found' }, 404);
    return json(status === 'published' ? { status, postcard } : { status, id });
  } catch { console.error('postcards: owner moderation failed'); return json({ error: 'unavailable' }, 503); }
}
