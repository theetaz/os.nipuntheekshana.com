import { useEffect } from 'react';
import { getStore } from '../../../src/os/state/store';
import { bootPhaseAtom, desktopAtom, motionPrefAtom, overlayAtom, spotlightOpenAtom, viewAtom } from '../../../src/os/state/atoms';
import { registerBeforeClose, runCommand } from '../../../src/os/wm/commands';

// Observation and guard registration only; all visible UI comes from OsLayout's real island.
export default function PowerHarness() {
  useEffect(() => {
    let off: (() => void) | undefined;
    const connect = () => {
      if (off || !document.documentElement.classList.contains('os-ready')) return;
      const store = getStore();
      const closed: { id: string; at: number }[] = [];
      off = store.sub(desktopAtom, () => {
        for (const [id, win] of Object.entries(store.get(desktopAtom).windows)) {
          if (win.closing && !closed.some(value => value.id === id)) closed.push({ id, at: performance.now() });
        }
      });
      Object.assign(window, { powerFixture: {
        closed, setMotion: (value: 'system' | 'reduce' | 'full') => store.set(motionPrefAtom, value),
        setView: (value: 'desktop' | 'simple') => store.set(viewAtom, value),
        phase: () => store.get(bootPhaseAtom), overlay: () => store.get(overlayAtom), spotlight: () => store.get(spotlightOpenAtom),
        guard: () => registerBeforeClose(store, 'projects', async () => false),
        command: (command: string) => runCommand(command, 'menu'),
      } });
      document.documentElement.dataset.powerProbe = 'ready';
    };
    const observer = new MutationObserver(connect);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    connect();
    return () => { observer.disconnect(); off?.(); delete document.documentElement.dataset.powerProbe; };
  }, []);
  return null;
}
