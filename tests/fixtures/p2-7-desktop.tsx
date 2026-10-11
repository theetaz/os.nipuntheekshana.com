import { useEffect, useState } from 'react';
import { Provider, useAtomValue, useStore } from 'jotai';
import { contextMenuAtom, desktopAtom, mochiPrefsAtom, showWidgetsAtom } from '../../src/os/state/atoms';
import { getStore, type OsStore } from '../../src/os/state/store';
import { runCommand } from '../../src/os/wm/commands';
import { Menu } from '../../src/os/ui/Menu';

// P2-8 owns the production host. This fixture verifies P2-7's menu handoff with the shared primitive.
function MenuConsumer() {
  const store = useStore(); const spec = useAtomValue(contextMenuAtom);
  const widgets = useAtomValue(showWidgetsAtom); const mochi = useAtomValue(mochiPrefsAtom);
  const desktop = useAtomValue(desktopAtom);
  return <><output hidden data-desktop-state>{JSON.stringify(desktop)}</output>{spec && <Menu label={spec.target === 'desktop' ? 'Desktop actions' : 'Desktop icon actions'}
    items={spec.items} point={spec} onClose={() => store.set(contextMenuAtom, null)}
    getItemState={command => ({ checked: command === 'desktop.widgets' ? widgets : command === 'desktop.mochi' ? mochi.visible : undefined })}
    onCommand={command => runCommand(command, 'menu')} />}</>;
}
export default function DesktopMenuFixture() {
  const [store, setStore] = useState<OsStore | null>(null);
  useEffect(() => {
    const connect = () => { if (document.documentElement.classList.contains('os-ready')) setStore(getStore()); };
    const observer = new MutationObserver(connect); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    connect(); return () => observer.disconnect();
  }, []);
  return store && <Provider store={store}><MenuConsumer /><span data-desktop-menu-fixture hidden /></Provider>;
}
