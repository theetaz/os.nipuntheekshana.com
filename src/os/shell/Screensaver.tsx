import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useStore } from 'jotai';
import { alertsAtom, bootPhaseAtom, contextMenuAtom, openMenuAtom, overlayAtom, reducedMotionAtom,
  spotlightOpenAtom, viewAtom } from '../state/atoms';
import islandMask from '../../assets/wallpapers/island-mask.svg?raw';
import { formatColombo } from '../lib/colombo-time';
import { usePowerOverlay } from './BootController';

export const SCREENSAVER_IDLE_MS = 5 * 60 * 1000;
const nightMailMask = `url("data:image/svg+xml,${encodeURIComponent(islandMask.trim())}")`;

export function Screensaver() {
  const store = useStore(); const overlay = useAtomValue(overlayAtom);
  const reduce = useAtomValue(reducedMotionAtom);
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false); const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false); const [clock, setClock] = useState('');
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = mounted && overlay === 'screensaver';
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let remaining = SCREENSAVER_IDLE_MS; let deadline = performance.now() + remaining;
    const allowed = () => !document.hidden && store.get(viewAtom) !== 'simple'
      && store.get(overlayAtom) === 'none' && store.get(bootPhaseAtom) === 'off'
      && !store.get(alertsAtom).length && !store.get(openMenuAtom) && !store.get(contextMenuAtom)
      && !store.get(spotlightOpenAtom);
    const schedule = () => {
      if (!allowed() || timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!allowed()) return;
        remaining = Math.max(0, deadline - performance.now());
        if (remaining) schedule(); else store.set(overlayAtom, 'screensaver');
      }, Math.max(0, deadline - performance.now()));
    };
    const reset = () => { remaining = SCREENSAVER_IDLE_MS; deadline = performance.now() + remaining; schedule(); };
    const changed = () => { clearTimeout(timer); timer = undefined; reset(); };
    const visibility = () => {
      if (document.hidden) { remaining = Math.max(0, deadline - performance.now()); clearTimeout(timer); timer = undefined; }
      else { deadline = performance.now() + remaining; schedule(); }
    };
    const events = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'scroll', 'input'] as const;
    for (const event of events) document.addEventListener(event, reset, { capture: true, passive: true });
    document.addEventListener('visibilitychange', visibility);
    const cleanups = [overlayAtom, bootPhaseAtom, viewAtom, alertsAtom, openMenuAtom, contextMenuAtom, spotlightOpenAtom]
      .map(value => store.sub(value, changed));
    schedule();
    return () => {
      clearTimeout(timer); cleanups.forEach(cleanup => cleanup());
      for (const event of events) document.removeEventListener(event, reset, true);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [store]);
  useEffect(() => {
    if (!active) { clearTimeout(wakeTimer.current); wakeTimer.current = undefined; setExiting(false); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer); setPaused(document.hidden);
      if (document.hidden) return;
      setClock(formatColombo(new Date(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
      timer = setTimeout(update, 60_000 - Date.now() % 60_000);
    };
    update(); document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, [active]);
  useEffect(() => () => clearTimeout(wakeTimer.current), []);
  const wake = useCallback(() => {
    if (wakeTimer.current !== undefined) return;
    setExiting(true);
    wakeTimer.current = setTimeout(() => {
      wakeTimer.current = undefined;
      if (store.get(overlayAtom) === 'screensaver') store.set(overlayAtom, 'none');
    }, store.get(reducedMotionAtom) ? 120 : 300);
  }, [store]);
  usePowerOverlay(panel, active, wake);
  if (!active) return null;
  return createPortal(<div ref={panel} className="power-screen screensaver os-chrome" role="dialog" aria-modal="true"
    aria-label="Night Mail screensaver" aria-describedby="screensaver-hint" tabIndex={-1}
    data-exiting={exiting || undefined} data-paused={paused || undefined} data-reduced-motion={reduce || undefined}>
    <div className="screensaver-island" style={{ maskImage: nightMailMask }} aria-hidden="true" />
    <div className="screensaver-clock"><time aria-live="off">{clock}</time><p>in Colombo</p></div>
    <div className="screensaver-mochi" role="img" aria-label="Mochi asleep">
      <span aria-hidden="true">z z z</span>
      <svg width="88" height="56" viewBox="0 0 88 56" aria-hidden="true"><path d="M14 39C9 27 13 19 19 15L17 4L32 13C43 9 53 12 59 20C76 18 83 26 81 38C87 37 87 47 77 49H22C11 49 5 47 7 41Z" fill="#F3EFE8" /><path d="M23 28q4 4 8 0m9 0q4 4 8 0M30 37q5 3 9 0" fill="none" stroke="#0B0F14" strokeWidth="2" strokeLinecap="round" /></svg>
    </div>
    <button className="power-return" id="screensaver-hint" onClick={wake}>Press any key or tap to wake.</button>
  </div>, document.body);
}
