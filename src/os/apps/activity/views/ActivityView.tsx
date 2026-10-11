import { useRef } from 'react';
import type { ClientActivity } from '../../../types/content';
import type { TerrainView } from '../../../scenes/terrain';
import { AppIcon } from '../../../ui/AppIcon';
import { GITHUB_ACTIVITY_URL, activitySummary, formatActivityDate } from '../activity-data';
import { StatTiles } from './StatTiles';
import { TerrainStage } from './TerrainStage';
import '../activity.css';

interface Props {
  activity: ClientActivity; interactive?: boolean; paused?: boolean;
  view?: TerrainView; onViewChange?: (view: TerrainView) => void; resetSequence?: number;
}
export function ActivityView({ activity, interactive = false, paused = false, view = 'perspective', onViewChange, resetSequence = 0 }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  if (!activity.available) return <div className="activity-view activity-empty">
    <AppIcon icon="app-activity" size={48} />
    <h1 className="sr-only">Activity</h1>
    <p>GitHub didn’t answer when this site was built. The terrain will be back after the next deploy.</p>
    <a href={GITHUB_ACTIVITY_URL} target="_blank" rel="noopener noreferrer">Open github.com/theetaz ↗</a>
  </div>;
  return <div ref={rootRef} className="activity-view" data-terrain data-view={view}
    data-start={activity.start} data-counts={activity.counts.join(',')}>
    <h1 className="sr-only">Activity</h1>
    <div className="activity-toolbar" role="group" aria-label="Activity controls">
      <div className="activity-segmented" role="group" aria-label="Terrain view">
        {([{ value: 'perspective', label: '3D' }, { value: 'top', label: 'Calendar' }] as const).map(option =>
          <button key={option.value} type="button" data-view={option.value} disabled={!interactive}
            aria-pressed={view === option.value} onClick={() => onViewChange?.(option.value)}>{option.label}</button>)}
      </div>
      <a href={GITHUB_ACTIVITY_URL} target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
    </div>
    <div className="activity-body">
      <StatTiles activity={activity} />
      <TerrainStage activity={activity} rootRef={rootRef} interactive={interactive} paused={paused} view={view}
        onViewChange={onViewChange} resetSequence={resetSequence} />
      <div className="activity-footer">
        <div className="activity-legend" aria-hidden="true"><span>Less</span>
          {[0, 1, 2, 3, 4, 5].map(level => <i key={level} className={`activity-heat-${level}`} />)}<span>More</span>
        </div>
        <p className={interactive ? undefined : 'activity-hint-placeholder'} aria-hidden={!interactive}>Drag to orbit, pinch to zoom, click a day to fly in.</p>
      </div>
      <p className="activity-summary">{activitySummary(activity)}</p>
      <p className="activity-source">Data from GitHub, fetched when this site was built on {formatActivityDate(new Date(activity.fetchedAt))}.</p>
    </div>
  </div>;
}
