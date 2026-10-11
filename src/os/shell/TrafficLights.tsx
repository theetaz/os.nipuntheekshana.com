import type { WindowId } from '../wm/types';
import { closeWindow, minimizeWindow, toggleMaximize } from '../wm/commands';

export function TrafficLights({ windowId, title, zoomable = true, maximized = false }: {
  windowId: WindowId; title: string; zoomable?: boolean; maximized?: boolean;
}) {
  return <div className="window-traffic-lights" role="group" aria-label="Window controls">
    <button type="button" className="window-traffic-light" data-traffic-light="close" aria-label={`Close ${title}`}
      onClick={() => { void closeWindow(windowId); }}><span className="window-light-disc"><svg viewBox="0 0 7 7" aria-hidden="true"><path d="m1 1 5 5M6 1 1 6" /></svg></span></button>
    <button type="button" className="window-traffic-light" data-traffic-light="min" aria-label={`Minimise ${title}`}
      onClick={() => minimizeWindow(windowId)}><span className="window-light-disc"><svg viewBox="0 0 7 7" aria-hidden="true"><path d="M1 3.5h5" /></svg></span></button>
    <button type="button" className="window-traffic-light" data-traffic-light="zoom" aria-label={`Zoom ${title}`} aria-disabled={!zoomable}
      onClick={() => { if (zoomable) toggleMaximize(windowId); }}><span className="window-light-disc"><svg viewBox="0 0 7 7" aria-hidden="true">
        <path d={maximized ? 'M.5 .5 3 3M1 3h2V1M6.5 6.5 4 4M4 6V4h2' : 'M3 3 .5 .5M.5 2.5v-2h2M4 4l2.5 2.5M4.5 6.5h2v-2'} />
      </svg></span></button>
  </div>;
}
