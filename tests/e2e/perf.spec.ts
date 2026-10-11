import { test, expect, openApp } from './fixtures';

test('60-step window drag has bounded commits, frame intervals and no long tasks @perf', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Chromium exposes long animation frames and long tasks.');
  await page.addInitScript(() => {
    const state = window as unknown as { __commits: number; __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown };
    state.__commits = 0;
    const renderers = new Map<number, unknown>();
    state.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers,
      inject(renderer: unknown) { const id = renderers.size + 1; renderers.set(id, renderer); return id; },
      onCommitFiberRoot() { state.__commits++; }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
    };
  });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  const win = page.locator('[data-window-id="projects"]'); await expect(win.locator('h1')).toHaveText('Projects');
  await expect.poll(() => win.evaluate(el => el.getAnimations().length)).toBe(0);
  const bar = await win.locator('[data-window-titlebar]').boundingBox();
  await page.mouse.move(bar!.x + 200, bar!.y + 26);
  await page.evaluate(() => {
    const state = window as unknown as { __commits: number; dragPerf: unknown };
    const sample = { commitsBefore: state.__commits, frames: [] as number[], loaf: [] as number[], tasks: [] as number[], active: true, last: 0, observers: [] as PerformanceObserver[] };
    state.dragPerf = sample;
    const record = (time: number) => { if (!sample.active) return; if (sample.last) sample.frames.push(time - sample.last); sample.last = time; requestAnimationFrame(record); };
    requestAnimationFrame(record);
    for (const [type, durations] of [['long-animation-frame', sample.loaf], ['longtask', sample.tasks]] as const) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) throw new Error(`Missing ${type} observer`);
      const observer = new PerformanceObserver(list => durations.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type }); sample.observers.push(observer);
    }
  });
  await page.mouse.down();
  for (let step = 1; step <= 60; step++) {
    await page.mouse.move(bar!.x + 200 + step * 10, bar!.y + 26);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(done)));
  }
  await page.mouse.up(); await expect(win).not.toHaveAttribute('data-dragging');
  const result = await page.evaluate(async () => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const state = window as unknown as { __commits: number; dragPerf: { commitsBefore: number; frames: number[]; loaf: number[]; tasks: number[]; active: boolean; observers: PerformanceObserver[] } };
    const sample = state.dragPerf; sample.active = false;
    sample.observers.forEach(observer => { const target = observer.takeRecords(); if (target.length) (target[0]!.entryType === 'longtask' ? sample.tasks : sample.loaf).push(...target.map(entry => entry.duration)); observer.disconnect(); });
    const frames = [...sample.frames].sort((a, b) => a - b);
    return { commits: state.__commits - sample.commitsBefore, p95: frames[Math.ceil(frames.length * 0.95) - 1], frames: frames.length, loaf: sample.loaf, tasks: sample.tasks };
  });
  await info.attach('drag-performance', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  console.log(`P2-4 drag: ${JSON.stringify(result)}`);
  expect(result.frames).toBeGreaterThanOrEqual(60); expect(result.commits).toBeLessThanOrEqual(2);
  expect(result.loaf.filter(duration => duration > 50)).toEqual([]); expect(result.tasks).toEqual([]);
  expect(result.p95).toBeLessThanOrEqual(process.env.CI ? 34 : 20);
});
