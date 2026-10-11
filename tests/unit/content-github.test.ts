import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GITHUB_TOKEN', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('build-time GitHub content', () => {
  it('sums non-fork stars and shares the same request across callers', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([{ stargazers_count: 10, fork: false }, { stargazers_count: 90, fork: true }]))
      .mockResolvedValueOnce(Response.json([{ stargazers_count: 7, fork: false }]));
    vi.stubGlobal('fetch', fetcher);
    const { getTotalStars } = await import('../../src/lib/github');
    const result = getTotalStars();
    expect(getTotalStars()).toBe(result);
    expect(await result).toBe(17);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rebuilds the contribution grid from dated cells and tooltip counts', async () => {
    const firstDay = Date.parse('2025-10-12T00:00:00Z');
    const html = Array.from({ length: 365 }, (_, index) => {
      const id = `contribution-day-component-${index % 7}-${Math.floor(index / 7)}`;
      const date = new Date(firstDay + index * 86_400_000).toISOString().slice(0, 10);
      const count = index === 0 ? '1,234 contributions' : index === 1 ? '1 contribution' : 'No contributions';
      return `<td class="ContributionCalendar-day" id="${id}" data-date="${date}"></td><tool-tip for="${id}">${count} on ${date}.</tool-tip>`;
    }).join('');
    const fetcher = vi.fn().mockResolvedValue(new Response(html));
    vi.stubGlobal('fetch', fetcher);
    const { getContributions } = await import('../../src/lib/github');
    expect(await getContributions()).toEqual({
      start: '2025-10-12', weeks: 53, total: 1235,
      counts: [1234, 1, ...Array(363).fill(0), ...Array(6).fill(-1)],
    });
    await getContributions();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns null for unavailable GitHub responses without breaking the build', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    const { getContributions, getTotalStars } = await import('../../src/lib/github');
    expect(await getTotalStars()).toBeNull();
    expect(await getContributions()).toBeNull();
  });

  it('returns null when the contribution calendar has no cells', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>')));
    const { getContributions } = await import('../../src/lib/github');
    expect(await getContributions()).toBeNull();
  });
});
