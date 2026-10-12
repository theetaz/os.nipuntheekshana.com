/// <reference types="astro/client" />
// Import binding types without replacing browser DOM globals in this shared project.
type D1Database = import('@cloudflare/workers-types').D1Database;
type KVNamespace = import('@cloudflare/workers-types').KVNamespace;
type RateLimit = import('@cloudflare/workers-types').RateLimit;
type Ai = import('@cloudflare/workers-types').Ai;
declare module 'cloudflare:workers' { export const env: Cloudflare.Env }
