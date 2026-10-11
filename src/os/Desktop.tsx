import { useEffect, useState } from 'react';
import { Provider, useAtomValue, useStore } from 'jotai';
import { RESET } from 'jotai/utils';
import { LazyMotion, MotionConfig } from 'motion/react';
import type { AppId } from './types/apps';
import { createOsStore, historyStore, registerStore } from './state/store';
import { desktopAtom, modeAtom, motionPrefAtom, onlineAtom, systemDarkAtom, systemReducedMotionAtom,
  systemReducedTransparencyAtom, updateAvailableAtom, viewAtom } from './state/atoms';
import { subscribePreferences } from './state/prefs';
import { subscribeHistory } from './url/history';
import { interceptLinks } from './url/links';
import { adoptStaticWindow } from './shell/Adoption';
import { subscribeHotkeys } from './shell/Hotkeys';
import { ModeSwitch, MODE_QUERY } from './shell/ModeSwitch';
import { DesktopShell } from './shell/DesktopShell';
import { PhoneShell } from './mobile/PhoneShell';
import { Spotlight } from './shell/Spotlight';
import { QuickLook } from './shell/QuickLook';
import { MenuHost } from './shell/MenuHost';
import { ContextMenuHost } from './shell/ContextMenuHost';
import { Alerts } from './shell/Alerts';
import { Toasts } from './shell/Toasts';
import { LiveRegion } from './shell/LiveRegion';
import { BootController } from './shell/BootController';
import { Screensaver } from './shell/Screensaver';
import { ShutDown } from './shell/ShutDown';
import { canPrefetch, prefetchApp } from './registry/loader';
import { isMac } from './lib/platform';
import { FEATURES } from './config';

export interface DesktopProps {
  initial: { appId: AppId; route: string } | null;
  build: { version: string; codename: string; sha: string; date: string };
  home: { nowItems: string[]; nowUpdated: string };
}
const loadMotionFeatures = () => import('./lib/motion-features').then(module => module.default);
function ClientBootstrap() {
  const store = useStore();
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    // Order matters: adoption must precede the history subscription and app loading.
    cleanups.push(registerStore(store));
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
    <Spotlight /><QuickLook /><MenuHost /><ContextMenuHost /><Alerts /><Toasts /><LiveRegion /><BootController /><Screensaver /><ShutDown /></>;
}
function MotionPreferences({ children }: { children: React.ReactNode }) {
  const motion = useAtomValue(motionPrefAtom);
  return <MotionConfig reducedMotion={motion === 'system' ? 'user' : motion === 'reduce' ? 'always' : 'never'}>{children}</MotionConfig>;
}
export default function Desktop(props: DesktopProps) {
  const [store] = useState(() => createOsStore(props));
  return <Provider store={store}><LazyMotion features={loadMotionFeatures} strict><MotionPreferences>
    <style>{`.island-desktop, .island-mobile { display: none; }
      html.os-ready[data-mode="desktop"] .island-desktop, html.os-ready[data-mode="mobile"] .island-mobile { display: contents; }
      html.os-ready body > :is(.static-menubar, .static-dock, .desktop-icons, .pocket-grid) { display: none; }
      .managed-window[data-adopting] { opacity: 0; pointer-events: none; }
      .managed-window[hidden] { display: none; }
      html[data-view="simple"] .managed-window { display: none; }
      html.os-ready[data-mode="mobile"] .island-mobile :is(.static-dock, .pocket-grid) { display: block; }
      html.os-ready[data-mode="mobile"] body:not(:has(.static-window)) > .static-menubar { display: flex; visibility: hidden; pointer-events: none; }
      .island-mobile .static-menubar { position: fixed; }
      html[data-mode="mobile"]:has(.managed-window:not([hidden])) .desktop-widgets { display: none; }
      .island-mobile .traffic-light.close { width: 44px; height: 44px; }
      .island-mobile .traffic-light.close > span:first-child { display: inline; }
    `}</style>
    <Shells {...props} /><ClientBootstrap />
  </MotionPreferences></LazyMotion></Provider>;
}
