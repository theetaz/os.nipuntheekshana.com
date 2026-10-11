import { describe, expect, it } from 'vitest';
import { resizeRect, type ResizeEdge } from '../../src/os/shell/useWindowResize';
import { APP_META } from '../../src/os/registry/meta';
const rect = { x: 240, y: 100, w: 960, h: 640 }; const viewport = { w: 1440, h: 900 };
const spec = APP_META.projects.window;
describe('window resize geometry', () => {
  const expected = {
    n: { x: 240, y: 150, w: 960, h: 590 }, s: { x: 240, y: 100, w: 960, h: 690 },
    e: { x: 240, y: 100, w: 1060, h: 640 }, w: { x: 340, y: 100, w: 860, h: 640 },
    ne: { x: 240, y: 150, w: 1060, h: 590 }, nw: { x: 340, y: 150, w: 860, h: 590 },
    se: { x: 240, y: 100, w: 1060, h: 690 }, sw: { x: 340, y: 100, w: 860, h: 690 },
  };
  for (const edge of Object.keys(expected) as ResizeEdge[]) it(`resizes ${edge} with the opposite edge anchored`, () => {
    expect(resizeRect(rect, edge, { x: 100, y: 50 }, spec, viewport)).toEqual(expected[edge]);
  });
  it('clamps bottom-right to the minimum', () => expect(resizeRect(rect, 'se', { x: -2000, y: -2000 }, spec, viewport)).toEqual({ ...rect, w: 560, h: 400 }));
  it('clamps top-left to the minimum while retaining bottom-right', () => expect(resizeRect(rect, 'nw', { x: 2000, y: 2000 }, spec, viewport)).toEqual({ x: 640, y: 340, w: 560, h: 400 }));
  it('keeps the top edge at or below the menu bar', () => expect(resizeRect(rect, 'n', { x: 0, y: -2000 }, spec, viewport)).toEqual({ ...rect, y: 32, h: 708 }));
  it('clamps to the work area maximum', () => expect(resizeRect(rect, 'se', { x: 4000, y: 4000 }, spec, viewport)).toEqual({ ...rect, w: 1424, h: 776 }));
  it('Settings rejects every manual resize direction', () => {
    for (const edge of Object.keys(expected) as ResizeEdge[]) expect(resizeRect(rect, edge, { x: 100, y: 100 }, APP_META.settings.window, viewport)).toEqual(rect);
  });
});
