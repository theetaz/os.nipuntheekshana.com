import type { APIRoute, GetStaticPaths } from 'astro';
import { getClientProjects, getClientWork } from '../../../lib/client-data';

export const prerender = true;
export const getStaticPaths: GetStaticPaths = async () => (await getClientProjects()).map(({ slug }) => ({ params: { slug } }));
export const GET: APIRoute = async ({ params }) => {
  const data = await getClientWork(params.slug!);
  if (!data) throw new Error(`Missing work content for project ${params.slug}`);
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
