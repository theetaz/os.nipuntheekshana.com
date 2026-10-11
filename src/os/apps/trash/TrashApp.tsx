import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useStore } from 'jotai';
import type { AppProps } from '../../registry/apps';
import { koodaEmptyAtom } from '../../state/atoms';
import { alert, announce, useAppCommands, useAppMenuState } from '../../wm/commands';
import { items, type TrashItem } from './items';
import { EMPTY_COMMAND } from './menus';
import { TrashView } from './views/TrashView';

export { menus } from './menus';

export default function TrashApp({ windowId, initialData, ready, scrollRootRef }: AppProps) {
  const store = useStore();
  const empty = useAtomValue(koodaEmptyAtom);
  const [note, setNote] = useState<TrashItem | null>(null);
  const confirming = useRef(false);
  const readyCalled = useRef(false);
  const data = initialData as { items?: readonly TrashItem[] } | null;
  const contents = data?.items ?? items;
  const menuState = useMemo(() => ({ [EMPTY_COMMAND]: { disabled: empty || !!note } }), [empty, note]);

  useLayoutEffect(() => {
    if (!readyCalled.current) { readyCalled.current = true; ready(); }
  }, [ready]);
  useLayoutEffect(() => { if (empty) setNote(null); }, [empty]);

  const emptyKooda = async () => {
    if (store.get(koodaEmptyAtom) || confirming.current) return;
    confirming.current = true;
    try {
      const result = await alert({ windowId, title: 'Empty Kooda?',
        body: 'Nothing here is really deleted. These are just jokes.', primary: 'Empty', cancel: 'Cancel' });
      if (result === 'primary') {
        store.set(koodaEmptyAtom, true);
        announce('Kooda is empty.');
      }
    } finally { confirming.current = false; }
  };
  useAppCommands(windowId, command => {
    if (command !== EMPTY_COMMAND) return false;
    if (!note) void emptyKooda();
    return true;
  });
  useAppMenuState(windowId, menuState);

  return <TrashView items={contents} empty={empty} note={note} onOpen={setNote}
    onCloseNote={() => setNote(null)} onEmpty={() => { void emptyKooda(); }} scrollRootRef={scrollRootRef} />;
}
