import type { CSSProperties, RefObject } from 'react';
import { Prose } from '../../../ui/Prose';
import type { ProjectData } from '../data';
import { safeBackdrop } from '../filter';
import { ProjectIcon, brandStyle } from './ProjectTile';
import { ScreensStrip } from './ScreensStrip';
import { InfoCard } from './InfoCard';
import { ProjectsToolbar, type ProjectsToolbarProps } from './ProjectsToolbar';
import '../projects.css';

export function ProjectDetailView({ project, work, next, onPreview, onNavigate, scrollRef, workError, onRetry, ...toolbar }: ProjectData & ProjectsToolbarProps & {
  onPreview?: (index: number, element: HTMLElement) => void; onNavigate?: (slug: string) => void;
  scrollRef?: RefObject<HTMLElement | null>; workError?: boolean; onRetry?: () => void;
}) {
  const brand = project.brand;
  const cta = brand?.cta ?? (project.live ? { label: 'Open live site', href: project.live } : project.repo ? { label: 'View source', href: project.repo } : null);
  return <div className="projects-app project-detail" style={{ ...brandStyle(project),
    '--project-light': safeBackdrop(brand?.backdrop.light, 'light'), '--project-dark': safeBackdrop(brand?.backdrop.dark, 'dark'),
  } as CSSProperties}>
    <ProjectsToolbar {...toolbar} project={project} />
    <div className="project-detail-scroll" data-scroll-root ref={scrollRef as RefObject<HTMLDivElement>} tabIndex={-1}>
      <header className="project-hero"><ProjectIcon project={project} size={72} /><div>
        <div className="project-heading"><h1>{project.title}</h1>{project.native && <span lang="si">{project.native}</span>}</div>
        <p className="project-hero-tagline">{project.tagline}</p>
        {brand && <p className="project-platform">{`${brand.platform} · ${brand.platformNote}`}</p>}
        <div className="project-chips">{brand?.chips.map(chip => <span key={chip}>{chip}</span>)}</div>
        <div className="project-hero-links">{cta && <a className="project-primary" href={cta.href} target="_blank" rel="noopener noreferrer">{cta.label}</a>}
          {project.repo && <a href={project.repo} target="_blank" rel="noopener noreferrer">Source ↗</a>}
          {project.story && <a href={project.story} target="_blank" rel="noopener noreferrer">Story ↗</a>}
        </div>
      </div></header>
      {!!work?.facts.length && <dl className="project-facts" aria-label="Project facts">{work.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
      <ScreensStrip project={project} onPreview={onPreview} />
      <div className="project-body"><article className="project-story" aria-label="Case study">
        <p className="project-description">{project.description}</p>{work?.lede && <p className="project-lede">{work.lede}</p>}
        {work && <Prose html={work.html} />}
        {workError && <p className="projects-data-error" role="alert">Couldn't load projects. <button type="button" onClick={onRetry}>Retry</button></p>}
      </article><InfoCard project={project} work={work} /></div>
      <footer className="project-footer"><a href={`/projects/${next.slug}`} onClick={event => {
        if (!onNavigate || event.metaKey || event.ctrlKey) return; event.preventDefault(); onNavigate(next.slug);
      }}>Next project: {next.title} →</a><a href="/projects" onClick={event => {
        if (!onNavigate || event.metaKey || event.ctrlKey) return; event.preventDefault(); onNavigate('');
      }}>All projects</a></footer>
    </div>
  </div>;
}
