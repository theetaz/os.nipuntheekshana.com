import type { CSSProperties } from 'react';
import type { ClientProject } from '../../../types/content';
import { Img } from '../../../ui/Img';
import { ProjectIcon, brandStyle, projectClick, type ProjectSelectionProps } from './ProjectTile';

export function ProjectLinks({ project }: { project: ClientProject }) {
  return <div className="project-links">{[['Live', project.live], ['Source', project.repo], ['Story', project.story]].map(([label, href]) => href &&
    <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}</div>;
}
export function GalleryView({ projects, ...selection }: ProjectSelectionProps & { projects: ClientProject[] }) {
  const project = projects.find(project => project.slug === selection.selected) ?? projects[0];
  if (!project) return null;
  return <div className="projects-gallery">
    <div className="projects-gallery-main">
      <a href={`/projects/${project.slug}`} className="projects-preview-stage" style={{
        '--project-light': project.brand?.backdrop.light ?? 'var(--os-sunken)', '--project-dark': project.brand?.backdrop.dark ?? 'var(--os-sunken)',
      } as CSSProperties} onClick={event => { if (selection.onOpen && !event.metaKey && !event.ctrlKey) { event.preventDefault(); selection.onOpen(project.slug); } }} aria-label={`Open ${project.title}`}>
        <Img image={project.cover} loading="eager" sizes="(max-width: 560px) 90vw, 440px" />
      </a>
      <div className="projects-filmstrip" role="listbox" aria-label="Project covers">{projects.map(item => <a key={item.slug}
        href={`/projects/${item.slug}`} role="option" aria-label={item.title} aria-selected={item.slug === project.slug} data-project={item.slug}
        tabIndex={item.slug === project.slug ? 0 : -1} className={item.slug === project.slug ? 'is-selected' : ''}
        onClick={event => projectClick(event, item, selection)} onDoubleClick={() => selection.onOpen?.(item.slug)}
        onFocus={() => selection.onSelect?.(item.slug)} onContextMenu={event => { if (!selection.onContext) return; event.preventDefault(); selection.onContext(item, event.currentTarget, { x: event.clientX, y: event.clientY }); }}>
        <Img image={item.cover} sizes="88px" alt={item.title} />
      </a>)}</div>
    </div>
    <aside className="projects-inspector" aria-label="Project inspector" style={brandStyle(project)}>
      <ProjectIcon project={project} size={48} /><h2>{project.title}</h2>{project.native && <p className="project-native" lang="si">{project.native}</p>}
      <p className="project-tagline">{project.tagline}</p><p>{project.description}</p>
      <h3>Stack</h3><div className="project-chips">{project.stack.map(item => <span key={item}>{item}</span>)}</div>
      <dl><dt>Year</dt><dd>{project.year}</dd><dt>Status</dt><dd>{project.status === 'incubating' ? 'Incubating' : 'Active'}</dd></dl>
      <ProjectLinks project={project} /><a href={`/projects/${project.slug}`} className="project-primary" onClick={event => {
        if (selection.onOpen && !event.metaKey && !event.ctrlKey) { event.preventDefault(); selection.onOpen(project.slug); }
      }}>Open project</a>
    </aside>
  </div>;
}
