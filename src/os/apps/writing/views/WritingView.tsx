import { Copy, ExternalLink } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { Toolbar } from '../../../ui/Toolbar';
import { Button } from '../../../ui/Button';
import { matchShortcut } from '../../../lib/hotkeys-match';
import { isMac } from '../../../lib/platform';
import type { ClientPost, ClientPostSummary } from '../../../types/content';
import { filterPosts, mainSiteUrl, type Folder, type TextSize } from '../data';
import { FolderSidebar } from './FolderSidebar';
import { PostList } from './PostList';
import { PostReader, type PostReaderProps } from './PostReader';
import '../writing.css';

export interface WritingViewProps {
  posts: readonly ClientPostSummary[]; post: ClientPost | null; route?: string; focused?: boolean;
  folder?: Folder; tag?: string | null; search?: string; size?: TextSize; showFolders?: boolean; pane?: 'folders' | 'list';
  error?: Error | null; postError?: Error | null; notFound?: boolean; scrollRootRef?: RefObject<HTMLElement | null>;
  onSelect?: (slug: string) => void; onBack?: () => void; onFolderChange?: (folder: Folder) => void;
  onTagChange?: (tag: string | null) => void; onShowFolders?: () => void; onSearchChange?: (value: string) => void;
  onTextSize?: (delta: -2 | 2) => void; onCopyLink?: () => void; onRetry?: () => void;
  onPostRetry?: () => void; onLinkClick?: PostReaderProps['onLinkClick'];
}
export function WritingView({ posts, post, route = '', focused = true, folder = 'all', tag = null, search = '',
  size = 17, showFolders = true, pane = 'list', error, postError, notFound, scrollRootRef, onSelect, onBack,
  onFolderChange, onTagChange, onShowFolders, onSearchChange, onTextSize, onCopyLink, onRetry, onPostRetry, onLinkClick }: WritingViewProps) {
  const filtered = filterPosts(posts, folder, tag, search);
  const view = useRef<HTMLDivElement>(null); const previousPane = useRef(pane);
  useEffect(() => {
    // Phone folder ↔ list moves replace the visible column; keep focus inside the column the reader now sees.
    if (previousPane.current === pane) return;
    previousPane.current = pane;
    const root = view.current; if (!root) return;
    const target = pane === 'folders' ? root.querySelector<HTMLElement>('.writing-folders [aria-current="page"]')
      : root.querySelector<HTMLElement>('.writing-folders-back');
    if (target?.getClientRects().length) target.focus({ preventScroll: true });
  }, [pane]);
  return <div ref={view} className="writing-view" data-reader-open={!!route} data-folders={showFolders} data-pane={pane} data-focused={focused}
    onKeyDown={event => {
      if (!focused || !onTextSize) return;
      const platform = isMac() ? 'mac' : 'other';
      const delta = matchShortcut(event, { code: 'Equal', alt: true }, { platform }) ? 2
        : matchShortcut(event, { code: 'Minus', alt: true }, { platform }) ? -2 : null;
      if (delta) { event.preventDefault(); onTextSize(delta); }
    }}>
    <Toolbar label="Writing controls" className="writing-toolbar" data-no-drag>
      <div className="writing-text-size js-only" role="group" aria-label="Text size">
        <Button variant="ghost" size={28} aria-label="Smaller text" disabled={size === 15} onClick={() => onTextSize?.(-2)}>A−</Button>
        <Button variant="ghost" size={28} aria-label="Bigger text" disabled={size === 19} onClick={() => onTextSize?.(2)}>A+</Button>
      </div>
      <Button className="writing-copy js-only" variant="ghost" size={28} onClick={onCopyLink} aria-label="Copy link"><Copy size={14} aria-hidden="true" /><span>Copy link</span></Button>
      <a className="writing-open-site" href={mainSiteUrl(route)} target="_blank" rel="noopener noreferrer" aria-label="Open on nipuntheekshana.com ↗">
        <span>Open on nipuntheekshana.com ↗</span><ExternalLink size={14} aria-hidden="true" />
      </a>
    </Toolbar>
    {error && <div className="writing-data-error" role="alert">Couldn't load writing. <Button size={28} onClick={onRetry}>Retry</Button></div>}
    <div className="writing-panes">
      <FolderSidebar posts={posts} folder={folder} tag={tag} focused={focused} onFolderChange={onFolderChange} onTagChange={onTagChange} />
      <PostList posts={filtered} route={route} folder={folder} tag={tag} search={search} scrollRootRef={scrollRootRef}
        onSelect={onSelect} onFolderChange={onFolderChange} onTagChange={onTagChange} onShowFolders={onShowFolders} onSearchChange={onSearchChange} />
      <PostReader post={post} route={route} size={size} error={postError} notFound={notFound} scrollRootRef={scrollRootRef}
        onBack={onBack} onRetry={onPostRetry} onTagChange={onTagChange} onLinkClick={onLinkClick} />
    </div>
  </div>;
}
