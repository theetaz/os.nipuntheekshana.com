import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

test('idle focused ring rotates on the compositor without painting the window @perf', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Chromium provides the Performance trace protocol.');
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  const win = page.locator('[data-window-id="projects"]'); await expect(win.locator('h1')).toHaveText('Projects');
  await expect.poll(() => win.evaluate(el => el.getAnimations().length)).toBe(0);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
  const ring = win.locator('.k-ring > i');
  expect(await ring.evaluate(el => el.getAnimations()[0]?.playState)).toBe('running');
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable'); await client.send('LayerTree.enable');
  const { root } = await client.send('DOM.getDocument', { depth: -1, pierce: true });
  const windowNodes = new Set<number>();
  function collect(node: { backendNodeId: number; attributes?: string[]; children?: typeof root.children }, inside = false) {
    inside ||= node.attributes?.some((value, index) => index % 2 === 0 && value === 'data-window-id') ?? false;
    if (inside) windowNodes.add(node.backendNodeId);
    node.children?.forEach(child => collect(child, inside));
  }
  collect(root);
  // LayerTree instrumentation invalidates existing layers. Finish its first
  // compositor frame before measuring the already-running idle animation.
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const windowLayers = new Set<string>();
  const paintedLayers: string[] = [];
  client.on('LayerTree.layerPainted', ({ layerId }) => { paintedLayers.push(layerId); });
  client.on('LayerTree.layerTreeDidChange', ({ layers }) => {
    for (const layer of layers ?? []) if (layer.backendNodeId && windowNodes.has(layer.backendNodeId)) windowLayers.add(layer.layerId);
  });
  await client.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.layers', transferMode: 'ReturnAsStream' });
  const sample = await ring.evaluate(async el => {
    const animation = el.getAnimations()[0]!;
    const start = Number(animation.currentTime); const frames: number[] = []; let previous = 0;
    for (let i = 0; i < 180; i++) {
      const time = await new Promise<number>(done => requestAnimationFrame(done));
      if (previous) frames.push(time - previous); previous = time;
    }
    return { start, end: Number(animation.currentTime), frames, transform: getComputedStyle(el).transform };
  });
  const completed = new Promise<{ stream?: string }>(done => client.once('Tracing.tracingComplete', done));
  await client.send('Tracing.end'); const { stream } = await completed; expect(stream).toBeTruthy();
  let body = '';
  while (true) {
    const chunk = await client.send('IO.read', { handle: stream! });
    body += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
    if (chunk.eof) break;
  }
  await client.send('IO.close', { handle: stream! }); await client.detach();
  const trace = JSON.parse(body) as { traceEvents: { name: string; args?: { data?: { nodeId?: number; nodeName?: string; layerId?: string } } }[] };
  const paints = trace.traceEvents.filter(event => event.name === 'Paint');
  const windowPaints = paints.filter(event => windowNodes.has(event.args?.data?.nodeId ?? -1) || windowLayers.has(String(event.args?.data?.layerId)));
  const frames = [...sample.frames].sort((a, b) => a - b);
  const result = { frames: sample.frames.length, elapsed: sample.end - sample.start, p95: frames[Math.ceil(frames.length * .95) - 1],
    totalPaints: paints.length, windowPaints: windowPaints.length, windowLayerPaints: paintedLayers.filter(id => windowLayers.has(id)).length,
    paintSources: [...new Set(paints.map(event => event.args?.data?.nodeName))],
    paintedLayers: [...new Set(paintedLayers)], windowNodes: windowNodes.size, windowLayers: [...windowLayers], transform: sample.transform };
  mkdirSync(resolve('.astro/k6-artifacts'), { recursive: true });
  writeFileSync(resolve('.astro/k6-artifacts/ring-performance.trace.json'), body);
  writeFileSync(resolve('.astro/k6-artifacts/ring-performance.json'), JSON.stringify(result, null, 2));
  await info.attach('ring-performance', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  console.log(`K6 ring: ${JSON.stringify(result)}`);
  expect(sample.end - sample.start).toBeGreaterThanOrEqual(2500); expect(sample.transform).not.toBe('none');
  expect(windowNodes.size).toBeGreaterThan(0); expect(windowLayers.size).toBeGreaterThan(0);
  expect(windowPaints).toEqual([]); expect(result.windowLayerPaints).toBe(0);
});
