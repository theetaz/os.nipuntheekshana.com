import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const path = '../../src/os/lib/motion-features';
beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.doUnmock(path); });

it('subscribes without downloading features, then shares the intent import', async () => {
  const features = { renderer: vi.fn() };
  const imported = vi.fn(() => ({ default: features }));
  vi.doMock(path, imported);
  const { loadMotionFeatures, preloadMotionFeatures } = await import('../../src/os/lib/motion-loader');
  const subscription = loadMotionFeatures();
  expect(loadMotionFeatures()).toBe(subscription);
  await Promise.resolve(); expect(imported).not.toHaveBeenCalled();
  const first = preloadMotionFeatures();
  expect(preloadMotionFeatures()).toBe(first);
  await expect(first).resolves.toBe(features);
  await expect(subscription).resolves.toBe(features);
  expect(imported).toHaveBeenCalledTimes(1);
});

it('keeps the root subscription usable after a failed intent import', async () => {
  vi.doMock(path, () => { throw new Error('offline'); });
  const { loadMotionFeatures, preloadMotionFeatures } = await import('../../src/os/lib/motion-loader');
  const subscription = loadMotionFeatures();
  // Vitest wraps a throwing module factory, retaining the import error as its cause.
  await expect(preloadMotionFeatures()).rejects.toMatchObject({ cause: { message: 'offline' } });
  const features = { renderer: vi.fn() };
  vi.doMock(path, () => ({ default: features }));
  await expect(preloadMotionFeatures()).resolves.toBe(features);
  await expect(subscription).resolves.toBe(features);
});

it('rejects an empty feature module instead of resolving LazyMotion with undefined', async () => {
  vi.doMock(path, () => ({ default: undefined }));
  const { loadMotionFeatures, preloadMotionFeatures } = await import('../../src/os/lib/motion-loader');
  const subscription = loadMotionFeatures();
  await expect(preloadMotionFeatures()).rejects.toThrow('Animation features could not be loaded');
  const features = { renderer: vi.fn() };
  vi.doMock(path, () => ({ default: features }));
  await expect(preloadMotionFeatures()).resolves.toBe(features);
  await expect(subscription).resolves.toBe(features);
});
