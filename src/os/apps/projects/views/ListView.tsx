import type { ClientProject } from '../../../types/content';
import type { ProjectSort, SortOrder } from '../filter';
import { ProjectIcon, projectClick, type ProjectSelectionProps } from './ProjectTile';

export function ListView({ projects, sort, onSort, ...selection }: ProjectSelectionProps & {
  projects: ClientProject[]; sort: SortOrder; onSort?: (key: ProjectSort) => void;
}) {
  return <table className="projects-list" aria-label="Projects">
    <thead><tr>{(['Name', 'Category', 'Stack', 'Year', 'Status'] as const).map(label => {
      const key = label.toLowerCase() as ProjectSort; const sortable = ['Name', 'Category', 'Year'].includes(label);
      return <th key={label} scope="col" aria-sort={sortable && sort.key === key ? sort.descending ? 'descending' : 'ascending' : undefined}>
        {sortable ? <button type="button" disabled={!onSort} onClick={() => onSort?.(key)}>{label}{sort.key === key && <span aria-hidden="true"> {sort.descending ? '▼' : '▲'}</span>}</button> : label}
      </th>;
    })}</tr></thead>
    <tbody>{projects.map(project => <tr key={project.slug} data-category={project.category} aria-selected={selection.selected === project.slug}
      className={selection.selected === project.slug ? 'is-selected' : ''}
      onClick={event => {
        if (!selection.onSelect) return;
        selection.onSelect(project.slug); event.currentTarget.querySelector<HTMLElement>('[data-project]')?.focus({ preventScroll: true });
      }} onDoubleClick={() => selection.onOpen?.(project.slug)}
      onContextMenu={event => {
        if (!selection.onContext) return; event.preventDefault();
        const anchor = event.currentTarget.querySelector<HTMLElement>('[data-project]')!;
        selection.onContext(project, anchor, { x: event.clientX, y: event.clientY });
      }}>
      <td><a href={`/projects/${project.slug}`} data-project={project.slug} tabIndex={selection.onSelect && selection.selected !== project.slug ? -1 : 0}
        onFocus={() => selection.onSelect?.(project.slug)} onClick={event => projectClick(event, project, selection)}>
        <ProjectIcon project={project} size={20} /><span>{project.title}{project.native && <span className="project-native" lang="si"> {project.native}</span>}</span>
      </a></td><td>{project.categoryLabel}</td><td>{project.stack.slice(0, 3).join(' · ')}</td><td>{project.year}</td>
      <td><span className={`project-status ${project.status}`}>{project.status === 'incubating' ? 'Incubating' : 'Active'}</span></td>
    </tr>)}</tbody>
  </table>;
}
