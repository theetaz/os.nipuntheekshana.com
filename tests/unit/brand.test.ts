import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
it('uses Kottu throughout public text while preserving persisted identifiers and local font aliases', () => {
  const failures: string[] = [];
  for (const path of [...files('src'), ...files('public'), 'package.json']) {
    if (!/\.(?:astro|tsx?|m?js|css|json|svg|webmanifest|txt|md)$/.test(path)) continue;
    const source = readFileSync(path, 'utf8').replace(/serendib:|serendibBack|SERENDIB_ACTIVITY_SOURCE|'Serendib Terminal(?: fallback)?'/g, '');
    source.split('\n').forEach((line, index) => { if (/serendib/i.test(line)) failures.push(`${path}:${index + 1}: ${line.trim()}`); });
  }
  expect(failures).toEqual([]);
});
