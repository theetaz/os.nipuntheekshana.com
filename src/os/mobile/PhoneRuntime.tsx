import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useStore } from 'jotai';
import { desktopAtom, resolvedThemeAtom, soundAtom, spotlightOpenAtom } from '../state/atoms';
import { focusWindow, runCommand, toast } from '../wm/commands';
import { APP_META } from '../registry/meta';
import { APPS } from '../registry/apps';
import type { AppId } from '../types/apps';
import { deferredComponent } from '../lib/deferred-component';
import { preloadMotionFeatures } from '../lib/motion-loader';
import { subscribePhoneHistory } from './phone-history';
import './phone-runtime.css';
const sheets = deferredComponent(async () => { const [module] = await Promise.all([import('./AppSheet'), preloadMotionFeatures()]); return module.AppSheet; });
import type { DesktopProps } from '../Desktop';
import { PhoneIconMenu, usePhoneIconMenu } from './usePhoneIconMenu';
const phoneMenu = deferredComponent(async () => (await import('./PhoneMenu')).PhoneMenu);
/** Warm the direct route's app and frame in parallel with island hydration. */
export function preloadPhone() {
  const app = document.getElementById('static-window')?.dataset.app;
  if (app && Object.hasOwn(APPS, app)) {
    void Promise.all([sheets.preload(), APPS[app as AppId].load()]).catch(() => {});
  }
}
export function PhoneRuntime(_props: DesktopProps) {
  const store = useStore(); const desktop = useAtomValue(desktopAtom); const focused = desktop.order.find(id => desktop.windows[id]?.closing) ?? desktop.focusedId;
  const home = useRef<HTMLDivElement>(typeof document === 'undefined' ? null : document.querySelector('#static-phone-home [data-phone-home]'));
  const mounted=useRef(new Set<string>());if(focused)mounted.current.add(focused);for(const id of mounted.current)if(!desktop.windows[id])mounted.current.delete(id);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [Pet, setPet] = useState<typeof import('../mochi/Mochi').Mochi | null>(null);
  const icons = usePhoneIconMenu(home);
  useLayoutEffect(() => subscribePhoneHistory(store), [store]);
  useLayoutEffect(() => {
    // Compact art can round to a different ratio than the SSR fallback.
    // Reserve that fallback box so decoding never changes document height.
    const restore = Array.from(document.querySelectorAll<HTMLImageElement>('#story .k-sticker img'), image => {
      const width = Number(image.getAttribute('width')); const height = Number(image.getAttribute('height'));
      const ratio = image.style.aspectRatio; const fit = image.style.objectFit;
      if (width > 0 && height > 0) { image.style.aspectRatio = `${width} / ${height}`; image.style.objectFit = 'contain'; }
      return () => { image.style.aspectRatio = ratio; image.style.objectFit = fit; };
    });
    return () => { for (const reset of restore) reset(); };
  }, []);
  useLayoutEffect(() => {
    if (!focused) return;
    const root = document.documentElement;
    const position = { left: scrollX, top: scrollY, behavior: 'instant' as const };
    const lock = () => { if (!root.classList.contains('k-scroll-lock')) root.classList.add('k-scroll-lock'); };
    lock();
    // Nested menus and alerts share the modal lock. Keep the sheet's lock
    // through their cleanup and the sheet's closing animation.
    const observer = new MutationObserver(lock);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    const contain = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-sheet], [data-os-ui-overlays]')) event.preventDefault();
    };
    document.addEventListener('touchmove', contain, { passive: false });
    document.addEventListener('wheel', contain, { passive: false });
    return () => {
      observer.disconnect();
      document.removeEventListener('touchmove', contain);
      document.removeEventListener('wheel', contain);
      if (!document.querySelector('[data-os-ui-overlays] [aria-modal="true"]')) root.classList.remove('k-scroll-lock');
      window.scrollTo(position);
    };
  }, [!!focused]);
  useLayoutEffect(()=>{
    const capture=(event:Event)=>{if(event.isTrusted&&store.get(soundAtom))void import('../lib/sound').then(sound=>sound.captureSoundGesture(event,false)).catch(()=>{});};
    for(const type of ['pointerdown','keydown','touchend'])document.addEventListener(type,capture,{capture:true,passive:true});
    return()=>{for(const type of ['pointerdown','keydown','touchend'])document.removeEventListener(type,capture,true);};
  },[store]);
  useLayoutEffect(()=>{
    const el=home.current;if(!el)return;
    const activate=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const control=(event.target as Element).closest<HTMLAnchorElement>('[data-phone-action]');
      if(control){
        event.preventDefault();
        if(control.dataset.phoneAction==='menu')setMenu(control);
        else if(control.dataset.phoneAction==='search')store.set(spotlightOpenAtom,true);
        else {runCommand(`theme.${store.get(resolvedThemeAtom)==='dark'?'light':'dark'}`,'menu');toast({title:`${store.get(resolvedThemeAtom)==='dark'?'Dark':'Light'} appearance`});}
        return;
      }
      const icon=(event.target as Element).closest<HTMLAnchorElement>('a[data-app-launch]');
      const app=icon?.dataset.appLaunch as AppId|undefined;if(!icon||!app||new URL(icon.href).pathname!==APP_META[app].basePath)return;
      const state=store.get(desktopAtom);const current=state.order.map(id=>state.windows[id]).find(win=>win?.appId===app&&!win.closing);
      if(current){event.preventDefault();focusWindow(current.id);}
    };
    el.addEventListener('click',activate);
    const root=el.parentElement;const wordmark=el.querySelector('.phone-wordmark');
    wordmark?.setAttribute('aria-haspopup','menu');if(root)root.dataset.shell='mobile';
    return()=>{el.removeEventListener('click',activate);wordmark?.removeAttribute('aria-haspopup');if(root)delete root.dataset.shell;};
  },[store]);
  useLayoutEffect(() => {
    const placeholder=home.current?.querySelector<HTMLElement>('.phone-mochi-placeholder');
    if(placeholder)placeholder.hidden=!!Pet;
    return()=>{if(placeholder)placeholder.hidden=false;};
  },[Pet]);
  useEffect(() => {
    if (focused) return;
    let active = true; let idle: number | undefined; let frame = 0;
    const load = () => { void Promise.all([import('../mochi/Mochi'), preloadMotionFeatures()]).then(([module]) => {
      // A prevented Vite preload failure can fulfil without a module.
      const Companion = module?.Mochi;
      if (active && Companion) setPet(() => Companion);
    }).catch(() => {}); };
    // Let the phone's text and reserved widget paint before loading its companion.
    void document.fonts.ready.then(() => {
      if (!active) return;
      frame = requestAnimationFrame(() => {
        if ('requestIdleCallback' in window) idle = window.requestIdleCallback(load, {timeout:4000});
        else frame = requestAnimationFrame(load);
      });
    });
    return () => { active = false; cancelAnimationFrame(frame); if(idle!==undefined) window.cancelIdleCallback(idle); };
  }, [!!focused]);
  const companion=home.current?.querySelector<HTMLElement>('.phone-companion');
  return <>{Pet&&companion&&createPortal(<Pet variant="widget"/>,companion)}<PhoneIconMenu target={icons.target} onClose={icons.close}/>{menu&&<phoneMenu.Component anchor={menu} onClose={() => setMenu(null)}/>} {Array.from(mounted.current,id=><sheets.Component key={id} windowId={id} active={id===focused}/>)}</>;
}
