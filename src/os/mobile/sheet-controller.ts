import { animate } from 'motion/mini';
import { spring } from 'motion';
import { springs } from '../lib/springs';
import type { FrameController } from '../shell/frame-controller';
import { launchers } from '../shell/window-launchers';
import type { AppId } from '../types/apps';
import type { Rect } from '../wm/types';
const transition = { ...springs.sheet, type:spring };
const transform = (r:Rect,sx=1,sy=1)=>`translate3d(${r.x}px,${r.y}px,0) scale(${sx},${sy})`;
export function createSheetController(el:HTMLElement, rect:Rect, reduce:()=>boolean=()=>false):FrameController {
  let animations: ReturnType<typeof animate>[]=[]; let generation=0;
  const icon = () => {
    const source=launchers.get(el.ownerDocument)?.get(el.dataset.app as AppId)?.deref()
      ?? el.ownerDocument.querySelector<HTMLElement>(`[data-shell="mobile"] [data-app-launch="${el.dataset.app}"]`);
    const box=(source?.querySelector('svg')??source)?.getBoundingClientRect();
    return box && box.width && box.height && box.bottom>0 && box.top<innerHeight ? {x:box.x,y:box.y,w:box.width,h:box.height} : null;
  };
  const controller:FrameController={ el,rect:{...rect},
    set(next) { this.stop(); this.rect={...next}; el.style.width=`${next.w}px`;el.style.height=`${next.h}px`;el.style.transform=transform(next);el.style.opacity='1';el.style.transformOrigin='0 0'; },
    stop() { generation++; for(const animation of animations) animation.cancel();animations=[];delete el.dataset.sheetAnimating; },
    destroy() { this.stop(); },
    async animate(kind,to) {
      // Static adoption is already painted; preserve its opaque frame during handoff.
      if(kind==='none'){this.set(to);return;}
      const from={...this.rect}; this.stop(); const run=generation;
      el.dataset.sheetAnimating='';
      const closing=kind==='close'||kind==='minimize'; const target=icon();
      this.rect={...to};el.style.width=`${to.w}px`;el.style.height=`${to.h}px`;el.style.transformOrigin='0 0';
      const full=transform(to); const small=target ? transform({ ...to,x:target.x,y:target.y },target.w/to.w,target.h/to.h) : full;
      if(reduce() || (closing && !target)) {
        el.style.transform=full; animations.push(animate(el,{opacity:closing?[1,0]:[0,1]},{duration:.12}));
      } else if(kind==='open' && target) {
        animations.push(animate(el,{transform:[small,full],clipPath:['inset(0 round 13.5px)','inset(0 round 0px)']},transition));
      } else if(closing) {
        animations.push(animate(el,{transform:[transform(from),small],clipPath:['inset(0 round 0px)','inset(0 round 13.5px)']},transition));
      } else {
        animations.push(animate(el,{transform:[transform(from),full]},transition));
      }
      await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
      if(run===generation)delete el.dataset.sheetAnimating;
      if(run===generation && !closing){el.style.transform=full;el.style.clipPath='';el.style.opacity='1';}
    }
  };
  controller.set(rect);return controller;
}
