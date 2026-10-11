import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../../src/lib/github');
  vi.resetModules();
});

describe('memoized activity builder', () => {
  it('returns the unavailable shape when contributions fail, and fetches only once', async () => {
    const getContributions = vi.fn().mockResolvedValue(null);
    const getTotalStars = vi.fn().mockResolvedValue(12);
    vi.doMock('../../src/lib/github', () => ({ getContributions, getTotalStars }));
    const { getClientActivity } = await import('../../src/lib/client-data');
    const first = getClientActivity();
    expect(getClientActivity()).toBe(first);
    const result = await first;
    expect(result).toEqual({ available: false, fetchedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false);
    expect(getContributions).toHaveBeenCalledExactlyOnceWith('theetaz');
    expect(getTotalStars).toHaveBeenCalledTimes(1);
  });

  it('keeps available contributions when only the stars request fails', async () => {
    const contributions = { start: '2026-10-04', weeks: 1, counts: [0, 2, 1, 0, -1, -1, -1], total: 3 };
    vi.doMock('../../src/lib/github', () => ({
      getContributions: vi.fn().mockResolvedValue(contributions), getTotalStars: vi.fn().mockResolvedValue(null),
    }));
    const { getClientActivity } = await import('../../src/lib/client-data');
    expect(await getClientActivity()).toEqual({
      available: true, ...contributions, stars: null, activeDays: 2, longestStreak: 2, currentStreak: 0,
      busiest: { date: '2026-10-05', count: 2 }, busiestWeekday: 1, fetchedAt: expect.any(String),
    });
  });
});
