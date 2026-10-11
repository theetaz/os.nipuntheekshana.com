import type { RefObject } from 'react';
import { colomboNow, formatColombo, nipunStatusLine } from '../lib/colombo-time';
import { Popover } from '../ui/Popover';

export { clockText, nextMinuteDelay } from '../lib/clock';
export function ClockPopover({ open, date, locale, anchorRef, onClose }: {
  open: boolean; date: Date | null; locale?: string; anchorRef: RefObject<HTMLButtonElement | null>; onClose(): void;
}) {
  return <Popover id="clock-popover" open={open} anchorRef={anchorRef} onClose={onClose} label="Clock" style={{ width: 300 }}>
    {date && <>
      <p className="mb-2 text-ui-strong">{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}</p>
      <p className="text-ui"><span className="tabular-nums">{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)}</span>
        <span className="ml-2 text-ink-2">where you are</span></p>
      <hr className="my-3 border-line" />
      <p className="text-ui"><span className="tabular-nums">{formatColombo(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span>
        <span className="ml-2 text-ink-2">in Colombo (UTC+05:30)</span></p>
      <p className="mt-2 text-caption text-ink-2">{nipunStatusLine(colomboNow(date).hour)}</p>
    </>}
  </Popover>;
}
