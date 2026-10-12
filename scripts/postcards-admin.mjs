// POSTCARDS_URL defaults to the production origin; ADMIN_TOKEN stays in the environment.
const [command = 'list', id] = process.argv.slice(2);
if (!['list', 'approve', 'hide'].includes(command) || (command !== 'list' && !/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id ?? ''))) {
  console.error('Usage: npm run postcards:admin -- list|approve ULID|hide ULID'); process.exit(1);
}
if (!process.env.ADMIN_TOKEN) { console.error('Set ADMIN_TOKEN in the environment.'); process.exit(1); }
const origin = new URL(process.env.POSTCARDS_URL ?? 'https://os.nipuntheekshana.com');
if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw new Error('Use HTTPS for owner moderation.');
const headers = { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` };
async function call(path, method = 'GET') {
  const response = await fetch(new URL(path, origin), { method, headers, signal: AbortSignal.timeout(15000) });
  const result = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${result.error}`); return result;
}
try {
  if (command === 'list') {
    let next = null;
    do {
      const page = await call(`/api/postcards/pending${next ? `?cursor=${encodeURIComponent(next)}` : ''}`);
      for (const card of page.items) console.log(JSON.stringify(card)); next = page.next;
    } while (next);
  } else console.log(JSON.stringify(await call(`/api/postcards/${id}/${command}`, 'POST')));
} catch (error) { console.error(error.message); process.exitCode = 1; }
