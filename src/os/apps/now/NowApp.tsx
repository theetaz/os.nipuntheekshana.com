import { lazy, Suspense, useLayoutEffect, useRef, type RefObject } from 'react';
import type { AppProps } from '../../registry/apps';
import type { ClientProfile } from '../../types/content';
import { useAppData } from '../../lib/fetch-json';
import { useAppCommands, useAppMenuState } from '../../wm/commands';
import { NowView } from './NowView';
export { menus } from './menus';
const menuState = {};
const DataError = lazy(() => import('../../ui/ErrorState').then(module => ({ default: module.ErrorState })));
export default function NowApp({ windowId, initialData, ready, scrollRootRef }: AppProps) {
  const { data, error, retry } = useAppData<ClientProfile>('now:index', '/data/profile.json', initialData as ClientProfile | null);
  const reportedReady = useRef(false);
  useAppCommands(windowId, () => false);
  useAppMenuState(windowId, menuState);
  useLayoutEffect(() => {
    if ((data || error) && !reportedReady.current) { reportedReady.current = true; ready(); }
  }, [data, error, ready]);
  return <div ref={scrollRootRef as RefObject<HTMLDivElement>} data-scroll-root className="now-scroll">
    {data ? <NowView now={data.now} /> : error
      ? <Suspense fallback={<p className="now-document" role="alert">Now couldn’t load.</p>}>
        <DataError title="Now couldn't load." onRetry={retry} simpleHref="/now#simple" />
      </Suspense>
      : <p className="now-document" role="status">Loading Now…</p>}
  </div>;
}
