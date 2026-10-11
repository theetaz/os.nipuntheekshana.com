import type { WindowId } from '../wm/types';
import { Window } from '../shell/Window';
export function AppSheet({ windowId }: { windowId: WindowId }) { return <Window windowId={windowId} mode="mobile" />; }
