import type { Ai, D1Database, KVNamespace, RateLimit } from '@cloudflare/workers-types';
export interface BackendEnv {
  DB?: D1Database;
  AI?: Ai;
  PERSONA?: KVNamespace;
  RL_POSTCARDS?: RateLimit;
  RL_MESSAGES?: RateLimit;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  IP_HASH_SALT?: string;
  ADMIN_TOKEN?: string;
  AI_MODEL?: string;
  AI_MESSAGES_ENABLED?: string;
}
export function featureHealth(env: BackendEnv) {
  return {
    ai: !!(env.AI_MESSAGES_ENABLED === 'true' && env.AI && env.DB && env.PERSONA && env.RL_MESSAGES && env.AI_MODEL && env.IP_HASH_SALT),
    postcards: !!(env.DB && env.RL_POSTCARDS && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY && env.IP_HASH_SALT),
  };
}
export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
