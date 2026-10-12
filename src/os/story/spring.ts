export interface Spring { x: number; y: number; vx: number; vy: number; tx: number; ty: number }
export function springAt(x: number, y: number): Spring { return { x, y, vx: 0, vy: 0, tx: x, ty: y }; }
export function atRest(s: Spring): boolean {
  return Math.abs(s.x - s.tx) < .5 && Math.abs(s.y - s.ty) < .5 && Math.abs(s.vx) < .5 && Math.abs(s.vy) < .5;
}
/** Semi-implicit Euler, two substeps; cap elapsed time after a stalled frame. */
export function stepSpring(s: Spring, seconds: number): boolean {
  const h = Math.max(0, Math.min(.032, seconds)) / 2;
  for (let i = 0; i < 2; i++) {
    s.vx += (-170 * (s.x - s.tx) - 20 * s.vx) * h;
    s.vy += (-170 * (s.y - s.ty) - 20 * s.vy) * h;
    s.x += s.vx * h; s.y += s.vy * h;
  }
  if (!atRest(s)) return false;
  s.x = s.tx; s.y = s.ty; s.vx = s.vy = 0;
  return true;
}
