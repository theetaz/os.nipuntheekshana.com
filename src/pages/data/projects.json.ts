import type { APIRoute } from 'astro';
import { categories } from '../../data/projects';
import { getArchive, getClientProjects } from '../../lib/client-data';

export const prerender = true;
export const GET: APIRoute = async () => {
  const [projects, archive] = await Promise.all([getClientProjects(), getArchive()]);
  return new Response(JSON.stringify({ projects, archive, categories }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
