import { createHash } from 'node:crypto';
import { education, experience, highlights, now, summary } from '../data/profile';
import type { ClientActivity } from '../os/types/content';
import { activitySummary, describeDay, heatLevels } from '../os/apps/activity/activity-data';

export function careerHash(org: string, period: string): string {
  return createHash('sha1').update(org + period).digest('hex').slice(0, 7);
}

const roles: Record<string, string> = {
  'Prabhava Labs': 'Founder', 'PerfectUs Technologies': 'Co-founder & CTO',
  'Self-employed': 'Freelance software engineer', 'Crowderia AB': 'Software trainee',
};
const startDate = (period: string) => Date.parse(`1 ${period.split(' — ')[0]}`);
export const careerRows = [
  ...[...experience].sort((a, b) => startDate(b.period) - startDate(a.period)).map(entry => ({
    org: entry.org, hash: careerHash(entry.org, entry.period),
    message: `${roles[entry.org] ?? entry.role} · ${entry.org}${entry.org === 'KeenEye Solutions' ? ' · Colombo & Paris' : ''}`,
    dates: entry.period.replace(' — ', ' → ').replace('Present', 'now'),
    ref: entry.org === 'Prabhava Labs' ? 'HEAD -> prabhava-labs' : entry.org === 'PerfectUs Technologies' ? 'perfectus' : '',
    branch: entry.org === 'PerfectUs Technologies' ? 'perfectus' : 'main',
    graph: entry.org === 'PerfectUs Technologies' ? '| *' : entry.org === 'KeenEye Solutions' ? '|/\n*' : '*',
    highlights: entry.highlights ?? [entry.summary],
  })),
  { org: education.school, hash: careerHash(education.school, education.period),
    message: `BSc Computer Science · ${education.school}`, dates: education.period.replace(' — ', ' → '),
    ref: 'tag: bsc', branch: 'education', graph: '*', highlights: [`${education.degree}, ${education.location}.`] },
];

export const skillBlocks = [
  { label: 'Smart contracts', colour: '#FFC93C', icon: 'blocks', tilt: -2 },
  { label: 'Data pipelines', colour: '#0FA3A3', icon: 'database', tilt: 2 },
  { label: 'Maps & geo', colour: '#3DBE6B', icon: 'map', tilt: -1 },
  { label: 'On-device ML', colour: '#FF7EB6', icon: 'brain-circuit', tilt: 3 },
  { label: 'Web & mobile apps', colour: '#FF8A3D', icon: 'smartphone', tilt: -2 },
  { label: 'ESP32 hardware', colour: '#EE5148', icon: 'cpu', tilt: 1 },
  { label: 'Teams of 50+', colour: '#FFFDF8', icon: 'users', tilt: -3 },
] as const;

const sentences = summary.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map(sentence => sentence.trim()) ?? [summary];
export const bioParagraphs = [sentences.slice(0, 2).join(' '), sentences.slice(2).join(' ')];
export const bioNotes = [
  { text: `${highlights[0]!.value} years shipping software`, tilt: -3 },
  { text: `${highlights[1]!.value} engineers led`, tilt: 2 },
  { text: `${highlights[2]!.value} smart contracts, ${highlights[3]!.value} critical incidents`, tilt: -1.5 },
];
export const nowNote = { items: now.items.slice(0, 3), updated: now.updated,
  label: `updated ${new Date(`${now.updated}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep')}` };

export const heatColours = ['#F3E9D6', '#FFE6D3', '#FFB27A', '#FF8A3D', '#E8453C', '#1B1530'] as const;
export const activityUnavailable = "GitHub didn't answer when this site was built. The terrain will be back after the next deploy.";
export function storyActivity(activity: ClientActivity) {
  if (!activity.available) return null;
  const levels = heatLevels(activity.counts);
  return {
    summary: activitySummary(activity),
    tiles: [
      { label: 'Contributions this year', value: activity.total },
      { label: 'Active days', value: activity.activeDays },
      { label: 'Longest streak', value: activity.longestStreak },
      ...(activity.stars === null ? [] : [{ label: 'Stars', value: activity.stars }]),
    ],
    cells: Array.from({ length: 53 * 7 }, (_, index) => ({
      x: Math.floor(index / 7) * 15, y: index % 7 * 15,
      fill: heatColours[levels[index] ?? 0] ?? heatColours[0],
      label: (activity.counts[index] ?? -1) < 0 ? 'Outside the contribution calendar.' : describeDay(activity, index),
    })),
  };
}

export { getArchive as storyArchive } from './client-data';
