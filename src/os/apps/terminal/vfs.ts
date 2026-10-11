import { CODENAME, VERSION } from '../../config';
import { fetchJson } from '../../lib/fetch-json';
import type { ClientActivity, ClientPostSummary, ClientProfile, ClientProject } from '../../types/content';
import type { Line, TerminalData } from './types';
import { segment, textLines } from './types';

export const HOME = '/home/nipun';
export interface VfsEntry { path: string; name: string; kind: 'directory' | 'text' | 'binary'; lines: Line[]; target?: string }
export type Vfs = ReadonlyMap<string, VfsEntry>;

export async function loadTerminalData(): Promise<TerminalData> {
  const [profile, projects, posts] = await Promise.all([
    fetchJson<ClientProfile>('/data/profile.json'),
    fetchJson<{ projects: ClientProject[] }>('/data/projects.json'),
    fetchJson<ClientPostSummary[]>('/data/writing.json'),
  ]);
  return { profile, projects: projects.projects, posts };
}
export const loadTerminalActivity = () => fetchJson<ClientActivity>('/data/activity.json');

/** Resolve ~, absolute and relative paths without allowing traversal past /. */
export function resolvePath(input: string, cwd = HOME): string {
  const expanded = input === '~' ? HOME : input.startsWith('~/') ? HOME + input.slice(1) : input;
  const parts: string[] = [];
  for (const part of (expanded.startsWith('/') ? expanded : `${cwd}/${expanded}`).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return '/' + parts.join('/');
}
export function displayPath(path: string): string {
  return path === HOME ? '~' : path.startsWith(HOME + '/') ? '~' + path.slice(HOME.length) : path;
}
export function nowLines(data: TerminalData): Line[] {
  return textLines([...data.profile.now.items.map((item, index) => `${index + 1}. ${item}`),
    `Updated ${data.profile.now.updated}`].join('\n'));
}
export function contactLines(data: TerminalData): Line[] {
  const { site, links } = data.profile;
  return [['Email', site.email, `mailto:${site.email}`], ['GitHub', links.github, links.github],
    ['LinkedIn', links.linkedin, links.linkedin], ['Prabhava Labs', links.prabhava, links.prabhava]]
    .map(([label, text, href]) => [segment(`${label}: `), segment(text!, 'link', href)]);
}
export function buildVfs(data: TerminalData): Vfs {
  const entries = new Map<string, VfsEntry>();
  const add = (path: string, kind: VfsEntry['kind'], lines: Line[] = [], target?: string) => {
    entries.set(path, { path, name: path.split('/').at(-1) || '/', kind, lines, target });
  };
  for (const path of ['/', '/home', HOME, '/etc', `${HOME}/projects`, `${HOME}/writing`]) add(path, 'directory');
  add(`${HOME}/about.md`, 'text', textLines(data.profile.summary), '/about');
  add(`${HOME}/now.txt`, 'text', nowLines(data), '/now');
  add(`${HOME}/contact.txt`, 'text', contactLines(data), '/messages');
  add(`${HOME}/cv.pdf`, 'binary', [], '/cv');
  add(`${HOME}/.secrets`, 'text', textLines('Tea powers the build.\nMochi runs the help desk.\nThere are no secrets in a read-only archive.'));
  add(`${HOME}/.mochirc`, 'text', textLines('mood=content\nfavourite_snack=kiribath\nnap_after=45s'));
  add('/etc/serendib-release', 'text', textLines(`Serendib ${VERSION} "${CODENAME}"\nShell: nsh 1.0`));
  for (const project of data.projects) {
    const target = `/projects/${project.slug}`;
    const lines = textLines([project.title, project.tagline, `${project.status} · ${project.year} · ${project.category}`,
      `Stack: ${project.stack.join(', ')}`, project.description].join('\n'));
    for (const label of ['live', 'repo', 'story'] as const) {
      if (project[label]) lines.push([segment(`${label}: `), segment(project[label], 'link', project[label])]);
    }
    lines.push([segment('open '), segment(`projects/${project.slug}`, 'link', target), segment(' for the full page')]);
    add(`${HOME}/projects/${project.slug}.md`, 'text', lines, target);
  }
  for (const post of data.posts) {
    const target = `/writing/${post.slug}`;
    add(`${HOME}/writing/${post.slug}.md`, 'text', [...textLines(`${post.title}\n${post.date}\n${post.description}`),
      [segment('open '), segment(`writing/${post.slug}`, 'link', target), segment(' to read it')]], target);
  }
  return entries;
}
export function listDirectory(vfs: Vfs, path: string, hidden = false): VfsEntry[] {
  const prefix = path === '/' ? '/' : path + '/';
  return [...vfs.values()].filter(entry => entry.path.startsWith(prefix) && entry.path !== path
    && !entry.path.slice(prefix.length).includes('/') && (hidden || !entry.name.startsWith('.')))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
