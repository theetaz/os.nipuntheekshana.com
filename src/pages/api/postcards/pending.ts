import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listPostcards } from '../../../lib/server/postcards';
import { json } from '../../../lib/server/env';
export const prerender = false;
export const GET: APIRoute = ({ request }) => listPostcards(request, env, 'pending');
export const ALL: APIRoute = () => json({ error: 'method' }, 405, { Allow: 'GET' });
