import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { moderatePostcard } from '../../../../lib/server/postcards';
import { json } from '../../../../lib/server/env';
export const prerender = false;
export const POST: APIRoute = ({ request, params }) => moderatePostcard(request, env, params.id ?? '', params.action ?? '');
export const ALL: APIRoute = () => json({ error: 'method' }, 405, { Allow: 'POST' });
