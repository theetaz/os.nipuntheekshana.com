import island from '../../data/island.json';
export const GET = () => new Response(JSON.stringify(island), { headers: { 'Content-Type': 'application/json' } });
