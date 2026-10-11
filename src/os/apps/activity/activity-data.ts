import type { ClientActivity } from '../../types/content';

export type AvailableActivity = Extract<ClientActivity, { available: true }>;
export const GITHUB_ACTIVITY_URL = 'https://github.com/theetaz';
const DAY_MS = 86_400_000;

export function activityDate(start: string, index = 0): Date {
  return new Date(Date.parse(`${start}T00:00:00Z`) + index * DAY_MS);
}
export function formatActivityDate(date: Date, year = true): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year && { year: 'numeric' }), timeZone: 'UTC' });
}
export function describeDay(activity: AvailableActivity, index: number): string {
  const count = Math.max(0, activity.counts[index] ?? 0);
  const date = activityDate(activity.start, index);
  return `${date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}, ${formatActivityDate(date)}: ${count.toLocaleString('en-US')} contribution${count === 1 ? '' : 's'}`;
}
export function activitySummary(activity: AvailableActivity): string {
  const first = activity.counts.findIndex(count => count >= 0);
  const last = activity.counts.findLastIndex(count => count >= 0);
  if (first < 0) return 'No GitHub contributions recorded in the last year.';
  return `${activity.total.toLocaleString('en-US')} GitHub contributions from ${formatActivityDate(activityDate(activity.start, first))} to ${formatActivityDate(activityDate(activity.start, last))}, on ${activity.activeDays.toLocaleString('en-US')} different days.`;
}
/** The activity strip's square-root ramp, capped at the 96th percentile. */
export function heatLevels(counts: number[]): number[] {
  const sorted = counts.filter(count => count > 0).sort((a, b) => a - b);
  const cap = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .96))] ?? 1;
  return counts.map(count => count <= 0 ? 0 : Math.min(5, Math.ceil(Math.min(1, Math.sqrt(count / cap)) * 5)));
}
export function nextDay(counts: number[], current: number, key: string): number {
  if (current < 0) return counts.findIndex(count => count >= 0);
  const row = current % 7;
  const next = key === 'ArrowRight' ? current + 7 : key === 'ArrowLeft' ? current - 7
    : key === 'ArrowDown' ? current + (row < 6 ? 1 : 0) : current - (row > 0 ? 1 : 0);
  return next >= 0 && next < counts.length && (counts[next] ?? -1) >= 0 ? next : current;
}
