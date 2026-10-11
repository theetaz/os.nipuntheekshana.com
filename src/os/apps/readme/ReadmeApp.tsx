import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useAtomValue } from 'jotai';
import { openMenuAtom } from '../../state/atoms';
import type { AppProps } from '../../registry/apps';
import type { ClientProfile } from '../../types/content';
import { useAppData } from '../../lib/fetch-json';
import { isMac } from '../../lib/platform';
import { useAppCommands, useAppMenuState } from '../../wm/commands';
import { ReadmeView, readmeSection, type ReadmeSection } from './ReadmeView';
export { menus } from './menus';
const menuState = {};
const DataError = lazy(() => import('../../ui/ErrorState').then(module => ({ default: module.ErrorState })));
export default function ReadmeApp({ windowId, initialData, query, focused, setQuery, setTitle, ready, scrollRootRef }: AppProps) {
  const { data, error, retry } = useAppData<ClientProfile>('readme:index', '/data/profile.json', initialData as ClientProfile | null);
  const reportedReady = useRef(false);
  const titledQuery = useRef<typeof query | null>(null);
  const openMenu = useAtomValue(openMenuAtom);
  const previousMenu = useRef<string | null>(null);
  const scrolledQuery = useRef<typeof query | null>(null);
  const [sectionRequest, setSectionRequest] = useState(0);
  const navigateSection = (section: ReadmeSection) => {
    scrolledQuery.current = null;
    setQuery({ section }, { replace: false });
    setSectionRequest(value => value + 1);
  };
  useAppCommands(windowId, command => {
    if (command !== 'readme.shortcuts') return false;
    navigateSection('shortcuts'); return true;
  });
  useAppMenuState(windowId, menuState);
  useLayoutEffect(() => {
    if (titledQuery.current !== query) { titledQuery.current = query; setTitle('Read me.txt'); }
    if ((data || error) && !reportedReady.current) {
      reportedReady.current = true; ready();
    }
  }, [data, error, query, ready, setTitle]);
  useEffect(() => {
    const fromHelp = previousMenu.current === 'help' || previousMenu.current === 'island';
    previousMenu.current = openMenu;
    if (openMenu || !data || !focused || (scrolledQuery.current === query && !fromHelp)) return;
    const section = readmeSection(query.section) ?? readmeSection(location.hash.slice(1));
    const root = scrollRootRef.current;
    const heading = section && root?.querySelector<HTMLElement>(`#${section}`);
    if (!root || !heading) return;
    // Let ready() finish the shell's focus handoff before focusing the section.
    const frame = requestAnimationFrame(() => {
      // Layout offsets stay accurate while the shell animates the window's scale.
      root.scrollTop = heading.offsetTop - 20;
      heading.focus({ preventScroll: true });
      scrolledQuery.current = query;
    });
    return () => cancelAnimationFrame(frame);
  }, [data, focused, query, openMenu, sectionRequest, scrollRootRef]);
  return <div ref={scrollRootRef as RefObject<HTMLDivElement>} data-scroll-root className="readme-scroll">
    {data ? <ReadmeView source={data.links.source} platform={isMac() ? 'mac' : 'other'}
      onSection={navigateSection} /> : error
      ? <Suspense fallback={<p className="readme-document" role="alert">Read me couldn’t load.</p>}>
        <DataError title="Read me couldn't load." onRetry={retry} simpleHref="/readme#simple" />
      </Suspense>
      : <p className="readme-document" role="status">Loading Read me…</p>}
  </div>;
}
