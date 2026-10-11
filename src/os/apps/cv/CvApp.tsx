import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../../registry/apps';
import type { ClientProfile } from '../../types/content';
import { useAppData } from '../../lib/fetch-json';
import { matchShortcut } from '../../lib/hotkeys-match';
import { isMac } from '../../lib/platform';
import { ErrorState } from '../../ui/ErrorState';
import { useAppCommands, useAppMenuState } from '../../wm/commands';
import { CvDocument, type CvViewerHandle, type CvViewerState } from './views/CvDocument';
import { menus } from './menus';
export { menus } from './menus';

export default function CvApp({ windowId, initialData, focused, ready, setTitle, scrollRootRef }: AppProps) {
  const { data: profile, error, retry } = useAppData<ClientProfile>('cv:index', '/data/profile.json', initialData as ClientProfile | null);
  const viewer = useRef<CvViewerHandle>(null);
  const readyCalled = useRef(false);
  const title = useRef('');
  const [state, setState] = useState<CvViewerState>({ zoom: 1, thumbnails: true });
  useAppCommands(windowId, command => viewer.current?.command(command) ?? false);
  useEffect(() => {
    if (!focused) return;
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const item = [...(menus.view ?? []), ...(menus.file ?? [])].find(item => item.kind === 'item'
        && item.shortcut && matchShortcut(event, item.shortcut, { platform: isMac() ? 'mac' : 'other' }));
      if (item?.kind === 'item' && viewer.current?.command(item.command)) event.preventDefault();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [focused]);
  useAppMenuState(windowId, useMemo(() => ({
    'cv.zoomIn': { disabled: !profile || state.zoom >= 2 },
    'cv.zoomOut': { disabled: !profile || state.zoom <= .5 },
    'cv.actualSize': { disabled: !profile },
    'cv.fitWidth': { disabled: !profile },
    'cv.thumbnails': { disabled: !profile, checked: state.thumbnails },
    'cv.print': { disabled: !profile },
    'cv.download': { disabled: !profile },
  }), [profile, state]));
  useLayoutEffect(() => {
    if (!profile && !error) return;
    const nextTitle = profile?.cv.filename ?? 'CV';
    if (title.current !== nextTitle) { title.current = nextTitle; setTitle(nextTitle); }
    if (!readyCalled.current) { readyCalled.current = true; ready(); }
  }, [profile, error, ready, setTitle]);
  if (error && !profile) return <div className="cv-empty" ref={scrollRootRef as React.RefObject<HTMLDivElement>} data-scroll-root>
    <ErrorState title="Couldn't load the CV." onRetry={retry} simpleHref="/cv#simple" />
  </div>;
  if (!profile) return <div className="cv-empty" role="status" aria-label="Loading CV" />;
  return <CvDocument ref={viewer} profile={profile} interactive idPrefix={`cv-${windowId}`} scrollRootRef={scrollRootRef} onStateChange={setState} />;
}
