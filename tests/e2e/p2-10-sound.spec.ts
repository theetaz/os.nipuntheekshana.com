import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, openApp } from './fixtures';

const errorsByPage = new WeakMap<Page, string[]>();
const soundModule = `/_astro/${readdirSync('dist/_astro').find(name => /^sound\..*\.js$/.test(name))!}`;

interface Probe {
  contexts: number;
  resumes: number;
  starts: string[];
  stops: { type: string; time: number }[];
  parameters: { name: string; method: string; value: number; time: number }[];
  preGestureLaunch: boolean;
  suspend: () => void;
}
declare global {
  interface Window {
    soundProbe: Probe;
    renderSound: () => Promise<{ peak: number; tail: number }>;
  }
}
function installAudioStub(options: { enabled?: boolean; volume?: number; missing?: boolean; rejected?: boolean; synthetic?: boolean; suspended?: boolean }) {
  if (options.enabled) localStorage.setItem('serendib:sound', 'true');
  if (options.volume !== undefined) localStorage.setItem('serendib:volume', JSON.stringify(options.volume));
  const probe: Probe = { contexts: 0, resumes: 0, starts: [], stops: [], parameters: [], preGestureLaunch: false, suspend: () => {} };
  window.soundProbe = probe;
  class Param {
    constructor(private name: string) {}
    setValueAtTime(value: number, time: number) { probe.parameters.push({ name: this.name, method: 'set', value, time }); }
    linearRampToValueAtTime(value: number, time: number) { probe.parameters.push({ name: this.name, method: 'linear', value, time }); }
    exponentialRampToValueAtTime(value: number, time: number) { probe.parameters.push({ name: this.name, method: 'exponential', value, time }); }
  }
  class Node {
    connect() {} disconnect() {}
  }
  class Source extends Node {
    type = 'noise'; buffer: unknown; onended?: () => void;
    frequency = new Param('frequency');
    start() { probe.starts.push(this.type); }
    stop(time: number) { probe.stops.push({ type: this.type, time }); this.onended?.(); }
  }
  class Audio {
    currentTime = 10; sampleRate = 48000; destination = new Node();
    state = options.suspended ? 'suspended' : 'running';
    constructor() { probe.contexts++; probe.suspend = () => { this.state = 'suspended'; }; }
    resume() {
      probe.resumes++;
      if (options.rejected) return Promise.reject(new Error('Audio unavailable'));
      this.state = 'running'; return Promise.resolve();
    }
    createGain() { return Object.assign(new Node(), { gain: new Param('gain') }); }
    createOscillator() { return new Source(); }
    createBufferSource() { return new Source(); }
    createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
    createBiquadFilter() { return Object.assign(new Node(), { type: '', frequency: new Param('filter'), Q: new Param('Q') }); }
  }
  Object.defineProperty(window, 'AudioContext', { value: options.missing ? undefined : Audio, configurable: true });
  Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });
  if (options.synthetic) {
    const observer = new MutationObserver(() => {
      if (!document.documentElement.classList.contains('os-ready')) return;
      observer.disconnect();
      document.querySelector<HTMLElement>('[data-shell="desktop"] [aria-label="Dock"] [aria-label="Projects"]')!.click();
      probe.preGestureLaunch = true;
    });
    observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; errorsByPage.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(errorsByPage.get(page)).toEqual([]); });
test('menu opening ticks and both menu and pointer snapping thunk through the lazy synth', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true });
  await page.goto('/'); await openApp(page, 'Projects');
  const win = page.locator('[data-window-id="projects"]');
  await expect(win).toBeVisible();
  const bar = page.getByRole('menubar', { name: 'Application menus' });
  await bar.getByRole('menuitem', { name: 'Window', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.soundProbe.starts)).toContain('square');
  await page.getByRole('menuitem', { name: 'Snap left', exact: true }).click();
  await expect(win).toHaveAttribute('data-mode', 'snapped');
  await expect.poll(() => page.evaluate(() => window.soundProbe.parameters
    .filter(item => item.name === 'frequency' && item.value === 180))).toHaveLength(1);
  // Restore, then use the real title-bar controller and its edge dwell preview.
  await win.locator('[data-window-titlebar]').dblclick();
  await win.locator('[data-window-titlebar]').dblclick();
  await win.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); });
  const title = (await win.locator('[data-window-titlebar]').boundingBox())!;
  await page.mouse.move(title.x + 160, title.y + 20); await page.mouse.down();
  await page.mouse.move(1438, 400, { steps: 10 });
  await expect(page.locator('[data-snap-preview]')).toBeVisible();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.soundProbe.parameters
    .filter(item => item.name === 'frequency' && item.value === 180))).toHaveLength(2);
});
test('muted by default: window launches never create an AudioContext or fetch the synth', async ({ page }) => {
  await page.addInitScript(installAudioStub, {});
  const requests: string[] = []; page.on('request', request => { if (/\/sound\..*\.js/.test(request.url())) requests.push(request.url()); });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await openApp(page, 'Projects'); await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  await openApp(page, 'Terminal'); await expect(page.locator('[data-window-id="terminal"]')).toBeVisible();
  expect(await page.evaluate(() => window.soundProbe.contexts)).toBe(0); expect(requests).toEqual([]);
});
test('persisted sound and a synthetic launch create no context before a real gesture', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true, synthetic: true, volume: 0.25 });
  const synth = page.waitForResponse(response => /\/sound\..*\.js/.test(response.url()));
  await page.goto('/'); await synth; await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  expect(await page.evaluate(() => ({ contexts: window.soundProbe.contexts, synthetic: window.soundProbe.preGestureLaunch })))
    .toEqual({ contexts: 0, synthetic: true });
  await openApp(page, 'Terminal');
  await expect.poll(() => page.evaluate(() => window.soundProbe.starts)).toEqual(['sine']);
  const probe = await page.evaluate(() => window.soundProbe);
  expect(probe.contexts).toBe(1);
  expect(probe.parameters).toEqual(expect.arrayContaining([
    { name: 'gain', method: 'set', value: 0.25, time: 10 },
    { name: 'gain', method: 'linear', value: 0.05, time: 10.004 },
    { name: 'gain', method: 'exponential', value: 0.0001, time: 10.09 },
    { name: 'frequency', method: 'set', value: 660, time: 10 },
    { name: 'frequency', method: 'exponential', value: 990, time: 10.07 },
  ]));
});
test('enabled sound resumes suspension on a subsequent keyboard gesture without autoplay', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true, suspended: true });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  await expect.poll(() => page.evaluate(() => window.soundProbe.starts)).toEqual(['sine']);
  expect(await page.evaluate(() => window.soundProbe.resumes)).toBe(1);
  await page.evaluate(() => window.soundProbe.suspend()); await page.keyboard.press('Shift');
  await expect.poll(() => page.evaluate(() => window.soundProbe.resumes)).toBe(2);
  expect(await page.evaluate(() => window.soundProbe.starts)).toEqual(['sine']);
  await openApp(page, 'Terminal');
  await expect.poll(() => page.evaluate(() => window.soundProbe.starts.length)).toBe(2);
  expect(await page.evaluate(() => window.soundProbe.contexts)).toBe(1);
});
test('rapid repeats are throttled and later repeats still play', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true });
  await page.addInitScript(() => {
    let now = 100;
    Object.defineProperty(performance, 'now', { value: () => now });
    window.addEventListener('sound:advance', () => { now += 61; });
  });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  await expect.poll(() => page.evaluate(() => window.soundProbe.starts.length)).toBe(1);
  await page.evaluate(async url => {
    const { playSound } = await import(url);
    // Invoke the public API twice in one turn, after the initial shell sound.
    window.dispatchEvent(new Event('sound:advance')); playSound('pop'); playSound('pop');
  }, soundModule);
  expect(await page.evaluate(() => window.soundProbe.starts.length)).toBe(2);
  await page.evaluate(async url => {
    const { playSound } = await import(url);
    window.dispatchEvent(new Event('sound:advance')); playSound('pop');
  }, soundModule);
  expect(await page.evaluate(() => window.soundProbe.starts.length)).toBe(3);
  expect(await page.evaluate(() => window.soundProbe.contexts)).toBe(1);
});
test('the other sounds schedule their waveforms, noise filter and short click', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  await expect.poll(() => page.evaluate(() => window.soundProbe.starts)).toEqual(['sine']);
  await page.evaluate(async url => {
    const { playSound } = await import(url);
    for (const name of ['tock', 'swoosh', 'tick', 'thunk']) playSound(name);
  }, soundModule);
  const probe = await page.evaluate(() => window.soundProbe);
  expect(probe.starts).toEqual(['sine', 'triangle', 'noise', 'square', 'noise', 'sine']);
  expect(probe.parameters).toEqual(expect.arrayContaining([
    { name: 'frequency', method: 'linear', value: 300, time: 10.06 },
    { name: 'Q', method: 'set', value: 0.8, time: 10 },
    { name: 'filter', method: 'set', value: 1800, time: 10 },
    { name: 'filter', method: 'linear', value: 400, time: 10.26 },
    { name: 'frequency', method: 'set', value: 180, time: 10 },
  ]));
  expect(probe.stops).toEqual(expect.arrayContaining([{ type: 'noise', time: 10.005 }, { type: 'sine', time: 10.04 }]));
});
test('zero volume creates no context even after a gesture', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true, volume: 0 });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  await page.waitForLoadState('networkidle'); expect(await page.evaluate(() => window.soundProbe.contexts)).toBe(0);
});
test('missing Web Audio leaves window commands usable without errors', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true, missing: true });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  await page.waitForLoadState('networkidle'); await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  expect(await page.evaluate(() => window.soundProbe.contexts)).toBe(0);
});
test('rejected resume leaves window commands usable without errors', async ({ page }) => {
  await page.addInitScript(installAudioStub, { enabled: true, suspended: true, rejected: true });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  await expect.poll(() => page.evaluate(() => window.soundProbe.resumes)).toBe(1);
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  expect(await page.evaluate(() => window.soundProbe.starts)).toEqual([]);
});
test('the browser audio engine renders an audible pop and silence after its lifetime', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('serendib:sound', 'true');
    const audio = new OfflineAudioContext(1, 24000, 48000);
    // Use native nodes so automation errors or a silent envelope cannot pass a spy test.
    class Audio {
      state = 'running'; currentTime = 0; sampleRate = audio.sampleRate; destination = audio.destination;
      createGain = audio.createGain.bind(audio);
      createOscillator = audio.createOscillator.bind(audio);
      createBuffer = audio.createBuffer.bind(audio);
      createBufferSource = audio.createBufferSource.bind(audio);
      createBiquadFilter = audio.createBiquadFilter.bind(audio);
    }
    Object.defineProperty(window, 'AudioContext', { value: Audio, configurable: true });
    window.renderSound = async () => {
      const samples = (await audio.startRendering()).getChannelData(0);
      let peak = 0; let tail = 0;
      for (let i = 0; i < samples.length; i++) {
        peak = Math.max(peak, Math.abs(samples[i]!));
        if (i >= 4800) tail = Math.max(tail, Math.abs(samples[i]!));
      }
      return { peak, tail };
    };
  });
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
  await page.waitForLoadState('networkidle');
  const result = await page.evaluate(() => window.renderSound());
  expect(result.peak).toBeGreaterThan(0.02); expect(result.peak).toBeLessThanOrEqual(0.03);
  expect(result.tail).toBe(0);
});
test('captures the desktop with sound enabled in light and dark @visual', async ({ page }) => {
  const artifacts = resolve('.astro/p2-10-artifacts'); mkdirSync(artifacts, { recursive: true });
  await page.addInitScript(installAudioStub, { enabled: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme }); await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/os-ready/); await openApp(page, 'Projects');
    await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
    await page.screenshot({ path: resolve(artifacts, `sound-${theme}-desktop.png`) });
  }
});
