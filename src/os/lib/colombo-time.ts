export const COLOMBO_TIME_ZONE = 'Asia/Colombo';
/** Return local calendar fields, without pretending a wall-clock value is an instant. */
export function colomboNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: COLOMBO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const field = (name: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === name)?.value);
  return { year: field('year'), month: field('month'), day: field('day'),
    hour: field('hour'), minute: field('minute'), second: field('second') };
}
export function formatColombo(date: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: COLOMBO_TIME_ZONE }).format(date);
}
export function nipunStatusLine(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Hour must be 0–23');
  if (hour < 6) return 'Nipun is probably asleep.';
  if (hour < 9) return 'Nipun is probably on his bike.';
  if (hour >= 12 && hour < 14) return 'Nipun is probably at lunch. Rice and curry, likely.';
  if (hour < 19) return 'Nipun is probably at his desk.';
  return 'Nipun is probably shipping something.';
}
