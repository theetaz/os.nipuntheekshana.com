// Ported from nipuntheekshana.com/src/lib/github.ts @ 64482c5325ceace12c645d1ac5ca211cece46445
// Build-time GitHub stats. Any failure (rate limit, offline build) falls back to
// null so the page simply omits the number instead of breaking the build.
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

const DAY_MS = 86_400_000;

async function fetchContributions(user: string): Promise<Contributions | null> {
  const response = await fetch(`https://github.com/users/${user}/contributions`, {
    headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  const html = await response.text();

  const cells = new Map<string, { date: string; day: number; week: number }>();
  for (const [tag] of html.matchAll(/<td[^>]*ContributionCalendar-day[^>]*>/g)) {
    const id = tag.match(/id="(contribution-day-component-(\d+)-(\d+))"/);
    const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
    if (id && date) cells.set(id[1]!, { date: date[1]!, day: Number(id[2]), week: Number(id[3]) });
  }
  if (cells.size === 0) return null;

  const tips = new Map<string, number>();
  for (const [, id, text] of html.matchAll(/<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const count = text!.match(/^([\d,]+) contributions?/);
    tips.set(id!, count ? Number(count[1]!.replace(/,/g, '')) : 0);
  }

  const weeks = Math.max(...[...cells.values()].map((c) => c.week)) + 1;
  const counts: number[] = Array(weeks * 7).fill(-1);
  let start = '';
  let total = 0;
  for (const [id, cell] of cells) {
    const count = tips.get(id) ?? 0;
    counts[cell.week * 7 + cell.day] = count;
    total += count;
    if (!start) {
      const first = Date.parse(`${cell.date}T00:00:00Z`) - (cell.week * 7 + cell.day) * DAY_MS;
      start = new Date(first).toISOString().slice(0, 10);
    }
  }
  return { start, weeks, counts, total };
}

let contributions: Promise<Contributions | null> | undefined;

export function getContributions(user = 'theetaz'): Promise<Contributions | null> {
  contributions ??= fetchContributions(user).catch(() => null);
  return contributions;
}
