import { describe, expect, it } from 'vitest';
import { activityStats, busiestWeekday } from '../../src/lib/activity-stats';
import type { Contributions } from '../../src/lib/github';

function calendar(counts: number[], start = '2026-10-04'): Contributions {
  return { start, counts, weeks: Math.ceil(counts.length / 7), total: counts.reduce((sum, count) => sum + Math.max(0, count), 0) };
}

describe('UTC contribution statistics', () => {
  it('counts active days and streaks across week boundaries, ignoring padding at the end', () => {
    expect(activityStats(calendar([-1, 1, 3, 0, 5, 1, 2, 8, -1, -1]))).toEqual({
      activeDays: 6, longestStreak: 4, currentStreak: 4,
      busiest: { date: '2026-10-11', count: 8 }, busiestWeekday: 0,
    });
  });

  it('resets the current streak on the last recorded zero, rather than on the last positive day', () => {
    expect(activityStats(calendar([1, 1, 1, 0, -1])).currentStreak).toBe(0);
  });

  it('does not bridge a missing day inside the calendar', () => {
    const stats = activityStats(calendar([1, 1, -1, 1, 1]));
    expect(stats.longestStreak).toBe(2);
    expect(stats.currentStreak).toBe(2);
  });

  it('uses UTC dates across daylight-saving and year boundaries; earliest busiest date wins ties', () => {
    expect(activityStats(calendar([0, 9, 9], '2026-10-31')).busiest).toEqual({ date: '2026-11-01', count: 9 });
    expect(activityStats(calendar([-1, 2, 3], '2025-12-31')).busiest).toEqual({ date: '2026-01-02', count: 3 });
  });

  it('sums each weekday rather than choosing the weekday of the busiest single day', () => {
    expect(busiestWeekday(calendar([9, 6, 0, 0, 0, 0, 0, 0, 6]))).toBe(1);
    expect(busiestWeekday(calendar([0, 5, 0], '2026-10-05'))).toBe(2);
  });

  it.each([[], Array(371).fill(0), Array(371).fill(-1)].map((counts) => [counts]))('handles an empty or all-zero year', (counts) => {
    expect(activityStats(calendar(counts))).toEqual({
      activeDays: 0, longestStreak: 0, currentStreak: 0, busiest: null, busiestWeekday: 0,
    });
  });
});
