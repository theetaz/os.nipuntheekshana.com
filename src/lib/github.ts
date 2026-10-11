// Ported from nipuntheekshana.com/src/lib/github.ts @ 64482c5325ceace12c645d1ac5ca211cece46445
// Build-time GitHub stats. The activity builder retains a last-good snapshot.
import { parseContributionCalendar } from './github-calendar.mjs';
type Repo = { stargazers_count: number; fork: boolean };

async function fetchRepos(url: string): Promise<Repo[]> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const token = import.meta.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return response.json();
}

let cached: Promise<number | null> | undefined;

export function getTotalStars(): Promise<number | null> {
  cached ??= Promise.all([
    fetchRepos('https://api.github.com/users/theetaz/repos?per_page=100&type=owner'),
    fetchRepos('https://api.github.com/orgs/prabhavalabs/repos?per_page=100&type=public'),
  ])
    .then((lists) =>
      lists
        .flat()
        .filter((repo) => !repo.fork)
        .reduce((sum, repo) => sum + repo.stargazers_count, 0),
    )
    .catch(() => null);
  return cached;
}

// The public contribution calendar for the last year, read from the same HTML
// fragment github.com renders on the profile page. Cells are numbered
// row (weekday, Sunday first) by column (week), so one flat array indexed
// week * 7 + day rebuilds the grid; -1 marks days outside the window.
export type Contributions = {
  start: string;
  weeks: number;
  counts: number[];
  total: number;
};

async function fetchContributions(user: string): Promise<Contributions | null> {
  const response = await fetch(`https://github.com/users/${user}/contributions`, {
    headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return parseContributionCalendar(await response.text());
}

let contributions: Promise<Contributions | null> | undefined;

export function getContributions(user = 'theetaz'): Promise<Contributions | null> {
  contributions ??= fetchContributions(user).catch(() => null);
  return contributions;
}
