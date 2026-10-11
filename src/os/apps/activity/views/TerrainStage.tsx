import { useEffect, useRef, useState, type RefObject } from 'react';
import type { TerrainController, TerrainView } from '../../../scenes/terrain';
import { activitySummary, describeDay, nextDay, type AvailableActivity } from '../activity-data';
import { CalendarHeatmap } from './CalendarHeatmap';

interface Props {
  activity: AvailableActivity; rootRef: RefObject<HTMLDivElement | null>;
  interactive: boolean; paused: boolean; view: TerrainView;
  onViewChange?: (view: TerrainView) => void; resetSequence: number;
}
export function TerrainStage({ activity, rootRef, interactive, paused, view, onViewChange, resetSequence }: Props) {
  const controller = useRef<TerrainController | null>(null);
  const latest = useRef({ paused, view, onViewChange });
  latest.current = { paused, view, onViewChange };
  const [ready, setReady] = useState(false);
  const [focusedDay, setFocusedDay] = useState(-1);
  const [live, setLive] = useState('');

  useEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    // The terrain is never in the initial shell or the static page's JS.
    void import('../../../scenes/terrain').then(({ initTerrain }) => {
      if (cancelled || !rootRef.current) return;
      controller.current = initTerrain(rootRef.current, {
        accent: true, view: latest.current.view, paused: latest.current.paused,
        onViewChange: next => latest.current.onViewChange?.(next),
      });
      setReady(controller.current !== null);
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; controller.current?.destroy(); controller.current = null; };
  }, [activity, interactive, rootRef]);
  useEffect(() => { controller.current?.setPaused(paused); }, [paused]);
  useEffect(() => { controller.current?.setView(view); }, [view]);
  useEffect(() => { if (resetSequence) controller.current?.reset(); }, [resetSequence]);

  return <>
    <div className="activity-terrain-stage" data-terrain-stage tabIndex={interactive ? 0 : undefined} role="group"
      aria-roledescription={ready ? '3D chart' : 'contribution calendar'}
      aria-label={`${activitySummary(activity)}${interactive ? ' Arrow keys move between days, Enter flies in, Shift with arrow keys orbits, Escape resets.' : ''}`}
      onKeyDown={event => {
        if (ready || !interactive || !event.key.startsWith('Arrow') || event.shiftKey) return;
        event.preventDefault();
        const next = nextDay(activity.counts, focusedDay, event.key);
        setFocusedDay(next);
        if (next >= 0) setLive(describeDay(activity, next));
      }}>
      <div className="activity-calendar-fallback"><CalendarHeatmap activity={activity} focusedDay={focusedDay} /></div>
      <canvas aria-hidden="true" />
      <div className="activity-terrain-tip" data-terrain-tip hidden aria-hidden="true">
        <p className="activity-tip-head"><span data-tip-day /><span data-tip-date /></p>
        <p className="activity-tip-count"><strong data-tip-count /> <span data-tip-unit /></p>
        <div className="activity-tip-bars" data-tip-bars />
        <p className="activity-tip-week">That week <span data-tip-week /></p>
      </div>
      {interactive && <p className="activity-fallback-note">Calendar view is available while the terrain loads, or if canvas is unavailable.</p>}
    </div>
    <p className="sr-only" aria-live="polite" aria-atomic="true" data-terrain-live>{live}</p>
  </>;
}
