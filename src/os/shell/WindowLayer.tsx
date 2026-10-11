import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { focusedIdAtom, orderAtom } from '../state/atoms';
import { trackWindowLaunches, Window } from './Window';
import { SnapPreview } from './SnapPreview';
import './p2-4-window-system.css';

export function WindowLayer({ mode = 'desktop' }: { mode?: 'desktop' | 'mobile' }) {
  useEffect(() => trackWindowLaunches(document), []);
  const order = useAtomValue(orderAtom); const focusedId = useAtomValue(focusedIdAtom);
  return <div className="window-layer" data-window-layer={mode}>
    {mode === 'desktop' && <SnapPreview zIndex={Math.max(1, order.indexOf(focusedId ?? '') * 2 + 1)} />}
    {order.filter(id => mode === 'desktop' || id === focusedId).map(id =>
      <Window key={id} windowId={id} mode={mode} zIndex={order.indexOf(id) * 2 + 2} />)}
  </div>;
}
