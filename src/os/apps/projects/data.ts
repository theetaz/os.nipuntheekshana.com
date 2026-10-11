import { useAppData } from '../../lib/fetch-json';
import type { Category, ClientArchiveItem, ClientProject, ClientWork } from '../../types/content';

export interface ProjectsData {
  projects: ClientProject[];
  archive: ClientArchiveItem[];
  categories: Record<Category, string>;
}
export interface ProjectData {
  project: ClientProject;
  work: ClientWork | null;
  next: Pick<ClientProject, 'slug' | 'title'>;
}
export function useProjectsData(initial: unknown) {
  const seed = initial && typeof initial === 'object' && 'projects' in initial ? initial as ProjectsData : null;
  return useAppData<ProjectsData>('projects:index', '/data/projects.json', seed);
}
export function useProjectWork(slug: string, initial: unknown) {
  const seed = initial && typeof initial === 'object' && 'project' in initial ? initial as ProjectData : null;
  return useAppData<ClientWork>(`projects:work:${slug}`, `/data/work/${slug}.json`, seed?.project.slug === slug ? seed.work : null);
}
