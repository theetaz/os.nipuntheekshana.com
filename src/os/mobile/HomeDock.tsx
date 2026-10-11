import { APP_META } from '../registry/meta';
export function HomeDock() {
  const apps = Object.values(APP_META).filter(app => app.phase === 'v1' && app.mobile.dockOrder !== null).sort((a,b) => a.mobile.dockOrder! - b.mobile.dockOrder!);
  return <nav className="phone-dock" aria-label="Dock"><ul role="toolbar" aria-label="Apps">{apps.map(app => <li role="presentation" key={app.id}><a data-phone-icon data-dock-app={app.id} data-app-launch={app.id} href={app.basePath} aria-label={app.name}><svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true"><use href={`#${app.icon}`}/></svg></a></li>)}</ul></nav>;
}
