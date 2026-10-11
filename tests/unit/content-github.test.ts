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
    const html = `
      <td class="ContributionCalendar-day" id="contribution-day-component-1-0" data-date="2026-10-05"></td>
      <td class="ContributionCalendar-day" id="contribution-day-component-2-0" data-date="2026-10-06"></td>
      <td class="ContributionCalendar-day" id="contribution-day-component-0-1" data-date="2026-10-11"></td>
      <tool-tip for="contribution-day-component-1-0">1,234 contributions on October 5.</tool-tip>
      <tool-tip for="contribution-day-component-2-0">1 contribution on October 6.</tool-tip>
      <tool-tip for="contribution-day-component-0-1">No contributions on October 11.</tool-tip>`;
    const fetcher = vi.fn().mockResolvedValue(new Response(html));
    vi.stubGlobal('fetch', fetcher);
    const { getContributions } = await import('../../src/lib/github');
    expect(await getContributions()).toEqual({
      start: '2026-10-04', weeks: 2, total: 1235,
      counts: [-1, 1234, 1, -1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1],
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
