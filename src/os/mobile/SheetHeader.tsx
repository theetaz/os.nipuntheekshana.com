import type { HTMLAttributes, MouseEvent } from 'react';
import './app-sheet.css';
import { APP_META } from '../registry/meta';
import type { AppId } from '../types/apps';
export interface SheetHeaderProps extends HTMLAttributes<HTMLElement> {
  appId: AppId; route: string; title: string; titleId?: string; loading?: boolean;
  onHome?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onBack?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onShare?: () => void; onMenu?: (anchor: HTMLButtonElement) => void;
}
/** Shared static/managed 52 px chrome. App controls stay inside the content. */
export function SheetHeader({ appId, route, title, titleId, loading, onHome, onBack, onShare, onMenu, ...props }: SheetHeaderProps) {
  const meta = APP_META[appId];
  return <header {...props} className="sheet-header" data-sheet-header data-window-titlebar={onHome ? 'sheet' : undefined} role="group" aria-label={`${title} title bar`}>
    <a data-sheet-action className="sheet-back" href={route ? meta.basePath : '/'} onClick={route ? onBack : onHome} aria-label={route ? `Back to ${meta.name}` : 'Home'}>{route ? `‹ ${meta.name}` : '▦ Home'}</a>
    <span id={titleId} className="sheet-title window-title">{title}{loading && <span className="sr-only" role="status">Still loading…</span>}</span>
    <div className="sheet-actions">{onShare && <button type="button" data-sheet-action aria-label="Share" onClick={onShare}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M7 11H4v10h16V11h-3"/></svg></button>}
    {onMenu && <button type="button" data-sheet-action aria-label="App commands" aria-haspopup="menu" onClick={event=>onMenu(event.currentTarget)}>•••</button>}</div>
  </header>;
}
