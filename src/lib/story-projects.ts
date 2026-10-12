import { getClientProjects } from './client-data';
import type { ClientProject } from '../os/types/content';
import type { StickerId } from './kottu-art';

export type StorySectionId = 'highlights' | 'side' | 'fun';
export interface StoryProject extends Pick<ClientProject, 'slug' | 'title' | 'native' | 'tagline' | 'stack' | 'status' | 'year' | 'repo' | 'live' | 'order'> {
  cover: ClientProject['cover'] | null;
  section: StorySectionId;
  sticker: StickerId;
  tilt: number;
  href: string;
  command: string;
}
function tiltFor(slug: string): number {
  let hash = 2166136261;
  for (const char of slug) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (hash % 15) - 7 || 1;
}
export async function storyProjects(): Promise<Record<StorySectionId, StoryProject[]>> {
  const groups: Record<StorySectionId, StoryProject[]> = { highlights: [], side: [], fun: [] };
  for (const project of await getClientProjects()) {
    const section = project.featured ? 'highlights' : ['colombo-delivery', 'terrarun', 'mochi'].includes(project.slug) ? 'fun' : 'side';
    const href = `/projects/${project.slug}`;
    groups[section].push({ ...project, section, sticker: `sticker-${project.slug}` as StickerId, tilt: tiltFor(project.slug), href, command: `$ open ${href}` });
  }
  groups.fun.push({ slug: 'pin-the-city', title: 'Pin the city', tagline: 'A game on this desktop.', stack: [], status: 'active',
    year: 2026, order: groups.fun.length, cover: null, section: 'fun', sticker: 'sticker-pin-the-city', tilt: tiltFor('pin-the-city'),
    href: '/maps/play', command: '$ open /maps/play' });
  return groups;
}
