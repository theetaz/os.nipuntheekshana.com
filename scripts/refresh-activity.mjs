import { readFile, writeFile } from 'node:fs/promises';
import { parseContributionCalendar, selectActivity } from '../src/lib/github-calendar.mjs';

const path = new URL('../src/data/activity-snapshot.json', import.meta.url);
const snapshot = JSON.parse(await readFile(path, 'utf8'));
const response = await fetch('https://github.com/users/theetaz/contributions', {
  headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(8000),
});
if (!response.ok) throw new Error(`GitHub ${response.status}; snapshot unchanged.`);
const contributions = parseContributionCalendar(await response.text());
const next = selectActivity(contributions, snapshot.stars, snapshot, new Date().toISOString());
if (next === snapshot) throw new Error('Incomplete calendar or total below sanity threshold; snapshot unchanged.');
// Stars are optional. Preserve the last value if their API is unavailable.
try {
  const repos = await Promise.all(['users/theetaz/repos?per_page=100&type=owner', 'orgs/prabhavalabs/repos?per_page=100&type=public'].map(async route => {
    const response = await fetch(`https://api.github.com/${route}`, {
      headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    return response.json();
  }));
  next.stars = repos.flat().filter(repo => !repo.fork).reduce((sum, repo) => sum + repo.stargazers_count, 0);
} catch { /* The contribution snapshot can still be refreshed. */ }
await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Activity snapshot refreshed: ${next.total} contributions, fetched ${next.fetchedAt}.`);
