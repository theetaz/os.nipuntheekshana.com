import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { contrastRatio, filterProjects, nextSelection, orderedForView, safeBackdrop, sortProjects } from '../../src/os/apps/projects/filter';
import { ProjectDetailView } from '../../src/os/apps/projects/views/ProjectDetailView';
import type { ProjectsData } from '../../src/os/apps/projects/data';
import type { ClientWork } from '../../src/os/types/content';

const data: ProjectsData = JSON.parse(readFileSync('dist/client/data/projects.json', 'utf8'));

describe('Projects catalogue filtering and ordering', () => {
  it('preserves all 18 projects, six featured, five incubating and eight archive entries', () => {
    expect(filterProjects(data.projects, 'all', '')).toHaveLength(18);
    expect(filterProjects(data.projects, 'featured', '')).toHaveLength(6);
    expect(filterProjects(data.projects, 'incubating', '')).toHaveLength(5);
    expect(filterProjects(data.projects, 'active', '')).toHaveLength(13);
    expect(data.archive).toHaveLength(8);
  });
  it('searches every specified field, case-insensitively, including native names', () => {
    for (const project of data.projects) {
      for (const term of [project.title, project.tagline, project.description, project.categoryLabel, ...project.stack, ...(project.native ? [project.native] : [])]) {
        expect(filterProjects(data.projects, 'all', `  ${term.toUpperCase()}  `)).toContain(project);
      }
    }
    for (const project of data.projects.filter(project => project.stack.includes('Go'))) {
      expect(filterProjects(data.projects, 'all', 'Go')).toContain(project);
    }
    expect(filterProjects(data.projects, 'all', 'no-such-project')).toEqual([]);
    expect(filterProjects(data.projects, 'archive', '')).toEqual([]);
  });
  it('combines search and status filters', () => {
    const filtered = filterProjects(data.projects, 'incubating', 'Go');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(project => project.status === 'incubating')).toBe(true);
  });
  it('sorts year both ways and leaves the source unchanged', () => {
    const before = data.projects.map(project => project.slug);
    for (const descending of [true, false]) {
      const sorted = sortProjects(data.projects, { key: 'year', descending });
      expect(sorted.map(project => project.year)).toEqual([...before.map((_, index) => data.projects[index]!.year)].sort((a, b) => descending ? b - a : a - b));
    }
    expect(data.projects.map(project => project.slug)).toEqual(before);
    expect(sortProjects(data.projects, { key: 'featured', descending: false }).map(project => project.order)).toEqual(Array.from({ length: 18 }, (_, index) => index));
    const names = sortProjects(data.projects, { key: 'name', descending: false }).map(project => project.title);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
  it('uses the rendered category order for grid keyboard movement', () => {
    const ordered = orderedForView(data.projects, 'icons', true);
    expect(ordered.slice(0, 7).every(project => project.category === 'data')).toBe(true);
    expect(nextSelection(0, 'ArrowDown', 18, 5)).toBe(5);
    expect(nextSelection(5, 'ArrowUp', 18, 5)).toBe(0);
    expect(nextSelection(17, 'ArrowRight', 18)).toBe(17);
    expect(nextSelection(0, 'ArrowLeft', 18)).toBe(0);
    expect(nextSelection(5, 'Home', 18)).toBe(0);
    expect(nextSelection(5, 'End', 18)).toBe(17);
    expect(nextSelection(0, 'End', 0)).toBe(-1);
  });
});

describe('Projects static content and contrast', () => {
  it('falls back to the window surface for unsafe or invalid backdrops', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(safeBackdrop('#645d52', 'light')).toBe('var(--os-window)');
    expect(safeBackdrop('#b9b2a6', 'dark')).toBe('var(--os-window)');
    expect(safeBackdrop('red', 'light')).toBe('var(--os-window)');
    expect(safeBackdrop('#ffffff', 'light')).toBe('#ffffff');
    expect(safeBackdrop('#000000', 'dark')).toBe('#000000');
  });
  for (const project of data.projects) it(`${project.slug} ships its complete case study, facts, cards and responsive captures`, () => {
    const work: ClientWork = JSON.parse(readFileSync(`dist/client/data/work/${project.slug}.json`, 'utf8'));
    const html = readFileSync(`dist/client/projects/${project.slug}.html`, 'utf8');
    const view = renderToStaticMarkup(createElement(ProjectDetailView, { project, work, next: { slug: 'salli', title: 'Salli' } }));
    expect(html).toContain(work.html);
    expect(view).toContain(work.html);
    for (const fact of work.facts) expect(view).toContain(fact.value);
    expect(html).toContain(`data-key="projects:${project.slug}"`);
    for (const screen of project.screens) {
      expect(view).toContain(screen.label);
      if (screen.avif) expect(view).toContain('type="image/avif"');
    }
    for (const card of project.brand?.cards ?? []) expect(view).toContain(card.label);
    if (project.brand?.api) expect(view).toContain('API example');
  });
});
