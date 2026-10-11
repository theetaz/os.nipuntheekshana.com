import type { MouseEvent, RefObject } from 'react';
import { SearchX } from 'lucide-react';
import { SearchField } from '../../../ui/SearchField';
import { EmptyState } from '../../../ui/EmptyState';
import { Chip } from '../../../ui/Chip';
import type { ClientPostSummary } from '../../../types/content';
import { FOLDERS, postDate, writingPath, type Folder } from '../data';

function navigateClick(event: MouseEvent<HTMLAnchorElement>, slug: string, onSelect?: (slug: string) => void) {
  if (!onSelect || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); onSelect(slug);
}
export interface PostListProps {
  posts: readonly ClientPostSummary[]; route: string; folder: Folder; tag: string | null; search: string;
  scrollRootRef?: RefObject<HTMLElement | null>;
  onSelect?: (slug: string) => void; onFolderChange?: (folder: Folder) => void;
  onSearchChange?: (value: string) => void; onTagChange?: (tag: string | null) => void;
}
export function PostList({ posts, route, folder, tag, search, scrollRootRef, onSelect, onFolderChange, onSearchChange, onTagChange }: PostListProps) {
  return <section className="writing-post-list" aria-label="Post list">
    <div className="writing-list-controls">
      {!route && <h1 className="writing-list-title">Writing</h1>}
      <label className="writing-folder-select js-only"><span className="sr-only">Writing folder</span>
        <select value={folder} onChange={event => onFolderChange?.(event.target.value as Folder)}>
          {FOLDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <SearchField className="writing-search js-only" label="Search writing" placeholder="Search writing" value={search}
        onChange={event => onSearchChange?.(event.target.value)} onKeyDown={event => {
          if (event.code === 'Escape' && search) { event.preventDefault(); event.stopPropagation(); onSearchChange?.(''); }
        }} />
      {tag && <Chip className="writing-active-tag" selected onClick={() => onTagChange?.(null)} aria-label={`Clear tag ${tag}`}>#{tag} ×</Chip>}
      <span className="sr-only" role="status">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</span>
    </div>
    <div className="writing-list-scroll" ref={!route ? scrollRootRef as RefObject<HTMLDivElement> : undefined}
      data-scroll-root={!route ? '' : undefined} tabIndex={-1}>
      {posts.length ? <ul className="writing-posts" aria-label="Posts">{posts.map(post => <li key={post.slug}>
        <a href={writingPath(post.slug)} className="writing-post-row" aria-current={route === post.slug ? 'page' : undefined}
          data-selected={route === post.slug} data-accent-filled={route === post.slug || undefined}
          onClick={event => navigateClick(event, post.slug, onSelect)} onKeyDown={event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.code) || event.altKey || event.metaKey || event.ctrlKey) return;
            const links = [...event.currentTarget.closest('ul')!.querySelectorAll<HTMLAnchorElement>('a')];
            const index = links.indexOf(event.currentTarget);
            const next = event.code === 'Home' ? 0 : event.code === 'End' ? links.length - 1
              : Math.max(0, Math.min(links.length - 1, index + (event.code === 'ArrowDown' ? 1 : -1)));
            event.preventDefault(); links[next]?.focus();
          }}>
          <span className="writing-post-title">{post.title}</span>
          <span className="writing-post-meta"><time dateTime={post.date}>{postDate(post.date)}</time>{` · ${post.minutes} min read`}</span>
          <span className="writing-post-description">{post.description}</span>
        </a>
      </li>)}</ul> : <EmptyState className="writing-list-empty" icon={search || tag ? <SearchX /> : undefined}
        title={search ? `No posts match "${search}".` : tag ? `No posts tagged "${tag}" here.`
          : `Nothing in ${FOLDERS.find(item => item.id === folder)?.label ?? 'All'} yet. Soon.`} />}
    </div>
  </section>;
}
