import { useAtomValue } from 'jotai';
import { orderAtom } from '../state/atoms';
import { windows } from './deferred-features';
import type { WindowLayerProps } from './WindowLayer';
// No managed window exists during SSR; the route's static window remains visible.
export function DeferredWindowLayer(props: WindowLayerProps) {
  const order = useAtomValue(orderAtom);
  return order.length ? <windows.Component {...props} /> : null;
}
