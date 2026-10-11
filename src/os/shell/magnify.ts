export const DOCK_REST_SIZE = 48;
export const DOCK_MAX_SIZE = 72;
export const MAGNIFY_STEP = 1 / 120;
const RANGE = 160;

/** Distances always refer to the icon's resting centre, never its animated position. */
export function magnify(distance: number): number {
  const d = Math.abs(distance);
  return d < RANGE ? DOCK_REST_SIZE + (DOCK_MAX_SIZE - DOCK_REST_SIZE) * Math.cos(d / RANGE * Math.PI / 2) : DOCK_REST_SIZE;
}

export interface MagnifySpring { size: number; velocity: number; target: number }
export function magnifyAtRest(spring: MagnifySpring): boolean {
  return Math.abs(spring.size - spring.target) < 0.1 && Math.abs(spring.velocity) < 0.1;
}

/** Pure semi-implicit Euler integration; the controller supplies fixed 1/120 s steps. */
export function stepMagnifySpring(spring: MagnifySpring): MagnifySpring {
  const acceleration = (380 * (spring.target - spring.size) - 28 * spring.velocity) / 0.6;
  const velocity = spring.velocity + acceleration * MAGNIFY_STEP;
  const next = { ...spring, velocity, size: spring.size + velocity * MAGNIFY_STEP };
  return magnifyAtRest(next) ? { size: next.target, target: next.target, velocity: 0 } : next;
}
