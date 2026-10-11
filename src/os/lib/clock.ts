import { COLOMBO_TIME_ZONE } from './colombo-time';

export function clockText(date: Date, locale?: string, colombo = false): string {
  const options = colombo ? { timeZone: COLOMBO_TIME_ZONE } : {};
  const day = new Intl.DateTimeFormat(locale, { ...options, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  const time = new Intl.DateTimeFormat(locale, { ...options, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${colombo ? 'LK ' : ''}${day}  ${time}`;
}
export function nextMinuteDelay(timestamp: number): number { return 60_000 - ((timestamp % 60_000 + 60_000) % 60_000); }
