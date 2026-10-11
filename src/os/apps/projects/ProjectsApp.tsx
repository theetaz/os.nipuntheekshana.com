import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { AppProps } from '../../registry/apps';
import type { Category, ClientProject } from '../../types/content';
import type { MenuItemSpec } from '../../types/apps';
import { copyWindowLink, openContextMenu, openQuickLook, toast, useAppCommands, useAppMenuState } from '../../wm/commands';
import { EmptyState } from '../../ui/EmptyState';
import { useProjectWork, useProjectsData, type ProjectData } from './data';
import { filterProjects, nextSelection, orderedForView, sortProjects, type ProjectFolder, type ProjectSort, type ProjectView, type SortOrder } from './filter';
import { ProjectsIndexView } from './views/ProjectsIndexView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { ProjectsToolbar } from './views/ProjectsToolbar';
import './projects.css';
export { menus } from './menus';

function ProjectContent({ project, next, initial, props, onReady, ...actions }: Omit<ProjectData, 'work'> & {
  initial: unknown; props: AppProps; onReady: () => void;
  onNavigate: (route: string) => void; onBack: () => void; onForward: () => void; canBack: boolean; canForward: boolean;
}) {
  const work = useProjectWork(project.slug, initial);
  const usable = !!work.data || !!work.error;
  useLayoutEffect(() => { if (usable) onReady(); }, [usable, onReady]);
  return <ProjectDetailView project={project} work={work.data} next={next} {...actions} scrollRef={props.scrollRootRef}
    workError={!!work.error} onRetry={work.retry} onCopy={() => { void copyWindowLink(props.windowId); }}
    onPreview={(index, element) => {
      const rect = element.getBoundingClientRect();
      openQuickLook({ slug: project.slug, index, from: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
    }} />;
}

export default function ProjectsApp(props: AppProps) {
  const { route, focused, scrollRootRef, initialData, ready } = props;
  const { data, error, retry } = useProjectsData(initialData);
  const seed = initialData && typeof initialData === 'object' && 'project' in initialData ? initialData as ProjectData : null;
  const project = data?.projects.find(project => project.slug === route) ?? (seed?.project.slug === route ? seed.project : null);
  const [folder, setFolder] = useState<ProjectFolder>('all'); const [view, setView] = useState<ProjectView>('icons');
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder>({ key: 'featured', descending: false });
  const [showStatus, setShowStatus] = useState(true); const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [history, setHistory] = useState({ routes: [route], cursor: 0 });
  const historyRef = useRef(history); historyRef.current = history;
  const scrolls = useRef(new Map<string, number>()); const lastRoute = useRef(route); const restored = useRef(route);
  const readyCalled = useRef(false); const searchRef = useRef<HTMLInputElement>(null);
  const pendingCategory = useRef<Category | null>(null); const typeAhead = useRef({ text: '', time: 0 });
  const categoryScroll = useRef<{ top: number; category: Category } | null>(null);
  const visible = useMemo(() => data ? orderedForView(sortProjects(filterProjects(data.projects, folder, search), sort), view, folder === 'all') : [], [data, folder, search, sort, view]);
  const currentSelection = visible.some(project => project.slug === selected) ? selected : visible[0]?.slug ?? null;
  const rememberScroll = () => { scrolls.current.set(route, scrollRootRef.current?.scrollTop ?? 0); };
  const onReady = useCallback(() => { if (!readyCalled.current) { readyCalled.current = true; ready(); } }, [ready]);
  const navigate = (next: string) => {
    if (next === route) return;
    rememberScroll();
    const current = historyRef.current;
    const updated = { routes: [...current.routes.slice(0, current.cursor + 1), next], cursor: current.cursor + 1 };
    historyRef.current = updated; setHistory(updated);
    props.navigate(next, { query: {}, title: next ? `${data?.projects.find(project => project.slug === next)?.title ?? next} — Projects` : 'Projects' });
  };
  const travel = (direction: -1 | 1) => {
    const current = historyRef.current; const cursor = current.cursor + direction; const next = current.routes[cursor];
    if (next === undefined) return;
    rememberScroll(); const updated = { ...current, cursor }; historyRef.current = updated; setHistory(updated);
    props.navigate(next, { query: {}, title: next ? `${data?.projects.find(project => project.slug === next)?.title ?? next} — Projects` : 'Projects' });
  };
  useLayoutEffect(() => {
    if (lastRoute.current === route) return;
    const current = historyRef.current;
    // Native history and Quick Look can navigate without the app's toolbar.
    if (current.routes[current.cursor] !== route) {
      const neighbor = current.routes[current.cursor - 1] === route ? current.cursor - 1
        : current.routes[current.cursor + 1] === route ? current.cursor + 1 : -1;
      const updated = neighbor < 0 ? { routes: [...current.routes.slice(0, current.cursor + 1), route], cursor: current.cursor + 1 }
        : { ...current, cursor: neighbor };
      historyRef.current = updated; setHistory(updated);
    }
    lastRoute.current = route;
  }, [route]);
  useLayoutEffect(() => {
    if (restored.current !== route && scrollRootRef.current) {
      scrollRootRef.current.scrollTop = scrolls.current.get(route) ?? 0; restored.current = route;
      if (!route && selected) scrollRootRef.current.querySelector<HTMLElement>(`[data-project="${selected}"]`)?.focus({ preventScroll: true });
    }
    if (!route && data || error && !project) onReady();
    if (data && route && !project) onReady();
    if (pendingCategory.current && scrollRootRef.current) {
      const target = scrollRootRef.current.querySelector<HTMLElement>(`[data-category="${pendingCategory.current}"]`);
      if (target) {
        scrollRootRef.current.scrollTop += target.getBoundingClientRect().top - scrollRootRef.current.getBoundingClientRect().top;
        categoryScroll.current = { top: scrollRootRef.current.scrollTop, category: pendingCategory.current };
      }
      pendingCategory.current = null;
    }
  }, [route, data, error, project, onReady, folder, search, view, scrollRootRef, selected]);
  const chooseFolder = (value: ProjectFolder) => { categoryScroll.current = null; setFolder(value); setActiveCategory(null); if (scrollRootRef.current) scrollRootRef.current.scrollTop = 0; };
  const chooseCategory = (value: Category) => {
    pendingCategory.current = value; setFolder('all'); setSearch(''); setView('icons'); setActiveCategory(value);
    // A second click still scrolls when React state already has the requested values.
    const target = scrollRootRef.current?.querySelector<HTMLElement>(`[data-category="${value}"]`);
    if (folder === 'all' && !search && target && scrollRootRef.current) {
      scrollRootRef.current.scrollTop += target.getBoundingClientRect().top - scrollRootRef.current.getBoundingClientRect().top;
      categoryScroll.current = { top: scrollRootRef.current.scrollTop, category: value };
      pendingCategory.current = null;
    }
  };
  const changeSort = (key: ProjectSort) => setSort(current => ({ key, descending: current.key === key ? !current.descending : key === 'year' }));
  const preview = (item: ClientProject, element?: HTMLElement | null) => {
    rememberScroll(); setSelected(item.slug);
    const rect = element?.getBoundingClientRect();
    openQuickLook({ slug: item.slug, index: 0, from: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null });
  };
  const context = (item: ClientProject, element: HTMLElement, point?: { x: number; y: number }) => {
    setSelected(item.slug); element.focus({ preventScroll: true }); const rect = element.getBoundingClientRect();
    const items: MenuItemSpec[] = [
      { kind: 'item', label: 'Open', command: `projects.context.open.${item.slug}` },
      { kind: 'item', label: 'Quick Look', command: `projects.context.preview.${item.slug}` },
      ...([['Open live site ↗', 'live', item.live], ['View source ↗', 'repo', item.repo], ['Read the story ↗', 'story', item.story]] as const)
        .flatMap(([label, kind, href]): MenuItemSpec[] => href ? [{ kind: 'item', label, command: `projects.context.${kind}.${item.slug}` }] : []),
      { kind: 'separator' }, { kind: 'item', label: 'Copy link', command: `projects.context.copy.${item.slug}` },
    ];
    openContextMenu({ ...point ?? { x: rect.x, y: rect.bottom }, target: `project:${item.slug}`, items });
  };
  useAppCommands(props.windowId, command => {
    if (command.startsWith('projects.view.')) { setView(command.slice(14) as ProjectView); return true; }
    if (command.startsWith('projects.sort.')) { const key = command.slice(14) as ProjectSort; setSort({ key, descending: key === 'year' }); return true; }
    if (command === 'projects.statusbar') { setShowStatus(value => !value); return true; }
    const item = project ?? data?.projects.find(project => project.slug === currentSelection);
    if (command === 'projects.open' && item) { navigate(item.slug); return true; }
    if (command === 'projects.preview' && item) { preview(item, scrollRootRef.current?.querySelector<HTMLElement>(`[data-project="${item.slug}"]`)); return true; }
    if (!command.startsWith('projects.context.')) return false;
    const [, , action, slug] = command.split('.'); const target = data?.projects.find(project => project.slug === slug);
    if (!target) return false;
    if (action === 'open') navigate(target.slug);
    else if (action === 'preview') preview(target, scrollRootRef.current?.querySelector<HTMLElement>(`[data-project="${target.slug}"]`));
    else if (action === 'copy') void navigator.clipboard.writeText(`https://os.nipuntheekshana.com/projects/${target.slug}`).then(() => toast({ title: 'Link copied.' }), () => toast({ title: 'Couldn’t copy the link.' }));
    else { const href = target[action as 'live' | 'repo' | 'story']; if (href) window.open(href, '_blank', 'noopener,noreferrer'); }
    return true;
  });
  const menuState = useMemo(() => ({
    ...Object.fromEntries(['icons', 'list', 'gallery'].map(value => [`projects.view.${value}`, { checked: view === value, disabled: !!route }])),
    ...Object.fromEntries(['featured', 'name', 'year', 'category'].map(value => [`projects.sort.${value}`, { checked: sort.key === value, disabled: !!route }])),
    'projects.statusbar': { checked: showStatus, disabled: !!route },
    'projects.open': { disabled: !currentSelection || !!route || folder === 'archive' }, 'projects.preview': { disabled: !project && (!currentSelection || folder === 'archive') },
  }), [view, sort.key, showStatus, route, currentSelection, project, folder]);
  useAppMenuState(props.windowId, menuState);
  useLayoutEffect(() => {
    props.setTitle(route ? `${project?.title ?? route} — Projects` : 'Projects');
  }, [route, project?.title]);
  const toolbar = { onBack: () => route && history.cursor === 0 ? navigate('') : travel(-1), onForward: () => travel(1),
    canBack: !!route || history.cursor > 0, canForward: history.cursor < history.routes.length - 1 };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || !focused) return;
    if ((event.metaKey || event.ctrlKey) && event.code === 'KeyF' || event.key === '/' && !(event.target as Element).closest('input,textarea,[contenteditable="true"]')) {
      if (!route) { event.preventDefault(); event.stopPropagation(); searchRef.current?.focus(); } return;
    }
    if (route || (event.target as Element).closest('input,button,textarea,[contenteditable="true"]')) return;
    const element = (event.target as Element).closest<HTMLElement>('[data-project]');
    const item = visible.find(project => project.slug === (element?.dataset.project ?? currentSelection));
    if (!item) return;
    if (event.key === ' ' || event.key === 'Enter' || (event.metaKey || event.ctrlKey) && event.key === 'ArrowDown') {
      event.preventDefault(); event.stopPropagation(); event.key === ' ' ? preview(item, element) : navigate(item.slug); return;
    }
    if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') {
      event.preventDefault(); event.stopPropagation(); if (element) context(item, element); return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    let next = -1;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      const grid = element?.closest('.projects-grid'); const columns = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 1;
      next = nextSelection(visible.indexOf(item), event.key, visible.length, view === 'icons' ? columns : 1);
    } else if (event.key.length === 1) {
      const now = performance.now(); const previous = typeAhead.current;
      const text = (now - previous.time < 700 ? previous.text : '') + event.key.toLocaleLowerCase('en');
      typeAhead.current = { text, time: now }; next = visible.findIndex(project => project.title.toLocaleLowerCase('en').startsWith(text));
    }
    if (next >= 0 && visible[next]) {
      event.preventDefault(); event.stopPropagation(); setSelected(visible[next]!.slug);
      scrollRootRef.current?.querySelector<HTMLElement>(`[data-project="${visible[next]!.slug}"]`)?.focus();
    }
  };
  const content = route && project ? <ProjectContent key={project.slug} project={project}
    next={data ? (() => { const next = data.projects[(data.projects.indexOf(project) + 1) % data.projects.length]!; return { slug: next.slug, title: next.title }; })() : seed!.next}
    initial={initialData} props={props} onReady={onReady} onNavigate={navigate} {...toolbar} />
    : route && data ? <div className="projects-app"><ProjectsToolbar {...toolbar} /><div data-scroll-root ref={scrollRootRef as React.RefObject<HTMLDivElement>}>
      <EmptyState title={`No project called "${route}".`} action={<a href="/projects" onClick={event => { event.preventDefault(); navigate(''); }}>All projects</a>} />
    </div></div>
      : !route && data ? <ProjectsIndexView data={data} {...toolbar} folder={folder} view={view} search={search} sort={sort}
        selected={currentSelection} singleClick={props.mode === 'mobile'} focused={focused} activeCategory={activeCategory} showStatus={showStatus} searchRef={searchRef} scrollRef={scrollRootRef}
        onFolder={chooseFolder} onCategory={chooseCategory} onView={setView} onSort={changeSort} onSearch={value => { setSearch(value); setActiveCategory(null); }}
        onSelect={setSelected} onOpen={navigate} onContext={context} onScroll={() => {
          if (folder !== 'all' || view !== 'icons' || !scrollRootRef.current) return;
          const root = scrollRootRef.current; const top = root.getBoundingClientRect().top;
          if (categoryScroll.current && Math.abs(root.scrollTop - categoryScroll.current.top) <= 1) {
            setActiveCategory(categoryScroll.current.category); return;
          }
          categoryScroll.current = null;
          const groups = [...root.querySelectorAll<HTMLElement>('.projects-category')];
          const current = groups.filter(group => group.getBoundingClientRect().top <= top + 40).at(-1);
          setActiveCategory(current?.dataset.category as Category ?? null);
        }} />
        : <div className="projects-app projects-loading" data-scroll-root ref={scrollRootRef as React.RefObject<HTMLDivElement>}>
          {error ? <p className="projects-data-error" role="alert">Couldn't load projects. <button type="button" onClick={retry}>Retry</button></p>
            : <><span className="sr-only" role="status">Loading projects…</span><div className="projects-loading-sidebar">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</div><div className="projects-loading-grid">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div></>}
        </div>;
  return <div className="projects-host" onKeyDown={keyboard} onScrollCapture={event => {
    if ((event.target as HTMLElement).hasAttribute('data-scroll-root')) scrolls.current.set(route, (event.target as HTMLElement).scrollTop);
  }}>{content}</div>;
}
