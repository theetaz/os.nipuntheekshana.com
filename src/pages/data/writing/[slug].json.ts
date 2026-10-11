import type { APIRoute, GetStaticPaths } from 'astro';
import { getClientPost, getClientPosts } from '../../../lib/client-data';

export const prerender = true;
export const getStaticPaths: GetStaticPaths = async () => (await getClientPosts()).map(({ slug }) => ({ params: { slug } }));
export const GET: APIRoute = async ({ params }) => {
  const data = await getClientPost(params.slug!);
  if (!data) throw new Error(`Missing published writing content for ${params.slug}`);
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
