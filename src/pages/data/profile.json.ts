import type { APIRoute } from 'astro';
import { getClientProfile } from '../../lib/client-data';

export const prerender = true;
export const GET: APIRoute = async () => new Response(JSON.stringify(await getClientProfile()), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
