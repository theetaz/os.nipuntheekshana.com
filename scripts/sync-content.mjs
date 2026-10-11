#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const files = [
  'src/data/profile.ts',
  'src/data/projects.ts',
  'src/data/island.json',
  'src/assets/me/avatar.png',
  'public/Nipun_Theekshana_CV.pdf',
];
const folders = [
  { name: 'src/content/work', markdown: true },
  { name: 'src/content/writing', markdown: true },
  { name: 'src/assets/work', markdown: false },
];
const provenance = 'src/data/.synced-from.json';

function options(args) {
  const result = { source: process.env.SOURCE_SITE ?? '../nipuntheekshana.com', check: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--source') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('--source requires a path');
      result.source = value;
    } else if (arg === '--check') result.check = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return result;
}

async function statOrNull(filename) {
  try {
    return await lstat(filename);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Reject links at every component: neither copying nor pruning may escape a mapping.
async function validatePath(base, relative, kind, required) {
  const parts = relative.split('/');
  let current = base;
  for (const [i, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = await statOrNull(current);
    if (!stat) {
      if (required) throw new Error(`Missing source path: ${current}`);
      return;
    }
    const expected = i === parts.length - 1 ? kind : 'directory';
    if (stat.isSymbolicLink() || (expected === 'directory' ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error(`Expected a regular ${expected}, without symlinks: ${current}`);
    }
  }
}

async function listFiles(base, relative, required) {
  await validatePath(base, relative, 'directory', required);
  if (!(await statOrNull(path.join(base, relative)))) return { files: [], directories: [] };
  const result = { files: [], directories: [] };
  for (const entry of await readdir(path.join(base, relative), { withFileTypes: true })) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      const children = await listFiles(base, name, true);
      result.files.push(...children.files);
      result.directories.push(name, ...children.directories);
    } else if (entry.isFile()) result.files.push(name);
    else throw new Error(`Expected a regular file or directory, without symlinks: ${path.join(base, name)}`);
  }
  return result;
}

async function equalFile(source, destination) {
  if (!(await statOrNull(destination))) return false;
  const [left, right] = await Promise.all([readFile(source), readFile(destination)]);
  return left.equals(right);
}

async function sync() {
  const opts = options(process.argv.slice(2));
  const source = await realpath(path.resolve(root, opts.source));
  if (source === root || source.startsWith(`${root}${path.sep}`) || root.startsWith(`${source}${path.sep}`)) {
    throw new Error('Source and destination repositories must be separate, non-overlapping directories');
  }
  await validatePath(source, 'package.json', 'file', true);
  const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  if (manifest.name !== 'nipuntheekshana.com') throw new Error('Source package.json must have name "nipuntheekshana.com"');
  const { stdout } = await run('git', ['-C', source, 'rev-parse', 'HEAD']);
  const commit = stdout.trim();

  // Finish all validation and comparison before making any destination changes.
  const desired = [...files];
  const stale = [];
  const staleDirectories = [];
  for (const folder of folders) {
    const from = await listFiles(source, folder.name, true);
    const to = await listFiles(root, folder.name, false);
    const mapped = from.files.filter((name) => !folder.markdown || (path.dirname(name) === folder.name && name.endsWith('.md')));
    desired.push(...mapped);
    const names = new Set(mapped);
    stale.push(...to.files.filter((name) => !names.has(name)));
    const directories = new Set(mapped.flatMap((name) => {
      const parents = [];
      for (let parent = path.dirname(name); parent !== folder.name; parent = path.dirname(parent)) parents.push(parent);
      return parents;
    }));
    staleDirectories.push(...to.directories.filter((name) => !directories.has(name)));
  }
  const changed = [];
  for (const name of desired.sort()) {
    await validatePath(source, name, 'file', true);
    await validatePath(root, name, 'file', false);
    if (!(await equalFile(path.join(source, name), path.join(root, name)))) changed.push(name);
  }
  await validatePath(root, provenance, 'file', false);
  let previous;
  if (await statOrNull(path.join(root, provenance))) {
    try {
      previous = JSON.parse(await readFile(path.join(root, provenance), 'utf8'));
    } catch { /* A normal sync repairs invalid provenance. */ }
  }
  const provenanceChanged = previous?.source !== source || previous?.commit !== commit || typeof previous?.syncedAt !== 'string';
  const count = changed.length + stale.length + staleDirectories.length;
  for (const name of changed) console.log(`COPY ${name}`);
  for (const name of stale.sort()) console.log(`DELETE ${name}`);
  for (const name of staleDirectories.sort()) console.log(`DELETE ${name}/`);
  if (provenanceChanged) console.log(`WRITE ${provenance}`);
  console.log(`${count} changed (${changed.length} copied, ${stale.length} deleted, ${staleDirectories.length} stale directories); ${desired.length} mapped files; provenance ${provenanceChanged ? 'changed' : 'unchanged'}`);

  if (opts.check) {
    process.exitCode = count > 0 || provenanceChanged ? 1 : 0;
    return;
  }
  if (opts.dryRun) return;
  for (const name of changed) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await copyFile(path.join(source, name), path.join(root, name));
  }
  for (const name of stale) await rm(path.join(root, name));
  for (const name of staleDirectories.sort((a, b) => b.length - a.length)) await rm(path.join(root, name), { recursive: true });
  if (count > 0 || provenanceChanged) {
    await mkdir(path.dirname(path.join(root, provenance)), { recursive: true });
    await writeFile(path.join(root, provenance), `${JSON.stringify({ source, commit, syncedAt: new Date().toISOString() }, null, 2)}\n`);
  }
}

try {
  await sync();
} catch (error) {
  console.error(`Content sync failed: ${error.message}`);
  process.exitCode = 1;
}
