import { deferredComponent } from '../lib/deferred-component';
import { preloadMotionFeatures } from '../lib/motion-loader';

/** Programmatic opens also activate features; warm intent avoids a cold render. */
function animated<P extends object>(load: () => Promise<import('react').ComponentType<P>>) {
  return deferredComponent(async () => {
    const [component] = await Promise.all([load(), preloadMotionFeatures()]);
    return component;
  });
}

export const windows = animated(() => import('./WindowLayer').then(module => module.WindowLayer));
export const menus = animated(() => import('./MenuHost').then(module => module.MenuHost));
export const statusPopovers = animated(() => import('./StatusPopovers').then(module => module.StatusPopovers));
export const spotlight = animated(() => import('./Spotlight').then(module => module.Spotlight));
export const contextMenus = animated(() => import('./ContextMenuHost').then(module => module.ContextMenuHost));
export const quickLook = animated(() => import('./QuickLook').then(module => module.QuickLook));
export const alerts = animated(() => import('./Alerts').then(module => module.Alerts));
export const toasts = animated(() => import('./Toasts').then(module => module.Toasts));
export const boot = deferredComponent(() => import('./BootController').then(module => module.BootController));

// These hosts observe sticky store state, so intent during loading is retained.
export const systems = deferredComponent(() => import('./SystemHosts').then(module => module.SystemHosts));
