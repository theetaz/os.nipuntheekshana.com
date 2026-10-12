import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
// Workers AI has no local emulator. Use the documented fail-open path locally;
// production's AI binding and generated deployment config remain intact.
const source = resolve('dist/server/wrangler.json');
const config = JSON.parse(await readFile(source, 'utf8'));
config.main = resolve(dirname(source), config.main);
config.assets.directory = resolve(dirname(source), config.assets.directory);
for (const database of config.d1_databases) database.migrations_dir = resolve(dirname(source), database.migrations_dir);
delete config.ai;
delete config.routes;
for (const key of ['configPath', 'userConfigPath', 'definedEnvironments', 'topLevelName']) delete config[key];
const directory = resolve('.wrangler/postcards-local');
await mkdir(directory, { recursive: true });
const local = resolve(directory, 'wrangler.json');
await writeFile(local, JSON.stringify(config, null, 2));
try { await copyFile('.dev.vars', resolve(directory, '.dev.vars')); }
catch (error) { if (error.code !== 'ENOENT') throw error; await rm(resolve(directory, '.dev.vars'), { force: true }); }
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', local, '--local', '--port', '8788', '--ip', 'localhost', '--persist-to', resolve('.wrangler/state'), ...process.argv.slice(2)], { stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
