import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { test, expect, openApp, openMenu } from './fixtures';

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); });
async function settled(win: Locator) {
  await expect(win).toBeVisible();
  await expect.poll(() => win.evaluate(el => el.getAnimations().length)).toBe(0);
}
async function projects(page: Page) {
  await openApp(page, 'Projects'); const win = page.locator('[data-window-id="projects"]');
  await expect(win.locator('h1')).toHaveText('Projects'); await settled(win); return win;
}
async function startDrag(page: Page, win: Locator) {
  const handle = win.locator('[data-window-titlebar]');
  const bar = await handle.boundingBox();
  const point = { x: Math.max(100, Math.min(page.viewportSize()!.width - 100, bar!.x + Math.min(200, bar!.width / 2))), y: bar!.y + bar!.height / 2 };
  await handle.evaluate(el => el.addEventListener('pointerdown', event => { (el as HTMLElement).dataset.testPointerId = String((event as PointerEvent).pointerId); }, { once: true }));
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  return { ...point, pointerId: await handle.evaluate(el => Number((el as HTMLElement).dataset.testPointerId)) };
}
async function box(win: Locator) {
  const r = await win.boundingBox(); return { x: r!.x, y: r!.y, w: r!.width, h: r!.height };
}
async function rectIs(win: Locator, expected: { x: number; y: number; w: number; h: number }) {
  await expect.poll(async () => { const r = await box(win); return Math.max(...Object.entries(expected).map(([key, value]) => Math.abs(r[key as keyof typeof r] - value))); }).toBeLessThanOrEqual(1);
}
async function observeClose(win: Locator) {
  await win.evaluate(el => {
    Object.assign(window, { windowCloseObservation: null });
    const observer = new MutationObserver(() => {
      if (el.getAttribute('data-transition') !== 'close') return;
      Object.assign(window, { windowCloseObservation: { connected: el.isConnected, animations: el.getAnimations().length,
        dragging: el.hasAttribute('data-dragging'), interaction: document.documentElement.hasAttribute('data-window-interaction') } });
      observer.disconnect();
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-transition'] });
  });
}
async function closeWasAnimated(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const observed = (window as unknown as { windowCloseObservation: { connected: boolean; animations: number; dragging: boolean; interaction: boolean } | null }).windowCloseObservation;
    return !!observed?.connected && observed.animations > 0 && !observed.dragging && !observed.interaction;
  })).toBe(true);
}

test('drag commits the pointer delta and remembers normal geometry', async ({ page }, info) => {
  const win = await projects(page); const before = await box(win);
  await page.screenshot({ path: resolve(`.astro/k6-artifacts/screenshots/ring-${info.project.name}.png`) });
  const start = await startDrag(page, win);
  await page.mouse.move(start.x + 73, start.y + 51, { steps: 8 });
  await expect(win).toHaveAttribute('data-dragging', '');
  await expect.poll(() => win.locator('.k-ring > i').evaluate(el => el.getAnimations()[0]?.playState)).toBe('paused');
  await rectIs(win, { ...before, x: before.x + 73, y: before.y + 51 });
  // Geometry remains in the DOM until release, so a theme update must not reset it.
  await page.evaluate(() => {
    localStorage.setItem('serendib:theme', '"dark"');
    window.dispatchEvent(new StorageEvent('storage', { key: 'serendib:theme', newValue: '"dark"', storageArea: localStorage }));
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.mouse.up(); await expect(win).not.toHaveAttribute('data-dragging');
  await expect.poll(() => win.locator('.k-ring > i').evaluate(el => el.getAnimations()[0]?.playState)).toBe('running');
  await rectIs(win, { ...before, x: before.x + 73, y: before.y + 51 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:geometry:v1')!))).toMatchObject({ projects: { x: before.x + 73, y: before.y + 51 } });
  await page.keyboard.press('Alt+KeyW'); await expect(win).toHaveCount(0);
  await openApp(page, 'Projects'); await settled(win); await rectIs(win, { ...before, x: before.x + 73, y: before.y + 51 });
});

test('left snap waits at least 120ms, previews behind the frame and uses exact geometry', async ({ page }) => {
  const win = await projects(page);
  await page.evaluate(() => {
    const timing = { entered: 0, shown: 0 }; Object.assign(window, { snapTiming: timing });
    document.addEventListener('pointermove', e => { if (e.clientX <= 6 && !timing.entered) timing.entered = performance.now(); }, true);
    new MutationObserver(() => { if (!timing.shown && document.querySelector('[data-snap-preview="left"]')) timing.shown = performance.now(); }).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  await startDrag(page, win); await page.mouse.move(4, 350);
  const preview = page.locator('[data-snap-preview="left"]'); await expect(preview).toBeVisible();
  const timing = await page.evaluate(() => (window as unknown as { snapTiming: { entered: number; shown: number } }).snapTiming);
  expect(timing.shown - timing.entered).toBeGreaterThanOrEqual(120);
  expect(await preview.evaluate(el => Number(getComputedStyle(el).zIndex))).toBe((await win.evaluate(el => Number(getComputedStyle(el).zIndex))) - 1);
  await expect(preview).toHaveAttribute('data-valid', 'true');
  await expect(preview).toHaveCSS('border-style', 'dashed');
  await expect(preview).toHaveCSS('border-width', '3px');
  await expect(preview).toHaveCSS('backdrop-filter', 'none');
  await page.screenshot({ path: resolve('.astro/k6-artifacts/screenshots/snap-preview.png') });
  await page.mouse.up(); await settled(win); await expect(win).toHaveAttribute('data-mode', 'snapped');
  await rectIs(win, { x: 8, y: 40, w: await page.evaluate(() => Math.floor((document.documentElement.getBoundingClientRect().width - 24) / 2)), h: 776 });
  await expect(page.locator('[data-snap-preview]')).toHaveCount(0);
});

test('a fast edge throw does not snap and leaving a zone clears its preview', async ({ page }) => {
  const win = await projects(page); const before = await box(win); const start = await startDrag(page, win);
  // Deliver move + release in the same input turn, independent of remote browser latency.
  await win.locator('[data-window-titlebar]').evaluate((el, pointerId) => {
    for (const type of ['pointermove', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { pointerId, isPrimary: true, clientX: 4, clientY: 350, bubbles: true }));
  }, start.pointerId);
  await rectIs(win, { ...before, x: before.x + 4 - start.x, y: before.y + 350 - start.y }); await page.mouse.up();
  await expect(win).not.toHaveAttribute('data-dragging'); await expect(win).toHaveAttribute('data-mode', 'normal');
  await startDrag(page, win); await page.mouse.move(4, 350); await expect(page.locator('[data-snap-preview="left"]')).toBeVisible();
  await page.mouse.move(300, 350); await expect(page.locator('[data-snap-preview]')).toHaveCount(0); await page.mouse.up();
});

test('top snap maximises and dragging out restores the normal size under the pointer', async ({ page }) => {
  const win = await projects(page); const normal = await box(win);
  await startDrag(page, win); await page.mouse.move(600, 33); await expect(page.locator('[data-snap-preview="max"]')).toBeVisible();
  await page.mouse.up(); await settled(win); await rectIs(win, { x: 8, y: 40, w: await page.evaluate(() => document.documentElement.getBoundingClientRect().width - 16), h: 776 });
  const start = await startDrag(page, win); const ratio = (start.x - 8) / (await box(win)).w;
  await page.mouse.move(start.x + 120, start.y + 110, { steps: 8 }); await page.mouse.up(); await settled(win);
  await expect(win).toHaveAttribute('data-mode', 'normal');
  await rectIs(win, { x: Math.round(start.x + 120 - ratio * normal.w), y: start.y + 110 - 20, w: normal.w, h: normal.h });
});

test('an invalid quarter preview drops the window without violating its minimum', async ({ page }) => {
  const win = await projects(page); await startDrag(page, win); await page.mouse.move(4, 80);
  await expect(page.locator('[data-snap-preview="top-left"]')).toHaveAttribute('data-valid', 'false');
  await page.mouse.up(); await expect(win).toHaveAttribute('data-mode', 'normal');
  expect((await box(win)).h).toBeGreaterThanOrEqual(400);
});

test('double click zooms and restores; controls are not drag handles', async ({ page }) => {
  const win = await projects(page); const normal = await box(win); const bar = win.locator('[data-window-titlebar]');
  await bar.dblclick({ position: { x: 250, y: 26 } }); await settled(win); await rectIs(win, { x: 8, y: 40, w: await page.evaluate(() => document.documentElement.getBoundingClientRect().width - 16), h: 776 });
  await bar.dblclick({ position: { x: 250, y: 26 } }); await settled(win); await rectIs(win, normal);
  await win.getByRole('button', { name: 'Maximise Projects' }).click(); await settled(win); await expect(win).toHaveAttribute('data-mode', 'maximized');
  await expect(win).not.toHaveAttribute('data-dragging');
});

test('corner resize clamps Projects to 560x400 and keeps north/west opposite edges anchored', async ({ page }) => {
  const win = await projects(page); const r = await box(win);
  await page.mouse.move(r.x + r.w, r.y + r.h); await page.mouse.down();
  await page.mouse.move(r.x + 250, r.y + 180, { steps: 8 });
  await expect(win).toHaveAttribute('data-resizing', '');
  await expect.poll(() => win.locator('.k-ring > i').evaluate(el => el.getAnimations()[0]?.playState)).toBe('paused');
  await page.mouse.up();
  await rectIs(win, { ...r, w: 560, h: 400 });
  const small = await box(win);
  await page.mouse.move(small.x, small.y); await page.mouse.down(); await page.mouse.move(small.x - 80, small.y - 32, { steps: 4 }); await page.mouse.up();
  await rectIs(win, { x: small.x - 80, y: small.y - 32, w: 640, h: 432 });
});

test('resizing a maximised window returns it to normal mode', async ({ page }) => {
  const win = await projects(page); await page.keyboard.press('Alt+KeyZ'); await settled(win);
  const r = await box(win); await page.mouse.move(r.x + r.w, r.y + r.h); await page.mouse.down();
  await page.mouse.move(r.x + r.w - 100, r.y + r.h - 80, { steps: 4 }); await page.mouse.up();
  await expect(win).toHaveAttribute('data-mode', 'normal'); await rectIs(win, { ...r, w: r.w - 100, h: r.h - 80 });
});

test('minimise retains content and becomes hidden and inert only after the animation; dock restores', async ({ page }) => {
  const win = await projects(page);
  await win.locator('h1').evaluate(el => el.dataset.retained = 'yes');
  await page.keyboard.press('Alt+KeyM');
  await expect(win).toHaveAttribute('inert', '');
  await expect(win).toHaveAttribute('hidden', '');
  await expect(win.locator('h1')).toHaveAttribute('data-retained', 'yes');
  await openApp(page, 'Projects'); await settled(win); await expect(win).not.toHaveAttribute('inert');
  await expect(win.locator('h1')).toHaveAttribute('data-retained', 'yes'); await expect(win).toHaveAttribute('data-focused', 'true');
});

test('focus raises windows, close finishes its animation before removal and restores focus', async ({ page }) => {
  const projectsWindow = await projects(page); await openApp(page, 'Terminal'); const terminal = page.locator('[data-window-id="terminal"]'); await settled(terminal);
  await expect(projectsWindow).toHaveAttribute('data-focused', 'false');
  // A control in an unfocused window activates on its first click.
  await projectsWindow.getByRole('button', { name: 'Maximise Projects' }).click(); await settled(projectsWindow);
  await expect(projectsWindow).toHaveAttribute('data-focused', 'true');
  await projectsWindow.evaluate(el => {
    const observer = new MutationObserver(() => {
      if (el.getAttribute('data-transition') !== 'close') return;
      Object.assign(window, { closeObservation: { connected: el.isConnected, animations: el.getAnimations().length } });
      observer.disconnect();
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-transition'] });
  });
  await page.keyboard.press('Alt+KeyW');
  // Observe the short transition in-browser, before the automation round trip.
  await expect.poll(() => page.evaluate(() => {
    const observed = (window as unknown as { closeObservation?: { connected: boolean; animations: number } }).closeObservation;
    return !!observed?.connected && observed.animations > 0;
  })).toBe(true);
  await expect(projectsWindow).toHaveCount(0);
  await expect(terminal).toHaveAttribute('data-focused', 'true'); expect(await terminal.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Alt+KeyW'); await expect(terminal).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: 'Terminal', exact: true })).toBeFocused();
});

test('Tab wraps both ways between the first and last controls', async ({ page }) => {
  const win = await projects(page); const first = await page.locator('html').getAttribute('data-mode')==='mobile'?win.getByRole('link',{name:'Home',exact:true}):win.getByRole('radio', { name: 'Icons', exact: true }); const last = win.getByRole('option', { selected: true });
  await first.focus(); await page.keyboard.press('Shift+Tab'); await expect(last).toBeFocused();
  await page.keyboard.press('Tab'); await expect(first).toBeFocused();
  if (await page.locator('html').getAttribute('data-mode') === 'desktop') {
    await page.keyboard.press('Tab'); await expect(win.getByRole('searchbox', { name: 'Search projects' })).toBeFocused();
    for (const name of ['Minimise Projects', 'Maximise Projects', 'Close Projects']) {
      await page.keyboard.press('Tab'); await expect(win.getByRole('button', { name, exact: true })).toBeFocused();
    }
    await page.keyboard.press('Tab'); await expect(win.getByRole('link', { name: /^All projects/ })).toBeFocused();
  }
  await page.keyboard.press('Escape'); await expect(win).toBeVisible();
});

test('window containment lets an app widget handle Tab first', async ({ page }) => {
  const win = await projects(page); const zoom = await page.locator('html').getAttribute('data-mode')==='mobile'?win.getByRole('button',{name:'App commands'}):win.getByRole('button', { name: 'Maximise Projects' });
  await zoom.evaluate(el => el.addEventListener('keydown', event => {
    if ((event as KeyboardEvent).key === 'Tab') event.preventDefault();
  }));
  await zoom.focus(); await page.keyboard.press('Tab'); await expect(zoom).toBeFocused();
});

test('keyboard move/resize commits on Return and rolls back on Escape', async ({ page }) => {
  const win = await projects(page); const before = await box(win);
  const start = () => page.evaluate(() => document.dispatchEvent(new CustomEvent('window:keyboardMove', { detail: { windowId: 'projects' } })));
  await start(); await expect(win).toHaveAttribute('data-keyboard-move', '');
  await expect(win.locator('[data-window-titlebar] [role="status"]')).toHaveText('Arrows move · Shift ×8 · ⌥ + arrows resize · Return to finish · Esc to cancel');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Alt+ArrowRight');
  await rectIs(win, { x: before.x + 8, y: before.y + 64, w: before.w + 8, h: before.h });
  await page.keyboard.press('Escape'); await rectIs(win, before);
  await start(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Alt+ArrowDown'); await page.keyboard.press('Enter');
  await rectIs(win, { ...before, x: before.x + 8, h: before.h + 8 }); await expect(win).not.toHaveAttribute('data-keyboard-move');
});

test('Settings has disabled zoom, no resize handles and rejects keyboard resizing', async ({ page }) => {
  await openApp(page, 'Settings'); const win = page.locator('[data-window-id="settings"]'); await settled(win); const before = await box(win);
  await expect(win.locator('[data-resize-handle]')).toHaveCount(0);
  const zoom = win.getByRole('button', { name: 'Maximise Appearance', exact: true }); await expect(zoom).toHaveAttribute('aria-disabled', 'true');
  await zoom.click({ force: true }); await rectIs(win, before);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('window:keyboardMove', { detail: { windowId: 'settings' } })));
  await page.keyboard.press('Alt+Shift+ArrowRight'); await page.keyboard.press('Alt+Shift+ArrowDown'); await page.keyboard.press('Enter'); await rectIs(win, before);
});

test('pointer cancellation restores geometry and clears capture styles', async ({ page }) => {
  const win = await projects(page); const before = await box(win); const point = await startDrag(page, win);
  await page.mouse.move(point.x + 40, point.y + 50); await expect(win).toHaveAttribute('data-dragging', '');
  await win.locator('[data-window-titlebar]').dispatchEvent('pointercancel', { pointerId: point.pointerId });
  await page.mouse.up(); await rectIs(win, before); await expect(page.locator('html')).not.toHaveAttribute('data-window-interaction');
});

for (const theme of ['light', 'dark'] as const) test(`title bar variants and focused/unfocused rings match the chrome metrics in ${theme} @visual`, async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Visual artifacts are captured in Chromium.');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  mkdirSync(resolve('.astro/k6-artifacts/screenshots'), { recursive: true });
  await page.emulateMedia({ colorScheme: theme }); await page.reload(); await expect(page.locator('html')).toHaveClass(/os-ready/);
  const win = await projects(page); await openApp(page, 'Terminal'); const terminal = page.locator('[data-window-id="terminal"]'); await settled(terminal);
  expect(await win.locator('[data-window-titlebar]').evaluate(el => el.getBoundingClientRect().height)).toBe(52);
  expect(await terminal.locator('[data-window-titlebar]').evaluate(el => el.getBoundingClientRect().height)).toBe(30);
  await expect(terminal).toHaveAttribute('data-theme', 'dark');
  expect(await terminal.locator('h1').evaluate(el => getComputedStyle(el).color)).toBe('rgb(244, 238, 255)');
  expect(await win.locator('.k-winbtn-disc').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await terminal.locator('.k-winbtn-disc').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 201, 60)');
  expect(await win.locator('.k-ring > i').evaluate(el => el.getAnimations().length)).toBe(0);
  const spin = await terminal.locator('.k-ring > i').evaluate(el => el.getAnimations().map(animation => ({
    state: animation.playState, duration: animation.effect!.getTiming().duration,
    frames: (animation.effect as KeyframeEffect).getKeyframes(),
  })));
  expect(spin).toHaveLength(1); expect(spin[0]!.state).toBe('running'); expect(spin[0]!.duration).toBe(8000);
  expect(spin[0]!.frames.every(frame => 'transform' in frame)).toBe(true);
  await page.screenshot({ path: resolve(`.astro/k6-artifacts/screenshots/windows-${theme}-terminal-focused.png`) });
  await win.getByRole('button', { name: 'Maximise Projects' }).focus();
  const projectAxe = await new AxeBuilder({ page }).include('[data-window-id="projects"]').analyze();
  expect(projectAxe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await page.screenshot({ path: resolve(`.astro/k6-artifacts/screenshots/windows-${theme}-projects-focused.png`) });
  await page.keyboard.press('Alt+KeyW'); await expect(win).toHaveCount(0);
  await openMenu(page, 'Go'); await page.getByRole('menuitem', { name: 'Now', exact: true }).click();
  const paper = page.locator('[data-window-id="now"]'); await settled(paper);
  await expect(paper.locator('[data-window-titlebar]')).toHaveCSS('height', '40px');
  await expect(paper.locator('[data-window-titlebar]')).toHaveCSS('background-color', 'rgb(255, 226, 122)');
  await expect(paper.locator('.window-title')).toHaveCSS('font-weight', '700');
  await page.screenshot({ path: resolve(`.astro/k6-artifacts/screenshots/paper-${theme}.png`) });
  await page.keyboard.press('Alt+KeyW'); await expect(paper).toHaveCount(0);
  await openApp(page, 'About'); const about = page.locator('[data-window-id="about"]'); await settled(about);
  await expect(about.locator('.k-winbtns')).toHaveCSS('background-color', 'rgb(255, 247, 232)');
  await page.screenshot({ path: resolve(`.astro/k6-artifacts/screenshots/transparent-${theme}.png`) });
  const axe = await new AxeBuilder({ page }).include('[data-window-id="about"]').analyze();
  expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await page.keyboard.press('Alt+KeyW'); await expect(about).toHaveCount(0);
  await page.keyboard.press('Alt+KeyW'); await expect(terminal).toHaveCount(0);
  await page.emulateMedia({ colorScheme: theme }); await page.goto('/404');
  const alert = page.locator('#static-alert'); await expect(alert).toBeVisible();
  await expect(alert.locator('.static-titlebar')).toHaveCSS('height', '40px');
  await expect(alert.getByRole('link', { name: 'Close (back to the desktop)' })).toHaveAttribute('href', '/');
  expect(await alert.locator('.k-ring > i').evaluate(el => el.getAnimations().length)).toBe(0);
  await page.screenshot({ path: resolve(`.astro/k6-artifacts/screenshots/404-${theme}.png`) });
  expect(errors).toEqual([]);
});

test('ring pauses while hidden and honours motion, transparency and forced colours', async ({ page }) => {
  const win = await projects(page); const ring = win.locator('.k-ring > i');
  expect(await win.evaluate(el => !el.querySelector('.k-winbtns')!.contains(document.activeElement))).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => ring.evaluate(el => el.getAnimations()[0]?.playState)).toBe('paused');
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => ring.evaluate(el => el.getAnimations()[0]?.playState)).toBe('running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => ring.evaluate(el => el.getAnimations().length)).toBe(0);
  await expect(ring).toHaveCSS('transform', 'none');
  await page.locator('html').evaluate(el => el.setAttribute('data-motion', 'full'));
  await expect.poll(() => ring.evaluate(el => el.getAnimations()[0]?.playState)).toBe('running');
  await page.locator('html').evaluate(el => { el.setAttribute('data-motion', 'reduce'); el.setAttribute('data-transparency', 'reduce'); });
  await expect.poll(() => ring.evaluate(el => el.getAnimations().length)).toBe(0);
  await expect(win.locator('[data-window-titlebar]')).toHaveCSS('backdrop-filter', 'none');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(win.locator('.k-ring')).toBeHidden();
  await expect(win).toHaveCSS('border-width', '3px');
  await expect(win).toHaveCSS('border-color', await page.evaluate(() => {
    const probe = document.createElement('i'); probe.style.color = 'Highlight'; document.body.append(probe);
    const color = getComputedStyle(probe).color; probe.remove(); return color;
  }));
});

test('transparent Island controls remain clear of the right-side window buttons', async ({ page }) => {
  await openApp(page, 'Island'); const win = page.locator('[data-window-id="maps"]'); await settled(win);
  await expect(win.locator('.maps-view')).toBeVisible();
  const controls = await win.locator('.k-winbtns').boundingBox();
  const toolbar = await win.locator('.maps-toolbar').boundingBox();
  expect(toolbar!.x + toolbar!.width).toBeLessThan(controls!.x);
  const layers = win.getByRole('button', { name: /^Layers/ });
  await layers.click(); await expect(layers).toHaveAttribute('aria-expanded', 'true');
  await layers.click(); await expect(layers).toHaveAttribute('aria-expanded', 'false');
});

test('reduced motion uses opacity only for open, zoom, minimise, restore and close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const native = Element.prototype.animate; const calls: { id: string | undefined; keys: string[]; duration: number }[] = [];
    Object.assign(window, { windowAnimations: calls });
    Element.prototype.animate = function(frames, options) {
      const animation = native.call(this, frames, options);
      if (this instanceof HTMLElement && this.dataset.windowId) calls.push({ id: this.dataset.windowId,
        keys: (animation.effect as KeyframeEffect).getKeyframes().flatMap(frame => Object.keys(frame)), duration: Number((animation.effect as KeyframeEffect).getTiming().duration) });
      return animation;
    };
  });
  const win = await projects(page); await page.keyboard.press('Alt+KeyZ'); await settled(win);
  await page.keyboard.press('Alt+KeyM'); await expect(win).toHaveAttribute('hidden', '');
  await openApp(page, 'Projects'); await settled(win); await page.keyboard.press('Alt+KeyW'); await expect(win).toHaveCount(0);
  const animations = await page.evaluate(() => (window as unknown as { windowAnimations: { keys: string[]; duration: number }[] }).windowAnimations);
  expect(animations.length).toBeGreaterThanOrEqual(5);
  for (const animation of animations) { expect(animation.keys).toContain('opacity'); expect(animation.keys).not.toContain('transform'); expect(animation.duration).toBeLessThanOrEqual(120); }
});

test('loading skeleton is app specific and reduced motion disables its shimmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/WritingApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await openApp(page, 'Writing'); const win = page.locator('[data-window-id="writing"]');
    await expect(win.locator('[data-skeleton="three-pane"]')).toBeVisible();
    expect(await win.locator('.window-skeleton-bar').first().evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
    release(); await expect(win.locator('h1')).toHaveText('Writing'); await expect(win.locator('[data-skeleton]')).toHaveCount(0);
  } finally { release(); }
});

test('a prevented preload error renders update recovery instead of an endless skeleton', async ({ page }) => {
  await page.route('**/WritingApp.*.js', route => route.abort());
  await openApp(page, 'Writing'); const win = page.locator('[data-window-id="writing"]');
  await expect(win.getByRole('alert')).toContainText('Kottu OS was updated while you were here.');
  await expect(win.getByRole('link', { name: 'Open simple view' })).toHaveAttribute('href', '/writing#simple');
  await expect(win.getByRole('button', { name: 'Reload' })).toBeVisible(); await expect(win.locator('[data-skeleton]')).toHaveCount(0);
});

test('a runtime app exception stays inside its frame and Retry recovers focus', async ({ page }) => {
  await page.route('**/WritingApp.*.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    // The genuine compiled app and its ready() callback still run after recovery.
    const guarded = source.replace(/export\{(\w+) as default/, 'function guarded(props){if(!window.appRecovered)throw new Error("App render fixture");return $1(props)}export{guarded as default');
    expect(guarded).not.toBe(source);
    await route.fulfill({ response, body: guarded });
  });
  await openApp(page, 'Writing'); const win = page.locator('[data-window-id="writing"]');
  await expect(win.getByRole('alert')).toContainText("This app didn't load.");
  await expect(win.getByRole('button', { name: 'Try again' })).toBeFocused();
  await page.evaluate(() => Object.assign(window, { appRecovered: true }));
  await win.getByRole('button', { name: 'Try again' }).click(); await expect(win.locator('h1')).toHaveText('Writing');
  // The heading renders before the async app data and ready() focus handoff.
  await expect(win.getByRole('list', { name: 'Posts', exact: true }).getByRole('link')).toHaveCount(2);
  await expect.poll(() => win.evaluate(el => el.contains(document.activeElement))).toBe(true);
});

test('closing during pointer capture cleans the gesture before playing the close animation', async ({ page }) => {
  const win = await projects(page); const point = await startDrag(page, win);
  await page.mouse.move(point.x + 30, point.y + 40); await expect(win).toHaveAttribute('data-dragging', '');
  await observeClose(win);
  await page.keyboard.press('Alt+KeyW'); await expect(page.locator('html')).not.toHaveAttribute('data-window-interaction');
  await closeWasAnimated(page); await page.mouse.up(); await expect(win).toHaveCount(0);
});

test('an interrupted minimise restores without a stale completion hiding the frame', async ({ page }) => {
  const win = await projects(page); const normal = await box(win);
  await page.keyboard.press('Alt+KeyM'); await expect(win).toHaveAttribute('data-transition', 'minimize');
  await openApp(page, 'Projects'); await settled(win); await expect(win).not.toHaveAttribute('hidden'); await rectIs(win, normal);
});

test('a title click during entrance finishes at the reducer rect', async ({ page }) => {
  await openApp(page, 'Projects'); const win = page.locator('[data-window-id="projects"]');
  const bar = await win.locator('[data-window-titlebar]').boundingBox();
  await page.mouse.move(bar!.x + bar!.width / 2, bar!.y + bar!.height / 2); await page.mouse.down(); await page.mouse.up();
  await settled(win); await rectIs(win, { x: await page.evaluate(() => Math.round((document.documentElement.getBoundingClientRect().width - 960) / 2)), y: 68, w: 960, h: 640 });
});

test('keyboard movement cancels on focus change and allows the next close animation to finish', async ({ page }) => {
  const win = await projects(page); const normal = await box(win);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('window:keyboardMove', { detail: { windowId: 'projects' } })));
  await page.keyboard.press('ArrowRight'); await openApp(page, 'Terminal'); const terminal = page.locator('[data-window-id="terminal"]'); await settled(terminal);
  await expect(win).not.toHaveAttribute('data-keyboard-move'); await rectIs(win, normal); await expect(terminal).toHaveAttribute('data-focused', 'true');
  expect(await terminal.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await win.getByRole('button', { name: 'Maximise Projects' }).click(); await settled(win);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('window:keyboardMove', { detail: { windowId: 'projects' } })));
  await observeClose(win); await page.keyboard.press('Alt+KeyW'); await closeWasAnimated(page); await expect(win).toHaveCount(0);
  await expect(terminal).toHaveAttribute('data-focused', 'true');
});

test('ready remains stable and app title updates preserve the live drag rect', async ({ page }) => {
  await page.route('**/ProjectsApp.*.js', async route => {
    const response = await route.fetch(); const source = await response.text();
    const probe = source.replace(/export\{(\w+) as default/, 'function probe(props){(window.readyCallbacks??=[]).push(props.ready);window.updateAppTitle=props.setTitle;return $1(props)}export{probe as default');
    expect(probe).not.toBe(source); await route.fulfill({ response, body: probe });
  });
  // Reload after installing the probe: the desktop prefetches Projects while idle.
  await page.reload(); await expect(page.locator('html')).toHaveClass(/os-ready/);
  const win = await projects(page); const before = await box(win); const point = await startDrag(page, win);
  await page.mouse.move(point.x + 50, point.y + 30); await rectIs(win, { ...before, x: before.x + 50, y: before.y + 30 });
  await page.evaluate(() => (window as unknown as { updateAppTitle: (title: string) => void }).updateAppTitle('Projects renamed'));
  await expect(win).toHaveAccessibleName('Projects renamed');
  await expect(win).toHaveAttribute('data-dragging', ''); await rectIs(win, { ...before, x: before.x + 50, y: before.y + 30 });
  const callbacks = await page.evaluate(() => {
    const values = (window as unknown as { readyCallbacks: unknown[] }).readyCallbacks;
    return { renders: values.length, unique: new Set(values).size };
  });
  expect(callbacks.renders).toBeGreaterThan(1); expect(callbacks.unique).toBe(1);
  await page.mouse.up(); await rectIs(win, { ...before, x: before.x + 50, y: before.y + 30 });
});
