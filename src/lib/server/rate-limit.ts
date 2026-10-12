import type { BackendEnv } from './env';
export const DAILY_CAP = 5;
export async function checkRateLimit(env: BackendEnv, ipHash: string, now = Date.now()): Promise<number | null> {
  const minute = await env.RL_POSTCARDS!.limit({ key: ipHash });
  if (!minute.success) return 60;
  const start = Date.parse(new Date(now).toISOString().slice(0, 10));
  const result = await env.DB!.prepare('SELECT COUNT(*) AS count FROM postcards WHERE ip_hash = ? AND created_at >= ?').bind(ipHash, start).first<{ count: number }>();
  return (result?.count ?? 0) >= DAILY_CAP ? dailyRetryAfter(now) : null;
}
export const dailyRetryAfter = (now: number) => Math.max(1, Math.ceil((Date.parse(new Date(now).toISOString().slice(0, 10)) + 86400000 - now) / 1000));
