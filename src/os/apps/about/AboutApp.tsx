import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../registry/apps';
import { useAppData } from '../../lib/fetch-json';
import { nextMinuteDelay } from '../../lib/clock';
import { openApp, toast, useAppCommands, useAppMenuState } from '../../wm/commands';
import { ErrorState } from '../../ui/ErrorState';
import { ABOUT_SECTIONS, sectionFromHash, type AboutProfile, type AboutSection } from './data';
import { AboutView } from './views/AboutView';
export { menus } from './menus';

export default function AboutApp({ windowId, initialData, focused, ready, scrollRootRef }: AppProps) {
  const { data, error, retry } = useAppData<AboutProfile>('about:index', '/data/profile.json', initialData as AboutProfile | null);
  const [section, setSection] = useState<AboutSection>(() => sectionFromHash(typeof location === 'undefined' ? '' : location.hash));
  const [at, setAt] = useState<string | null>(null);
  const readyCalled = useRef(false);
  const selectSection = useCallback((next: AboutSection) => {
    setSection(next);
    if (scrollRootRef.current) scrollRootRef.current.scrollTop = 0;
  }, [scrollRootRef]);
  const email = useCallback(() => {
    if (!data) return;
    if (!navigator.clipboard) { toast({ title: 'Email', body: data.site.email }); return; }
    void navigator.clipboard.writeText(data.site.email).then(() => toast({ title: 'Email copied' }),
      () => toast({ title: 'Email', body: data.site.email }));
  }, [data]);
  useAppCommands(windowId, command => {
    const next = ABOUT_SECTIONS.find(name => command === `about.section.${name.toLowerCase()}`);
    if (next) { selectSection(next); return true; }
    if (command === 'about.cv') { openApp('cv'); return true; }
    if (command === 'about.email' && data) { email(); location.href = `mailto:${data.site.email}`; return true; }
    return false;
  });
  const menuState = useMemo(() => Object.fromEntries([
    ...ABOUT_SECTIONS.map(name => [`about.section.${name.toLowerCase()}`, { checked: name === section, disabled: !data }]),
    ['about.email', { disabled: !data }],
  ]), [data, section]);
  useAppMenuState(windowId, menuState);
  useLayoutEffect(() => {
    if ((data || error) && !readyCalled.current) { readyCalled.current = true; ready(); }
  }, [data, error, ready]);
  useEffect(() => {
    if (!data) return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date(); setAt(now.toISOString());
      timer = setTimeout(update, nextMinuteDelay(now.getTime()));
    };
    update();
    return () => clearTimeout(timer);
  }, [data]);

  if (!data) return <div className="about-load" ref={scrollRootRef as React.RefObject<HTMLDivElement | null>} data-scroll-root>
    {error ? <ErrorState title="About couldn't load." onRetry={retry} simpleHref="/about#simple" />
      : <p role="status">Loading About…</p>}
  </div>;
  return <AboutView profile={data} at={at ?? data.renderedAt ?? new Date().toISOString()} section={section}
    idPrefix={`about-${windowId}`} interactive focused={focused} scrollRootRef={scrollRootRef}
    onSectionChange={selectSection} onEmail={email}
    onAvatarSevenClicks={() => document.dispatchEvent(new CustomEvent('about:avatar7', { bubbles: true, detail: { windowId } }))} />;
}
