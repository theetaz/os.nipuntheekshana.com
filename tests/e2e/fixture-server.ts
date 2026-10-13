import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export interface FixtureServer { origin: string; stop(): Promise<void> }

/** Isolated production fixtures cannot reload when another suite creates a route. */
export async function fixtureServer(name: string, port: number, pages: Record<string, string>): Promise<FixtureServer> {
  const relative = `.astro/e2e-${name}`; const directory = resolve(root, relative);
  let server: ChildProcess | undefined; let output = '';
  const record = (chunk: Buffer) => { output += chunk.toString(); };
  const stop = async () => {
    if (server?.pid && server.exitCode === null && server.signalCode === null) {
      try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      await new Promise<void>(done => { if (server!.exitCode !== null || server!.signalCode !== null) done(); else server!.once('exit', () => done()); });
    }
    await mkdir(resolve(root, '.astro/p2-int-artifacts'), { recursive: true });
    await writeFile(resolve(root, `.astro/p2-int-artifacts/fixture-${name}.log`), output);
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await mkdir(resolve(directory, 'pages'), { recursive: true });
    for (const [route, content] of Object.entries(pages)) await writeFile(resolve(directory, `pages/${route}.astro`), content.replace("../../../src/styles/global.css", "../fixture.css"));
    await writeFile(resolve(directory, 'fixture.css'), '@import "../../src/styles/global.css";\n@source "../../tests/fixtures";\n@source "./pages";');
    await writeFile(resolve(directory, 'config.mjs'), `import base from '../../astro.config.mjs';
export default { ...base, adapter: undefined, srcDir: '${relative}/', cacheDir: '${relative}/cache/', outDir: '${relative}/dist/',
  vite: { ...base.vite, cacheDir: '${relative}/vite-cache/' } };`);
    await new Promise<void>((done, reject) => {
      const build = spawn('npm', ['run', 'build', '--', '--config', `${relative}/config.mjs`], { cwd: root, env: { ...process.env, SERENDIB_ACTIVITY_SOURCE: 'snapshot' }, stdio: ['ignore', 'pipe', 'pipe'] });
      build.stdout.on('data', record); build.stderr.on('data', record);
      build.once('error', reject); build.once('exit', code => code === 0 ? done() : reject(new Error(`Fixture build failed: ${output}`)));
    });
    await cp(resolve(root, 'dist/client/data'), resolve(directory, 'dist/data'), { recursive: true });
    const sprite = await readFile(resolve(root, 'dist/client/app-icons.svg'), 'utf8');
    await writeFile(resolve(directory, 'dist/app-icons.svg'), sprite);
    // The shared drawing includes the avatar and font URLs from the main build.
    for (const asset of new Set(sprite.match(/\/_astro\/[^\s'"<>;)]+/g))) {
      await mkdir(resolve(directory, 'dist/_astro'), { recursive: true });
      await cp(resolve(root, `dist/client${asset}`), resolve(directory, `dist${asset}`));
    }
    // Standalone static fixtures expose the backend-unavailable health contract.
    await mkdir(resolve(directory, 'dist/api'), { recursive: true });
    await writeFile(resolve(directory, 'dist/api/health'), JSON.stringify({ ai: false, postcards: false }));
    server = spawn('npx', ['astro', 'preview', '--config', `${relative}/config.mjs`, '--ignore-lock', '--host', 'localhost', '--port', String(port)], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    server.stdout!.on('data', record); server.stderr!.on('data', record);
    await new Promise<void>((done, reject) => {
      const timer = setTimeout(() => reject(new Error(`Fixture server did not become ready: ${output}`)), 60_000);
      const ready = (chunk: Buffer) => { if (chunk.toString().includes(`localhost:${port}`)) { clearTimeout(timer); done(); } };
      server!.stdout!.on('data', ready); server!.stderr!.on('data', ready);
      server!.once('error', error => { clearTimeout(timer); reject(error); });
      server!.once('exit', code => { clearTimeout(timer); reject(new Error(`Fixture server exited: ${code}\n${output}`)); });
    });
    return { origin: `http://localhost:${port}`, stop };
  } catch (error) { await stop(); throw error; }
}
