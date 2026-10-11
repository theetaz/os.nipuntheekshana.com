import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { APPS } from '../../src/os/registry/apps';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
interface Chunk { modules: string[]; imports: string[]; css: string[] }
const { chunks } = JSON.parse(readFileSync(resolve(dist, '.css-scope.json'), 'utf8')) as { chunks: Record<string, Chunk> };
const hash = (source: string) => createHash('sha256').update(source).digest('hex');
const cssHash = (file: string) => hash(readFileSync(resolve(dist, file), 'utf8'));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

// Independent source walk: only real static imports, never the plugin's graph.
function staticCss(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return new Set();
  seen.add(file);
  if (file.endsWith('.css')) return new Set([relative(root, file)]);
  const raw = readFileSync(file, 'utf8');
  const source = file.endsWith('.astro') ? raw.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '' : raw;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const css = new Set<string>();
  for (const node of ast.statements) {
    if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || (ts.isExportDeclaration(node) && node.isTypeOnly)
      || (ts.isImportDeclaration(node) && node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword)
      || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)
      || !node.moduleSpecifier.text.startsWith('.')) continue;
    const target = resolve(dirname(file), node.moduleSpecifier.text.split('?')[0]!);
    const dependency = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`]
      .find(candidate => /\.(?:[cm]?js|tsx?|astro|css)$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile());
    if (dependency) for (const sheet of staticCss(dependency, seen)) css.add(sheet);
  }
  return css;
}
const pageSources = files(resolve(root, 'src/pages')).filter(file => file.endsWith('.astro')).map(file => {
  const route = relative(resolve(root, 'src/pages'), file).replace(/\.astro$/, '').replace(/(^|\/)index$/, '');
  const pattern = route.split('/').filter(Boolean).map(part => part.startsWith('[...') ? '.+' : part.startsWith('[') ? '[^/]+' : part).join('/');
  return { file, pattern: new RegExp(`^/${pattern}$`) };
});
function pageSheets(file: string): Set<string> {
  const html = readFileSync(file, 'utf8');
  const sheets = [...html.matchAll(/<link\b[^>]*>/g)].filter(match => /\brel="stylesheet"/.test(match[0]))
    .map(match => cssHash(match[0].match(/\bhref="([^"]+)"/)![1]!.replace(/^\//, '')));
  sheets.push(...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => hash(match[1]!)));
  return new Set(sheets);
}
const appSheets = new Map<string, Set<string>>();
for (const chunk of Object.values(chunks)) {
  for (const source of chunk.modules.filter(module => /^src\/os\/apps\/.*\.css$/.test(module))) {
    const sheets = appSheets.get(source) ?? new Set<string>();
    chunk.css.forEach(file => sheets.add(cssHash(file)));
    appSheets.set(source, sheets);
  }
}

const classesIn = (css: string) => new Set([...css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map(match => `.${match[1]}`));
const sourceClasses = new Map([...appSheets.keys()].map(source => [source, classesIn(readFileSync(resolve(root, source), 'utf8'))]));
// Up to five classes per app sheet that no other app sheet defines.
const fingerprints = new Map([...sourceClasses].map(([source, classes]) => [source, [...classes].filter(name =>
  [...sourceClasses].every(([other, otherClasses]) => other === source || !otherClasses.has(name))).slice(0, 5)]));
function pageCss(file: string): string {
  const html = readFileSync(file, 'utf8');
  const linked = [...html.matchAll(/href="(\/_astro\/[^" ]+\.css)"/g)].map(match => readFileSync(resolve(dist, match[1]!.slice(1)), 'utf8'));
  return [...linked, ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]!)].join('\n');
}

describe('built CSS respects static pages and lazy app chunks', () => {
  it.each(Object.keys(APPS))('%s keeps every statically imported app sheet attached to its lazy chunk', appId => {
    const entries = Object.entries(chunks).filter(([, chunk]) => chunk.modules.some(module =>
      module.startsWith(`src/os/apps/${appId}/`) && /App\.tsx$/.test(module)));
    expect(entries, `Missing emitted registry app ${appId}`).toHaveLength(1);
    const entry = entries[0]![1].modules.find(module => module.startsWith(`src/os/apps/${appId}/`) && /App\.tsx$/.test(module))!;
    for (const source of staticCss(resolve(root, entry))) {
      if (!source.startsWith('src/os/apps/')) continue;
      expect(appSheets.get(source)?.size, `${appId}: missing lazy CSS ${source}`).toBeGreaterThan(0);
    }
  });

  it.each(files(dist).filter(file => file.endsWith('.html')))('includes only app CSS statically imported by %s', file => {
    const route = `/${relative(dist, file).replace(/\.html$/, '').replace(/^index$/, '')}`;
    const page = pageSources.find(source => source.pattern.test(route));
    expect(page, `No source page for ${route}`).toBeDefined();
    const expected = staticCss(page!.file);
    const actual = pageSheets(file);
    const text = pageCss(file);
    for (const [source, sheets] of appSheets) {
      // A page sheet can bundle an app's CSS with other modules, so match on the
      // classes only that source defines rather than on whole-file hashes.
      const marks = fingerprints.get(source) ?? [];
      const included = [...sheets].some(sheet => actual.has(sheet))
        || (marks.length > 0 && marks.every(mark => text.includes(mark)));
      expect(included, `${route}: ${source}`).toBe(expected.has(source));
    }
  });

  it('defers window and overlay sheets while retaining static-window chrome', () => {
    const home = pageSheets(resolve(dist, 'index.html'));
    const deferred = ['src/os/shell/p2-4-window-system.css', 'src/os/shell/Spotlight.tsx'];
    for (const module of deferred) {
      const chunk = Object.values(chunks).find(chunk => chunk.modules.includes(module))!;
      expect(chunk, module).toBeDefined();
      expect(chunk.css.length).toBeGreaterThan(0);
      chunk.css.forEach(file => expect(home.has(cssHash(file)), file).toBe(false));
    }
    const linkedCss = [...readFileSync(resolve(dist, 'projects/salli.html'), 'utf8').matchAll(/href="(\/_astro\/[^" ]+\.css)"/g)]
      .map(match => readFileSync(resolve(dist, match[1]!.slice(1)), 'utf8')).join('\n');
    expect(linkedCss).toContain('.static-window');
  });
});
