import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = new URL('../../scripts/sync-content.mjs', import.meta.url);
const mapped = [
  'src/data/profile.ts', 'src/data/projects.ts', 'src/data/island.json',
  'src/content/work/project.md', 'src/content/writing/post.md',
  'src/assets/work/screens/example.png', 'src/assets/me/avatar.png',
  'public/Nipun_Theekshana_CV.pdf',
];
let sandbox: string;
let source: string;
let destination: string;

function put(base: string, name: string, value: string | Buffer) {
  const filename = path.join(base, name);
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, value);
}

function digest(base: string): string {
  const hash = createHash('sha256');
  function visit(relative: string) {
    for (const entry of readdirSync(path.join(base, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '.git') continue;
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(name);
      else hash.update(name).update(readFileSync(path.join(base, name)));
    }
  }
  visit('');
  return hash.digest('hex');
}

function sync(args: string[] = [], env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, [path.join(destination, 'scripts/sync-content.mjs'), ...args], {
    cwd: sandbox, encoding: 'utf8', env: { ...process.env, SOURCE_SITE: undefined, ...env },
  });
}

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(path.join(tmpdir(), 'serendib-content-')));
  source = path.join(sandbox, 'nipuntheekshana.com');
  destination = path.join(sandbox, 'os.nipuntheekshana.com');
  put(source, 'package.json', JSON.stringify({ name: 'nipuntheekshana.com' }));
  for (const name of mapped) put(source, name, Buffer.from([0, 255, ...Buffer.from(name)]));
  mkdirSync(path.join(destination, 'scripts'), { recursive: true });
  copyFileSync(script, path.join(destination, 'scripts/sync-content.mjs'));
  const git = spawnSync('git', ['-C', source, 'init', '-q'], { encoding: 'utf8' });
  expect(git.status).toBe(0);
  expect(spawnSync('git', ['-C', source, '-c', 'user.name=Content Test', '-c', 'user.email=content@example.test', 'commit', '--allow-empty', '-qm', 'test: initialise content fixture']).status).toBe(0);
});

afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

describe('content sync CLI', () => {
  it('copies exact bytes from the root-relative default source and keeps a no-op stable', () => {
    const before = digest(source);
    const first = sync();
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('8 changed');
    for (const name of mapped) expect(readFileSync(path.join(destination, name))).toEqual(readFileSync(path.join(source, name)));
    const provenanceFile = path.join(destination, 'src/data/.synced-from.json');
    const provenance = readFileSync(provenanceFile, 'utf8');
    expect(JSON.parse(provenance)).toMatchObject({ source, commit: expect.stringMatching(/^[a-f0-9]{40}$/), syncedAt: expect.any(String) });
    expect(sync().stdout).toContain('0 changed');
    expect(readFileSync(provenanceFile, 'utf8')).toBe(provenance);
    expect(sync(['--check']).status).toBe(0);
    expect(digest(source)).toBe(before);
  });

  it('reports changed, missing, and stale files without writing in check or dry-run modes', () => {
    expect(sync().status).toBe(0);
    put(destination, mapped[0]!, 'edited locally');
    rmSync(path.join(destination, mapped[1]!));
    put(destination, 'src/content/work/stale.md', 'stale');
    const before = digest(destination);
    const check = sync(['--check']);
    expect(check.status).toBe(1);
    expect(check.stdout).toContain('COPY src/data/profile.ts');
    expect(check.stdout).toContain('COPY src/data/projects.ts');
    expect(check.stdout).toContain('DELETE src/content/work/stale.md');
    expect(sync(['--dry-run']).status).toBe(0);
    expect(digest(destination)).toBe(before);
    expect(sync().status).toBe(0);
    expect(sync(['--check']).status).toBe(0);
  });

  it('prunes stale nested assets only inside mapped folders and preserves hand-ported files', () => {
    expect(sync().status).toBe(0);
    put(destination, 'src/assets/work/obsolete/nested/file.png', 'old');
    put(destination, 'src/data/about.ts', 'hand port');
    put(destination, 'src/assets/me/other.png', 'unmapped');
    put(destination, 'public/other.pdf', 'unmapped');
    rmSync(path.join(source, 'src/assets/work/screens/example.png'));
    const result = sync();
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(path.join(destination, 'src/assets/work/obsolete'))).toBe(false);
    expect(existsSync(path.join(destination, 'src/assets/work/screens'))).toBe(false);
    for (const name of ['src/data/about.ts', 'src/assets/me/other.png', 'public/other.pdf']) expect(existsSync(path.join(destination, name))).toBe(true);
    expect(sync().stdout).toContain('0 changed');
  });

  it('supports SOURCE_SITE, explicit source precedence, and dry-run on an empty destination', () => {
    const before = digest(destination);
    expect(sync(['--dry-run'], { SOURCE_SITE: source }).status).toBe(0);
    expect(digest(destination)).toBe(before);
    expect(sync(['--source', '../nipuntheekshana.com'], { SOURCE_SITE: '/missing' }).status).toBe(0);
  });

  it('rejects invalid source identity and missing inputs before making any changes', () => {
    const before = digest(destination);
    put(source, 'package.json', JSON.stringify({ name: 'another-site' }));
    expect(sync().stderr).toContain('Source package.json must have name');
    put(source, 'package.json', JSON.stringify({ name: 'nipuntheekshana.com' }));
    rmSync(path.join(source, 'public/Nipun_Theekshana_CV.pdf'));
    expect(sync().status).toBe(1);
    expect(digest(destination)).toBe(before);
  });

  it('rejects symlinks in source and destination before a copy can write through them', () => {
    const before = digest(source);
    mkdirSync(path.join(destination, 'src'), { recursive: true });
    symlinkSync(path.join(source, 'src/data'), path.join(destination, 'src/data'));
    const result = sync();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('without symlinks');
    expect(digest(source)).toBe(before);
    expect(existsSync(path.join(destination, 'public/Nipun_Theekshana_CV.pdf'))).toBe(false);
    rmSync(path.join(destination, 'src/data'));
    symlinkSync(path.join(source, 'src/data/profile.ts'), path.join(source, 'src/assets/work/link'));
    expect(sync().stderr).toContain('without symlinks');
  });

  it('rejects overlapping repositories and malformed options', () => {
    expect(sync(['--source', destination]).stderr).toContain('non-overlapping');
    expect(sync(['--source']).status).toBe(1);
    expect(sync(['--unknown']).status).toBe(1);
  });
});
