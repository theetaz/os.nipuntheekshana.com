import { json, type BackendEnv } from './env';
import { hashIp, utcDay } from './ip-hash';
import { validOrigin } from './turnstile';

export interface VisitContext { waitUntil(promise: Promise<unknown>): void }
const unavailable = () => json({ error: 'unavailable' }, 503);
export async function getVisits(env: BackendEnv): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const row = await env.DB.prepare("SELECT value FROM counters WHERE name = 'visits'").first<{ value: number }>();
    return row ? json({ count: row.value }, 200, { 'Cache-Control': 'public, max-age=60' }) : unavailable();
  } catch { return unavailable(); }
}
export async function postVisit(request: Request, env: BackendEnv, ctx: VisitContext, now = Date.now()): Promise<Response> {
  if (!validOrigin(request)) return json({ error: 'origin' }, 403);
  if (!env.DB || !env.IP_HASH_SALT) return unavailable();
  try {
    const day = utcDay(now);
    const ipHash = await hashIp(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.IP_HASH_SALT, day);
    // D1 batches are transactions. changes() belongs to the preceding INSERT,
    // so deduplication and the increment commit together, including under races.
    const result = await env.DB.batch<{ value: number }>([
      env.DB.prepare('INSERT OR IGNORE INTO visit_seen (day, ip_hash) VALUES (?, ?)').bind(day, ipHash),
      env.DB.prepare("UPDATE counters SET value = value + 1 WHERE name = 'visits' AND changes() = 1 RETURNING value"),
      env.DB.prepare("SELECT value FROM counters WHERE name = 'visits'"),
    ]);
    const row = result[2]?.results[0];
    if (!row) return unavailable();
    ctx.waitUntil(env.DB.prepare('DELETE FROM visit_seen WHERE day < ?').bind(utcDay(now - 2 * 86400000)).run().catch(() => {}));
    return json({ count: row.value, counted: result[0]!.meta.changes === 1 });
  } catch { return unavailable(); }
}
