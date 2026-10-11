import { useLayoutEffect, useState, type RefObject } from 'react';
import { deferredComponent } from '../lib/deferred-component';
import type { MenuItemSpec } from '../types/apps';
import { toast } from '../wm/commands';
const menu = deferredComponent(async () => (await import('../ui/Menu')).Menu);
export function usePhoneIconMenu(root: RefObject<HTMLElement | null>) {
  const [target, setTarget] = useState<HTMLAnchorElement | null>(null);
  useLayoutEffect(() => {
    const el = root.current; if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined; let start: { x:number; y:number; link:HTMLAnchorElement } | null = null; let held = false;
    const cancel = () => { clearTimeout(timer); start = null; };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('[data-phone-icon]'); if (!link) return;
      held = false; start = { x:event.clientX, y:event.clientY, link };
      timer = setTimeout(() => { held = true; link.focus(); setTarget(link); }, 500);
    };
    const move = (event: PointerEvent) => { if (start && Math.hypot(event.clientX-start.x,event.clientY-start.y)>8) cancel(); };
    const click = (event: MouseEvent) => { if (held && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); held = false; } };
    const context = (event: MouseEvent) => { const link = (event.target as Element).closest<HTMLAnchorElement>('[data-phone-icon]'); if (link) { event.preventDefault(); link.focus(); setTarget(link); } };
    el.addEventListener('pointerdown',down); window.addEventListener('pointermove',move); window.addEventListener('pointerup',cancel); window.addEventListener('pointercancel',cancel);
    el.addEventListener('click',click,true); el.addEventListener('contextmenu',context);
    return () => { cancel(); el.removeEventListener('pointerdown',down); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',cancel); window.removeEventListener('pointercancel',cancel); el.removeEventListener('click',click,true); el.removeEventListener('contextmenu',context); };
  }, [root]);
  return { target, close: () => { setTarget(null); target?.focus(); } };
}
export function PhoneIconMenu({ target, onClose }: { target: HTMLAnchorElement | null; onClose: () => void }) {
  if (!target) return null;
  const items: MenuItemSpec[] = [{kind:'item',label:'Open',command:'open'},{kind:'item',label:'Copy link',command:'copy'}];
  return <menu.Component label="App context menu" items={items} anchorRef={{current:target}} onClose={onClose} onCommand={command => {
    if (command === 'open') target.click();
    else void navigator.clipboard.writeText(target.href.startsWith(location.origin) ? 'https://os.nipuntheekshana.com'+target.pathname+target.search : target.href).then(()=>toast({title:'Link copied'}),()=>toast({title:"Couldn't copy the link"}));
  }}/>;
}
