import type { WindowId } from '../wm/types';
import { closeWindow, minimizeWindow, toggleMaximize } from '../wm/commands';
export function TrafficLights({ windowId }: { windowId: WindowId }) {
  return <div className="traffic-lights"><button className="traffic-light close" data-traffic-light aria-label="Close window" onClick={() => { void closeWindow(windowId); }}><span aria-hidden="true">×</span></button>
    <button className="traffic-light minimise js-only" data-traffic-light aria-label="Minimise window" onClick={() => minimizeWindow(windowId)}><span aria-hidden="true">−</span></button>
    <button className="traffic-light zoom js-only" data-traffic-light aria-label="Zoom window" onClick={() => toggleMaximize(windowId)}><span aria-hidden="true">+</span></button></div>;
}
