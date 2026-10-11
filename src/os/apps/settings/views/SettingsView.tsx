import type { RefObject } from 'react';
import { Palette, Image, Accessibility as AccessibilityIcon, Volume2, Cat, Monitor, Info, Code } from 'lucide-react';
import { Sidebar, SidebarRow } from '../../../ui/Sidebar';
import { SECTIONS, type SectionId, type SectionProps, type SettingsData } from '../settings';
import { Appearance } from '../sections/Appearance';
import { Wallpaper } from '../sections/Wallpaper';
import { Accessibility } from '../sections/Accessibility';
import { Sound } from '../sections/Sound';
import { MochiSection } from '../sections/MochiSection';
import { Desktop } from '../sections/Desktop';
import { About } from '../sections/About';
import Developer from '../sections/Developer';
import '../p3-10-settings.css';

const icons = { appearance: Palette, wallpaper: Image, accessibility: AccessibilityIcon, sound: Volume2,
  mochi: Cat, desktop: Monitor, about: Info, developer: Code };
interface Props extends SectionProps {
  section?: SectionId; developer?: boolean; focused?: boolean; data: SettingsData;
  liveUnavailable: string | null; onSection?: (section: SectionId) => void;
  scrollRootRef?: RefObject<HTMLElement | null>;
}
export function SettingsView({ section = 'appearance', developer = false, focused = true, data,
  liveUnavailable, onSection, scrollRootRef, ...props }: Props) {
  const sections = SECTIONS.filter(item => developer || item.id !== 'developer');
  const content = (id: SectionId) => {
    switch (id) {
      case 'appearance': return <Appearance {...props} />;
      case 'wallpaper': return <Wallpaper {...props} liveUnavailable={liveUnavailable} />;
      case 'accessibility': return <Accessibility {...props} />;
      case 'sound': return <Sound {...props} />;
      case 'mochi': return <MochiSection {...props} />;
      case 'desktop': return <Desktop {...props} />;
      case 'about': return <About data={data} />;
      case 'developer': return <Developer />;
    }
  };
  return <div className={`settings-app${onSection ? '' : ' settings-static'}`} data-scroll-root={onSection ? '' : undefined}
    ref={scrollRootRef as RefObject<HTMLDivElement | null>}>
    <Sidebar label="Settings sections" className="settings-sidebar">
      <h1 className="settings-sidebar-title">Settings</h1>
      {sections.map(item => { const Icon = icons[item.id]; return onSection
        ? <SidebarRow key={item.id} selected={section === item.id} activeWindow={focused} icon={<Icon strokeWidth={1.75} />}
          onClick={() => onSection(item.id)}>{item.label}</SidebarRow>
        : <a key={item.id} href={`#settings-static-${item.id}`} className={`settings-static-nav settings-nav-${item.id}`}>
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />{item.label}</a>;
      })}
    </Sidebar>
    <div className="settings-panels">
      {onSection ? <section className="settings-panel" aria-label={SECTIONS.find(item => item.id === section)?.label}>{content(section)}</section>
        : sections.map(item => <section key={item.id} id={`settings-static-${item.id}`} className="settings-panel" aria-label={item.label}>
          {content(item.id)}<p className="settings-static-note">Preferences apply live and save on this device when JavaScript is enabled.</p>
        </section>)}
    </div>
  </div>;
}
