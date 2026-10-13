import { cloneElement, useEffect, useRef, useState } from 'react';
import { Provider, useAtomValue } from 'jotai';
import { LazyMotion, MotionConfig } from 'motion/react';
import { createOsStore, registerStore } from '../../../src/os/state/store';
import { desktopAtom, koodaEmptyAtom, motionPrefAtom, mochiPrefsAtom, systemReducedMotionAtom } from '../../../src/os/state/atoms';
import { alert, announce, openContextMenu, openQuickLook, toast } from '../../../src/os/wm/commands';
import { Spotlight } from '../../../src/os/shell/Spotlight';
import { QuickLook } from '../../../src/os/shell/QuickLook';
import { Alerts } from '../../../src/os/shell/Alerts';
import { Toasts } from '../../../src/os/shell/Toasts';
import { ContextMenuHost } from '../../../src/os/shell/ContextMenuHost';
import { LiveRegion } from '../../../src/os/shell/LiveRegion';
import { APP_ICON_SYMBOLS } from '../../../src/os/icons/app-icons';
const features = () => import('../../../src/os/lib/motion-features').then(module => module.default);

function Controls() {
  const [result, setResult] = useState('pending'); const sequence = useRef(0);
  const mochi = useAtomValue(mochiPrefsAtom); const empty = useAtomValue(koodaEmptyAtom);
  return <main className="p2-8-fixture" style={{ padding: 32 }}><h1>Overlay interaction fixture</h1>
    <button type="button" onClick={() => toast({ title: `Notice ${++sequence.current}` })}>Add toast</button>
    <button type="button" onClick={() => toast({ title: 'Saved', action: { label: 'Undo changes', run: () => announce('Changes undone') } })}>Action toast</button>
    <button type="button" onClick={() => { setResult('pending'); void alert({ title: 'Continue?', body: 'Confirm the next action.', primary: 'Continue' }).then(setResult); }}>System alert</button>
    <button type="button" onClick={() => { setResult('pending'); void alert({ windowId: 'projects', title: 'Delete screenshot?', primary: 'Delete', danger: true }).then(setResult); }}>Window sheet</button>
    <button type="button" onClick={() => { setResult('pending'); void alert({ title: 'First alert', primary: 'First' }).then(value => setResult(`first:${value}`));
      void alert({ title: 'Second alert', primary: 'Second' }).then(value => setResult(`second:${value}`)); }}>Queue alerts</button>
    <button type="button" onClick={() => openContextMenu({ x: innerWidth - 4, y: innerHeight - 4, target: 'Fixture', items: [
      { kind: 'item', label: 'Show Mochi', command: 'desktop.mochi', role: 'checkbox' },
      { kind: 'item', label: 'Open Now', command: 'go.now' },
    ] })}>Context menu</button>
    <button type="button" style={{ position: 'fixed', bottom: 100, left: 40, width: 100, height: 60 }} onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      openQuickLook({ slug: 'salli', index: 0, from: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
    }}>Preview screenshot</button>
    <p data-testid="alert-result">{result}</p><p data-testid="mochi-visible">{String(mochi.visible)}</p><p data-testid="empty">{String(empty)}</p>
  </main>;
}

export default function Overlays() {
  const [store] = useState(createOsStore); const [ready, setReady] = useState(false);
  useEffect(() => {
    const unregister = registerStore(store);
    store.set(systemReducedMotionAtom, matchMedia('(prefers-reduced-motion: reduce)').matches);
    store.set(motionPrefAtom, 'system');
    store.set(desktopAtom, { type: 'VIEWPORT', viewport: { w: innerWidth, h: innerHeight } });
    store.set(desktopAtom, { type: 'OPEN', appId: 'projects', route: 'salli', rect: { x: 200, y: 100, w: 800, h: 600 } });
    setReady(true); return unregister;
  }, [store]);
  return <Provider store={store}><LazyMotion features={features} strict><MotionConfig reducedMotion="user">
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>{Object.entries(APP_ICON_SYMBOLS).map(([id, symbol]) => cloneElement(symbol, { key: id }))}</svg>
    <div data-overlay-fixture-ready={ready}><Controls /></div>
    <Spotlight /><QuickLook /><Alerts /><Toasts /><ContextMenuHost /><LiveRegion />
  </MotionConfig></LazyMotion></Provider>;
}
