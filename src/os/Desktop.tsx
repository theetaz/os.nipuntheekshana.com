import { LazyMotion, MotionConfig } from 'motion/react';
import './shell/adoption.css';
import { useEffect, useState } from 'react';
import { Provider, useAtomValue, useSetAtom, useStore } from 'jotai';
import { RESET } from 'jotai/utils';
import type { AppId } from './types/apps';
import { createOsStore, historyStore, registerStore } from './state/store';
import { desktopAtom, modeAtom, motionPrefAtom, onlineAtom, systemDarkAtom, systemReducedMotionAtom,
  systemReducedTransparencyAtom, updateAvailableAtom, viewAtom, spotlightOpenAtom, contextMenuAtom, alertsAtom, toastsAtom, recentAtom, bootedAtom, bootPhaseAtom, overlayAtom, openMenuAtom } from './state/atoms';
import { subscribePreferences } from './state/prefs';
import { subscribeHistory } from './url/history';
import { interceptLinks } from './url/links';
import { adoptStaticWindow } from './shell/Adoption';
import { subscribeHotkeys } from './shell/Hotkeys';
import { ModeSwitch, MODE_QUERY } from './shell/ModeSwitch';
import { DesktopShell } from './shell/DesktopShell';
import { PhoneShell } from './mobile/PhoneShell';
import { LiveRegion } from './shell/LiveRegion';
import * as deferred from './shell/deferred-features';
import { trackWindowLaunches } from './shell/window-launchers';
import { canPrefetch, prefetchApp } from './registry/loader';
import { isMac } from './lib/platform';
import { loadMotionFeatures, preloadMotionFeatures } from './lib/motion-loader';
import { FEATURES } from './config';

export interface DesktopProps {
  initial: { appId: AppId; route: string } | null;
  build: { version: string; codename: string; sha: string; date: string };
  home: { nowItems: string[]; nowUpdated: string };
}
function SystemOverlays() {
  const spotlight = useAtomValue(spotlightOpenAtom); const context = useAtomValue(contextMenuAtom);
  const alerts = useAtomValue(alertsAtom); const toasts = useAtomValue(toastsAtom); const desktop = useAtomValue(desktopAtom);
  const win = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  const setRecent = useSetAtom(recentAtom);
  useEffect(() => {
    if (!win || win.closing || win.minimized) return;
    const id = win.appId === 'projects' && win.route ? `project:${win.route}`
      : win.appId === 'writing' && win.route ? `post:${win.route}`
        : win.appId === 'maps' && win.route === 'play' ? 'action:play' : `app:${win.appId}`;
    setRecent(previous => previous[0] === id ? previous : [id, ...previous.filter(value => value !== id)].slice(0, 5));
  }, [win?.id, win?.route, win?.createdSeq, win?.minimized, win?.closing, setRecent]);
  const quicklook = win?.appId === 'projects' && /^\d+$/.test(win.query.shot ?? '');
  const [loaded, setLoaded] = useState([false, false, false, false, false]);
  useEffect(() => {
    const requested = [spotlight, quicklook, !!context, !!alerts.length, !!toasts.length];
    setLoaded(previous => requested.some((value, i) => value && !previous[i]) ? previous.map((value, i) => value || requested[i]!) : previous);
  }, [spotlight, quicklook, context, alerts.length, toasts.length]);
  // Keep activated hosts mounted so they can finish exit animations and restore focus.
  return <>{(spotlight || loaded[0]) && <deferred.spotlight.Component />}
    {(quicklook || loaded[1]) && <deferred.quickLook.Component />}
    {(context || loaded[2]) && <deferred.contextMenus.Component />}
    {(alerts.length > 0 || loaded[3]) && <deferred.alerts.Component />}
    {(toasts.length > 0 || loaded[4]) && <deferred.toasts.Component />}</>;
}
function DeferredSystem() {
  const menu = useAtomValue(openMenuAtom); const phase = useAtomValue(bootPhaseAtom); const overlay = useAtomValue(overlayAtom);
  const [activated, setActivated] = useState({ menus: false, boot: false, sleep: false, shutdown: false });
  useEffect(() => {
    const boot = document.documentElement.hasAttribute('data-boot') || phase !== 'off';
    if (!boot && !activated.boot) document.querySelector('.boot-screen')?.remove();
    setActivated(previous => {
      const next = { menus: previous.menus || !!menu, boot: previous.boot || boot,
        sleep: previous.sleep || overlay === 'screensaver', shutdown: previous.shutdown || overlay === 'shutdown' };
      return Object.keys(next).some(key => next[key as keyof typeof next] !== previous[key as keyof typeof next]) ? next : previous;
    });
  }, [menu, phase, overlay, activated.boot]);
  return <>{(menu || activated.menus) && <deferred.menus.Component />}
    {(phase !== 'off' || activated.boot) && <deferred.boot.Component />}
    {(overlay === 'screensaver' || activated.sleep) && <deferred.screensaver.Component />}
    {(overlay === 'shutdown' || activated.shutdown) && <deferred.shutdown.Component />}</>;
}
/** Import only the feature under the pointer/focus; don't fetch search data or initialise audio. */
function preloadShellIntent(document: Document): () => void {
  const intent = (event: Event) => {
    if (!canPrefetch()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[role="menubar"], .mb-status, [data-dock-item], [role="option"], a[href^="/"]')) void preloadMotionFeatures().catch(() => {});
    if (target?.closest('[role="menubar"]')) { void deferred.menus.preload().catch(() => {}); return; }
    if (target?.closest('.mb-clock, [aria-controls="now-popover"], [aria-label="What Nipun\'s up to"]')) void deferred.statusPopovers.preload().catch(() => {});
    if (target?.closest('[aria-label="Spotlight"]')) void deferred.spotlight.preload().catch(() => {});
    if (target?.closest('a[href^="/"]')) void deferred.windows.preload().catch(() => {});
    if (target?.closest('[data-dock-item], [role="option"]')) void deferred.contextMenus.preload().catch(() => {});
  };
  document.addEventListener('pointerover', intent); document.addEventListener('focusin', intent);
  return () => { document.removeEventListener('pointerover', intent); document.removeEventListener('focusin', intent); };
}
function ClientBootstrap() {
  const store = useStore();
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    // Order matters: adoption must precede the history subscription and app loading.
    cleanups.push(registerStore(store));
    cleanups.push(trackWindowLaunches(document));
    cleanups.push(preloadShellIntent(document));
    if (document.documentElement.hasAttribute('data-boot')) {
      void deferred.boot.preload().catch(() => {});
      let skipTimer: ReturnType<typeof setTimeout> | undefined;
      // Capture input while the boot controller's chunk is in flight.
      const skip = (event: Event) => {
        if (!document.documentElement.hasAttribute('data-boot') || document.querySelector('[data-boot-managed]')) return;
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation();
        const html = document.documentElement;
        if (html.hasAttribute('data-boot-skip-requested')) return;
        html.dataset.bootSkipRequested = String(performance.now()); html.dataset.bootExit = 'skip';
        skipTimer = setTimeout(() => {
          document.querySelector('.boot-screen')?.remove(); delete html.dataset.boot; delete html.dataset.bootExit;
          delete html.dataset.bootSkipRequested; store.set(bootPhaseAtom, 'off'); store.set(bootedAtom, true);
        }, 200);
      };
      for (const type of ['keydown', 'pointerdown', 'click']) window.addEventListener(type, skip, { capture: true, passive: false });
      cleanups.push(() => { clearTimeout(skipTimer); for (const type of ['keydown', 'pointerdown', 'click']) window.removeEventListener(type, skip, true); });
    }
    const media = [
      ['(prefers-color-scheme: dark)', systemDarkAtom],
      ['(prefers-reduced-motion: reduce)', systemReducedMotionAtom],
      ['(prefers-reduced-transparency: reduce)', systemReducedTransparencyAtom],
    ] as const;
    for (const [query, preference] of media) {
      const match = matchMedia(query); const update = () => store.set(preference, match.matches);
      update(); match.addEventListener('change', update); cleanups.push(() => match.removeEventListener('change', update));
    }
    const mode = matchMedia(MODE_QUERY); const updateMode = () => store.set(modeAtom, mode.matches ? 'mobile' : 'desktop');
    updateMode(); mode.addEventListener('change', updateMode); cleanups.push(() => mode.removeEventListener('change', updateMode));
    const online = () => store.set(onlineAtom, navigator.onLine);
    online(); window.addEventListener('online', online); window.addEventListener('offline', online);
    cleanups.push(() => { window.removeEventListener('online', online); window.removeEventListener('offline', online); });
    let frame = 0;
    const resize = () => { if (frame) return; frame = requestAnimationFrame(() => {
      frame = 0; store.set(desktopAtom, { type: 'VIEWPORT', viewport: { w: innerWidth, h: innerHeight } });
    }); };
    // Set the viewport before measuring and opening the static window.
    store.set(desktopAtom, { type: 'VIEWPORT', viewport: { w: innerWidth, h: innerHeight } });
    window.addEventListener('resize', resize); cleanups.push(() => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); });
    cleanups.push(subscribePreferences(store, document.documentElement));
    if (document.documentElement.dataset.viewRequest === 'desktop') {
      delete document.documentElement.dataset.viewRequest;
      if (location.hash) location.replace('#');
      history.replaceState(history.state, '', location.pathname + location.search);
      store.set(viewAtom, RESET);
    } else if (location.hash === '#simple') store.set(viewAtom, 'simple');
    cleanups.push(adoptStaticWindow(store, document));
    // Simple view retains native document navigation and its original title.
    let historyCleanup: (() => void) | undefined;
    const syncHistory = () => {
      historyCleanup?.(); historyCleanup = undefined;
      if (store.get(viewAtom) !== 'simple') historyCleanup = subscribeHistory(historyStore(store), window, history,
        { features: FEATURES.postcards ? { postcards: true } : {} });
    };
    syncHistory();
    const unsubscribeView = store.sub(viewAtom, syncHistory);
    cleanups.push(() => { unsubscribeView(); historyCleanup?.(); });
    cleanups.push(interceptLinks(document, window));
    cleanups.push(subscribeHotkeys(document, isMac() ? 'mac' : /Windows/.test(navigator.userAgent) ? 'windows' : 'linux'));
    const preloadError = (event: Event) => { event.preventDefault(); store.set(updateAvailableAtom, true); };
    window.addEventListener('vite:preloadError', preloadError); cleanups.push(() => window.removeEventListener('vite:preloadError', preloadError));
    if ('requestIdleCallback' in window && store.get(modeAtom) === 'desktop' && canPrefetch()) {
      const idle = window.requestIdleCallback(() => {
        if (store.get(viewAtom) !== 'simple' && store.get(modeAtom) === 'desktop') { prefetchApp('projects', store); prefetchApp('about', store); }
      }, { timeout: 4000 });
      cleanups.push(() => window.cancelIdleCallback(idle));
    }
    document.documentElement.classList.add('os-ready');
    cleanups.push(() => document.documentElement.classList.remove('os-ready'));
    return () => { cleanups.reverse().forEach(cleanup => cleanup()); };
  }, [store]);
  return null;
}
function Shells(props: DesktopProps) {
  const view = useAtomValue(viewAtom);
  return view === 'simple' ? null : <><ModeSwitch desktop={<DesktopShell {...props} />} mobile={<PhoneShell {...props} />} />
    <SystemOverlays /><DeferredSystem /><LiveRegion /></>;
}
function MotionPreferences({ children }: { children: React.ReactNode }) {
  const motion = useAtomValue(motionPrefAtom);
  return <MotionConfig reducedMotion={motion === 'system' ? 'user' : motion === 'reduce' ? 'always' : 'never'}>{children}</MotionConfig>;
}
export default function Desktop(props: DesktopProps) {
  const [store] = useState(() => createOsStore(props));
  return <Provider store={store}><LazyMotion features={loadMotionFeatures} strict><MotionPreferences>
    <Shells {...props} /><ClientBootstrap />
  </MotionPreferences></LazyMotion></Provider>;
}
