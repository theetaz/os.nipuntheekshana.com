import type { RefObject, KeyboardEvent } from 'react';
import { Archive, Box, CircleDot, Cpu, Layers, Mic, Smartphone, Star } from 'lucide-react';
import { Sidebar, SidebarSection } from '../../../ui/Sidebar';
import { StatusBar } from '../../../ui/StatusBar';
import { EmptyState } from '../../../ui/EmptyState';
import type { Category } from '../../../types/content';
import type { ProjectsData } from '../data';
import { categoryOrder, filterProjects, sortProjects, orderedForView, type ProjectFolder, type ProjectSort, type ProjectView, type SortOrder } from '../filter';
import { IconsView } from './IconsView';
import { ListView } from './ListView';
import { GalleryView } from './GalleryView';
import { ArchiveView } from './ArchiveView';
import type { ProjectSelectionProps } from './ProjectTile';
import { ProjectsToolbar, type ProjectsToolbarProps } from './ProjectsToolbar';
import '../projects.css';
import '../projects-index.css';

const categoryIcons = { data: Layers, apps: Smartphone, hardware: Cpu, worlds: Box, ai: Mic };
export interface ProjectsIndexProps extends ProjectSelectionProps, ProjectsToolbarProps {
  data: ProjectsData; folder?: ProjectFolder; view?: ProjectView; search?: string; sort?: SortOrder;
  activeCategory?: Category | null; focused?: boolean; showStatus?: boolean;
  onFolder?: (folder: ProjectFolder) => void; onCategory?: (category: Category) => void;
  onView?: (view: ProjectView) => void; onSearch?: (value: string) => void; onSort?: (key: ProjectSort) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void; onScroll?: () => void;
  scrollRef?: RefObject<HTMLElement | null>; searchRef?: RefObject<HTMLInputElement | null>;
}
export function ProjectsIndexView({ data, folder = 'all', view = 'icons', search = '', sort = { key: 'featured', descending: false },
  activeCategory = null, focused = true, showStatus = true, onFolder, onCategory, onView, onSearch, onSort, onKeyDown,
  onScroll, scrollRef, searchRef, ...selection }: ProjectsIndexProps) {
  const projects = orderedForView(sortProjects(filterProjects(data.projects, folder, search), sort), view, folder === 'all');
  const selected = projects.find(project => project.slug === selection.selected);
  const row = (label: string, value: ProjectFolder, count: number, icon: React.ReactNode, href: string) => <a href={href}
    className={`projects-folder${folder === value && !activeCategory ? ' is-current' : ''}`} aria-current={folder === value && !activeCategory ? 'page' : undefined}
    onClick={event => { if (!onFolder) return; event.preventDefault(); onFolder(value); }}>
    {icon}<span>{label}</span><span className="projects-count">{count}</span>
  </a>;
  return <div className="projects-app projects-index" data-focused={focused}>
    <ProjectsToolbar {...selection} view={view} search={search} onView={onView} onSearch={onSearch} searchRef={searchRef} />
    <div className="projects-body">
      <Sidebar label="Project folders" className="projects-sidebar">
        <SidebarSection title="Favourites">
          {row('All projects', 'all', data.projects.length, <CircleDot size={14} aria-hidden="true" />, '#projects-group-data')}
          {row('Featured', 'featured', data.projects.filter(project => project.featured).length, <Star size={14} aria-hidden="true" />, '#projects-group-data')}
        </SidebarSection>
        <SidebarSection title="Categories">{categoryOrder.map(category => {
          const Icon = categoryIcons[category];
          return <a key={category} href={`#projects-group-${category}`} className={`projects-folder${activeCategory === category ? ' is-current' : ''}`}
            aria-current={activeCategory === category ? 'location' : undefined} onClick={event => { if (!onCategory) return; event.preventDefault(); onCategory(category); }}>
            <Icon size={14} aria-hidden="true" /><span>{data.categories[category]}</span><span className="projects-count">{data.projects.filter(project => project.category === category).length}</span>
          </a>;
        })}</SidebarSection>
        <SidebarSection title="Status">
          {row('Active', 'active', data.projects.filter(project => project.status === 'active').length, <i className="project-dot active" aria-hidden="true" />, '#projects-group-data')}
          {row('Incubating', 'incubating', data.projects.filter(project => project.status === 'incubating').length, <i className="project-dot incubating" aria-hidden="true" />, '#projects-group-data')}
        </SidebarSection>
        <SidebarSection title="Archive">{row('Before open source', 'archive', data.archive.length, <Archive size={14} aria-hidden="true" />, '#projects-archive')}</SidebarSection>
      </Sidebar>
      <div className={`projects-content projects-view-${view}`} ref={scrollRef as RefObject<HTMLDivElement>} data-scroll-root
        onKeyDown={onKeyDown} onScroll={onScroll} tabIndex={-1}>
        {folder === 'archive' ? <ArchiveView archive={data.archive} /> : !projects.length ?
          <EmptyState title={`No projects match "${search}".`} body={'Try "map" or "Go".'} />
          : view === 'icons' ? <IconsView projects={projects} grouped={folder === 'all'} categories={data.categories} {...selection} />
            : view === 'list' ? <ListView projects={projects} sort={sort} onSort={onSort} {...selection} />
              : <GalleryView projects={projects} {...selection} />}
        {folder !== 'archive' && <div className="no-js-only"><ArchiveView archive={data.archive} /></div>}
      </div>
    </div>
    {showStatus && <StatusBar hint="Space to preview" className="projects-statusbar">
      {folder === 'archive' ? `${data.archive.length} archived projects` : `${projects.length}${projects.length !== data.projects.length ? ` of ${data.projects.length}` : ''} projects${selected ? ` · ${selected.title} selected` : ''}`}
    </StatusBar>}
  </div>;
}
