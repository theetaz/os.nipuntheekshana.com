import { describe, expect, it } from 'vitest';
import { APP_META } from '../../src/os/registry/meta';
import { clampMove, clampSize, DOCK_RESERVE, flipFrom, GUTTER, MENU_BAR, SNAP_DWELL_MS, workArea, zoneAt, zoneRect } from '../../src/os/wm/geometry';
import { placeWindow } from '../../src/os/wm/placement';
import { wmReducer } from '../../src/os/wm/reducer';
import { createDesktopState } from '../../src/os/wm/types';
import type { Rect, SnapZone } from '../../src/os/wm/types';

const zones: SnapZone[] = ['max', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const viewports = [
  { viewport: { w: 1024, h: 640 }, area: { x: 8, y: 40, w: 1008, h: 516 }, halfW: 500, halfH: 254, rightX: 516, bottomY: 302 },
  { viewport: { w: 1440, h: 900 }, area: { x: 8, y: 40, w: 1424, h: 776 }, halfW: 708, halfH: 384, rightX: 724, bottomY: 432 },
  { viewport: { w: 2560, h: 1440 }, area: { x: 8, y: 40, w: 2544, h: 1316 }, halfW: 1268, halfH: 654, rightX: 1284, bottomY: 702 },
];

describe('work area and snapping', () => {
  it('exports the specified reserved areas and dwell duration', () => {
    expect([MENU_BAR, GUTTER, DOCK_RESERVE, SNAP_DWELL_MS]).toEqual([32, 8, 84, 120]);
  });
  for (const { viewport, area, halfW, halfH, rightX, bottomY } of viewports) {
    it(`computes the work area at ${viewport.w}×${viewport.h}`, () => { expect(workArea(viewport)).toEqual(area); });
    const expected: Record<SnapZone, Rect> = {
      max: area, left: { x: 8, y: 40, w: halfW, h: area.h }, right: { x: rightX, y: 40, w: halfW, h: area.h },
      'top-left': { x: 8, y: 40, w: halfW, h: halfH }, 'top-right': { x: rightX, y: 40, w: halfW, h: halfH },
      'bottom-left': { x: 8, y: bottomY, w: halfW, h: halfH }, 'bottom-right': { x: rightX, y: bottomY, w: halfW, h: halfH },
    };
    it.each(zones)(`computes %s at ${viewport.w}×${viewport.h}`, (zone) => { expect(zoneRect(zone, viewport)).toEqual(expected[zone]); });
  }
  it('floors odd halves without overlapping the gutter', () => {
    expect(zoneRect('bottom-right', { w: 1441, h: 901 })).toEqual({ x: 724, y: 432, w: 708, h: 384 });
  });
  const boundaries: [number, number, SnapZone | null][] = [
    [6, 121, 'left'], [7, 121, null], [6, 120, 'top-left'], [7, 120, null],
    [500, 34, 'max'], [500, 35, null], [6, 34, 'top-left'], [7, 34, 'max'],
    [6, 479, 'left'], [6, 480, 'bottom-left'], [7, 480, null],
    [1017, 121, 'right'], [1016, 121, null], [1017, 120, 'top-right'], [1016, 120, null],
    [1017, 479, 'right'], [1017, 480, 'bottom-right'], [1016, 480, null],
    [0, 0, 'top-left'], [1024, 0, 'top-right'], [0, 640, 'bottom-left'], [1024, 640, 'bottom-right'],
    [-1, 121, 'left'], [1025, 121, 'right'], [500, 640, null],
  ];
  it.each(boundaries)('zoneAt(%s, %s) = %s at 1024×640', (x, y, zone) => {
    expect(zoneAt({ x, y }, { w: 1024, h: 640 })).toBe(zone);
  });
});

describe('clamping and FLIP', () => {
  const v = { w: 1024, h: 640 };
  it.each([
    [-1000, -100, -624, 32], [2000, 1000, 928, 600], [100.4, 40.6, 100, 41],
    [-624, 32, -624, 32], [928, 600, 928, 600], [0, 40, 0, 40],
  ])('clampMove(%s, %s) keeps 96 title-bar pixels and menu clearance', (x, y, expectedX, expectedY) => {
    const rect = { x, y, w: 720, h: 440 };
    expect(clampMove(rect, v)).toEqual({ ...rect, x: expectedX, y: expectedY });
    expect(rect).toEqual({ x, y, w: 720, h: 440 });
  });
  it.each([
    [1, 1, 560, 400], [2000, 1000, 1008, 516], [560, 400, 560, 400],
    [700.4, 450.6, 700, 451], [1008, 516, 1008, 516],
  ])('clampSize(%s×%s) uses app minimums and work-area maxima', (w, h, expectedW, expectedH) => {
    expect(clampSize({ x: 100, y: 20, w, h }, APP_META.projects.window, v)).toEqual({ x: 100, y: 32, w: expectedW, h: expectedH });
  });
  it('shrinks normal windows to a viewport smaller than the app minimum, per the geometry contract', () => {
    expect(clampSize({ x: 0, y: 0, w: 960, h: 640 }, APP_META.projects.window, { w: 390, h: 844 }))
      .toEqual({ x: 0, y: 32, w: 374, h: 640 });
  });
  it('clamps position using the final resized width', () => {
    expect(clampSize({ x: -2000, y: 900, w: 560, h: 400 }, APP_META.projects.window, v))
      .toEqual({ x: -464, y: 600, w: 560, h: 400 });
  });
  it('FLIP returns the absolute from position and independent scale axes', () => {
    expect(flipFrom({ x: 80, y: 120, w: 600, h: 300 }, { x: 8, y: 40, w: 1200, h: 900 }))
      .toEqual({ x: 80, y: 120, sx: 0.5, sy: 1 / 3 });
    expect(flipFrom({ x: 10, y: 20, w: 500, h: 400 }, { x: 10, y: 20, w: 500, h: 400 }))
      .toEqual({ x: 10, y: 20, sx: 1, sy: 1 });
  });
});

describe('placement', () => {
  const initial = () => createDesktopState({ w: 1024, h: 640 });
  it('centres the default size above the vertical centre', () => {
    expect(placeWindow(APP_META.terminal, initial(), null)).toEqual({ x: 152, y: 40, w: 720, h: 440 });
    expect(placeWindow(APP_META.terminal, createDesktopState(), null)).toEqual({ x: 360, y: 168, w: 720, h: 440 });
  });
  it('clamps large defaults to work area minus 24, keeping minimum size', () => {
    expect(placeWindow(APP_META.projects, initial(), null)).toEqual({ x: 32, y: 40, w: 960, h: 492 });
    expect(placeWindow(APP_META.settings, createDesktopState({ w: 390, h: 640 }), null).w).toBe(680);
  });
  it('uses remembered size and clamps a remembered position', () => {
    expect(placeWindow(APP_META.terminal, initial(), { x: -2000, y: 900, w: 720, h: 440 }))
      .toEqual({ x: -624, y: 600, w: 720, h: 440 });
    expect(placeWindow(APP_META.terminal, initial(), { x: 100, y: 120, w: 100, h: 100 }))
      .toEqual({ x: 100, y: 120, w: 420, h: 260 });
  });
  it('cascades 28 pixels and wraps to centered base plus 14 at 1024×640', () => {
    let state = initial();
    for (const expected of [
      { x: 152, y: 40, w: 720, h: 440 }, { x: 180, y: 68, w: 720, h: 440 },
      { x: 208, y: 96, w: 720, h: 440 }, { x: 166, y: 54, w: 720, h: 440 },
    ]) {
      expect(placeWindow(APP_META.terminal, state, null)).toEqual(expected);
      state = wmReducer(state, { type: 'OPEN', appId: 'terminal', newInstance: true });
      expect(state.windows[state.focusedId!]!.rect).toEqual(expected);
    }
  });
  it('wraps a remembered collision to the centered base, then stops even if occupied', () => {
    const remembered = { x: 280, y: 110, w: 720, h: 440 };
    let state = wmReducer(initial(), { type: 'OPEN', appId: 'terminal', rect: remembered });
    state = wmReducer(state, { type: 'OPEN', appId: 'terminal', rect: { x: 166, y: 54, w: 720, h: 440 }, newInstance: true });
    expect(placeWindow(APP_META.terminal, state, remembered)).toEqual({ x: 166, y: 54, w: 720, h: 440 });
  });
  it.each(['MINIMIZE', 'CLOSE'] as const)('ignores %s frames when finding occupied positions', (type) => {
    const state = wmReducer(wmReducer(initial(), { type: 'OPEN', appId: 'terminal' }), { type, id: 'terminal' });
    expect(placeWindow(APP_META.terminal, state, null)).toEqual({ x: 152, y: 40, w: 720, h: 440 });
  });
  it.each([[-4, -4, 180, 68], [4, 4, 180, 68], [5, 4, 152, 40], [4, 5, 152, 40]])
    ('collision tolerance at offset %s,%s', (dx, dy, x, y) => {
      const state = wmReducer(initial(), { type: 'OPEN', appId: 'terminal', rect: { x: 152 + dx, y: 40 + dy, w: 720, h: 440 } });
      expect(placeWindow(APP_META.terminal, state, null)).toEqual({ x, y, w: 720, h: 440 });
    });
});
