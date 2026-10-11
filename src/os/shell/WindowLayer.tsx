import { useAtomValue } from 'jotai';
import { focusedIdAtom, orderAtom } from '../state/atoms';
import { Window } from './Window';
import { SnapPreview } from './SnapPreview';
import type { WindowId } from '../wm/types';
import './p2-4-window-system.css';

export interface WindowLayerProps { mode?: 'desktop' | 'mobile'; windowId?: WindowId }
export function WindowLayer({ mode = 'desktop', windowId }: WindowLayerProps) {
  const order = useAtomValue(orderAtom); const focusedId = useAtomValue(focusedIdAtom);
  const visible = windowId ? [windowId] : order.filter(id => mode === 'desktop' || id === focusedId);
  return <div className="window-layer" data-window-layer={mode}>
    {mode === 'desktop' && <SnapPreview zIndex={Math.max(1, order.indexOf(focusedId ?? '') * 2 + 1)} />}
    {visible.map(id =>
      <Window key={id} windowId={id} mode={mode} zIndex={order.indexOf(id) * 2 + 2} />)}
  </div>;
}
