import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { featureHealth, json } from '../../lib/server/env';
export const prerender = false;
export const GET: APIRoute = () => json(featureHealth(env), 200, { 'Cache-Control': 'public, max-age=60' });
