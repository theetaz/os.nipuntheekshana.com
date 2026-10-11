import type { APIRoute } from 'astro';
import { getClientActivity } from '../../lib/client-data';

export const prerender = true;
export const GET: APIRoute = async () => new Response(JSON.stringify(await getClientActivity()), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
