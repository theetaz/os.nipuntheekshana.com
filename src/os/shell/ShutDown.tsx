import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useAtomValue, useStore } from 'jotai';
import { bootPhaseAtom, overlayAtom, reducedMotionAtom } from '../state/atoms';
import { usePowerOverlay } from './BootController';

export function ShutDown() {
  const store = useStore(); const overlay = useAtomValue(overlayAtom);
  const reduce = useAtomValue(reducedMotionAtom);
  const panel = useRef<HTMLDivElement>(null); const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const active = mounted && overlay === 'shutdown';
  const turnOn = useCallback(() => {
    // Complete focus/inert cleanup before the imperative boot overlay takes over.
    flushSync(() => store.set(overlayAtom, 'none'));
    store.set(bootPhaseAtom, 'running');
  }, [store]);
  usePowerOverlay(panel, active, turnOn);
  if (!active) return null;
  return createPortal(<div ref={panel} className="power-screen shutdown-screen os-chrome" role="dialog" aria-modal="true"
    aria-labelledby="shutdown-title" aria-describedby="shutdown-hint" tabIndex={-1} data-reduced-motion={reduce || undefined}>
    <div className="shutdown-copy"><h1 id="shutdown-title">It's now safe to close this tab.</h1>
      <button className="power-return" id="shutdown-hint" onClick={turnOn}>Or press any key to switch it back on.</button>
    </div>
  </div>, document.body);
}
