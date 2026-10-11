import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import ts from 'typescript';

const ORIGIN = 'https://budget.invalid';
const gzipBytes = (buffer) => gzipSync(buffer, { level: 9 }).length;
const posix = (path) => path.split(sep).join('/');

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return files.flat().sort();
}

// Parse actual syntax so comments, string literals and import() stay out of
// the static closure. Re-exports count as static imports too.
function staticImports(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  return ast.statements.flatMap((node) =>
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
      ? [node.moduleSpecifier.text] : []);
}

function attributes(tag) {
  const result = {};
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = (match[2] ?? match[3] ?? match[4] ?? '')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  return result;
}

function htmlResources(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, '');
  const modules = [];
  const inlineModules = [];
  const css = new Set();
  const fonts = new Set();
  const inlineCss = [];
  // Remove raw-text elements before scanning tags so JS strings aren't HTML.
  const markup = source.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi,
    (_, kind, attrs, body) => {
      if (kind.toLowerCase() === 'style') inlineCss.push(body);
      else {
        const attr = attributes(attrs);
        if (attr.type?.toLowerCase() === 'module') {
          if (attr.src) modules.push(attr.src);
          else inlineModules.push(body);
        }
      }
      return '';
    });
  for (const match of markup.matchAll(/<(link|astro-island)\b([^>]*)>/gi)) {
    const attr = attributes(match[2]);
    if (match[1].toLowerCase() === 'astro-island') {
      if (attr['component-url']) modules.push(attr['component-url']);
      if (attr['renderer-url']) modules.push(attr['renderer-url']);
    } else {
      const rel = (attr.rel ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('modulepreload') && attr.href) modules.push(attr.href);
      if (rel.includes('stylesheet') && attr.href) css.add(attr.href);
      if (rel.includes('preload') && attr.as?.toLowerCase() === 'font' && attr.href) fonts.add(attr.href);
    }
  }
  return { modules, inlineModules, css, fonts, inlineCss };
}

/** Check a build. Thresholds are bytes (KiB = 1024 bytes), fonts/images raw;
 * HTML/JS/CSS/JSON are gzip level 9. Exported for synthetic build regressions.
 */
export async function checkBudgets({ root = process.cwd(), log = true } = {}) {
  const dist = resolve(root, 'dist');
  const config = JSON.parse(await readFile(resolve(root, 'budgets.config.json'), 'utf8'));
  const all = await filesUnder(dist);
  const htmlFiles = all.filter((file) => file.endsWith('.html') && basename(file) !== 'og.html');
  if (!htmlFiles.includes(join(dist, 'index.html'))) throw new Error('Build is missing dist/index.html');

  const rows = [];
  const errors = [];
  const notices = [];
  const buffers = new Map();
  const importCache = new Map();
  const label = (file) => posix(relative(dist, file));
  const urlFor = (file) => `/${label(file)}`;
  const read = async (file) => {
    if (!buffers.has(file)) buffers.set(file, await readFile(file));
    return buffers.get(file);
  };
  const measure = (metric, resource, bytes, limit, warn = false, unit = 'bytes') => {
    if (!Number.isFinite(limit) || limit < 0) throw new Error(`Invalid budget for ${metric}: ${limit}`);
    rows.push({ metric, resource, bytes, limit, unit,
      status: bytes <= limit ? 'pass' : warn ? 'warn' : 'fail' });
  };
  const asset = (specifier, importer) => {
    const url = new URL(specifier, new URL(importer, ORIGIN));
    if (url.origin !== ORIGIN) throw new Error(`Cannot measure external asset ${specifier} in ${importer}`);
    const file = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(`${dist}${sep}`)) throw new Error(`Asset escapes dist: ${specifier}`);
    return file;
  };
  const closure = async (entries) => {
    const visited = new Set();
    const visit = async (file) => {
      if (visited.has(file)) return;
      visited.add(file);
      if (!importCache.has(file)) {
        importCache.set(file, staticImports((await read(file)).toString('utf8'), file)
          .map((specifier) => asset(specifier, urlFor(file))));
      }
      for (const dependency of importCache.get(file)) await visit(dependency);
    };
    for (const file of entries) await visit(file);
    return visited;
  };
  const sumGzip = async (files) => {
    let bytes = 0;
    for (const file of files) bytes += gzipBytes(await read(file));
    return bytes;
  };
  let homeClosure = new Set();

  // Home first so app budgets can subtract its shared dependencies.
  htmlFiles.sort((a, b) => Number(b === join(dist, 'index.html')) - Number(a === join(dist, 'index.html')));
  for (const file of htmlFiles) {
    try {
      const html = (await read(file)).toString('utf8');
      const resource = label(file);
      const home = resource === 'index.html';
      const { modules, inlineModules, css, fonts, inlineCss } = htmlResources(html);
      const entries = modules.map((specifier) => asset(specifier, urlFor(file)));
      for (const source of inlineModules) {
        entries.push(...staticImports(source, file).map((specifier) => asset(specifier, urlFor(file))));
      }
      const initial = await closure(entries);
      if (home) homeClosure = initial;
      const jsBytes = await sumGzip(initial)
        + inlineModules.reduce((sum, source) => sum + gzipBytes(Buffer.from(source)), 0);
      measure(home ? 'B1 initial JS' : 'B2 initial JS', resource, jsBytes,
        home ? config.initialJsHome : config.initialJsRoute);
      const eagerApps = [...initial].filter((chunk) => /App[.-].*\.js$/.test(basename(chunk)));
      if (eagerApps.length) errors.push(`${resource}: app chunks in initial JS: ${eagerApps.map(label).join(', ')}`);
      const cssFiles = new Set([...css].map((specifier) => asset(specifier, urlFor(file))));
      measure('B5 CSS', resource, await sumGzip(cssFiles)
        + inlineCss.reduce((sum, source) => sum + gzipBytes(Buffer.from(source)), 0), config.cssPerPage);
      const fontFiles = new Set([...fonts].map((specifier) => asset(specifier, urlFor(file))));
      let fontBytes = 0;
      for (const font of fontFiles) fontBytes += (await read(font)).length;
      measure('B6 font count', resource, fontFiles.size, config.preloadFonts.count, false, 'files');
      measure('B6 font bytes', resource, fontBytes, config.preloadFonts.bytes);
      const htmlBytes = gzipBytes(await read(file));
      if (home) measure('B7 HTML home', resource, htmlBytes, config.htmlHome);
      measure('B8 HTML route', resource, htmlBytes, config.htmlRouteMax);
    } catch (error) { errors.push(`${label(file)}: ${error.message}`); }
  }

  const chunks = all.filter((file) => label(file).startsWith('_astro/') && file.endsWith('.js'));
  const motion = chunks.filter((file) => /^(motion-features|domAnimation)[.-]/.test(basename(file)));
  if (!motion.length) notices.push('SKIP B3 motion features: chunk not built yet');
  for (const file of motion) {
    try {
      const incremental = [...await closure([file])].filter((chunk) => !homeClosure.has(chunk));
      measure('B3 motion features', label(file), await sumGzip(incremental), config.motionFeatures);
    } catch (error) { errors.push(`${label(file)}: ${error.message}`); }
  }
  // Keys are emitted entry names: MapsApp = Island, TrashApp = Kooda;
  // island is the separately lazy-loaded three.js scene (150 KiB).
  for (const [name, limit] of Object.entries(config.apps)) {
    const matches = chunks.filter((file) => basename(file).startsWith(`${name}.`)
      || basename(file).startsWith(`${name}-`));
    if (!matches.length) notices.push(`SKIP B4 ${name}: chunk not built yet`);
    for (const file of matches) {
      try {
        const incremental = [...await closure([file])].filter((chunk) => !homeClosure.has(chunk));
        measure('B4 incremental JS', label(file), await sumGzip(incremental), limit);
      } catch (error) { errors.push(`${label(file)}: ${error.message}`); }
    }
  }
  const json = all.filter((file) => label(file).startsWith('data/') && file.endsWith('.json'));
  if (!json.length) notices.push('SKIP B9 data JSON: no data endpoints built yet');
  for (const file of json) measure('B9 JSON', label(file), gzipBytes(await read(file)), config.jsonMax);
  for (const file of all.filter((file) => /\.avif$/i.test(file))) {
    const { width } = await sharp(await read(file)).metadata();
    if (width === 640 || width === 1600) measure('B10 AVIF image', label(file), (await read(file)).length,
      width === 640 ? config.imageWarn.coverAvif640 : config.imageWarn.screenAvif1600, true);
  }

  const passed = errors.length === 0 && rows.every((row) => row.status !== 'fail');
  const report = { passed, rows, errors, notices };
  await writeFile(join(dist, '.budgets.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (log) {
    console.table(rows.map(({ metric, resource, bytes, limit, unit, status }) => ({
      metric, resource, actual: unit === 'files' ? `${bytes} files` : `${(bytes / 1024).toFixed(2)} KiB`,
      budget: unit === 'files' ? `${limit} files` : `${(limit / 1024).toFixed(2)} KiB`, status,
    })));
    notices.forEach((notice) => console.log(notice));
    errors.forEach((error) => console.error(`FAIL ${error}`));
    console.log(`Budgets ${passed ? 'passed' : 'failed'}; report: dist/.budgets.json`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await checkBudgets();
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    console.error(`Budget check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
