import type { WindowId } from '../wm/types';
import { TrafficLights } from './TrafficLights';
export function TitleBar({ windowId, title }: { windowId: WindowId; title: string }) {
  return <header className="static-titlebar" role="group"><TrafficLights windowId={windowId} /><span id={`window-title-${windowId}`}>{title}</span></header>;
}
