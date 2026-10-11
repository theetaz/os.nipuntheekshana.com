import { useEffect, useRef, useState } from 'react';
import { Provider, useAtomValue, useStore } from 'jotai';
import { createOsStore, historyStore, registerStore } from '../../../src/os/state/store';
import { alertsAtom, bootPhaseAtom, desktopAtom, modeAtom, motionPrefAtom, overlayAtom, spotlightOpenAtom,
  systemDarkAtom, systemReducedMotionAtom, viewAtom } from '../../../src/os/state/atoms';
import { subscribePreferences } from '../../../src/os/state/prefs';
import { subscribeHistory } from '../../../src/os/url/history';
import { openApp, registerBeforeClose, resolveAlert, runCommand } from '../../../src/os/wm/commands';
import { BootController } from '../../../src/os/shell/BootController';
import { Screensaver } from '../../../src/os/shell/Screensaver';
import { ShutDown } from '../../../src/os/shell/ShutDown';
import { WindowLayer } from '../../../src/os/shell/WindowLayer';
import { subscribeHotkeys } from '../../../src/os/shell/Hotkeys';
import { MODE_QUERY } from '../../../src/os/shell/ModeSwitch';
import { Menu } from '../../../src/os/ui/Menu';

// P2-5's menu and P2-8's alert hosts are independent stubs on the task base.
// These test-only adapters exercise the real commands/store and power components.
function Harness() {
  const store = useStore(); const alerts = useAtomValue(alertsAtom); const view = useAtomValue(viewAtom);
  const [menu, setMenu] = useState(false); const anchor = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = [
      ['(prefers-reduced-motion: reduce)', systemReducedMotionAtom], ['(prefers-color-scheme: dark)', systemDarkAtom],
    ] as const;
    const mediaCleanups = media.map(([query, value]) => {
      const match = matchMedia(query); const update = () => store.set(value, match.matches);
      update(); match.addEventListener('change', update); return () => match.removeEventListener('change', update);
    });
    const mode = matchMedia(MODE_QUERY); store.set(modeAtom, mode.matches ? 'mobile' : 'desktop');
    const removals = [registerStore(store), subscribePreferences(store, document.documentElement),
      subscribeHistory(historyStore(store), window, history), subscribeHotkeys(document, 'linux')];
    const closed: { id: string; at: number }[] = [];
    const removeLog = store.sub(desktopAtom, () => {
      for (const [id, win] of Object.entries(store.get(desktopAtom).windows)) {
        if (win.closing && !closed.some(value => value.id === id)) closed.push({ id, at: performance.now() });
      }
    });
    Object.assign(window, { powerFixture: {
      closed, setMotion: (value: 'system' | 'reduce' | 'full') => store.set(motionPrefAtom, value),
      setView: (value: 'desktop' | 'simple') => store.set(viewAtom, value),
      phase: () => store.get(bootPhaseAtom), overlay: () => store.get(overlayAtom), spotlight: () => store.get(spotlightOpenAtom),
      guard: () => registerBeforeClose(store, 'projects', async () => false),
    } });
    document.documentElement.classList.add('os-ready');
    return () => { removeLog(); removals.reverse().forEach(remove => remove()); mediaCleanups.forEach(remove => remove()); };
  }, [store]);
  return <><main id="fixture-desktop"><h1>Power verification desktop</h1>
    <button ref={anchor} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(true)}>Island menu</button>
    <button onClick={() => openApp('projects')}>Open Projects</button><button onClick={() => openApp('terminal')}>Open Terminal</button>
    <button onClick={() => runCommand('os.spotlight', 'shortcut')}>Open Spotlight</button>
  </main>
    <Menu open={menu} label="Island menu" anchorRef={anchor} onClose={() => { setMenu(false); anchor.current?.focus(); }}
      onCommand={command => runCommand(command, 'menu')} items={[
        { kind: 'item', label: 'Sleep', command: 'os.sleep' },
        { kind: 'item', label: 'Restart…', command: 'os.restart' },
        { kind: 'item', label: 'Shut down…', command: 'os.shutdown' },
      ]} />
    {alerts.map(spec => <section key={spec.id} role="alertdialog" aria-modal="true" aria-label={spec.title}
      style={{ position: 'fixed', inset: '30% 30% auto', zIndex: 80, padding: 24, background: 'var(--os-window)' }}>
      <h2>{spec.title}</h2><p>{spec.body}</p><button onClick={() => resolveAlert(spec.id!, 'primary')}>{spec.primary}</button>
      <button onClick={() => resolveAlert(spec.id!, 'cancel')}>Cancel</button>
    </section>)}
    <WindowLayer />{view !== 'simple' && <><BootController /><Screensaver /><ShutDown /></>}
  </>;
}
export default function PowerHarness() {
  const [store] = useState(() => createOsStore());
  return <Provider store={store}><Harness /></Provider>;
}
