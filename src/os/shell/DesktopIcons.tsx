import { APP_META } from '../registry/meta';
import { pathFor } from '../url/routes';
export function DesktopIcons() {
  const apps = Object.values(APP_META).filter(app => app.phase === 'v1' && app.desktopIcon).sort((a, b) => a.desktopIcon!.order - b.desktopIcon!.order);
  return <nav className="desktop-icons os-chrome" aria-label="Desktop"><ul>{apps.map(app => <li key={app.id}>
    <a href={pathFor(app.id, app.desktopIcon!.route ?? '')}><svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><use href={`#${app.desktopIcon!.icon}`} /></svg><span>{app.desktopIcon!.label}</span></a>
  </li>)}</ul></nav>;
}
