import { useLayoutEffect, useRef, useState, type RefObject, type KeyboardEvent } from 'react';
import type { ClientProfile } from '../../../types/content';
import { Sidebar, SidebarRow } from '../../../ui/Sidebar';
import { ABOUT_SECTIONS, type AboutSection } from '../data';
import { Overview } from './Overview';
import { Story } from './Story';
import { Principles } from './Principles';
import { Toolbox } from './Toolbox';
import { Life } from './Life';
import '../p3-3-about.css';

interface AboutViewProps {
  profile: ClientProfile;
  at: string;
  section?: AboutSection;
  idPrefix?: string;
  interactive?: boolean;
  focused?: boolean;
  scrollRootRef?: RefObject<HTMLElement | null>;
  onSectionChange?: (section: AboutSection) => void;
  onEmail?: () => void;
  onAvatarSevenClicks?: () => void;
}

export function AboutView({ profile, at, section = 'Overview', idPrefix = 'about', interactive = false,
  focused = true, scrollRootRef, onSectionChange, onEmail, onAvatarSevenClicks }: AboutViewProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const clicks = useRef<number[]>([]);
  const root = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    if (!interactive || !root.current) return;
    const observer = new ResizeObserver(entries => setNarrow((entries[0]?.contentRect.width ?? 760) < 560));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [interactive]);
  const panelId = (name: AboutSection) => `${idPrefix}-${name.toLowerCase()}`;
  const tabId = (name: AboutSection) => `${idPrefix}-tab-${name.toLowerCase()}`;
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const index = ABOUT_SECTIONS.indexOf(section);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? ABOUT_SECTIONS.length - 1
      : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % ABOUT_SECTIONS.length
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + ABOUT_SECTIONS.length - 1) % ABOUT_SECTIONS.length : null;
    if (next === null) return;
    event.preventDefault();
    onSectionChange?.(ABOUT_SECTIONS[next]!);
    tabs.current[next]?.focus({ preventScroll: true });
    tabs.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const content = (name: AboutSection) => {
    switch (name) {
      case 'Overview': return <Overview profile={profile} at={at} storyHref={`#${panelId('Story')}`} interactive={interactive}
        onStory={interactive ? event => { event.preventDefault(); onSectionChange?.('Story'); tabs.current[1]?.focus({ preventScroll: true }); } : undefined}
        onEmail={interactive ? event => { event.stopPropagation(); onEmail?.(); } : undefined}
        onAvatarClick={() => {
          const now = performance.now();
          clicks.current = [...clicks.current.filter(time => now - time <= 4000), now];
          if (clicks.current.length === 7) { clicks.current = []; onAvatarSevenClicks?.(); }
        }} />;
      case 'Story': return <Story chapters={profile.chapters} />;
      case 'Principles': return <Principles principles={profile.principles} />;
      case 'Toolbox': return <Toolbox skills={profile.skills} />;
      case 'Life': return <Life hobbies={profile.hobbies} />;
    }
  };

  return <div className="about-view" data-interactive={interactive} ref={root}>
    <Sidebar label="About sections" className="about-sidebar" role={interactive ? 'tablist' : undefined}
      aria-orientation={interactive ? (narrow ? 'horizontal' : 'vertical') : undefined} onKeyDown={interactive ? onKeyDown : undefined}>
      {ABOUT_SECTIONS.map((name, index) => interactive
        ? <SidebarRow key={name} ref={element => { tabs.current[index] = element; }} role="tab"
          id={tabId(name)} aria-controls={panelId(name)} aria-selected={section === name}
          tabIndex={section === name ? 0 : -1} selected={section === name} activeWindow={focused}
          onClick={() => onSectionChange?.(name)}>{name}</SidebarRow>
        : <a key={name} className="about-static-tab" href={`#${panelId(name)}`}>{name}</a>)}
    </Sidebar>
    <div className="about-scroll" data-scroll-root tabIndex={interactive ? undefined : 0} ref={scrollRootRef as RefObject<HTMLDivElement | null>}>
      {ABOUT_SECTIONS.map(name => <section key={name} id={panelId(name)} className="about-panel"
        role={interactive ? 'tabpanel' : undefined} aria-labelledby={interactive ? tabId(name) : undefined}
        tabIndex={interactive ? 0 : undefined} hidden={interactive && section !== name} data-selected={section === name}>
        {content(name)}
      </section>)}
    </div>
  </div>;
}
