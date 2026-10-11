import type { Category, ClientProject } from '../../types/content';

export const categoryOrder: readonly Category[] = ['data', 'apps', 'hardware', 'worlds', 'ai'];
export type ProjectFolder = 'all' | 'featured' | 'active' | 'incubating' | 'archive';
export type ProjectView = 'icons' | 'list' | 'gallery';
export type ProjectSort = 'featured' | 'name' | 'year' | 'category';
export interface SortOrder { key: ProjectSort; descending: boolean }

export function filterProjects(projects: readonly ClientProject[], folder: ProjectFolder, search: string): ClientProject[] {
  const terms = search.trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  return projects.filter(project => {
    if (folder === 'archive' || (folder === 'featured' && !project.featured)
      || ((folder === 'active' || folder === 'incubating') && project.status !== folder)) return false;
    const text = [project.title, project.native, project.tagline, project.description,
      project.categoryLabel, ...project.stack].join(' ').toLocaleLowerCase('en');
    return terms.every(term => text.includes(term));
  });
}
export function sortProjects(projects: readonly ClientProject[], { key, descending }: SortOrder): ClientProject[] {
  return [...projects].sort((a, b) => {
    const value = key === 'featured' ? a.order - b.order : key === 'name' ? a.title.localeCompare(b.title, 'en')
      : key === 'year' ? a.year - b.year : categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    return (descending ? -value : value) || a.order - b.order;
  });
}
export function orderedForView(projects: readonly ClientProject[], view: ProjectView, grouped: boolean): ClientProject[] {
  return view === 'icons' && grouped ? categoryOrder.flatMap(category => projects.filter(project => project.category === category)) : [...projects];
}
export function nextSelection(index: number, key: string, count: number, columns = 1): number {
  if (!count) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : key === 'ArrowUp' ? -columns : columns;
  return Math.max(0, Math.min(count - 1, (index < 0 ? 0 : index) + step));
}
function channels(hex: string): number[] {
  return /^#[\da-f]{6}$/i.test(hex) ? [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) : [];
}
export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => channels(hex).reduce((sum, value, index) => {
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
  }, 0);
  if (!channels(first).length || !channels(second).length) return 0;
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function safeBackdrop(backdrop: string | undefined, theme: 'light' | 'dark'): string {
  return backdrop && contrastRatio(backdrop, theme === 'light' ? '#645d52' : '#b9b2a6') >= 4.5
    ? backdrop : 'var(--os-window)';
}
