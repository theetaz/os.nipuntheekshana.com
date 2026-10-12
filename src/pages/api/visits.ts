import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { json } from '../../lib/server/env';
import { getVisits, postVisit } from '../../lib/server/visits';
export const prerender = false;
export const GET: APIRoute = () => getVisits(env);
export const POST: APIRoute = ({ request, locals }) => postVisit(request, env, locals.cfContext);
export const ALL: APIRoute = () => json({ error: 'method' }, 405, { Allow: 'GET, POST' });
