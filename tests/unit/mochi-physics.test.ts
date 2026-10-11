import { describe, expect, it } from 'vitest';
import { clampPosition, releaseVelocity, restingBody, squash, stepPhysics, surfaceAt, trackVelocity, type Body } from '../../src/os/mochi/physics';

const area = { x: 8, y: 40, w: 1424, h: 776 };
const fling = (x = 700, y = 400, vx = 2000, vy = 1000): Body => ({ x, y, vx, vy, mode: 'fling', surface: null });
describe('Mochi flight and dragging', () => {
  it.each([
    [8, 400, -2000, 0, 'vx', 920], [1368, 400, 2000, 0, 'vx', -920],
    [700, 40, 0, -2000, 'vy', 920], [700, 752, 0, 2000, 'vy', -920],
  ] as const)('bounces at a work-area edge with 0.5 restitution', (x, y, vx, vy, axis, expected) => {
    const next = stepPhysics(fling(x, y, vx, vy), 1 / 60, area);
    expect(next[axis]).toBeCloseTo(expected); expect(clampPosition(next, area)).toEqual({ x: next.x, y: next.y });
  });
  it('applies 0.92 velocity decay per 60 Hz frame', () => {
    expect(stepPhysics(fling(), 1 / 60, area)).toMatchObject({ vx: 1840, vy: 920 });
    const fast = stepPhysics(stepPhysics(fling(), 1 / 120, area), 1 / 120, area);
    expect(fast.vx).toBeCloseTo(1840); expect(fast.vy).toBeCloseTo(920);
  });
  it('settles a fast diagonal fling inside the area and stops moving', () => {
    let body = fling(1300, 90, 7000, -6000); let frames = 0;
    while (body.mode !== 'rest' && frames++ < 300) body = stepPhysics(body, 1 / 60, area);
    expect(frames).toBeLessThan(300); expect(body.mode).toBe('rest'); expect(body.vx).toBe(0); expect(body.vy).toBe(0);
    expect(clampPosition(body, area)).toEqual({ x: body.x, y: body.y }); expect(stepPhysics(body, 1, area)).toBe(body);
  });
  it('never integrates a drag or a deliberate slow drop', () => {
    const body = restingBody({ x: 600, y: 300 }); expect(stepPhysics(body, 1, area)).toBe(body);
    const drag: Body = { ...body, mode: 'drag', vx: 5000 }; expect(stepPhysics(drag, 1, area)).toBe(drag);
  });
  it('clamps persisted positions, including a tiny viewport', () => {
    expect(clampPosition({ x: -100, y: 900 }, area)).toEqual({ x: 8, y: 752 });
    expect(clampPosition({ x: 900, y: -100 }, { x: 8, y: 40, w: 30, h: 30 })).toEqual({ x: 8, y: 40 });
  });
  it('tracks recent velocity and discards a held release', () => {
    let samples = [{ x: 0, y: 0, t: 0 }];
    samples = trackVelocity(samples, { x: 180, y: 60, t: 60 });
    expect(releaseVelocity(samples, 65)).toEqual({ x: 3000, y: 1000 });
    expect(releaseVelocity(samples, 150)).toEqual({ x: 0, y: 0 });
    expect(trackVelocity(samples, { x: 180, y: 60, t: 140 })).toHaveLength(2);
    expect(releaseVelocity([], 0)).toEqual({ x: 0, y: 0 });
  });
  it('caps bad gaps and extreme pointer speeds', () => {
    expect(releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 10_000, y: -10_000, t: 5 }], 5)).toEqual({ x: 8000, y: -8000 });
    const next = stepPhysics(fling(), 100, area); expect(clampPosition(next, area)).toEqual({ x: next.x, y: next.y });
  });
  it('uses the original speed-based squash formula', () => {
    expect(squash(restingBody({ x: 10, y: 10 }))).toBe(''); expect(squash(fling(10, 10, 4000, 0))).toContain('scale(1.25, 0.75)');
  });
  it('springs back from Kooda, then settles exactly at the previous position', () => {
    let body: Body = { ...restingBody({ x: 1100, y: 752 }), mode: 'return', home: { x: 468, y: 418 } };
    let frames = 0;
    while (body.mode !== 'rest' && frames++ < 300) body = stepPhysics(body, 1 / 60, area);
    expect(body).toMatchObject({ x: 468, y: 418, vx: 0, vy: 0, mode: 'rest' }); expect(frames).toBeLessThan(300);
  });
});
describe('Mochi surfaces', () => {
  const dock = { id: 'dock', x: 300, y: 808, w: 700 };
  const window = { id: 'about', x: 100, y: 300, w: 600 };
  it.each([dock, window])('walks along $id', surface => {
    const body: Body = { ...restingBody({ x: surface.x + 100, y: surface.y - 64 }, surface.id), vx: 44, mode: 'walk' };
    const next = stepPhysics(body, 1 / 60, area, [surface]); expect(next.x).toBeGreaterThan(body.x);
    expect(next.y).toBe(surface.y - 64); expect(next.surface).toBe(surface.id);
  });
  it('falls when it walks beyond the edge or its window disappears', () => {
    const body: Body = { ...restingBody({ x: 685, y: 236 }, 'about'), vx: 100, mode: 'walk' };
    expect(stepPhysics(body, 1 / 60, area, [window]).mode).toBe('fall');
    expect(stepPhysics(body, 1 / 60, area).mode).toBe('fall');
  });
  it('lands on the first window or dock crossed while falling', () => {
    const falling: Body = { ...restingBody({ x: 400, y: 230 }), vy: 800, mode: 'fall' };
    expect(stepPhysics(falling, 1 / 60, area, [dock, window])).toMatchObject({ mode: 'rest', y: 236, surface: 'about' });
    let body = { ...falling, y: 500 };
    for (let i = 0; body.mode !== 'rest' && i < 120; i++) body = stepPhysics(body, 1 / 60, area, [dock]);
    expect(body).toMatchObject({ mode: 'rest', y: 744, surface: 'dock' });
  });
  it('only attaches deliberate drops within four pixels of a supporting surface', () => {
    expect(surfaceAt({ x: 400, y: 236 }, [window])?.id).toBe('about');
    expect(surfaceAt({ x: 800, y: 236 }, [window])).toBeUndefined();
    expect(surfaceAt({ x: 400, y: 250 }, [window])).toBeUndefined();
  });
});
