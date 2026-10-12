import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { education, experience, now, summary } from '../../src/data/profile';
import type { ClientActivity, ClientArchiveItem, ClientProject } from '../../src/os/types/content';
import { bioNotes, bioParagraphs, careerHash, careerRows, heatColours, nowNote, skillBlocks, storyActivity, storyArchive } from '../../src/lib/story-data';
import { storyProjects } from '../../src/lib/story-projects';

vi.mock('../../src/lib/client-data', () => {
  const data = JSON.parse(readFileSync('dist/client/data/projects.json', 'utf8')) as { projects: ClientProject[]; archive: ClientArchiveItem[] };
  return { getClientProjects: async () => data.projects, getArchive: async () => data.archive };
});
const activity = JSON.parse(readFileSync('dist/client/data/activity.json', 'utf8')) as ClientActivity;

describe('static story data', () => {
  it('uses stable seven-character SHA-1 hashes of the original organisation and period', () => {
    expect(careerHash('a', 'bc')).toBe('a9993e3');
    expect(careerHash('Prabhava Labs', 'Jan 2026 — Present')).toBe('7cb11e1');
    expect(careerHash('Prabhava Labs', 'Jan 2026 — Present')).toBe(careerHash('Prabhava Labs', 'Jan 2026 — Present'));
    expect(careerHash('Prabhava Labs', 'Jan 2025 — Present')).not.toBe('7cb11e1');
    expect(careerRows.every(row => /^[0-9a-f]{7}$/.test(row.hash))).toBe(true);
  });
  it('orders the six roles by start date and finishes with education, preserving every highlight', () => {
    expect(careerRows.map(row => row.org)).toEqual([
      'Prabhava Labs', 'PerfectUs Technologies', 'KeenEye Solutions', 'Parallax Technologies', 'Self-employed', 'Crowderia AB', 'University of Ruhuna',
    ]);
    for (const entry of experience) expect(careerRows.find(row => row.org === entry.org)?.highlights).toEqual(entry.highlights ?? [entry.summary]);
    expect(careerRows[0]).toMatchObject({ ref: 'HEAD -> prabhava-labs', dates: 'Jan 2026 → now' });
    expect(careerRows[1]).toMatchObject({ ref: 'perfectus', graph: '| *' });
    expect(careerRows.at(-1)).toMatchObject({ hash: careerHash(education.school, education.period), branch: 'education', ref: 'tag: bsc' });
  });
  it('keeps the complete summary in two paragraphs of at most 70 words and the specified notes', () => {
    expect(bioParagraphs.join(' ')).toBe(summary);
    expect(bioParagraphs).toHaveLength(2);
    for (const paragraph of bioParagraphs) expect(paragraph.split(/\s+/).length).toBeLessThanOrEqual(70);
    expect(bioNotes.map(note => note.text)).toEqual(['10+ years shipping software', '50+ engineers led', '1,000+ smart contracts, 0 critical incidents']);
    expect(nowNote).toMatchObject({ items: now.items.slice(0, 3), updated: '2026-09-28', label: 'updated 28 Sep' });
    expect(skillBlocks).toHaveLength(7);
    expect(skillBlocks.find(block => block.icon === 'cpu')?.colour).toBe('#EE5148');
  });
  it('uses the real project catalogue for six highlights, nine side projects and four fun projects', async () => {
    const groups = await storyProjects();
    expect(groups.highlights).toHaveLength(6);
    expect(groups.side).toHaveLength(9);
    expect(groups.fun.map(project => project.slug)).toEqual(['colombo-delivery', 'mochi', 'terrarun', 'pin-the-city']);
    const catalogue = JSON.parse(readFileSync('dist/client/data/projects.json', 'utf8')) as { projects: ClientProject[] };
    expect(groups.highlights.map(project => project.slug)).toEqual(catalogue.projects.filter(project => project.featured).map(project => project.slug));
    const slugs = Object.values(groups).flat().map(project => project.slug);
    expect(new Set(slugs).size).toBe(19);
    expect(groups.fun.at(-1)).toMatchObject({ href: '/maps/play', sticker: 'sticker-pin-the-city', cover: null });
  });
  it('builds four snapshot stat tiles and 371 labelled cells with the v1 colour normalisation', () => {
    const calendar = storyActivity(activity)!;
    expect(calendar.tiles.map(tile => tile.label)).toEqual(['Contributions this year', 'Active days', 'Longest streak', 'Stars']);
    expect(calendar.cells).toHaveLength(371);
    expect(calendar.cells[0]).toMatchObject({ x: 0, y: 0 });
    expect(calendar.cells.at(-1)).toMatchObject({ x: 780, y: 90 });
    expect(calendar.summary).toContain('GitHub contributions');
    expect(calendar.cells.every(cell => cell.label && heatColours.includes(cell.fill))).toBe(true);
    const counts = [0, 1, 4, 9, 16, 25, -1];
    const small = storyActivity({ ...activity, available: true, start: '2026-01-04', counts } as ClientActivity)!;
    expect(small.cells.slice(0, 7).map(cell => cell.fill)).toEqual([heatColours[0], heatColours[1], heatColours[2], heatColours[3], heatColours[4], heatColours[5], heatColours[0]]);
    expect(small.cells[6]!.label).toBe('Outside the contribution calendar.');
  });
  it('omits unavailable activity and missing stars without inventing values', () => {
    expect(storyActivity({ available: false, fetchedAt: '2026-10-12T00:00:00Z' })).toBeNull();
    expect(storyActivity({ ...activity, available: true, stars: null } as ClientActivity)?.tiles).toHaveLength(3);
  });
  it('retains all eight archive receipts with their year and stack', async () => {
    const receipts = await storyArchive();
    expect(receipts).toHaveLength(8);
    expect(receipts.map(item => item.title)).toEqual(['Village 60 Plus ERP', 'PGLL Logistic', 'StoreMate SaaS', 'Cooperative loans platform', 'Hope SL', 'Space Hunter', 'Private PoA blockchain', 'Coqeep']);
    expect(receipts.every(item => item.note && item.year && item.stack)).toBe(true);
  });
});
