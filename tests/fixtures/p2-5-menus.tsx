import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Provider, useAtomValue } from 'jotai';
import { APPS } from '../../src/os/registry/apps';
import type { AppProps } from '../../src/os/registry/apps';
import { createOsStore, registerStore } from '../../src/os/state/store';
import { desktopAtom, spotlightOpenAtom, toastsAtom, alertsAtom } from '../../src/os/state/atoms';
import { openApp, useAppCommands, useAppMenuState } from '../../src/os/wm/commands';
import { MenuBar } from '../../src/os/shell/MenuBar';
import { MenuHost } from '../../src/os/shell/MenuHost';

function TestApp({ windowId }: Pick<AppProps, 'windowId'>) {
  const [checked, setChecked] = useState(false); const [command, setCommand] = useState('None');
  useAppCommands(windowId, command => {
    if (command === 'projects.toggle') { setChecked(value => !value); setCommand(command); return true; }
    if (command === 'projects.disabled') { setCommand(command); return true; } return false;
  });
  const state = useMemo(() => ({ 'projects.toggle': { checked }, 'projects.disabled': { disabled: true } }), [checked]);
  useAppMenuState(windowId, state);
  return <output data-testid="app-command">{command}</output>;
}
function StateSnapshot() {
  const desktop = useAtomValue(desktopAtom); const spotlight = useAtomValue(spotlightOpenAtom);
  const toasts = useAtomValue(toastsAtom); const alerts = useAtomValue(alertsAtom);
  const focused = desktop.focusedId ? desktop.windows[desktop.focusedId] : undefined;
  return <><output data-testid="focused-section">{focused?.query.section ?? ''}</output>
    <output data-testid="spotlight-open">{String(spotlight)}</output>
    <output data-testid="toast-title">{toasts.at(-1)?.title}</output>
    <output data-testid="alert-body">{alerts.at(-1)?.body}</output></>;
}
export default function MenuFixture() {
  const [store] = useState(createOsStore); const original = useRef(APPS.projects.load);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const cleanup = registerStore(store);
    APPS.projects.load = async () => ({ default: TestApp, menus: { view: [
      { kind: 'item', label: 'Live option', command: 'projects.toggle', role: 'checkbox' },
      { kind: 'item', label: 'Unavailable action', command: 'projects.disabled' },
    ] } });
    openApp('projects'); setReady(true);
    return () => { APPS.projects.load = original.current; cleanup(); };
  }, [store]);
  return <Provider store={store}>{ready && <><MenuBar home={{ nowItems: ['One', 'Two', 'Three', 'Four'], nowUpdated: '2026-10-11' }} />
    <MenuHost /><main style={{ padding: 80 }}><TestApp windowId="projects" /><StateSnapshot />
      <button type="button" onClick={() => { store.set(desktopAtom, { type: 'OPEN', appId: 'terminal' }); }}>Focus another app</button>
    </main></>}</Provider>;
}
