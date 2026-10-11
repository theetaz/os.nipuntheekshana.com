import { activityDate, activitySummary, describeDay, heatLevels, type AvailableActivity } from '../activity-data';

export function CalendarHeatmap({ activity, focusedDay = -1 }: { activity: AvailableActivity; focusedDay?: number }) {
  const levels = heatLevels(activity.counts);
  const weeks = Math.max(1, Math.ceil(activity.counts.length / 7));
  const monthTicks = Array.from({ length: weeks }, (_, week) => {
    const date = activityDate(activity.start, week * 7);
    if (week > 0 && date.getUTCMonth() === activityDate(activity.start, (week - 1) * 7).getUTCMonth()) return null;
    if (week > weeks - 3) return null;
    return <text key={week} x={28 + week * 12} y="13">{date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</text>;
  });
  return <svg className="activity-calendar" viewBox={`0 0 ${weeks * 12 + 32} 108`} role="img" aria-label={activitySummary(activity)}>
    {monthTicks}
    {[1, 3, 5].map(day => <text key={day} x="0" y={28 + day * 12}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}</text>)}
    {activity.counts.map((count, index) => count < 0 ? null : <rect key={index}
      x={28 + Math.floor(index / 7) * 12} y={20 + index % 7 * 12} width="10" height="10" rx="2"
      className={`activity-heat-${levels[index]}${focusedDay === index ? ' activity-day-focused' : ''}`}>
      <title>{describeDay(activity, index)}</title>
    </rect>)}
  </svg>;
}
