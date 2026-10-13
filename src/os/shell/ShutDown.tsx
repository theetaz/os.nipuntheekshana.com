import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useAtomValue, useStore } from 'jotai';
import { bootPhaseAtom, overlayAtom, reducedMotionAtom } from '../state/atoms';
import { usePowerOverlay } from './BootController';

export function ShutDown() {
  const store = useStore(); const overlay = useAtomValue(overlayAtom);
  const reduce = useAtomValue(reducedMotionAtom);
  const panel = useRef<HTMLDivElement>(null); const [mounted, setMounted] = useState(false);
  const releaseChord = useRef<(() => void) | undefined>(undefined);
  useEffect(() => { setMounted(true); return () => releaseChord.current?.(); }, []);
  const active = mounted && overlay === 'shutdown';
  const turnOn = useCallback((event?: Event) => {
    // A modifier wakes the screen before the rest of its chord arrives. Consume
    // that chord across the deferred controller handoff, through modifier release.
    if (event instanceof KeyboardEvent && ['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) {
      releaseChord.current?.();
      const release = () => {
        window.removeEventListener('keydown', capture, true); window.removeEventListener('keyup', capture, true);
        window.removeEventListener('blur', release); releaseChord.current = undefined;
      };
      const capture = (next: KeyboardEvent) => {
        if (next.cancelable) next.preventDefault(); next.stopImmediatePropagation();
        if (next.type === 'keyup' && !next.ctrlKey && !next.altKey && !next.metaKey && !next.shiftKey) release();
      };
      releaseChord.current = release;
      window.addEventListener('keydown', capture, { capture: true, passive: false });
      window.addEventListener('keyup', capture, { capture: true, passive: false }); window.addEventListener('blur', release);
    }
    // Complete focus/inert cleanup before the imperative boot overlay takes over.
    flushSync(() => store.set(overlayAtom, 'none'));
    store.set(bootPhaseAtom, 'running');
  }, [store]);
  usePowerOverlay(panel, active, turnOn);
  if (!active) return null;
  return createPortal(<div ref={panel} className="power-screen shutdown-screen os-chrome" role="dialog" aria-modal="true"
    aria-labelledby="shutdown-title" aria-describedby="shutdown-hint" tabIndex={-1} data-reduced-motion={reduce || undefined}>
    <div className="shutdown-copy"><h1 id="shutdown-title">It's now safe to close this tab.</h1>
      <button className="power-return" id="shutdown-hint" onClick={() => turnOn()}>Or press any key to switch it back on.</button>
    </div>
  </div>, document.body);
}
