import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const src = resolve(root, 'src');

function sources(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function specifiers(source: string, file: string): string[] {
  const imports: string[] = [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      imports.push(node.arguments[0].text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteral(node.argument.literal)) {
      imports.push(node.argument.literal.text);
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      imports.push(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return imports;
}

function forbidden(specifier: string, file: string): boolean {
  if (/^(astro|node):/.test(specifier)) return true;
  const clean = specifier.split(/[?#]/)[0] ?? '';
  let target: string | undefined;
  if (clean.startsWith('.')) target = resolve(dirname(file), clean);
  else if (/^(?:@\/|~\/|src\/|\/src\/)/.test(clean)) {
    target = resolve(src, clean.replace(/^(?:@\/|~\/|src\/|\/src\/)/, ''));
  } else if (/^(data|lib|content)\//.test(clean)) target = resolve(src, clean);
  return target !== undefined && /^(data|lib|content)\//.test(relative(src, target).split(sep).join('/'));
}

describe('client import boundaries', () => {
  it('keeps server data, content, helpers and builtins out of src/os', () => {
    const violations = sources(resolve(src, 'os')).flatMap((file) =>
      specifiers(readFileSync(file, 'utf8'), file)
        .filter((specifier) => forbidden(specifier, file))
        .map((specifier) => `${relative(root, file)} imports ${specifier}`));
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('recognises relative and aliased server paths without rejecting os/lib or packages', () => {
    const file = resolve(src, 'os/apps/projects/ProjectsApp.tsx');
    for (const specifier of [
      '../../../data/projects', '../../../lib/github', '../../../content/work/a.md',
      '@/data/projects', '~/lib/github', 'src/content/work/a.md', '/src/data/projects',
      'data/projects', 'astro:content', 'node:fs',
    ]) expect(forbidden(specifier, file), specifier).toBe(true);
    for (const specifier of ['../../lib/fetch-json', '@/os/lib/fetch-json', 'react', 'jotai/utils']) {
      expect(forbidden(specifier, file), specifier).toBe(false);
    }
  });

  it('inspects imports, re-exports, dynamic imports and types, ignoring comments and strings', () => {
    const code = `
      import type { X } from 'astro:content';
      export { y } from '../../../lib/github';
      export * from '../../../data/projects';
      const data = import('../../../content/work/a.md');
      const fs = require('node:fs');
      type T = import('node:path').ParsedPath;
      import legacy = require('node:url');
      // import z from 'ignored-comment';
      const text = "import z from 'ignored-string'";
    `;
    expect(specifiers(code, 'example.ts')).toEqual([
      'astro:content', '../../../lib/github', '../../../data/projects',
      '../../../content/work/a.md', 'node:fs', 'node:path', 'node:url',
    ]);
  });
});
