import type { DesktopProps } from '../Desktop';
import { useEffect, useState } from 'react';
import { PropsController } from './PropsController';
import { DesktopSurface } from './DesktopSurface';
import { DeferredWindowLayer } from './DeferredWindowLayer';
import { Dock } from './Dock';
import { MenuBar } from './MenuBar';
function IdleMochi() {
  const [Pet, setPet] = useState<typeof import('../mochi/Mochi').Mochi | null>(null);
  useEffect(() => {
    let cancelled = false; let idle = 0; let timer: ReturnType<typeof setTimeout> | undefined; let frame = 0;
    const load = () => { void import('../mochi/Mochi').then(module => {
      if (!cancelled && module?.Mochi) setPet(() => module.Mochi);
    }).catch(() => {}); };
    // Two frames guarantee a painted shell before scheduling the pet's idle work.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(load, { timeout: 4000 });
      else timer = globalThis.setTimeout(load, 200);
    }); });
    return () => { cancelled = true; cancelAnimationFrame(frame); if (idle) window.cancelIdleCallback(idle); clearTimeout(timer); };
  }, []);
  return Pet && <Pet />;
}
export function DesktopShell(props: DesktopProps) {
  return <><DesktopSurface /><PropsController /><IdleMochi /><DeferredWindowLayer /><Dock /><MenuBar home={props.home} build={props.build}>
    <nav className="no-js-only" aria-label="Menu bar"><a href="/projects">Projects</a><a href="/writing">Writing</a><a href="/about">About</a><a href="/cv">CV</a><a href="/now">Now</a></nav>
  </MenuBar></>;
}
