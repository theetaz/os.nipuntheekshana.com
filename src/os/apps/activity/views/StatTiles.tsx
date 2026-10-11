import { activityDate, formatActivityDate, type AvailableActivity } from '../activity-data';

export function StatTiles({ activity }: { activity: AvailableActivity }) {
  const tiles = [
    { label: 'Contributions', value: activity.total.toLocaleString('en-US') },
    { label: 'Active days', value: activity.activeDays.toLocaleString('en-US') },
    { label: 'Longest streak', value: `${activity.longestStreak} days`, title: `Current streak: ${activity.currentStreak} days` },
    ...(activity.busiest ? [{ label: 'Busiest day', value: `${formatActivityDate(activityDate(activity.busiest.date), false)} · ${activity.busiest.count.toLocaleString('en-US')}` }] : []),
    ...(activity.stars !== null ? [{ label: 'Stars', value: activity.stars.toLocaleString('en-US') }] : []),
  ];
  return <dl className="activity-stats" aria-label="GitHub statistics">
    {tiles.map(tile => <div className="activity-stat" key={tile.label} title={tile.title}>
      <dt>{tile.label}</dt><dd>{tile.value}</dd>
    </div>)}
  </dl>;
}
