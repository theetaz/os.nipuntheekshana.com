import type { WindowSpec } from '../types/apps';
import type { Point, Rect, SnapZone, Viewport } from './types';

export const MENU_BAR = 32;
export const GUTTER = 8;
export const DOCK_RESERVE = 84;
export const SNAP_DWELL_MS = 120;

export const workArea = (v: Viewport): Rect =>
  ({ x: GUTTER, y: MENU_BAR + GUTTER, w: v.w - 2 * GUTTER, h: v.h - MENU_BAR - GUTTER - DOCK_RESERVE });

export function zoneRect(zone: SnapZone, v: Viewport): Rect {
  const wa = workArea(v);
  const halfW = Math.floor((v.w - 3 * GUTTER) / 2);
  const halfH = Math.floor((wa.h - GUTTER) / 2);
  const rightX = 2 * GUTTER + halfW;
  const bottomY = wa.y + halfH + GUTTER;
  switch (zone) {
    case 'max': return wa;
    case 'left': return { x: GUTTER, y: wa.y, w: halfW, h: wa.h };
    case 'right': return { x: rightX, y: wa.y, w: halfW, h: wa.h };
    case 'top-left': return { x: GUTTER, y: wa.y, w: halfW, h: halfH };
    case 'top-right': return { x: rightX, y: wa.y, w: halfW, h: halfH };
    case 'bottom-left': return { x: GUTTER, y: bottomY, w: halfW, h: halfH };
    case 'bottom-right': return { x: rightX, y: bottomY, w: halfW, h: halfH };
  }
}

export function zoneAt(p: Point, v: Viewport): SnapZone | null {
  const left = p.x <= 6, right = p.x >= v.w - 7;
  if (left || right) {
    if (p.y <= 120) return left ? 'top-left' : 'top-right';
    if (p.y >= v.h - 160) return left ? 'bottom-left' : 'bottom-right';
    return left ? 'left' : 'right';
  }
  return p.y <= 34 ? 'max' : null;
}

export const clampMove = (r: Rect, v: Viewport): Rect => ({
  ...r,
  x: Math.round(Math.min(Math.max(r.x, -(r.w - 96)), v.w - 96)),
  y: Math.round(Math.min(Math.max(r.y, MENU_BAR), v.h - 40)),
});

export function clampSize(r: Rect, spec: WindowSpec, v: Viewport): Rect {
  const wa = workArea(v);
  const w = Math.round(Math.min(Math.max(r.w, spec.minWidth), wa.w));
  const h = Math.round(Math.min(Math.max(r.h, spec.minHeight), wa.h));
  return clampMove({ x: r.x, y: Math.max(r.y, MENU_BAR), w, h }, v);
}

/** Absolute inverse transform, with transform-origin 0 0. */
export const flipFrom = (from: Rect, to: Rect) =>
  ({ x: from.x, y: from.y, sx: from.w / to.w, sy: from.h / to.h });
