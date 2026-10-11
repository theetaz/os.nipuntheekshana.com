import { useEffect, type RefObject } from 'react';
import type { WindowId, Rect } from '../wm/types';
import type { FrameController } from '../shell/frame-controller';
export const sheetResistance=(distance:number)=>distance<=200 ? Math.max(0,distance) : 200+(distance-200)*.5;
export const shouldCloseSheet=(distance:number,velocity:number)=>distance>120||velocity>800;
export function useSheetGesture(_windowId:WindowId, element:RefObject<HTMLElement|null>, frame:RefObject<FrameController|null>, close:()=>Promise<boolean>) {
  useEffect(()=>{
    const el=element.current; const header=el?.querySelector<HTMLElement>('[data-sheet-header]');if(!el||!header)return;
    let gesture:{source:'pointer'|'touch';id:number;startY:number;lastY:number;lastAt:number;velocity:number;distance:number;base:Rect}|null=null;
    const start=(source:'pointer'|'touch',id:number,y:number,at:number,target:EventTarget|null)=>{
      if(gesture||!frame.current||el.inert||(target as Element)?.closest('[data-sheet-action]'))return;
      const base={...frame.current.rect};frame.current.stop();el.dataset.dragging='';
      gesture={source,id,startY:y,lastY:y,lastAt:at,velocity:0,distance:0,base};
    };
    const move=(y:number,at:number)=>{if(!gesture||!frame.current)return;const dt=at-gesture.lastAt;gesture.velocity=dt>0?(y-gesture.lastY)/dt*1000:0;gesture.lastY=y;gesture.lastAt=at;gesture.distance=Math.max(0,y-gesture.startY);frame.current.set({...gesture.base,y:gesture.base.y+sheetResistance(gesture.distance)});};
    const end=async(cancelled:boolean,at:number)=>{
      const current=gesture;gesture=null;delete el.dataset.dragging;if(!current||!frame.current)return;
      const velocity=at-current.lastAt>80?0:current.velocity;
      if(!cancelled&&shouldCloseSheet(current.distance,velocity)&&await close())return;
      if(frame.current) await frame.current.animate('restore',current.base);
    };
    const down=(event:PointerEvent)=>{if(event.button!==0)return;start('pointer',event.pointerId,event.clientY,event.timeStamp,event.target);if(gesture)try{header.setPointerCapture(event.pointerId);}catch{/* Synthetic pointers have no browser capture. */}};
    const pointerMove=(event:PointerEvent)=>{if(gesture?.source==='pointer'&&gesture.id===event.pointerId){event.preventDefault();move(event.clientY,event.timeStamp);}};
    const pointerUp=(event:PointerEvent)=>{if(gesture?.source==='pointer'&&gesture.id===event.pointerId)void end(event.type!=='pointerup',event.timeStamp);};
    const touchStart=(event:TouchEvent)=>{const touch=event.changedTouches[0];if(touch)start('touch',touch.identifier,touch.clientY,event.timeStamp,event.target);};
    const touchMove=(event:TouchEvent)=>{if(gesture?.source!=='touch')return;const touch=Array.from(event.changedTouches).find(t=>t.identifier===gesture!.id);if(touch){event.preventDefault();move(touch.clientY,event.timeStamp);}};
    const touchEnd=(event:TouchEvent)=>{if(gesture?.source==='touch')void end(event.type==='touchcancel',event.timeStamp);};
    header.addEventListener('pointerdown',down);header.addEventListener('touchstart',touchStart,{passive:true});header.addEventListener('touchmove',touchMove,{passive:false});header.addEventListener('touchend',touchEnd);header.addEventListener('touchcancel',touchEnd);
    window.addEventListener('pointermove',pointerMove,{passive:false});window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerUp);
    return()=>{gesture=null;delete el.dataset.dragging;header.removeEventListener('pointerdown',down);header.removeEventListener('touchstart',touchStart);header.removeEventListener('touchmove',touchMove);header.removeEventListener('touchend',touchEnd);header.removeEventListener('touchcancel',touchEnd);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',pointerUp);};
  },[element,frame,close]);
}
