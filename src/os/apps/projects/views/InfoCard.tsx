import type { ClientProject, ClientWork } from '../../../types/content';
import { BrandCards } from './BrandCards';
import { ApiCard } from './ApiCard';

export function InfoCard({ project, work }: { project: ClientProject; work: ClientWork | null }) {
  return <aside className="project-info" aria-label="Project information"><h2>Info</h2>
    <dl>{work?.role && <><dt>Role</dt><dd>{work.role}</dd></>}<dt>Year</dt><dd>{project.year}</dd>
      <dt>Status</dt><dd>{project.status === 'incubating' ? 'Incubating' : 'Active'}</dd><dt>Stack</dt><dd>{project.stack.join(' · ')}</dd>
    </dl><BrandCards cards={project.brand?.cards ?? []} />{project.brand?.api && <ApiCard api={project.brand.api} />}
  </aside>;
}
