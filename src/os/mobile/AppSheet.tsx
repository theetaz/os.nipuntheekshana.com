import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { desktopAtom, windowAtom } from '../state/atoms';
import { closeWindow, copyWindowLink } from '../wm/commands';
import { windowLink } from '../url/url';
import { Window } from '../shell/Window';
import type { FrameController } from '../shell/frame-controller';
import { isolateModal } from '../lib/modal-focus';
import { focusableWithin } from '../lib/focus';
import type { WindowId } from '../wm/types';
import { SheetHeader } from './SheetHeader';
import { useSheetGesture } from './useSheetGesture';
import { createSheetController } from './sheet-controller';
import { phoneBack } from './phone-history';
import { deferredComponent } from '../lib/deferred-component';
const phoneMenu = deferredComponent(async () => (await import('./PhoneMenu')).PhoneMenu);
import '../shell/p2-4-window-system.css';
export function AppSheet({windowId,active=true}:{windowId:WindowId;active?:boolean}) {
  const store=useStore();const win=useAtomValue(windowAtom(windowId));const element=useRef<HTMLElement|null>(null);const frame=useRef<FrameController|null>(null);
  const isolated=useRef(false);
  const [menu,setMenu]=useState<HTMLElement|null>(null);const [engaged,setEngaged]=useState(false);
  const close=useCallback(async()=>{const allowed=await closeWindow(windowId);if(allowed)store.set(desktopAtom,{type:'FOCUS_DESKTOP'});return allowed;},[store,windowId]);
  useSheetGesture(windowId,element,frame,close);
  useLayoutEffect(()=>{
    const el=element.current;if(!el||!active)return;
    const focus=()=>{if(el.contains(document.activeElement))return;(el.querySelector<HTMLElement>('[data-autofocus]')??focusableWithin(el)[0]??el).focus({preventScroll:true});};
    const update=()=>{
      const current=store.get(desktopAtom).windows[windowId];if(!current||current.closing||current.minimized||el.hasAttribute('data-adopting'))return;
      const active=document.activeElement;if(current.adopted&&!engaged&&active!==document.body&&!el.contains(active))return;
      return isolateModal(el,focus,'[data-os-ui-overlays]');
    };
    let release=update();isolated.current=!!release;const observer=new MutationObserver(()=>{if(!release){release=update();isolated.current=!!release;}});observer.observe(el,{attributes:true,attributeFilter:['data-adopting']});
    return()=>{observer.disconnect();release?.();isolated.current=false;};
  },[active,engaged,store,windowId,win?.closing,win?.minimized]);
  useLayoutEffect(()=>{
    const el=element.current;if(!el||!active)return;
    let raf=0;const resize=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
      const viewport=visualViewport;if(!viewport||el.hasAttribute('data-dragging'))return;
      frame.current?.set({x:viewport.offsetLeft,y:viewport.offsetTop,w:viewport.width,h:viewport.height});
      el.style.setProperty('--sheet-viewport-height',`${viewport.height}px`);
    });};
    visualViewport?.addEventListener('resize',resize);visualViewport?.addEventListener('scroll',resize);
    return()=>{cancelAnimationFrame(raf);visualViewport?.removeEventListener('resize',resize);visualViewport?.removeEventListener('scroll',resize);};
  },[active]);
  if(!win)return null;
  return <div className="window-layer" data-window-layer="mobile" hidden={!active} onPointerDownCapture={()=>{if(!isolated.current)setEngaged(true);}}>
    <Window windowId={windowId} mode="mobile" elementRef={element} frameRef={frame} controllerFactory={createSheetController} header={(current,loading)=><SheetHeader appId={current.appId} route={current.route} title={current.title} titleId={`window-title-${windowId}`} loading={loading}
      onHome={event=>{event.preventDefault();void close();}} onBack={event=>{event.preventDefault();phoneBack(store,windowId);}}
      onShare={()=>{const url=windowLink(current);if(!url)return;if(navigator.share)void navigator.share({title:current.title,url}).catch(error=>{if(error?.name!=='AbortError')void copyWindowLink(windowId);});else void copyWindowLink(windowId);}}
      onMenu={setMenu}/>}/>
    {menu&&<phoneMenu.Component anchor={menu} appId={win.appId} onHome={()=>{void close();}} onClose={()=>setMenu(null)}/>}
  </div>;
}
