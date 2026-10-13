import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendEnv } from '../../src/lib/server/env';
import { getVisits, postVisit } from '../../src/lib/server/visits';
let db: DatabaseSync; let env: BackendEnv; let cleanup: Promise<unknown>[];
const now = Date.parse('2026-10-13T12:00:00Z');
const context = { waitUntil(promise: Promise<unknown>) { cleanup.push(promise); } };
const request = (ip = '203.0.113.1', origin = 'http://localhost:8790') => new Request('http://localhost:8790/api/visits', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': ip } });
function d1() {
  type Statement = { sql: string; args: (string | number)[]; bind(...args: (string | number)[]): Statement; run(): Promise<unknown>; first(): Promise<unknown> };
  return { prepare(sql: string) {
    const statement: Statement = { sql, args: [], bind(...args) { statement.args = args; return statement; },
      async run() { return db.prepare(sql).run(...statement.args); }, async first() { return db.prepare(sql).get(...statement.args) ?? null; } };
    return statement;
  }, async batch(statements: Statement[]) {
    db.exec('BEGIN');
    try {
      const result = statements.map(statement => {
        const prepared = db.prepare(statement.sql); const results = prepared.all(...statement.args);
        const meta = db.prepare('SELECT changes() AS changes').get(); return { results, meta, success: true };
      }); db.exec('COMMIT'); return result;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } } as unknown as BackendEnv['DB'];
}
beforeEach(() => { db = new DatabaseSync(':memory:'); db.exec(readFileSync('migrations/0002_visits.sql', 'utf8')); env = { DB: d1(), IP_HASH_SALT: 'local-salt' }; cleanup = []; });
afterEach(async () => { await Promise.all(cleanup); db.close(); vi.restoreAllMocks(); });
describe('visits with a transactional SQLite-backed D1 mock', () => {
  it('counts once per daily salted IP and exposes only the total', async () => {
    const first = await postVisit(request(), env, context, now); expect(await first.json()).toEqual({ count: 1, counted: true });
    expect(first.headers.get('Cache-Control')).toBe('no-store');
    expect(await (await postVisit(request(), env, context, now)).json()).toEqual({ count: 1, counted: false });
    const row = db.prepare('SELECT * FROM visit_seen').get()!; expect(row.day).toBe('2026-10-13'); expect(row.ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain('203.0.113');
    const get = await getVisits(env); expect(await get.json()).toEqual({ count: 1 }); expect(get.headers.get('Cache-Control')).toBe('public, max-age=60');
  });
  it('deduplicates simultaneous same-IP visits while counting distinct IPs', async () => {
    const duplicates = await Promise.all(Array.from({ length: 30 }, () => postVisit(request(), env, context, now)));
    const values = await Promise.all(duplicates.map(value => value.json())); expect(values.filter(value => value.counted)).toHaveLength(1);
    expect(values.every(value => value.count === 1)).toBe(true);
    await Promise.all(Array.from({ length: 20 }, (_, i) => postVisit(request(`203.0.113.${i + 10}`), env, context, now)));
    expect(await (await getVisits(env)).json()).toEqual({ count: 21 });
  });
  it('rolls back the seen insert if the increment fails, then permits a retry', async () => {
    db.exec("CREATE TRIGGER fail_count BEFORE UPDATE ON counters BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    expect((await postVisit(request(), env, context, now)).status).toBe(503); expect(db.prepare('SELECT COUNT(*) AS count FROM visit_seen').get()!.count).toBe(0);
    db.exec('DROP TRIGGER fail_count'); expect(await (await postVisit(request(), env, context, now)).json()).toEqual({ count: 1, counted: true });
  });
  it('uses UTC midnight and cleans rows older than two days in waitUntil', async () => {
    for (const day of ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']) db.prepare('INSERT INTO visit_seen VALUES (?, ?)').run(day, `hash-${day}`);
    await postVisit(request(), env, context, now); await Promise.all(cleanup);
    expect(db.prepare('SELECT day FROM visit_seen ORDER BY day').all().map(row => row.day)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
    expect(await (await postVisit(request(), env, context, Date.parse('2026-10-14T00:00:00Z'))).json()).toEqual({ count: 2, counted: true });
    expect(cleanup).toHaveLength(2);
  });
  it('rejects cross-origin requests and missing bindings without recording visits', async () => {
    expect(await (await postVisit(request(undefined, 'https://evil.example'), env, context, now)).json()).toEqual({ error: 'origin' });
    expect((await postVisit(request(), {}, context, now)).status).toBe(503); expect((await getVisits({})).status).toBe(503);
    expect((await postVisit(request(), { DB: env.DB }, context, now)).status).toBe(503);
    expect(db.prepare('SELECT COUNT(*) AS count FROM visit_seen').get()!.count).toBe(0);
  });
  it('returns unavailable for missing migrations and read failures', async () => {
    db.exec('DROP TABLE counters'); expect((await getVisits(env)).status).toBe(503); expect((await postVisit(request(), env, context, now)).status).toBe(503);
  });
});
