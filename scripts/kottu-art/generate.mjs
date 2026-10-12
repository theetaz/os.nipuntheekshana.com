import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { catalogue, root, parseFlags, selectedAssets, positiveInteger, externalWork, loadProvenance, batchPrompt, writeJson } from './lib.mjs';

const flags = parseFlags(process.argv.slice(2), ['family', 'only', 'batch-size', 'concurrency', 'passes', 'model', 'work', 'dry-run']);
const assets = selectedAssets(flags);
const concurrency = positiveInteger(flags.concurrency, 3, 'concurrency', 6);
const passes = positiveInteger(flags.passes, 2, 'passes', 10);
const model = flags.model ?? 'gpt-5.6-sol';
const batchSize = flags['batch-size'] ? positiveInteger(flags['batch-size'], 6, 'batch-size', 7) : null;
const approved = new Set(loadProvenance().filter((entry) => entry.approved).map((entry) => entry.id));
let pending = assets.filter((asset) => !approved.has(asset.id));
function batchesFor(entries) {
  return Object.keys(catalogue.families).flatMap((family) => {
    const group = entries.filter((asset) => asset.family === family), batches = [];
    const size = batchSize ?? catalogue.families[family].batchSize;
    for (let i = 0; i < group.length; i += size) batches.push(group.slice(i, i + size));
    return batches;
  });
}
function command(command, args, cwd, logPath, timeoutMs) {
  return new Promise((done) => {
    const log = logPath ? createWriteStream(logPath) : null;
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => log ? log.write(chunk) : process.stdout.write(chunk));
    child.stderr.on('data', (chunk) => log ? log.write(chunk) : process.stderr.write(chunk));
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGTERM'), timeoutMs) : null;
    child.on('error', (error) => { if (log) log.write(`${error.message}\n`); else console.error(error.message); });
    child.on('close', (code) => { if (timer) clearTimeout(timer); if (log) log.end(() => done(code)); else done(code); });
  });
}
async function main() {
  if (flags['dry-run']) {
    for (const batch of batchesFor(pending)) console.log(batchPrompt(batch));
    return;
  }
  const work = await externalWork(flags.work ?? resolve(tmpdir(), 'kottu-art'));
  console.log(`${pending.length} unapproved assets; model ${model}; work ${work}`);
  const manifest = { model, passes, startedAt: new Date().toISOString(), batches: [], pending: [] };
  for (let pass = 1; pass <= passes && pending.length; pass++) {
    const batches = batchesFor(pending), results = [];
    let next = 0;
    console.log(`pass ${pass}: ${pending.length} assets, ${batches.length} batches, concurrency ${concurrency}`);
    await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
      while (next < batches.length) {
        const index = next++, batch = batches[index];
        const directory = resolve(work, `batch-${batch[0].family}-${String(index + 1).padStart(2, '0')}-${Date.now().toString(36)}`);
        mkdirSync(directory, { recursive: true });
        const brief = batchPrompt(batch), startedAt = new Date().toISOString();
        writeFileSync(resolve(directory, 'brief.txt'), brief);
        writeJson(resolve(directory, 'batch.json'), { model, pass, startedAt, ids: batch.map((asset) => asset.id) });
        const code = await command('codex', ['exec', '-m', model, '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', directory, brief], directory, resolve(directory, 'run.log'), 45 * 60 * 1000);
        const found = batch.filter((asset) => existsSync(resolve(directory, `${asset.id}.png`))).map((asset) => asset.id);
        const result = { pass, directory, code, ids: batch.map((asset) => asset.id), found };
        results.push(result); manifest.batches.push(result);
        console.log(`batch ${index + 1} (${batch[0].family}): exit ${code}, ${found.length}/${batch.length} PNGs, ${directory}`);
      }
    }));
    // The processor owns repository writes; the generator only writes its external work root.
    const ids = pending.map((asset) => asset.id).join(',');
    await command(process.execPath, [resolve(root, 'scripts/kottu-art/process.mjs'), '--from', work, '--only', ids], root);
    const provenance = loadProvenance();
    pending = pending.filter((asset) => {
      const entry = provenance.find((entry) => entry.id === asset.id);
      const sources = results.flatMap((result) => result.found.includes(asset.id) ? [resolve(result.directory, `${asset.id}.png`)] : []);
      return !entry || entry.placeholder || !sources.includes(entry.sourceFile);
    });
    manifest.pending = pending.map((asset) => asset.id);
    writeJson(resolve(work, 'generation-report.json'), manifest);
    console.log(`pass ${pass} complete: ${pending.length} missing or rejected`);
  }
  if (pending.length) { console.error(`Still missing or rejected: ${pending.map((asset) => asset.id).join(', ')}`); process.exitCode = 2; }
}
await main().catch((error) => { console.error(error.message); process.exitCode = 2; });
