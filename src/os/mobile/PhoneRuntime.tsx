import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAtomValue, useStore } from 'jotai';
import { focusedIdAtom, resolvedThemeAtom, spotlightOpenAtom } from '../state/atoms';
import { runCommand, toast } from '../wm/commands';
import { HomeScreen } from './HomeScreen';
import { AppSheet } from './AppSheet';
import type { DesktopProps } from '../Desktop';
import { PhoneIconMenu, usePhoneIconMenu } from './usePhoneIconMenu';
import { PhoneMenu } from './PhoneMenu';
export function PhoneRuntime(props: DesktopProps) {
  const store = useStore(); const focused = useAtomValue(focusedIdAtom); const home = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [Pet, setPet] = useState<typeof import('../mochi/Mochi').Mochi | null>(null);
  const icons = usePhoneIconMenu(home);
  useLayoutEffect(() => {
    const staticHome = document.getElementById('static-phone-home');
    if (staticHome) { staticHome.hidden = true; staticHome.inert = true; }
    return () => { if (staticHome) { staticHome.hidden = false; staticHome.inert = false; } };
  }, []);
  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => { void import('../mochi/Mochi').then(module => { if (active) setPet(() => module.Mochi); }).catch(() => {}); });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, []);
  return <><HomeScreen home={props.home} homeRef={home} companion={Pet ? <Pet variant="widget"/> : undefined} header={{
    onMenu: event => { event.preventDefault(); setMenu(event.currentTarget); },
    onSearch: event => { event.preventDefault(); store.set(spotlightOpenAtom, true); },
    onAppearance: event => { if (event.altKey) return; event.preventDefault(); runCommand(`theme.${store.get(resolvedThemeAtom) === 'dark' ? 'light' : 'dark'}`, 'menu'); toast({ title: `${store.get(resolvedThemeAtom) === 'dark' ? 'Dark' : 'Light'} appearance` }); }
  }}/><PhoneIconMenu target={icons.target} onClose={icons.close}/><PhoneMenu anchor={menu} onClose={() => setMenu(null)}/>{focused && <AppSheet windowId={focused}/>}</>;
}
