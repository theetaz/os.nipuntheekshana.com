import type { WindowId } from '../wm/types';
import { closeWindow, minimizeWindow, toggleMaximize } from '../wm/commands';

export function WindowButtons({ windowId, title, zoomable = true, maximized = false }: {
  windowId: WindowId; title: string; zoomable?: boolean; maximized?: boolean;
}) {
  return <div className="k-winbtns" role="group" aria-label="Window controls">
    <button type="button" className="k-winbtn" data-window-button="minimise" aria-label={`Minimise ${title}`}
      onClick={() => minimizeWindow(windowId)}><span className="k-winbtn-disc"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5h6" /></svg></span></button>
    <button type="button" className="k-winbtn" data-window-button="maximise" aria-label={`Maximise ${title}`} aria-disabled={!zoomable}
      aria-pressed={maximized} onClick={() => { if (zoomable) toggleMaximize(windowId); }}>
      <span className="k-winbtn-disc"><svg viewBox="0 0 10 10" aria-hidden="true">
        {maximized ? <path d="M3 3V1h6v6H7M1 3h6v6H1z" /> : <rect x="2" y="2" width="6" height="6" />}
      </svg></span></button>
    <button type="button" className="k-winbtn" data-window-button="close" aria-label={`Close ${title}`}
      onClick={() => { void closeWindow(windowId); }}><span className="k-winbtn-disc"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="m2 2 6 6M8 2 2 8" /></svg></span></button>
  </div>;
}
