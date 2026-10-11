import { afterEach, expect, it, vi } from 'vitest';
import { rafThrottle } from '../../src/os/lib/raf';
afterEach(() => vi.unstubAllGlobals());
it('coalesces to the latest arguments, schedules subsequent frames and cancels teardown work', () => {
  let frame!: FrameRequestCallback;
  const request = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 7; });
  const cancel = vi.fn(); vi.stubGlobal('requestAnimationFrame', request); vi.stubGlobal('cancelAnimationFrame', cancel);
  const callback = vi.fn(); const throttled = rafThrottle(callback);
  throttled('first'); throttled('latest'); expect(request).toHaveBeenCalledTimes(1);
  frame(0); expect(callback).toHaveBeenCalledWith('latest');
  throttled('next'); expect(request).toHaveBeenCalledTimes(2);
  throttled.cancel(); expect(cancel).toHaveBeenCalledWith(7);
  throttled('again'); expect(request).toHaveBeenCalledTimes(3);
});
