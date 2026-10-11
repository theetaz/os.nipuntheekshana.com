import snapshot from '../../src/data/activity-snapshot.json';
import { activityStats } from '../../src/lib/activity-stats';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.stubEnv('SERENDIB_ACTIVITY_SOURCE', 'live'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('../../src/lib/github');
  vi.resetModules();
});

describe('memoized activity builder', () => {
  it('preserves the last-good snapshot and its fetch date when GitHub fails, and fetches only once', async () => {
    const getContributions = vi.fn().mockResolvedValue(null);
    const getTotalStars = vi.fn().mockResolvedValue(12);
    vi.doMock('../../src/lib/github', () => ({ getContributions, getTotalStars }));
    const { getClientActivity } = await import('../../src/lib/client-data');
    const first = getClientActivity();
    expect(getClientActivity()).toBe(first);
    const result = await first;
    expect(result).toEqual({ available: true, ...snapshot, ...activityStats(snapshot) });
    expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false);
    expect(getContributions).toHaveBeenCalledExactlyOnceWith('theetaz');
    expect(getTotalStars).toHaveBeenCalledTimes(1);
  });

  it('keeps available contributions when only the stars request fails', async () => {
    const contributions = { ...snapshot, counts: [...snapshot.counts] };
    vi.doMock('../../src/lib/github', () => ({
      getContributions: vi.fn().mockResolvedValue(contributions), getTotalStars: vi.fn().mockResolvedValue(null),
    }));
    const { getClientActivity } = await import('../../src/lib/client-data');
    expect(await getClientActivity()).toEqual({
      available: true, ...contributions, ...activityStats(contributions), stars: null, fetchedAt: expect.any(String),
    });
  });
});
