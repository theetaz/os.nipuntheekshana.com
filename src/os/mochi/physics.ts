import type { Point, Rect } from '../wm/types';

export const MOCHI_SIZE = 64;
export const FLING_THRESHOLD = 1500;
export interface Surface { id: string; x: number; y: number; w: number }
export interface Body extends Point {
  vx: number; vy: number; mode: 'rest' | 'drag' | 'fling' | 'walk' | 'fall' | 'return'; surface: string | null; home?: Point;
}
export interface Sample extends Point { t: number }
export const restingBody = (point: Point, surface: string | null = null): Body => ({ ...point, vx: 0, vy: 0, mode: 'rest', surface });
export function clampPosition(point: Point, area: Rect, size = MOCHI_SIZE): Point {
  return { x: Math.max(area.x, Math.min(area.x + Math.max(0, area.w - size), point.x)),
    y: Math.max(area.y, Math.min(area.y + Math.max(0, area.h - size), point.y)) };
}
export function trackVelocity(samples: Sample[], sample: Sample): Sample[] {
  return [...samples.filter(previous => sample.t - previous.t <= 80), sample].slice(-12);
}
export function releaseVelocity(samples: readonly Sample[], now: number): Point {
  const last = samples.at(-1); const first = samples.find(sample => now - sample.t <= 100);
  if (!last || !first || now - last.t > 80 || last.t - first.t < 4) return { x: 0, y: 0 };
  const seconds = (last.t - first.t) / 1000;
  return { x: Math.max(-8000, Math.min(8000, (last.x - first.x) / seconds)),
    y: Math.max(-8000, Math.min(8000, (last.y - first.y) / seconds)) };
}
export function surfaceAt(point: Point, surfaces: readonly Surface[], size = MOCHI_SIZE): Surface | undefined {
  return surfaces.find(surface => Math.abs(point.y + size - surface.y) <= 4
    && point.x + size / 2 >= surface.x && point.x + size / 2 <= surface.x + surface.w);
}

/** Fixed 60 Hz substeps make 0.92 decay and 0.5 restitution refresh-rate independent. */
export function stepPhysics(body: Body, elapsed: number, area: Rect, surfaces: readonly Surface[] = [], size = MOCHI_SIZE): Body {
  if (body.mode === 'rest' || body.mode === 'drag') return body;
  let next = { ...body };
  let remaining = Math.max(0, Math.min(elapsed, 0.05));
  while (remaining > 0.00001 && next.mode !== 'rest') {
    const dt = Math.min(1 / 60, remaining); remaining -= dt;
    const floor = area.y + Math.max(0, area.h - size);
    const right = area.x + Math.max(0, area.w - size);
    if (next.mode === 'return') {
      const home = clampPosition(next.home ?? next, area, size);
      next.vx += (170 * (home.x - next.x) - 11 * next.vx) * dt;
      next.vy += (170 * (home.y - next.y) - 11 * next.vy) * dt;
      next.x += next.vx * dt; next.y += next.vy * dt;
      if (Math.hypot(home.x - next.x, home.y - next.y) < 0.3 && Math.hypot(next.vx, next.vy) < 8) return restingBody(home, surfaceAt(home, surfaces, size)?.id ?? null);
    } else if (next.mode === 'walk') {
      const surface = surfaces.find(candidate => candidate.id === next.surface);
      next.x += next.vx * dt;
      if (surface && next.x + size / 2 >= surface.x && next.x + size / 2 <= surface.x + surface.w) {
        next.y = surface.y - size;
      } else { next.mode = 'fall'; next.surface = null; }
    } else {
      const previousBottom = next.y + size;
      if (next.mode === 'fall') next.vy += 1200 * dt;
      next.x += next.vx * dt; next.y += next.vy * dt;
      const decay = Math.pow(0.92, dt * 60);
      next.vx *= decay;
      if (next.mode === 'fling') next.vy *= decay;
      if (next.mode === 'fall' && next.vy >= 0) {
        const landing = surfaces.filter(surface => previousBottom <= surface.y + 1 && next.y + size >= surface.y
          && next.x + size / 2 >= surface.x && next.x + size / 2 <= surface.x + surface.w)
          .sort((a, b) => a.y - b.y)[0];
        if (landing) return restingBody(clampPosition({ x: next.x, y: landing.y - size }, area, size), landing.id);
      }
    }
    if (next.x < area.x || next.x > right) { next.x = Math.max(area.x, Math.min(right, next.x)); next.vx *= -0.5; }
    if (next.y < area.y || next.y > floor) {
      next.y = Math.max(area.y, Math.min(floor, next.y)); next.vy *= -0.5;
      if (body.mode === 'fall' && next.y === floor) return restingBody(next);
    }
    if (next.mode === 'fling' && Math.hypot(next.vx, next.vy) < 8) return restingBody(next);
  }
  return next;
}

export function squash(body: Body): string {
  const stretch = Math.min(0.25, Math.hypot(body.vx, body.vy) / 4000);
  const angle = Math.atan2(body.vy, body.vx);
  return stretch ? `rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch}) rotate(${-angle}rad)` : '';
}
