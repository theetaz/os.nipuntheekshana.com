import type { DesktopProps } from '../Desktop';
import { useEffect } from 'react';
import { useStore } from 'jotai';
import { DesktopIcons } from './DesktopIcons';
import { DesktopSurface } from './DesktopSurface';
import { Mochi } from '../mochi/Mochi';
import { WindowLayer } from './WindowLayer';
import { Dock } from './Dock';
import { MenuBar } from './MenuBar';
import { LiveWallpaper } from './LiveWallpaper';
import { WidgetsController } from './WidgetsController';
export function DesktopShell(props: DesktopProps) {
  const store = useStore();
  useEffect(() => WidgetsController(store), [store]);
  return <><LiveWallpaper /><DesktopSurface /><DesktopIcons /><Mochi /><WindowLayer /><Dock /><MenuBar home={props.home} build={props.build}>
    <nav className="no-js-only" aria-label="Menu bar"><a href="/projects">Projects</a><a href="/writing">Writing</a><a href="/about">About</a><a href="/cv">CV</a><a href="/now">Now</a></nav>
  </MenuBar></>;
}
