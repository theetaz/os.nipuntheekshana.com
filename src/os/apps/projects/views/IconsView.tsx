import type { ClientProject, Category } from '../../../types/content';
import { categoryOrder } from '../filter';
import { ProjectTile, type ProjectSelectionProps } from './ProjectTile';

export function IconsView({ projects, grouped, categories, ...selection }: ProjectSelectionProps & {
  projects: ClientProject[]; grouped: boolean; categories: Record<Category, string>;
}) {
  const groups = grouped ? categoryOrder.map(category => ({ category, title: categories[category], projects: projects.filter(project => project.category === category) }))
    : [{ category: 'all', title: '', projects }];
  return <div className="projects-icons" role="listbox" aria-label="Projects">
    {groups.filter(group => group.projects.length).map(group => <section role="group" aria-label={group.title || 'Projects'}
      className="projects-category" id={`projects-group-${group.category}`} data-category={group.category} key={group.category}>
      {group.title && <h2 className="projects-group-heading" aria-hidden="true">{group.title} · {group.projects.length}</h2>}
      <div className="projects-grid">{group.projects.map(project => <ProjectTile key={project.slug} project={project} {...selection} />)}</div>
    </section>)}
  </div>;
}
