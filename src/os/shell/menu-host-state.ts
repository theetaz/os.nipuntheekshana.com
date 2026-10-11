import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { atom, useSetAtom, useStore } from 'jotai';
import { openMenuAtom } from '../state/atoms';
import type { AppId, AppMenus } from '../types/apps';
import type { ShellMenu } from '../registry/menus';

export interface MenuHostSpec {
  menus: readonly ShellMenu[]; anchors: ReadonlyMap<string, RefObject<HTMLButtonElement | null>>;
  appId?: AppId | null; definitions?: AppMenus; version?: string; move(id: string, direction: 1 | -1): void;
}
export const hostsAtom = atom<ReadonlyMap<object, MenuHostSpec>>(new Map());
export function useMenuHost(spec: MenuHostSpec): void {
  const setHosts = useSetAtom(hostsAtom); const store = useStore(); const owner = useRef({});
  useLayoutEffect(() => { setHosts(previous => new Map(previous).set(owner.current, spec)); }, [setHosts, spec]);
  useEffect(() => () => {
    setHosts(previous => { const next = new Map(previous); next.delete(owner.current); return next; });
    store.set(openMenuAtom, null);
  }, [setHosts, store]);
}
