import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFrameController } from '../../src/os/shell/frame-controller';
import type { Rect, TransitionKind } from '../../src/os/wm/types';

const motion = vi.hoisted(() => ({ calls: [] as { frames: Record<string, unknown>; options: Record<string, unknown>; cancel: ReturnType<typeof vi.fn>; resolve: () => void }[] }));
vi.mock('motion/mini', () => ({ animate: vi.fn((_element, frames, options) => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  const cancel = vi.fn(); motion.calls.push({ frames, options, cancel, resolve });
  return Object.assign(promise, { cancel });
}) }));
vi.mock('motion', () => ({ spring: vi.fn() }));
const initial: Rect = { x: 240, y: 68, w: 960, h: 640 };
function element() {
  const writes: string[] = [];
  const style = new Proxy({ width: '', height: '', transform: '', opacity: '', transformOrigin: '' }, {
    set(target, key, value) { writes.push(String(key)); Reflect.set(target, key, value); return true; },
  });
  const getComputedStyle = vi.fn(() => ({ transform: 'matrix(0.8, 0, 0, 0.8, 300, 100)', transformOrigin: '480px 320px' }));
  const el = { style, ownerDocument: { defaultView: { innerWidth: 1440, innerHeight: 900, getComputedStyle } } } as unknown as HTMLElement;
  return { el, writes, getComputedStyle };
}
async function complete() { motion.calls.forEach(call => call.resolve()); await Promise.resolve(); await Promise.resolve(); }

beforeEach(() => { motion.calls.length = 0; });
afterEach(() => vi.unstubAllGlobals());
describe('frame geometry and interruption', () => {
  it('initialises a translation and only writes changed dimensions, with no layout reads', () => {
    const { el, writes, getComputedStyle } = element(); const frame = createFrameController(el, initial);
    expect(el.style.transform).toBe('translate3d(240px, 68px, 0) scale(1, 1)'); expect(el.style.width).toBe('960px');
    writes.length = 0; frame.set({ ...initial, x: 300, y: 140 });
    expect(writes).not.toContain('width'); expect(writes).not.toContain('height'); expect(getComputedStyle).not.toHaveBeenCalled();
    expect(frame.rect).toEqual({ ...initial, x: 300, y: 140 });
  });
  it('commits the painted scale and transform-origin compensation when interrupted', async () => {
    vi.stubGlobal('DOMMatrixReadOnly', class { m11 = .8; m22 = .8; m41 = 300; m42 = 100; });
    const { el, getComputedStyle } = element(); const frame = createFrameController(el, initial);
    const promise = frame.animate('open', initial); frame.stop(); await promise;
    expect(getComputedStyle).toHaveBeenCalledTimes(1);
    expect(frame.rect.x).toBeCloseTo(396); expect(frame.rect.y).toBeCloseTo(164);
    expect(frame.rect.w).toBe(768); expect(frame.rect.h).toBe(512);
    expect(motion.calls.every(call => call.cancel.mock.calls.length === 1)).toBe(true);
  });
  it('a pointer write cancels animations and settles the caller without reading layout', async () => {
    const { el, getComputedStyle } = element(); const frame = createFrameController(el, initial);
    const pending = frame.animate('open', initial); frame.set({ ...initial, x: 400 }); await pending;
    expect(getComputedStyle).not.toHaveBeenCalled(); expect(frame.rect.x).toBe(400);
    await complete(); expect(frame.rect.x).toBe(400);
  });
  it('destroy settles pending work and prevents late animation completions and writes', async () => {
    const { el } = element(); const frame = createFrameController(el, initial);
    const pending = frame.animate('close', initial); frame.destroy(); await pending; frame.set({ ...initial, x: 0 });
    await complete(); expect(frame.rect).toEqual(initial); expect(el.style.opacity).toBe('1');
  });
  it('none settles immediately without starting an animation', async () => {
    const { el } = element(); const frame = createFrameController(el, initial); await frame.animate('none', initial);
    expect(motion.calls).toHaveLength(0);
  });
  it('closing an interrupted entrance keeps its painted dimensions until the exit finishes', async () => {
    vi.stubGlobal('DOMMatrixReadOnly', class { m11 = .8; m22 = .8; m41 = 300; m42 = 100; });
    const { el } = element(); const frame = createFrameController(el, initial);
    const entrance = frame.animate('open', initial); const exit = frame.animate('close', initial);
    await entrance; expect(el.style.width).toBe('768px'); expect(el.style.height).toBe('512px');
    await complete(); await exit; expect(el.style.opacity).toBe('0');
  });
});

describe('transition specifications', () => {
  it('clamps launch origin and uses the required open spring and opacity tween', async () => {
    const { el } = element(); const frame = createFrameController(el, initial);
    const pending = frame.animate('open', initial, { origin: { x: -400, y: 2000 } });
    expect(el.style.transformOrigin).toBe('0px 640px');
    expect(motion.calls[0]!.options).toMatchObject({ stiffness: 420, damping: 34, mass: .9 });
    expect(motion.calls[1]!.options.duration).toBe(.12); await complete(); await pending;
  });
  for (const kind of ['snap', 'zoom', 'unsnap'] as const) it(`${kind} applies final dimensions with an inverse FLIP`, async () => {
    const { el } = element(); const frame = createFrameController(el, initial); const target = { x: 8, y: 40, w: 1424, h: 776 };
    const pending = frame.animate(kind, target);
    expect(el.style.width).toBe('1424px'); expect(el.style.height).toBe('776px');
    const frames = motion.calls[0]!.frames.transform as string[];
    expect(frames[0]).toBe(`translate3d(240px, 68px, 0) scale(${960 / 1424}, ${640 / 776})`);
    expect(motion.calls[0]!.options).toMatchObject({ stiffness: 380, damping: 36, mass: 1 });
    await complete(); await pending; expect(frame.rect).toEqual(target);
  });
  it('minimises to a 48px width at the dock anchor with a late opacity fade', async () => {
    const { el } = element(); const frame = createFrameController(el, initial);
    const pending = frame.animate('minimize', initial, { dockTarget: { x: 700, y: 850 } });
    expect(motion.calls[0]!.frames.transform).toEqual(['translate3d(240px, 68px, 0) scale(1, 1)', 'translate3d(676px, 834px, 0) scale(0.05, 0.05)']);
    expect(motion.calls[1]!.frames.opacity).toEqual([1, 1, 0]); expect(motion.calls[1]!.options.times).toEqual([0, .7, 1]);
    expect(motion.calls[0]!.options.duration).toBe(.36); await complete(); await pending; expect(el.style.opacity).toBe('0');
  });
  it('restores with the required spring and falls back to the bottom centre', async () => {
    const { el } = element(); const frame = createFrameController(el, initial); const pending = frame.animate('restore', initial);
    expect(motion.calls[0]!.options).toMatchObject({ stiffness: 320, damping: 32, mass: 1 });
    expect((motion.calls[0]!.frames.transform as string[])[0]).toBe('translate3d(696px, 842px, 0) scale(0.05, 0.05)');
    await complete(); await pending;
  });
  it('close resolves only after the 140ms animation completes', async () => {
    const { el } = element(); const frame = createFrameController(el, initial); let done = false;
    const pending = frame.animate('close', initial).then(() => { done = true; });
    await Promise.resolve(); expect(done).toBe(false); expect(motion.calls[0]!.options.duration).toBe(.14);
    await complete(); await pending; expect(el.style.opacity).toBe('0');
  });
  for (const kind of ['open', 'close', 'minimize', 'restore', 'zoom', 'snap', 'unsnap'] satisfies TransitionKind[]) it(`${kind} under reduced motion animates opacity only`, async () => {
    const { el } = element(); const frame = createFrameController(el, initial, () => true); const pending = frame.animate(kind, { ...initial, x: 8 });
    expect(motion.calls).toHaveLength(1); expect(Object.keys(motion.calls[0]!.frames)).toEqual(['opacity']);
    expect(motion.calls[0]!.options.duration).toBeLessThanOrEqual(.12); await complete(); await pending;
  });
});
