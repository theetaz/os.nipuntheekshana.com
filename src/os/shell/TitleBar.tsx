import type { ReactNode } from 'react';
import type { TitleBarKind } from '../types/apps';
import type { WindowId } from '../wm/types';
import { focusWindow, openContextMenu, toggleMaximize } from '../wm/commands';
import { TrafficLights } from './TrafficLights';
import { NO_DRAG } from './useWindowDrag';

export const KEYBOARD_MOVE_HINT = 'Arrows move · Shift ×8 · ⌥ + arrows resize · Return to finish · Esc to cancel';
export function TitleBar({ windowId, title, kind = 'standard', zoomable = true, maximized = false, keyboardMove = false,
  stillLoading = false, navigation, toolbar }: {
  windowId: WindowId; title: string; kind?: TitleBarKind; zoomable?: boolean; maximized?: boolean;
  keyboardMove?: boolean; stillLoading?: boolean; navigation?: ReactNode; toolbar?: ReactNode;
}) {
  return <header className="window-titlebar" data-window-titlebar={kind} role="group" aria-label={`${title} title bar`} tabIndex={-1}
    onDoubleClick={event => { if (zoomable && !(event.target as Element).closest(NO_DRAG)) toggleMaximize(windowId); }}
    onContextMenu={event => {
      if ((event.target as Element).closest(NO_DRAG)) return;
      event.preventDefault(); focusWindow(windowId);
      openContextMenu({ x: event.clientX, y: event.clientY, target: windowId, items: [
        { kind: 'item', label: 'Minimise', command: 'window.minimize' },
        ...(zoomable ? [{ kind: 'item' as const, label: maximized ? 'Restore' : 'Zoom', command: 'window.zoom' }] : []),
        { kind: 'item', label: 'Copy link', command: 'window.copyLink' }, { kind: 'separator' },
        { kind: 'item', label: 'Close', command: 'window.close' },
      ] });
    }}>
    <TrafficLights windowId={windowId} title={title} zoomable={zoomable} maximized={maximized} />
    {navigation && <div data-no-drag className="window-navigation">{navigation}</div>}
    <span id={`window-title-${windowId}`} className={`window-title${kind === 'transparent' ? ' sr-only' : ''}`}>
      <span className={stillLoading ? 'sr-only' : undefined}>{title}</span>
      {stillLoading && <span className="window-loading-spinner" role="status" aria-label="Still loading…" title="Still loading…" />}
    </span>
    {toolbar && <div data-no-drag className="window-toolbar">{toolbar}</div>}
    {keyboardMove && <span className="window-keyboard-hint" role="status">{KEYBOARD_MOVE_HINT}</span>}
  </header>;
}
