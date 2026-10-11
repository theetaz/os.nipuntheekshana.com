import { APP_META, DOCK_LINKS } from '../registry/meta';
import type { DesktopProps } from '../Desktop';
export function HomeScreen(_props: { home?: DesktopProps['home'] }) {
  const apps = Object.values(APP_META).filter(app => app.phase === 'v1' && app.mobile.gridOrder !== null).sort((a, b) => a.mobile.gridOrder! - b.mobile.gridOrder!);
  return <nav className="pocket-grid os-chrome" aria-label="Pocket apps"><ul>{apps.map(app => <li key={app.id}><a href={app.basePath}><svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true"><use href={`#${app.icon}`} /></svg><span>{app.name}</span></a></li>)}
    {DOCK_LINKS.map(link => <li key={link.id}><a href={link.href} target="_blank" rel="noopener noreferrer"><svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true"><use href={`#${link.icon}`} /></svg><span>{link.label}</span></a></li>)}
    <li><a href="/maps/play"><svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true"><use href="#app-pin" /></svg><span>Pin the city</span></a></li></ul></nav>;
}
