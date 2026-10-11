/** Coalesce into the latest call once per frame. Cancel on consumer teardown. */
export function rafThrottle<T extends unknown[]>(callback: (...args: T) => void) {
  let frame: number | undefined;
  let latest: T;
  const throttled = (...args: T) => {
    latest = args;
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => { frame = undefined; callback(...latest); });
  };
  throttled.cancel = () => { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; };
  return throttled;
}
