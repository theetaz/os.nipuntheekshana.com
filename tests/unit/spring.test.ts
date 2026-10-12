import { describe, expect, it, vi } from 'vitest';
import { atRest, springAt, stepSpring } from '../../src/os/story/spring';
import { typeLine } from '../../src/os/story/typer';

describe('preview follower', () => {
  it('lags a 300px jump at 50ms and converges within 4px at 900ms', () => {
    const s = springAt(100, 120); s.tx += 300;
    for (let i = 0; i < 3; i++) stepSpring(s, 1 / 60);
    expect(s.tx - s.x).toBeGreaterThan(100);
    for (let i = 3; i < 54; i++) stepSpring(s, 1 / 60);
    expect(Math.abs(s.tx - s.x)).toBeLessThan(4);
  });
  it.each([60, 120])('settles both axes with bounded overshoot at %iHz', hz => {
    const s = springAt(-100, 300); s.tx = 200; s.ty = -100;
    let maxX = s.x, minY = s.y;
    for (let i = 0; i < hz * 3; i++) { stepSpring(s, 1 / hz); maxX = Math.max(maxX, s.x); minY = Math.min(minY, s.y); }
    expect(maxX - s.tx).toBeLessThan(15); expect(s.ty - minY).toBeLessThan(20);
    expect(atRest(s)).toBe(true); expect(s).toEqual({ x: 200, y: -100, vx: 0, vy: 0, tx: 200, ty: -100 });
  });
  it('requires both distance and speed on both axes before stopping', () => {
    const s = springAt(0, 0);
    expect(atRest(s)).toBe(true);
    for (const key of ['x', 'y', 'vx', 'vy'] as const) { s[key] = .5; expect(atRest(s)).toBe(false); s[key] = .49; expect(atRest(s)).toBe(true); s[key] = 0; }
  });
  it('caps stalled frames and keeps velocity when the pointer changes direction', () => {
    const a = springAt(0, 0), b = springAt(0, 0); a.tx = b.tx = 300;
    stepSpring(a, 10); stepSpring(b, .032); expect(a).toEqual(b);
    const velocity = a.vx; a.tx = -300;
    expect(a.vx).toBe(velocity); stepSpring(a, 1 / 60); expect(a.vx).toBeLessThan(velocity);
    for (let i = 0; i < 180; i++) stepSpring(a, 1 / 60);
    expect(a.x).toBe(-300); expect(atRest(a)).toBe(true);
  });
});

describe('command typing lifecycle', () => {
  it('waits 110ms, types at 26ms intervals, completes, and leaves no timer', () => {
    vi.useFakeTimers();
    try {
      const setProperty = vi.fn();
      const el = { textContent: '', parentElement: { style: { setProperty } } } as unknown as Element, done = vi.fn(); typeLine(el, 'open repo', false, done);
      vi.advanceTimersByTime(109); expect(el.textContent).toBe('');
      expect(setProperty).toHaveBeenLastCalledWith('--k-chars', '0');
      vi.advanceTimersByTime(1); expect(el.textContent).toBe('o');
      expect(setProperty).toHaveBeenLastCalledWith('--k-chars', '1');
      vi.advanceTimersByTime(26 * 8); expect(el.textContent).toBe('open repo');
      expect(setProperty).toHaveBeenLastCalledWith('--k-chars', '9');
      expect(done).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('cancels before the delay and midway, and reduced motion is immediate', () => {
    vi.useFakeTimers();
    try {
      const el = { textContent: '' } as Element, done = vi.fn();
      typeLine(el, 'open repo', false, done)(); vi.runAllTimers(); expect(el.textContent).toBe('');
      const cancel = typeLine(el, 'open repo', false, done); vi.advanceTimersByTime(136); cancel();
      expect(el.textContent).toBe('op'); vi.runAllTimers(); expect(el.textContent).toBe('op'); expect(done).not.toHaveBeenCalled();
      typeLine(el, 'open repo', true, done); expect(el.textContent).toBe('open repo'); expect(done).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
