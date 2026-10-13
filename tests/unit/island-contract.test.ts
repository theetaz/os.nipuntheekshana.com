import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import Desktop, { type DesktopProps } from '../../src/os/Desktop';
import { createOsStore, registerStore } from '../../src/os/state/store';
import { desktopAtom } from '../../src/os/state/atoms';
const props: DesktopProps = { initial: null, build: { version: '1.0', codename: 'Galle Face', sha: 'local', date: '2026-10-11' }, home: { nowItems: [], nowUpdated: '2026-10-11' } };

describe('island rendering and build contracts', () => {
  it('renders both shells and crawlable links with no windows or shared store leakage during SSR', () => {
    const store = createOsStore(props); const cleanup = registerStore(store);
    store.set(desktopAtom, { type: 'OPEN', appId: 'terminal' });
    try {
      const html = renderToString(createElement(Desktop, props));
      expect(html).toContain('data-shell="desktop"'); expect(html).toContain('data-shell="mobile"');
      expect(html).toContain('href="/projects"');
      const built = readFileSync('dist/client/index.html', 'utf8');
      const staticHeader = built.match(/<header[^>]*class="[^"]*k-static-topbar[^"]*"[^>]*>([\s\S]*?)<\/header>/)![1]!;
      const navigation = staticHeader.match(/<nav aria-label="Menu bar">([\s\S]*?)<\/nav>/)![1]!;
      expect([...navigation.matchAll(/href="([^"]+)"/g)].map(match => match[1])).toEqual(['/projects', '/writing', '/about', '/cv', '/now']);
      expect(html).not.toContain('data-window-id=');
      expect(renderToString(createElement(Desktop, props))).toBe(html);
    } finally { cleanup(); }
  });
  it('keeps every app module outside the built home page initial JavaScript closure', () => {
    const html = readFileSync('dist/client/index.html', 'utf8');
    const entries = [...html.matchAll(/(?:component-url|renderer-url)="([^"]+)"/g)].map(match => resolve('dist/client', `.${match[1]}`));
    expect(entries).toHaveLength(2);
    const closure = new Set<string>(); const queue = [...entries];
    while (queue.length) {
      const file = queue.pop()!; if (closure.has(file)) continue; closure.add(file);
      const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
      for (const statement of ast.statements) {
        if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier
          && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.startsWith('.'))
          queue.push(resolve(dirname(file), statement.moduleSpecifier.text));
      }
    }
    expect([...closure].filter(file => /(?:Projects|Writing|About|Cv|Terminal|Maps|Activity|Messages|Now|Settings|Trash|Readme|Guestbook)App[.-]/.test(file))).toEqual([]);
    expect(closure.size).toBeGreaterThan(2);
  });
});
