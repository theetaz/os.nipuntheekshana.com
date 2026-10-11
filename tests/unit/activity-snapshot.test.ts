import { describe, expect, it } from 'vitest';
import snapshot from '../../src/data/activity-snapshot.json';
import { isCompleteCalendar, parseContributionCalendar, selectActivity } from '../../src/lib/github-calendar.mjs';

const now = '2026-10-11T20:00:00Z';
const html = () => snapshot.counts.flatMap((count, index) => {
  if (count < 0) return [];
  const date = new Date(Date.parse(snapshot.start) + index * 86_400_000).toISOString().slice(0, 10);
  const id = `contribution-day-component-${index % 7}-${Math.floor(index / 7)}`;
  return [`<td class="ContributionCalendar-day" id="${id}" data-date="${date}"></td><tool-tip for="${id}">${count ? `${count} contributions` : 'No contributions'} on ${date}.</tool-tip>`];
}).join('');

describe('last-good activity snapshot', () => {
  it('contains a complete year, consistent counts and an original fetch date', () => {
    expect(isCompleteCalendar(snapshot)).toBe(true);
    expect(snapshot.total).toBeGreaterThan(17_000);
    expect(Number.isNaN(Date.parse(snapshot.fetchedAt))).toBe(false);
    expect(parseContributionCalendar(html())).toMatchObject({ total: snapshot.total, counts: snapshot.counts });
  });
  it('keeps the snapshot on failure, missing cells, bad totals, or a drop greater than 50%', () => {
    const missing = { ...snapshot, counts: [...snapshot.counts] }; missing.counts[100] = -1;
    const partial = { ...snapshot, counts: snapshot.counts.map(count => count < 0 ? -1 : Math.floor(count / 4)) };
    partial.total = partial.counts.reduce((sum, count) => sum + Math.max(0, count), 0);
    for (const data of [null, missing, { ...snapshot, total: 5152 }, partial]) {
      expect(selectActivity(data, null, snapshot, now)).toBe(snapshot);
      expect(selectActivity(data, null, snapshot, now).fetchedAt).toBe(snapshot.fetchedAt);
    }
  });
  it('accepts a complete successful fetch at the threshold and dates it freshly', () => {
    const data = { ...snapshot, counts: snapshot.counts.map(count => count < 0 ? -1 : Math.ceil(count / 2)) };
    data.total = data.counts.reduce((sum, count) => sum + Math.max(0, count), 0);
    expect(selectActivity(data, null, snapshot, now)).toEqual({ ...data, stars: null, fetchedAt: now });
  });
  it('never converts absent/unrecognised tooltips into zero contributions', () => {
    const calendar = html();
    expect(parseContributionCalendar(calendar.replace(/<tool-tip[^>]*>[\s\S]*?<\/tool-tip>/, ''))).toBeNull();
    expect(parseContributionCalendar(calendar.replace('5 contributions', 'Unknown count'))).toBeNull();
    expect(parseContributionCalendar(calendar.replace(/<td[^>]*>/, ''))).toBeNull();
    expect(parseContributionCalendar(calendar.replace('data-date="2025-10-12"', 'data-date="2025-10-13"'))).toBeNull();
  });
});
