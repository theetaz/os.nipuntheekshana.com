import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { AppProps } from '../../registry/apps';
import type { ClientActivity } from '../../types/content';
import type { TerrainView } from '../../scenes/terrain';
import { windowAtom } from '../../state/atoms';
import { useAppData } from '../../lib/fetch-json';
import { useAppCommands, useAppMenuState } from '../../wm/commands';
import { ActivityView } from './views/ActivityView';
export { menus } from './menus';
export default function ActivityApp({ windowId, initialData, ready, scrollRootRef }: AppProps) {
  const { data, error, retry } = useAppData<ClientActivity>('activity:index', '/data/activity.json', initialData as ClientActivity | null);
  const win = useAtomValue(windowAtom(windowId));
  const [view, setView] = useState<TerrainView>('perspective');
  const [resetSequence, setResetSequence] = useState(0);
  const didReady = useRef(false);
  useLayoutEffect(() => {
    if (!didReady.current && (data || error)) { didReady.current = true; ready(); }
  }, [data, error, ready]);
  useAppCommands(windowId, command => {
    if (command === 'activity.3d') setView('perspective');
    else if (command === 'activity.calendar') setView('top');
    else if (command === 'activity.reset') setResetSequence(sequence => sequence + 1);
    else return false;
    return true;
  });
  const menuState = useMemo(() => ({
    'activity.3d': { checked: view === 'perspective', disabled: !data?.available },
    'activity.calendar': { checked: view === 'top', disabled: !data?.available },
    'activity.reset': { disabled: !data?.available },
  }), [data?.available, view]);
  useAppMenuState(windowId, menuState);
  return <div ref={scrollRootRef as React.RefObject<HTMLDivElement>} data-scroll-root className="static-content">
    <div className="static-document activity-document">
      {error ? <div className="activity-data-error" role="alert"><p>Couldn’t load activity.</p><button type="button" onClick={retry}>Retry</button></div>
        : data ? <ActivityView activity={data} interactive view={view} onViewChange={setView}
          paused={!!(win?.minimized || win?.closing)} resetSequence={resetSequence} />
        : <p className="activity-loading" role="status">Loading activity…</p>}
    </div>
  </div>;
}
