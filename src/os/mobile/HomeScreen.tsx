import type { ReactNode, Ref } from 'react';
import type { DesktopProps } from '../Desktop';
import { HomeHeader, type HomeHeaderProps } from './HomeHeader';
import { HomeWidgets } from './HomeWidgets';
import { HomeGrid } from './HomeGrid';
import { HomeDock } from './HomeDock';
interface ArtImage { avif: string; webp: string; src: string; width: number; height: number }
export type HomeArt = Record<'tuktuk' | 'lotus-tower' | 'tea' | 'radio', ArtImage>;
export function HomeScreen({ home, art: _art, companion, header, homeRef, id = 'phone-content', hidden = false }: { home: DesktopProps['home']; art?: HomeArt; companion?: ReactNode; header?: HomeHeaderProps; homeRef?: Ref<HTMLDivElement>; id?: string; hidden?: boolean }) {
  return <div ref={homeRef} id={id} tabIndex={-1} role="main" aria-label="Serendib Pocket home" className="phone-home os-chrome" data-phone-home hidden={hidden}>
    <HomeHeader {...header}/><div className="phone-home-body"><HomeWidgets home={home} companion={companion}/><HomeGrid/></div><HomeDock/>
  </div>;
}
