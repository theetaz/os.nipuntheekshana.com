import { describe, expect, it } from 'vitest';
import { colomboNow, formatColombo, nipunStatusLine } from '../../src/os/lib/colombo-time';
describe('Colombo time', () => {
  it.each([
    [0, 'Nipun is probably asleep.'], [6, 'Nipun is probably on his bike.'],
    [9, 'Nipun is probably at his desk.'], [12, 'Nipun is probably at lunch. Rice and curry, likely.'],
    [14, 'Nipun is probably at his desk.'], [19, 'Nipun is probably shipping something.'],
    [23, 'Nipun is probably shipping something.'],
  ])('uses the specified copy at hour %i', (hour, line) => expect(nipunStatusLine(hour as number)).toBe(line));
  it('handles half-hour offset and date rollover regardless of host timezone', () => {
    expect(colomboNow(new Date('2026-10-11T20:45:12Z'))).toEqual({ year: 2026, month: 10, day: 12, hour: 2, minute: 15, second: 12 });
    expect(formatColombo(new Date('2026-10-11T17:41:00Z'), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).toBe('23:11');
    expect(colomboNow(new Date('2026-10-11T18:30:00Z')).hour).toBe(0);
  });
  it.each([-1, 24, 1.5, NaN])('rejects invalid hour %s', hour => expect(() => nipunStatusLine(hour)).toThrow(RangeError));
});
