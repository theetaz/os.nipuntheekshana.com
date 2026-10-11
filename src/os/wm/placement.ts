import type { AppMeta } from '../types/apps';
import { clampMove, workArea } from './geometry';
import type { DesktopState, Rect } from './types';

export function placeWindow(meta: AppMeta, state: DesktopState, remembered: Rect | null): Rect {
  const wa = workArea(state.viewport);
  // Retain the app minimum even when the desktop is smaller (mobile renders a sheet).
  const w = Math.round(Math.max(meta.window.minWidth, Math.min(remembered?.w ?? meta.window.width, wa.w - 24)));
  const h = Math.round(Math.max(meta.window.minHeight, Math.min(remembered?.h ?? meta.window.height, wa.h - 24)));
  const centered = { x: wa.x + Math.round((wa.w - w) / 2),
    y: Math.max(wa.y, wa.y + Math.round((wa.h - h) / 2) - 40), w, h };
  let rect = remembered ? clampMove({ ...remembered, w, h }, state.viewport) : centered;
  const occupied = Object.values(state.windows).filter((win) => !win.minimized && !win.closing);
  while (occupied.some((win) => Math.abs(win.rect.x - rect.x) <= 4 && Math.abs(win.rect.y - rect.y) <= 4)) {
    rect = { ...rect, x: rect.x + 28, y: rect.y + 28 };
    if (rect.x + w > wa.x + wa.w || rect.y + h > wa.y + wa.h) {
      return { ...centered, x: centered.x + 14, y: centered.y + 14 };
    }
  }
  return rect;
}
