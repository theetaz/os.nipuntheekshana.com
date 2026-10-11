import type { CSSProperties, MouseEvent } from 'react';
import type { ClientProject } from '../../../types/content';
import { Img } from '../../../ui/Img';

export function brandStyle(project: ClientProject): CSSProperties {
  return { '--project-color': project.brand?.color ?? 'var(--os-accent)',
    '--project-ink': project.brand?.ink ?? 'var(--os-on-accent)' } as CSSProperties;
}
export function ProjectIcon({ project, size = 64 }: { project: ClientProject; size?: number }) {
  return <span className="project-icon" style={{ ...brandStyle(project), width: size, height: size }} aria-hidden="true">
    {project.icon ? <Img image={project.icon} alt="" sizes={`${size}px`} />
      : <span lang={/[\u0D80-\u0DFF]/.test(project.monogram) ? 'si' : undefined}>{project.monogram}</span>}
  </span>;
}
export interface ProjectSelectionProps {
  selected: string | null;
  singleClick?: boolean;
  onSelect?: (slug: string) => void;
  onOpen?: (slug: string) => void;
  onContext?: (project: ClientProject, element: HTMLElement, point?: { x: number; y: number }) => void;
}
export function projectClick(event: MouseEvent<HTMLAnchorElement>, project: ClientProject, props: ProjectSelectionProps) {
  if (event.button || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !props.onSelect) return;
  event.preventDefault(); props.onSelect(project.slug);
  if (props.singleClick) props.onOpen?.(project.slug);
}
export function ProjectTile({ project, ...props }: ProjectSelectionProps & { project: ClientProject }) {
  const selected = project.slug === props.selected;
  return <a href={`/projects/${project.slug}`} role="option" aria-selected={selected}
    aria-label={`${project.title}${project.status === 'incubating' ? ', Incubating' : ''}`}
    data-project={project.slug} tabIndex={props.onSelect && !selected ? -1 : 0}
    className={`project-tile${selected ? ' is-selected' : ''}`} title={project.tagline}
    onClick={event => projectClick(event, project, props)} onDoubleClick={() => props.onOpen?.(project.slug)}
    onFocus={() => props.onSelect?.(project.slug)} onContextMenu={event => {
      if (!props.onContext) return; event.preventDefault(); props.onContext(project, event.currentTarget, { x: event.clientX, y: event.clientY });
    }}>
    <span className="project-icon-backdrop"><ProjectIcon project={project} /></span>
    <span className="project-tile-label"><span>{project.status === 'incubating' && <i className="project-incubating" aria-hidden="true" />}{project.title}</span></span>
  </a>;
}
