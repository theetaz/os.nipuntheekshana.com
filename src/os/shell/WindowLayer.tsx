import { useAtomValue } from 'jotai';
import { desktopAtom } from '../state/atoms';
import { Window } from './Window';
export function WindowLayer({ mode = 'desktop' }: { mode?: 'desktop' | 'mobile' }) {
  const state = useAtomValue(desktopAtom);
  return <>{state.order.filter(id => mode === 'desktop' || id === state.focusedId).map((id, index) =>
    <Window key={id} windowId={id} mode={mode} zIndex={30 + index} />)}</>;
}
