import { APP_META } from '../registry/meta';
import type { AppId, AppMeta } from '../types/apps';

/** One entry per app, including later apps; root and sub-routes share the registry policy. */
export const ROUTES: readonly {
  appId: AppId;
  basePath: AppMeta['basePath'];
  subRoutes: AppMeta['subRoutes'];
}[] = Object.values(APP_META).map(({ id, basePath, subRoutes }) => ({
  appId: id, basePath, subRoutes,
}));

function supportsRoute(subRoutes: AppMeta['subRoutes'], route: string): boolean {
  if (route === '') return true;
  // Match the entire slug, including rejecting trailing line terminators.
  if (subRoutes === 'slug') return !/[^a-z0-9-]/.test(route);
  return subRoutes !== 'none' && subRoutes.includes(route);
}

/** Accept a pathname only. Home and unknown paths have no app target. */
export function matchRoute(pathname: string): { appId: AppId; route: string } | null {
  for (const { appId, basePath, subRoutes } of ROUTES) {
    if (pathname === basePath) return { appId, route: '' };
    if (!pathname.startsWith(`${basePath}/`)) continue;
    const route = pathname.slice(basePath.length + 1);
    if (route !== '' && supportsRoute(subRoutes, route)) return { appId, route };
  }
  return null;
}

/** Invalid sub-routes throw rather than generating paths outside the route table. */
export function pathFor(appId: AppId, route: string): string {
  const meta = APP_META[appId];
  if (!supportsRoute(meta.subRoutes, route)) {
    throw new RangeError(`Invalid route for ${appId}: ${route}`);
  }
  return route === '' ? meta.basePath : `${meta.basePath}/${route}`;
}
