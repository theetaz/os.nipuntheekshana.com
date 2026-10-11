import type { Contributions } from './github';

const DAY_MS = 86_400_000;

export function activeDays({ counts }: Contributions): number {
  return counts.filter((count) => count > 0).length;
}

export function longestStreak({ counts }: Contributions): number {
  let current = 0;
  let longest = 0;
  for (const count of counts) {
    current = count > 0 ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** Ends on the last UTC day with data, ignoring the grid's trailing -1 padding. */
export function currentStreak({ counts }: Contributions): number {
  let end = counts.length - 1;
  while (end >= 0 && counts[end]! < 0) end--;
  let streak = 0;
  while (end >= 0 && counts[end]! > 0) { streak++; end--; }
  return streak;
}

/** Earliest date wins ties; an all-zero calendar has no busiest day. */
export function busiestDay({ start, counts }: Contributions): { date: string; count: number } | null {
  let index = -1;
  let max = 0;
  counts.forEach((count, day) => {
    if (count > max) { max = count; index = day; }
  });
  if (index < 0) return null;
  const date = new Date(Date.parse(`${start}T00:00:00Z`) + index * DAY_MS).toISOString().slice(0, 10);
  return { date, count: max };
}

/** Sunday = 0. Sum contributions by UTC weekday; first weekday wins ties (zero year = 0). */
export function busiestWeekday({ start, counts }: Contributions): number {
  const totals = Array<number>(7).fill(0);
  const first = new Date(`${start}T00:00:00Z`).getUTCDay();
  counts.forEach((count, day) => {
    if (count > 0) totals[(first + day) % 7]! += count;
  });
  return totals.indexOf(Math.max(...totals));
}

export function activityStats(data: Contributions) {
  return {
    activeDays: activeDays(data), longestStreak: longestStreak(data), currentStreak: currentStreak(data),
    busiest: busiestDay(data), busiestWeekday: busiestWeekday(data),
  };
}
