import type { WindowId } from '../wm/types';
import { DeferredWindowLayer } from '../shell/DeferredWindowLayer';
export function AppSheet({ windowId }: { windowId: WindowId }) { return <DeferredWindowLayer mode="mobile" windowId={windowId} />; }
