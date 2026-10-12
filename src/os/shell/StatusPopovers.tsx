import './p2-8-overlays.css';
import type { RefObject } from 'react';
import type { DesktopProps } from '../Desktop';
import { openApp } from '../wm/commands';
import { Popover } from '../ui/Popover';
import { ClockPopover } from './ClockPopover';

export function StatusPopovers({ open, home, nowAnchor, clockAnchor, date, locale, onClose }: {
  open: string | null; home?: DesktopProps['home']; date: Date | null; locale?: string;
  nowAnchor: RefObject<HTMLButtonElement | null>; clockAnchor: RefObject<HTMLButtonElement | null>; onClose(): void;
}) {
  return <><Popover id="now-popover" open={open === 'status.now'} anchorRef={nowAnchor} label="What Nipun's up to" onClose={() => onClose()} style={{ width: 300 }}>
      <h2 className="mb-3 text-title-3">Now</h2>
      <ul className="list-disc space-y-2 pl-4 text-ui">{home?.nowItems.slice(0, 3).map((item, index) => <li key={index}>{item}</li>)}</ul>
      <button type="button" className="mt-3 text-ui-strong text-accent-ink" onClick={() => { onClose(); openApp('now'); }}>Open Now ›</button>
    </Popover>
    <ClockPopover open={open === 'status.clock'} anchorRef={clockAnchor} date={date} locale={locale} onClose={() => onClose()} /></>;
}
