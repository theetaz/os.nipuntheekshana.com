import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import type { DesktopProps } from '../Desktop';
import { openMenuAtom, soundAtom, spotlightOpenAtom, themePrefAtom } from '../state/atoms';
import { openApp, toast } from '../wm/commands';
import { isMac } from '../lib/platform';
import { clockText, nextMinuteDelay } from '../lib/clock';
import { statusPopovers } from './deferred-features';

function StatusIcon({ children }: { children: ReactNode }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
export function StatusItems({ home }: { home?: DesktopProps['home'] }) {
  const [open, setOpen] = useAtom(openMenuAtom); const [sound, setSound] = useAtom(soundAtom);
  const [theme, setTheme] = useAtom(themePrefAtom); const setSpotlight = useSetAtom(spotlightOpenAtom);
  const nowAnchor = useRef<HTMLButtonElement | null>(null); const clockAnchor = useRef<HTMLButtonElement | null>(null);
  const [date, setDate] = useState<Date | null>(null); const [locale, setLocale] = useState<string | undefined>();
  const [lk, setLk] = useState(false); const [mac, setMac] = useState(false);
  useEffect(() => {
    setLocale(navigator.language); setMac(isMac());
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { setDate(new Date()); timer = setTimeout(tick, nextMinuteDelay(Date.now())); };
    const resume = () => { if (document.hidden) return; clearTimeout(timer); tick(); };
    tick(); document.addEventListener('visibilitychange', resume);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', resume); };
  }, []);
  const [popoversLoaded, setPopoversLoaded] = useState(false);
  useEffect(() => { if (open === 'status.now' || open === 'status.clock') setPopoversLoaded(true); }, [open]);
  const toggle = (id: string) => setOpen(value => value === id ? null : id);
  return <div className="mb-status" role="group" aria-label="Status">
    <button ref={nowAnchor} type="button" className="mb-status-button" aria-label="What Nipun's up to" title="What Nipun's up to"
      aria-haspopup="dialog" aria-expanded={open === 'status.now'} aria-controls={open === 'status.now' ? 'now-popover' : undefined}
      onClick={() => toggle('status.now')}><span className="mb-now-dot" aria-hidden="true" /></button>
    <button type="button" className="mb-status-button" aria-label={sound ? 'Sound on' : 'Sound off'} title={sound ? 'Sound on' : 'Sound off'}
      aria-pressed={sound} onClick={() => { setOpen(null); setSound(value => !value); }}>
      <StatusIcon><path d="M11 5 6 9H2v6h4l5 4V5z" />{sound ? <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
        : <path d="m22 9-6 6M16 9l6 6" />}</StatusIcon></button>
    <button type="button" className="mb-status-button" aria-label="Appearance" title={`Appearance: ${theme === 'auto' ? 'Automatic' : theme === 'dark' ? 'Dark' : 'Light'}`}
      onClick={event => {
        setOpen(null);
        if (event.altKey) { openApp('settings', { query: { section: 'appearance' } }); return; }
        const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light';
        setTheme(next); toast({ title: `${next === 'auto' ? 'Automatic' : next === 'dark' ? 'Dark' : 'Light'} appearance` });
      }}><StatusIcon><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></StatusIcon></button>
    <button type="button" className="mb-status-button" aria-label="Spotlight" title={`Spotlight (${mac ? '⌘K' : 'Ctrl+K'})`}
      onClick={() => { setOpen(null); setSpotlight(true); }}><StatusIcon><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></StatusIcon></button>
    <button ref={clockAnchor} type="button" className="mb-trigger mb-clock" aria-label={date ? `${clockText(date, locale, lk)}, ${lk ? 'Colombo time' : 'local time'}` : 'Clock'}
      title={`Clock · ${mac ? '⌥' : 'Alt+'}click for Colombo time`} aria-haspopup="dialog" aria-expanded={open === 'status.clock'}
      aria-controls={open === 'status.clock' ? 'clock-popover' : undefined} onClick={event => {
        if (event.altKey) { setLk(value => !value); setOpen(null); } else toggle('status.clock');
      }}><time dateTime={date?.toISOString()}>{date ? clockText(date, locale, lk) : '\u00a0'}</time></button>
    {(open === 'status.now' || open === 'status.clock' || popoversLoaded) && <statusPopovers.Component open={open} home={home} nowAnchor={nowAnchor} clockAnchor={clockAnchor} date={date} locale={locale} onClose={() => setOpen(null)} />}
  </div>;
}
