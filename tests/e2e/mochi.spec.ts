import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { test, expect, openApp } from './fixtures';
import type { Page } from '@playwright/test';

const pet = (page: Page) => page.getByRole('button', { name: 'Mochi, a small desk buddy. Press to pet.', exact: true });
const root = (page: Page) => page.locator('[data-mochi]');
const bubble = (page: Page) => page.locator('[data-mochi-bubble]');
async function ready(page: Page) {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/); await expect(pet(page)).toBeVisible();
}
async function prefs(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('serendib:mochi') ?? '{}') as { pets: number; pos: { x: number; y: number }; visible: boolean });
}
async function slowDrag(page: Page, x: number, y: number) {
  const box = (await pet(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  // A stationary release is slow even when the automated pointer moves rapidly.
  await page.evaluate(() => new Promise<void>(done => { const start = performance.now(); const frame = () => performance.now() - start >= 110 ? done() : requestAnimationFrame(frame); requestAnimationFrame(frame); }));
  await page.mouse.up();
}
async function menuAction(page: Page, label: string) {
  await pet(page).focus(); await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu', { name: 'Mochi context menu' })).toBeVisible();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}

test('loads on idle after first paint and keeps Mochi out of startup requests', async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks = new Map<number, IdleRequestCallback>(); let id = 0;
    type Fiber = { memoizedProps?: Record<string, unknown>; child?: Fiber; sibling?: Fiber };
    const dock = { commits: 0 }; let previous: Record<string, unknown> | undefined;
    const dockProps = (fiber: Fiber | undefined): Record<string, unknown> | undefined => {
      if (!fiber) return;
      if (fiber.memoizedProps?.['data-dock-mode'] === 'desktop') return fiber.memoizedProps;
      return dockProps(fiber.child) ?? dockProps(fiber.sibling);
    };
    Object.assign(window, { requestIdleCallback: (callback: IdleRequestCallback) => { callbacks.set(++id, callback); return id; },
      cancelIdleCallback: (key: number) => callbacks.delete(key),
      flushMochiIdle: () => { for (const callback of callbacks.values()) callback({ didTimeout: false, timeRemaining: () => 50 }); callbacks.clear(); },
      mochiIdleCount: () => callbacks.size, mochiDock: dock,
      __REACT_DEVTOOLS_GLOBAL_HOOK__: { supportsFiber: true, inject: () => 1,
        onCommitFiberRoot: (_id: number, value: { current: Fiber }) => {
          const props = dockProps(value.current); if (props && props !== previous) dock.commits++; previous = props;
        }, onCommitFiberUnmount: () => {} } });
  });
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await expect.poll(() => page.evaluate(() => (window as unknown as { mochiIdleCount(): number }).mochiIdleCount())).toBeGreaterThanOrEqual(2);
  expect(requests.filter(url => /\/(Mochi|api)\.[^/]+\.js/.test(url))).toEqual([]); await expect(root(page)).toHaveCount(0);
  const paint = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime);
  expect(paint).toBeGreaterThan(0);
  const commits = await page.evaluate(() => (window as unknown as { mochiDock: { commits: number } }).mochiDock.commits);
  expect(commits).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as { flushMochiIdle(): void }).flushMochiIdle()); await expect(pet(page)).toBeVisible();
  expect(requests.some(url => /\/Mochi\.[^/]+\.js/.test(url))).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { mochiDock: { commits: number } }).mochiDock.commits)).toBe(commits);
});

test('click pets show three hearts, the first milestone, and a persisted count', async ({ page }) => {
  await ready(page); await pet(page).click();
  await expect(root(page)).toHaveAttribute('data-mood', 'happy'); await expect(bubble(page)).toHaveText('Hehe. Again?');
  await expect(page.locator('.mochi-heart:visible')).toHaveCount(3); expect((await prefs(page)).pets).toBe(1);
  await expect(root(page).getByRole('status')).toHaveText('Hehe. Again?');
  await pet(page).click(); expect((await prefs(page)).pets).toBe(2);
  await expect(root(page).getByRole('status')).toHaveText('Hehe. Again?');
  await page.reload(); await expect(pet(page)).toBeVisible(); await pet(page).click(); expect((await prefs(page)).pets).toBe(3);
});

test('keyboard pets, context-menu navigation, tea, sleep, wake and hide are usable', async ({ page }) => {
  await ready(page); await pet(page).focus(); await page.keyboard.press('Enter'); expect((await prefs(page)).pets).toBe(1);
  await page.keyboard.press('Space'); expect((await prefs(page)).pets).toBe(2);
  await page.keyboard.press('Shift+F10'); await expect(page.getByRole('menuitem', { name: 'Pet', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'Give tea' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(bubble(page)).toHaveText('Ceylon tea. My favourite.'); await expect(pet(page)).toBeFocused();
  await menuAction(page, 'Put to sleep'); await expect(root(page)).toHaveAttribute('data-mood', 'sleep');
  await menuAction(page, 'Wake up'); await expect(bubble(page)).toHaveText("Oh. I wasn't sleeping. Promise.");
  await menuAction(page, 'Hide Mochi'); await expect(root(page)).toBeHidden(); expect((await prefs(page)).visible).toBe(false);
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Show Mochi', exact: true }).click(); await expect(pet(page)).toBeVisible();
});

test('a slow drag stays put, persists across reload, and never increments pets', async ({ page }) => {
  await ready(page); await slowDrag(page, 650, 500); await expect(root(page)).toHaveAttribute('data-physics', 'rest');
  const point = (await prefs(page)).pos; expect(point.x).toBeCloseTo(618, 0); expect(point.y).toBeCloseTo(468, 0); expect((await prefs(page)).pets ?? 0).toBe(0);
  await page.reload(); await expect(pet(page)).toBeVisible();
  const box = (await pet(page).boundingBox())!; expect(box.x).toBeCloseTo(point.x, 1); expect(box.y).toBeCloseTo(point.y, 1);
});

test('a fast fling becomes dizzy, bounces, and settles within the work area', async ({ page }) => {
  await ready(page); await slowDrag(page, 500, 450);
  // Control pointer timestamps: a loaded machine must not turn this fast gesture into a held release.
  await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 20));
  const box = (await pet(page).boundingBox())!;
  await page.mouse.move(box.x + 32, box.y + 32); await page.mouse.down();
  for (let step = 1; step <= 4; step++) {
    await page.clock.runFor(12); await page.mouse.move(500 + 125 * step, 450 - 30 * step);
  }
  await page.mouse.up();
  await expect(bubble(page)).toHaveText('Wheee.'); await expect(root(page)).toHaveAttribute('data-physics', 'fling');
  await expect(root(page)).toHaveAttribute('data-mood', 'dizzy');
  const bounced = page.evaluate(() => new Promise<boolean>(done => {
    const el = document.querySelector<HTMLElement>('[data-mochi]')!; let lastX = new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
    const sample = () => { const x = new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
      if (x < lastX - .1) return done(true); lastX = x;
      if (el.dataset.physics === 'rest') return done(false); requestAnimationFrame(sample); }; sample();
  }));
  await page.clock.runFor(500); expect(await bounced).toBe(true);
  await page.clock.runFor(3000); await expect(root(page)).toHaveAttribute('data-physics', 'rest');
  const final = (await pet(page).boundingBox())!; expect(final.x).toBeGreaterThanOrEqual(8); expect(final.y).toBeGreaterThanOrEqual(40);
  expect(final.x + final.width).toBeLessThanOrEqual(1432); expect(final.y + final.height).toBeLessThanOrEqual(816);
  expect((await prefs(page)).pos.x).toBeCloseTo(final.x, 1);
});

test('Kooda highlights during drag and returns Mochi to its previous position', async ({ page }) => {
  await ready(page); await slowDrag(page, 500, 450); const previous = (await prefs(page)).pos;
  const box = (await pet(page).boundingBox())!; const trash = page.locator('.os-dock [data-dock-app="trash"]'); const target = (await trash.boundingBox())!;
  await page.mouse.move(box.x + 32, box.y + 32); await page.mouse.down(); await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect(trash).toHaveAttribute('data-kooda-over', 'true'); await page.mouse.up();
  await expect(bubble(page)).toHaveText("Hey. I'm not rubbish."); await expect(trash).not.toHaveAttribute('data-kooda-over', 'true');
  expect((await prefs(page)).pos).toEqual(previous); await expect(root(page)).toHaveAttribute('data-physics', 'rest');
});

test('reduced motion has no body animations, hearts or fling, while drag still works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page); await pet(page).click();
  expect(await pet(page).evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0); await expect(page.locator('.mochi-heart:visible')).toHaveCount(0);
  const box = (await pet(page).boundingBox())!; await page.mouse.move(box.x + 32, box.y + 32); await page.mouse.down();
  await page.mouse.move(800, 400, { steps: 2 }); await page.mouse.up(); await expect(root(page)).toHaveAttribute('data-physics', 'rest');
  expect((await prefs(page)).pos).toEqual({ x: 768, y: 368 }); expect(await pet(page).evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test('naps after 45 seconds, respects the nap preference, and starts asleep in Colombo at night', async ({ page }) => {
  await ready(page); await expect(root(page)).toHaveAttribute('data-mood', 'sleep'); await page.clock.install(); await pet(page).click();
  await page.clock.fastForward(44_000); await expect(root(page)).toHaveAttribute('data-mood', 'idle');
  await page.clock.fastForward(1100); await expect(root(page)).toHaveAttribute('data-mood', 'sleep');
  await page.mouse.move(700, 500); await expect(bubble(page)).toHaveText("Oh. I wasn't sleeping. Promise.");
  await page.addInitScript(() => localStorage.setItem('serendib:mochi', JSON.stringify({ visible: true, naps: false, pos: null, pets: 0 })));
  await page.reload(); await expect(pet(page)).toBeVisible(); await pet(page).click(); await page.clock.fastForward(60_000);
  await expect(root(page)).toHaveAttribute('data-mood', 'idle');
});

test('window opens turn curious eyes toward their centre and fast window scroll surprises Mochi', async ({ page }) => {
  await ready(page); await openApp(page, 'About'); await expect(root(page)).toHaveAttribute('data-mood', 'curious');
  // Window creation precedes the lazy app; scroll its real root, not the skeleton.
  await expect(page.locator('[data-window-id="about"]').getByRole('heading', { name: 'Nipun Theekshana', exact: true })).toBeVisible();
  expect(await root(page).locator('.mochi__eyes').evaluate(element => (element as SVGElement).style.transform)).toContain('translate(');
  await page.locator('[data-window-id="about"]').evaluate(element => {
    const scroll = element.querySelector<HTMLElement>('[data-scroll-root]')!;
    const content = document.createElement('div'); content.style.height = '5000px'; scroll.append(content); scroll.scrollTop = 1200;
  });
  await expect(root(page)).toHaveAttribute('data-mood', 'surprised');
});

test('surface walking and a disappearing window cause a fall to the dock or work-area floor', async ({ page }) => {
  await page.clock.install(); await ready(page); await openApp(page, 'About'); const win = page.locator('[data-window-id="about"]');
  await win.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  const rect = (await win.boundingBox())!; await slowDrag(page, rect.x + 100, rect.y - 32);
  await expect(root(page)).toHaveAttribute('data-surface', 'about');
  // A gentle-drop remark can last 2.6 s before the 12 s idle stroll and its 1.8 s walk.
  await page.clock.runFor(15_000); await page.clock.runFor(2000);
  expect((await prefs(page)).pos.x).not.toBeCloseTo(rect.x + 68, 0);
  await win.getByRole('button', { name: 'Close About', exact: true }).click(); await expect(root(page)).toHaveAttribute('data-physics', 'fall');
  await page.clock.runFor(2000); await expect(root(page)).toHaveAttribute('data-physics', 'rest');
});

test('tab visibility pauses animation and mood deadlines until the tab returns', async ({ page }) => {
  await ready(page); await pet(page).click(); await page.clock.install();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(root(page)).toHaveAttribute('data-paused', 'true'); await page.clock.fastForward(5000); await expect(root(page)).toHaveAttribute('data-mood', 'happy');
  expect(await pet(page).evaluate(element => element.getAnimations({ subtree: true }).every(animation => animation.playState === 'paused'))).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(root(page)).toHaveAttribute('data-paused', 'false'); await page.clock.fastForward(1400); await expect(root(page)).toHaveAttribute('data-mood', 'idle');
});

for (const theme of ['light', 'dark'] as const) test(`${theme} Mochi is accessible and matches the character at 1440×900`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(value => localStorage.setItem('serendib:theme', JSON.stringify(value)), theme); await ready(page); await pet(page).click();
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.filter(item => item.impact === 'serious' || item.impact === 'critical');
  expect(violations).toEqual([]); expect(errors).toEqual([]);
  await mkdir('.astro/p3-12-artifacts', { recursive: true }); await page.screenshot({ path: `.astro/p3-12-artifacts/mochi-${theme}.png`, animations: 'disabled' });
});
