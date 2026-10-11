import type { APIRoute } from 'astro';
import { getClientPosts } from '../../lib/client-data';

export const prerender = true;
export const GET: APIRoute = async () => new Response(JSON.stringify(await getClientPosts()), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
