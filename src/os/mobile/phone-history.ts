import { desktopAtom } from '../state/atoms';
import { historyStore, type OsStore } from '../state/store';
import { subscribeHistory } from '../url/history';
import { APP_META } from '../registry/meta';
import { FEATURES } from '../config';
/** Present one path app, retaining the existing desktop window parameter value. */
export function subscribePhoneHistory(store:OsStore):()=>void {
  const base=historyStore(store);
  const appendWindows=(url:string)=>{const next=new URL(url,location.href);const windows=new URL(location.href).searchParams.get('w');if(windows!==null)next.searchParams.set('w',windows);return next.pathname+next.search+next.hash;};
  const port={get state(){return history.state;},
    pushState(data:unknown,unused:string,url:string){const next=appendWindows(url);if(next===location.pathname+location.search+location.hash)return;history.pushState({...((data&&typeof data==='object')?data:{}),serendibBack:location.pathname+location.search},unused,next);},
    replaceState(data:unknown,unused:string,url:string){history.replaceState(data,unused,appendWindows(url));}};
  return subscribeHistory({...base,getState:()=>{const state=base.getState();const focused=state.focusedId?state.windows[state.focusedId]:null;return {...state,order:focused&&!focused.closing&&!focused.minimized?[focused.id]:[],focusedId:focused&&!focused.closing&&!focused.minimized?focused.id:null};}},window,port,{features:FEATURES.postcards?{postcards:true}:{}});
}
export function phoneBack(store:OsStore,id:string):void {
  const win=store.get(desktopAtom).windows[id];if(!win)return;
  const previous=history.state?.serendibBack;
  // Closing a query overlay (Quick Look's ?shot) replaces its entry with the page beneath, leaving
  // an identical previous entry. Step past it so one Back always changes what is shown.
  if(previous===location.pathname+location.search){window.addEventListener('popstate',()=>phoneBack(store,id),{once:true});history.back();return;}
  if(typeof previous==='string' && (previous.split('?')[0]===APP_META[win.appId].basePath||previous.startsWith(APP_META[win.appId].basePath+'/'))) history.back();
  else store.set(desktopAtom,{type:'NAVIGATE',id,route:'',query:{},history:'push'});
}
