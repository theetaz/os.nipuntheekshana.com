import { FileText, NotebookPen, Rss, Settings2, Sun } from 'lucide-react';
import { Sidebar, SidebarRow, SidebarSection } from '../../../ui/Sidebar';
import { Chip } from '../../../ui/Chip';
import type { ClientPostSummary } from '../../../types/content';
import { FOLDERS, RSS_URL, type Folder } from '../data';

const icons = { all: FileText, engineering: Settings2, notes: NotebookPen, life: Sun };
export interface FolderSidebarProps {
  posts: readonly ClientPostSummary[]; folder: Folder; tag: string | null; focused: boolean;
  onFolderChange?: (folder: Folder) => void; onTagChange?: (tag: string | null) => void;
}
export function FolderSidebar({ posts, folder, tag, focused, onFolderChange, onTagChange }: FolderSidebarProps) {
  const tags = [...new Set(posts.flatMap(post => post.tags))];
  return <Sidebar label="Writing folders" className="writing-folders">
    <SidebarSection title="Folders">
      {FOLDERS.map(item => {
        const Icon = icons[item.id]; const count = posts.filter(post => item.id === 'all' || post.kind === item.id).length;
        return <div key={item.id}>
          <SidebarRow className="js-only" icon={<Icon strokeWidth={1.75} />} count={count} selected={folder === item.id}
            activeWindow={focused} onClick={() => onFolderChange?.(item.id)}>{item.label}</SidebarRow>
          <span className="writing-static-folder no-js-only"><Icon size={14} aria-hidden="true" />{item.label}<span>{count}</span></span>
        </div>;
      })}
    </SidebarSection>
    <SidebarSection title="Tags">
      <div className="writing-folder-tags">{tags.map(item => <span key={item}>
        <Chip className="js-only" selected={tag === item} onClick={() => onTagChange?.(tag === item ? null : item)}>{item}</Chip>
        <span className="no-js-only writing-static-tag">{item}</span>
      </span>)}</div>
    </SidebarSection>
    <a className="writing-rss" href={RSS_URL} target="_blank" rel="noopener noreferrer"><Rss size={14} aria-hidden="true" />RSS ↗</a>
  </Sidebar>;
}
