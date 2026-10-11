import type { RefObject } from 'react';
import { ChevronLeft, ChevronRight, GalleryHorizontal, LayoutGrid, List } from 'lucide-react';
import { Segmented } from '../../../ui/Segmented';
import { SearchField } from '../../../ui/SearchField';
import type { ClientProject } from '../../../types/content';
import type { ProjectView } from '../filter';

export interface ProjectsToolbarProps {
  onBack?: () => void; onForward?: () => void; canBack?: boolean; canForward?: boolean;
  onCopy?: () => void;
}
export function ProjectsToolbar({ project, view = 'icons', search = '', onView, onSearch, searchRef,
  onBack, onForward, canBack, canForward, onCopy }: ProjectsToolbarProps & {
    project?: ClientProject; view?: ProjectView; search?: string; onView?: (view: ProjectView) => void;
    onSearch?: (value: string) => void; searchRef?: RefObject<HTMLInputElement | null>;
  }) {
  return <div className="projects-toolbar" role="group" aria-label="Projects toolbar" data-no-drag>
    <div className="projects-navigation">
      {onBack ? <button type="button" aria-label="Back" disabled={!canBack} onClick={onBack}><ChevronLeft size={16} aria-hidden="true" /></button>
        : project ? <a href="/projects" aria-label="Back to projects"><ChevronLeft size={16} aria-hidden="true" /></a>
          : <button type="button" disabled aria-label="Back"><ChevronLeft size={16} aria-hidden="true" /></button>}
      <button type="button" aria-label="Forward" disabled={!canForward} onClick={onForward}><ChevronRight size={16} aria-hidden="true" /></button>
    </div>
    {project ? <span className="projects-toolbar-title">{project.title} — Projects</span> : <h1 className="projects-toolbar-title">Projects</h1>}
    <div className="projects-toolbar-actions">{project ? <>
      <button type="button" className="projects-copy js-only" disabled={!onCopy} onClick={onCopy}>Copy link</button>
      {project.live && <a href={project.live} target="_blank" rel="noopener noreferrer">Open live ↗</a>}
    </> : <>
      <Segmented label="Project view" value={view} className="projects-view-switch js-only" onChange={value => onView?.(value as ProjectView)} options={[
        { value: 'icons', label: <><LayoutGrid size={14} aria-hidden="true" /><span className="sr-only">Icons</span></> },
        { value: 'list', label: <><List size={14} aria-hidden="true" /><span className="sr-only">List</span></> },
        { value: 'gallery', label: <><GalleryHorizontal size={14} aria-hidden="true" /><span className="sr-only">Gallery</span></> },
      ]} />
      <SearchField label="Search projects" placeholder="Search projects" value={search} ref={searchRef}
        readOnly={!onSearch} onChange={event => onSearch?.(event.currentTarget.value)} className="projects-search js-only" />
    </>}</div>
  </div>;
}
