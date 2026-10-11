import { APP_META, DOCK_LINKS } from '../registry/meta';
import { DockItem } from './DockItem';
export function Dock({ mode = 'desktop' }: { mode?: 'desktop' | 'mobile' }) {
  const apps = Object.values(APP_META).filter(app => app.phase === 'v1' && (mode === 'mobile' ? app.mobile.dockOrder !== null : app.dockOrder !== null && app.id !== 'trash'))
    .sort((a, b) => (mode === 'mobile' ? a.mobile.dockOrder! - b.mobile.dockOrder! : a.dockOrder! - b.dockOrder!));
  return <nav className="static-dock os-chrome" aria-label="Dock"><ul role="toolbar" aria-label="Apps">
    {apps.map(app => <li role="presentation" key={app.id}><DockItem app={app} /></li>)}
    {mode === 'desktop' && <><li role="presentation" className="dock-divider" aria-hidden="true" />
      {DOCK_LINKS.map(link => <li role="presentation" key={link.id}><a href={link.href} aria-label={link.label} target="_blank" rel="noopener noreferrer"><svg width="48" height="48" viewBox="0 0 64 64" aria-hidden="true"><use href={`#${link.icon}`} /></svg></a></li>)}
      <li role="presentation" className="dock-divider" aria-hidden="true" /><li role="presentation"><DockItem app={APP_META.trash} /></li></>}
  </ul></nav>;
}
