/** @typedef {{ start: string, weeks: number, counts: number[], total: number }} Contributions */
const DAY_MS = 86_400_000;

/** Reject incomplete years, interior holes, malformed counts and inconsistent totals. */
export function isCompleteCalendar(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.start) || !Number.isFinite(Date.parse(data.start))
    || new Date(`${data.start}T00:00:00Z`).getUTCDay() !== 0
    || !Number.isInteger(data.weeks) || data.weeks < 52 || data.weeks > 54
    || !Array.isArray(data.counts) || data.counts.length !== data.weeks * 7
    || !data.counts.every(count => Number.isSafeInteger(count) && count >= -1)) return false;
  const first = data.counts.findIndex(count => count >= 0);
  const last = data.counts.findLastIndex(count => count >= 0);
  const days = last - first + 1;
  return first >= 0 && first < 7 && data.counts.length - last - 1 < 7
    && days >= 365 && days <= 366
    && data.counts.slice(first, last + 1).every(count => count >= 0)
    && data.total === data.counts.reduce((sum, count) => sum + Math.max(0, count), 0);
}

/** GitHub's profile fragment has one dated cell and one explicit tooltip per day. */
export function parseContributionCalendar(html) {
  const cells = new Map();
  for (const [tag] of html.matchAll(/<td[^>]*ContributionCalendar-day[^>]*>/g)) {
    const id = tag.match(/id="(contribution-day-component-(\d+)-(\d+))"/);
    const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
    if (!id || !date || cells.has(id[1]) || Number(id[2]) > 6) return null;
    cells.set(id[1], { date: date[1], day: Number(id[2]), week: Number(id[3]) });
  }
  if (!cells.size) return null;
  const tips = new Map();
  for (const [, id, text] of html.matchAll(/<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const count = text.match(/^([\d,]+) contributions?/);
    if (!count && !/^No contributions/.test(text)) return null;
    if (tips.has(id)) return null;
    tips.set(id, count ? Number(count[1].replace(/,/g, '')) : 0);
  }
  const weeks = Math.max(...[...cells.values()].map(cell => cell.week)) + 1;
  if (weeks < 52 || weeks > 54) return null;
  const counts = Array(weeks * 7).fill(-1);
  let startMs;
  let total = 0;
  for (const [id, cell] of cells) {
    const index = cell.week * 7 + cell.day;
    const origin = Date.parse(`${cell.date}T00:00:00Z`) - index * DAY_MS;
    startMs ??= origin;
    if (!Number.isFinite(origin) || origin !== startMs || !tips.has(id) || counts[index] !== -1) return null;
    counts[index] = tips.get(id);
    total += counts[index];
  }
  const result = { start: new Date(startMs).toISOString().slice(0, 10), weeks, counts, total };
  return isCompleteCalendar(result) ? result : null;
}

/** The original fetch date survives fallback so the UI tells the truth about age. */
export function selectActivity(contributions, stars, snapshot, fetchedAt) {
  if (!isCompleteCalendar(snapshot)) throw new Error('Invalid committed activity snapshot.');
  if (!isCompleteCalendar(contributions) || contributions.total < snapshot.total * 0.5) return snapshot;
  return { ...contributions, stars, fetchedAt };
}
