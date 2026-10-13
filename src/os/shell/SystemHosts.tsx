import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { alertsAtom, bootPhaseAtom, contextMenuAtom, desktopAtom, openMenuAtom, overlayAtom, recentAtom, spotlightOpenAtom, toastsAtom } from '../state/atoms';
import * as deferred from './deferred-features';
import { deferredComponent } from '../lib/deferred-component';
const screensaver = deferredComponent(() => import('./Screensaver').then(module => module.Screensaver));
const shutdown = deferredComponent(() => import('./ShutDown').then(module => module.ShutDown));
const health = deferredComponent(() => import('../state/feature-health').then(module => module.FeatureHealth));

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
    {(overlay === 'screensaver' || activated.sleep) && <screensaver.Component />}
    {(overlay === 'shutdown' || activated.shutdown) && <shutdown.Component />}</>;
}
export function SystemHosts() { return <><SystemOverlays /><DeferredSystem /><health.Component /></>; }
