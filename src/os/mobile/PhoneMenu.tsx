import { postcardsAvailableAtom } from '../state/features';
import { useEffect, useState } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { Menu } from '../ui/Menu';
import { appMenus, desktopMenus, islandMenu, getItemState, windowItems } from '../registry/menus';
import { APP_META } from '../registry/meta';
import { loadApp } from '../registry/loader';
import { desktopAtom, menuStateAtom, mochiPrefsAtom, showWidgetsAtom, themePrefAtom, wallpaperAtom } from '../state/atoms';
import { alert, focusWindow, openApp, runCommand } from '../wm/commands';
import type { AppId, AppMenus, MenuItemSpec } from '../types/apps';
import { VERSION } from '../config';
export function PhoneMenu({ anchor, onClose, appId, onHome }: { anchor: HTMLElement | null; onClose: () => void; appId?: AppId; onHome?: () => void }) {
  const postcards=useAtomValue(postcardsAvailableAtom);
  const store=useStore(); const desktop=useAtomValue(desktopAtom); const states=useAtomValue(menuStateAtom);
  const theme=useAtomValue(themePrefAtom); const wallpaper=useAtomValue(wallpaperAtom); const widgets=useAtomValue(showWidgetsAtom); const mochi=useAtomValue(mochiPrefsAtom);
  const [definitions,setDefinitions]=useState<AppMenus>({});
  useEffect(()=>{let active=true;setDefinitions({});if(appId)void loadApp(appId,store).then(module=>{if(active)setDefinitions(module.menus??{});},()=>{});return()=>{active=false;};},[appId,store]);
  if (!anchor) return null;
  const win=desktop.focusedId?desktop.windows[desktop.focusedId]:undefined;const meta=appId?APP_META[appId]:undefined;
  const menus=meta?appMenus(meta,definitions):desktopMenus();
  const running=windowItems(desktop).map(item=>{if(item.kind!=='item')return item;const current=desktop.windows[item.command.slice(13)];return current&&current.appId!=='terminal'?{...item,label:APP_META[current.appId].name}:item;});
  const items:MenuItemSpec[]=[...(onHome?[{kind:'item' as const,label:'Home',command:'phone.home'}]:[]),...islandMenu(),
    ...menus.filter(menu=>meta?menu.id!=='window':['go','view','help'].includes(menu.id)).map(menu=>({kind:'submenu' as const,label:menu.label,items:menu.items})),
    ...(desktop.order.length?[{kind:'submenu' as const,label:'Apps',items:running}]:[])];
  const state=(command:string)=>getItemState(command,{desktop,appState:win?states[win.id]:undefined,theme,wallpaper,widgets,postcards,mochi:mochi.visible,zoomable:false,resizable:false});
  return <Menu style={{maxHeight:'calc(100dvh - 68px - env(safe-area-inset-top) - env(safe-area-inset-bottom))'}} label={meta?'App commands':'Serendib menu'} anchorRef={{current:anchor}} items={items} getItemState={state} onClose={()=>{onClose();anchor.focus();}} onCommand={command=>{
    if(command==='phone.home'||command==='window.close'||command==='app.quit'||command==='app.hide'){onHome?.();return;}
    if(command.startsWith('window.focus:')){focusWindow(command.slice(13));return;}
    if(command==='app.about'&&meta){void alert({title:`About ${meta.name}`,body:`${meta.description}\nVersion ${VERSION}`,primary:'OK'});return;}
    if(command==='os.shortcuts'){if(win?.appId==='readme')runCommand('readme.shortcuts','menu');else openApp('readme',{query:{section:'shortcuts'}});return;}
    if(command==='help.source'){window.open('https://github.com/theetaz/os.nipuntheekshana.com','_blank','noopener,noreferrer');return;}
    if(command==='help.report'){location.href='mailto:theekshana2@gmail.com?subject=Serendib%3A%20problem%20report';return;}
    runCommand(command,'menu');
  }}/>;
}
