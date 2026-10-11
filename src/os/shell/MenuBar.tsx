import type { ReactNode } from 'react';
import { ISLAND_PATH, ISLAND_VIEWBOX } from '../icons/island-glyph';
import type { DesktopProps } from '../Desktop';
export function MenuBar({ children }: { children?: ReactNode; home?: DesktopProps['home']; build?: DesktopProps['build'] }) {
  return <header className="static-menubar os-chrome"><a className="serendib-brand" href="/" aria-label="Serendib home"><svg width="13" height="22" viewBox={ISLAND_VIEWBOX} aria-hidden="true"><path d={ISLAND_PATH} fill="currentColor" /></svg><span>Serendib</span></a>
    {children}<nav className="js-only" aria-label="Menu bar"><a href="/projects">Projects</a><a href="/writing">Writing</a><a href="/about">About</a><a href="/cv">CV</a><a href="/now">Now</a></nav>
    <a className="simple-entry" href="#simple">Simple view</a></header>;
}
