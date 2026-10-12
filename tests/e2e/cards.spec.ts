import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { transform } from 'esbuild';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const artifacts = resolve('.astro/k9-artifacts');
const cardSelector = '[data-k-card="salli"]';
// Exercise the final story grids while the legacy fixed phone home is present.
const containers = `
  [data-k-cards=highlights] { grid-template-columns:repeat(2,minmax(0,1fr));gap:40px 36px }
  [data-k-cards=side] { grid-template-columns:repeat(3,minmax(0,1fr));gap:32px }
  [data-k-cards=fun] { grid-template-columns:repeat(4,minmax(0,1fr));gap:32px }
  @media(max-width:1023px) {
    .phone-home { display:none!important } #story { display:block!important }
    [data-k-cards=highlights] { grid-template-columns:minmax(0,1fr) }
    [data-k-cards=side],[data-k-cards=fun] { grid-template-columns:repeat(2,minmax(0,1fr)) }
  }`;

async function visit(page: Page, selector = cardSelector) {
  await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
  await page.addStyleTag({ content: containers });
  const card = page.locator(selector);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute('data-card-ready');
  await page.evaluate(() => document.fonts.ready);
  return card;
}

async function centre(page: Page, selector = cardSelector) {
  await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect(); scrollTo(0, scrollY + r.top - (innerHeight - r.height) / 2);
  });
  await expect.poll(() => page.locator(selector).boundingBox()).not.toBeNull();
}

test('card assets, title-only link names and inert back faces are server rendered', async ({ page }) => {
  const card = await visit(page);
  await expect(card.getByRole('link', { name: 'Salli', exact: true })).toHaveAttribute('href', '/projects/salli');
  await expect(card.locator('.k-card-back')).toHaveAttribute('inert');
  await expect(card.locator('.k-card-back')).toHaveAttribute('aria-hidden', 'true');
  await expect(card.locator('.k-sticker img')).toHaveAttribute('alt', '');
  await expect(card.locator('.k-sticker img')).toHaveAttribute('loading', 'lazy');
  const shot = JSON.parse((await card.getAttribute('data-shot'))!);
  expect(shot.avif).toMatch(/ 640w$/); expect(shot.webp).toMatch(/ 640w$/);
  await expect(card.locator('.k-shot img')).toHaveCount(0);
  await expect(page.locator('.k-preview')).toHaveCount(0);
  await expect(page.locator('[data-k-card="pin-the-city"] .k-tab')).toHaveText('game · on this desktop');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    const result = await new AxeBuilder({ page }).include('[data-k-cards]').analyze();
    expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  }
});

test('fine pointer lift, sticker wobble, chip fan and peel match the choreography', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Fine-pointer choreography');
  const card = await visit(page); await centre(page);
  const chip = card.locator('.k-card-front .k-chips li').nth(2);
  const before = (await chip.boundingBox())!.x;
  await card.locator('.k-card-link').hover();
  await expect(card).toHaveCSS('translate', '-6px -8px', { timeout: 300 });
  expect(await card.evaluate(el => getComputedStyle(el).boxShadow)).toMatch(/14px 16px 0px/);
  expect(await card.locator('.k-sticker').evaluate(el => el.getAnimations().some(a => (a as CSSAnimation).animationName === 'stickerWobble' && a.playState === 'running'))).toBe(true);
  await expect.poll(async () => (await chip.boundingBox())!.x - before, { timeout: 600 }).toBeGreaterThan(40);
  await expect.poll(() => card.locator('.k-peel').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeCloseTo(44 / 28, 2);
});

test('one preview follows with spring lag, flips at edges, types, and becomes idle', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Fine-pointer follower');
  const card = await visit(page); await centre(page);
  await page.clock.install({ time: new Date('2026-10-12T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-12T12:00:01Z'));
  await page.evaluate(() => {
    const native = requestAnimationFrame;
    Object.assign(window, { k9Frames: 0 });
    window.requestAnimationFrame = callback => {
      if (new Error().stack?.includes('story-cards.')) (window as unknown as { k9Frames: number }).k9Frames++;
      return native(callback);
    };
  });
  await card.evaluate(el => el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 480 })));
  const preview = page.locator('.k-preview');
  await expect(preview).toHaveAttribute('aria-hidden', 'true');
  await expect(preview).toHaveCSS('pointer-events', 'none'); await expect(preview).toHaveCSS('z-index', '19');
  await page.clock.runFor(300);
  await card.evaluate(el => el.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 550, clientY: 480 })));
  await page.clock.runFor(50);
  const x = () => preview.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  expect(576 - await x()).toBeGreaterThan(100);
  await page.clock.runFor(850); expect(Math.abs(576 - await x())).toBeLessThan(4);
  await page.clock.runFor(300);
  await expect(preview.locator('.k-typed')).toHaveText('open github.com/prabhavalabs/salli');
  await expect(preview.locator('.k-hint')).toHaveCSS('opacity', '1');
  const settled = await page.evaluate(() => (window as unknown as { k9Frames: number }).k9Frames);
  await page.clock.runFor(300);
  expect(await page.evaluate(() => (window as unknown as { k9Frames: number }).k9Frames)).toBe(settled);
  await card.evaluate(el => el.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 1410, clientY: 840 })));
  await page.clock.runFor(1200);
  expect(Math.abs(await x() - (1410 - 380 - 26))).toBeLessThan(4);
  expect(await preview.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)).toBeLessThan(840 - 290);
  await card.evaluate(el => el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
  await page.clock.runFor(200); await expect(preview).toHaveCSS('opacity', '0');
  const stopped = await page.evaluate(() => (window as unknown as { k9Frames: number }).k9Frames);
  await page.clock.runFor(500);
  expect(await page.evaluate(() => (window as unknown as { k9Frames: number }).k9Frames)).toBe(stopped);
  const next = page.locator('[data-k-card="lanka-data-layer"]');
  await next.evaluate(el => el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 480 })));
  await expect(page.locator('.k-preview')).toHaveCount(1);
});

test('hover decodes the cover before revealing it and clicking opens the case study', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Desktop hover and window');
  const card = await visit(page); await centre(page); await card.locator('.k-card-link').hover();
  const shot = page.locator('.k-preview .k-shot');
  await expect(shot).toHaveAttribute('data-loaded');
  expect(await shot.locator('img').evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
  expect(await shot.locator('img').evaluate(img => (img as HTMLImageElement).currentSrc)).toContain('.avif');
  const ring = await page.locator('.k-preview').evaluate(el => {
    const style = getComputedStyle(el);
    return { angle: parseFloat(style.getPropertyValue('--k-angle')), gradient: parseFloat(style.backgroundImage.match(/conic-gradient\(from ([\d.]+)deg/)![1]!), duration: style.animationDuration };
  });
  expect(ring.gradient).toBeCloseTo(ring.angle, 2); expect(ring.duration).toBe('4s');
  await card.locator('.k-card-link').click();
  await expect(page).toHaveURL(/\/projects\/salli/);
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
  await expect(page.locator('.k-preview')).toBeHidden();
});

test('focus-visible docks, Escape hides, and keyboard Enter opens without flipping', async ({ page }, info) => {
  const card = await visit(page);
  await card.evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().top - 430));
  await page.keyboard.press('Tab'); await card.locator('.k-card-link').focus();
  await expect(card.locator('.k-card-link')).toBeFocused();
  await expect(card).toHaveCSS('outline-width', '3px');
  const preview = page.locator('.k-preview');
  if (info.project.name === 'chromium') {
    await expect(preview).toHaveAttribute('data-docked', 'true');
    expect(await preview.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).b)).toBe(0);
    await expect(preview.locator('.k-typed')).toHaveText('open github.com/prabhavalabs/salli');
    const p = (await preview.boundingBox())!, c = (await card.boundingBox())!;
    expect(Math.abs(p.x + p.width - c.x - c.width)).toBeLessThan(1);
    expect(Math.abs(p.y + p.height + 12 - c.y)).toBeLessThan(1);
    await page.keyboard.press('Escape'); await expect(preview).toHaveCSS('opacity', '0', { timeout: 200 });
  } else await expect(preview).toHaveCount(0);
  await page.keyboard.press('Enter'); await expect(card).not.toHaveAttribute('data-flipped');
  await expect(page).toHaveURL(/\/projects\/salli/);
  if (info.project.name.startsWith('mobile')) await expect(page.locator('[data-sheet]:visible')).toBeVisible();
  else await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
});

test('system and explicit reduced motion dock instantly with static chips and full text', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Desktop reduced-motion preview');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const card = await visit(page); await centre(page); await card.locator('.k-card-link').hover();
  await expect(card).toHaveCSS('translate', /^0px(?: 0px)?$/);
  await expect(card.locator('.k-sticker')).toHaveCSS('animation-name', 'none');
  const chip = card.locator('.k-card-front .k-chips li').nth(2);
  await expect(chip).toHaveCSS('translate', /^0px(?: 0px)?$/); await expect(chip).toHaveCSS('rotate', '0deg');
  await expect(page.locator('.k-preview')).toHaveAttribute('data-docked', 'true');
  await expect(page.locator('.k-preview .k-typed')).toHaveText('open github.com/prabhavalabs/salli');
  await expect(page.locator('.k-caret')).toHaveCSS('animation-name', 'none');
  await page.evaluate(() => document.documentElement.dataset.motion = 'full');
  await expect(card).toHaveAttribute('data-reduced', 'false');
  await expect(card.locator('.k-sticker')).not.toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.documentElement.dataset.motion = 'reduce');
  await expect(card).toHaveAttribute('data-reduced', 'true'); await expect(card.locator('.k-sticker')).toHaveCSS('animation-name', 'none');
});

test('touch flips, moves focus, unflips the previous card, and opens a sheet on second tap', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Touch phone behavior');
  const card = await visit(page);
  const front = (await card.boundingBox())!;
  for (const chip of await card.locator('.k-card-front .k-chips li').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()))) {
    expect(chip.x).toBeGreaterThanOrEqual(front.x); expect(chip.x + chip.width).toBeLessThanOrEqual(front.x + front.width);
  }
  await card.locator('.k-card-link').tap();
  await expect(card).toHaveAttribute('data-flipped'); await expect(card.locator('.k-card-back')).not.toHaveAttribute('inert');
  await expect(card.locator('.k-card-front')).toHaveAttribute('inert'); await expect(card.locator('.k-card-open')).toBeFocused();
  const back = (await card.boundingBox())!;
  for (const action of await card.locator('.k-card-actions a').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()))) {
    expect(action.y).toBeGreaterThanOrEqual(back.y); expect(action.y + action.height).toBeLessThanOrEqual(back.y + back.height);
  }
  await expect(card.locator('.k-card-back .k-shot')).toHaveAttribute('data-loaded');
  await expect(page.locator('.k-preview')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).include('[data-k-cards="highlights"]').analyze();
  expect(accessibility.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.evaluate(() => scrollBy(0, 20)); await expect(card).toHaveAttribute('data-flipped');
  const next = page.locator('[data-k-card="lanka-data-layer"]'); await next.locator('.k-card-link').tap();
  await expect(card).not.toHaveAttribute('data-flipped'); await expect(card.locator('.k-card-back')).toHaveAttribute('inert');
  await card.locator('.k-card-link').tap(); await expect(next).not.toHaveAttribute('data-flipped');
  await expect(card.locator('.k-card-open')).toBeFocused();
  await expect(card.locator('.k-card-back .k-command')).toBeVisible();
  await card.locator('.k-card-back .k-command').tap();
  await expect(page).toHaveURL(/\/projects\/salli/); await expect(page.locator('[data-sheet]:visible')).toBeVisible();
});

test('compact phone backs have 44px actions, no overflow, and pass axe in both themes', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('mobile'), 'Compact phone cards');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    const card = await visit(page, '[data-k-cards="side"] [data-k-card]:first-child'); await card.locator('.k-card-link').tap();
    await expect(card.locator('.k-card-open')).toBeFocused();
    for (const box of await card.locator('.k-card-actions a').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()))) {
      expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const result = await new AxeBuilder({ page }).include('[data-k-cards="side"]').analyze();
    expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? '')).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  }
});

test('pen flips, mouse and zero-detail keyboard activation open directly', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Mixed input types');
  const card = await visit(page);
  await card.evaluate(el => el.querySelector('.k-card-link')!.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'pen', detail: 1 })));
  await expect(card).toHaveAttribute('data-flipped'); await expect(card.locator('.k-card-open')).toBeFocused();
  const next = page.locator('[data-k-card="lanka-data-layer"]');
  await next.evaluate(el => el.querySelector<HTMLElement>('.k-card-link')!.click());
  await expect(next).not.toHaveAttribute('data-flipped'); await expect(page).toHaveURL(/\/projects\/lanka-data-layer/);
});

test('a narrow phone shell creates no preview even with a fine desktop pointer', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Responsive fine-pointer phone mode');
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await visit(page);
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'mobile');
  await card.locator('.k-card-link').hover(); await page.keyboard.press('Tab'); await card.locator('.k-card-link').focus();
  await expect(page.locator('.k-preview')).toHaveCount(0);
});

test('forced colors keep visible card focus and readable faces', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  const card = await visit(page); await page.keyboard.press('Tab'); await card.locator('.k-card-link').focus();
  await expect(card).toHaveCSS('border-top-width', '1px'); await expect(card).toHaveCSS('outline-width', '3px');
  await expect(card.locator('.k-peel')).toBeHidden();
  expect(await card.evaluate(el => getComputedStyle(el).color !== getComputedStyle(el).backgroundColor)).toBe(true);
});

test('card interaction preserves layout and has no console or page errors', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const card = await visit(page);
  await page.evaluate(() => {
    Object.assign(window, { k9Cls: 0, k9Shifts: [] });
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
      for (const entry of list.getEntries()) { const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean; sources: { node: Element | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] };
        if (!shift.hadRecentInput) {
          const metrics = window as unknown as { k9Cls: number; k9Shifts: unknown[] };
          metrics.k9Cls += shift.value;
          metrics.k9Shifts.push({ value: shift.value, sources: shift.sources.map(source => ({ node: source.node?.outerHTML?.slice(0, 300), before: source.previousRect.toJSON(), after: source.currentRect.toJSON() })) });
        } }
    }).observe({ type: 'layout-shift' });
  });
  const before = await card.evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }));
  if (info.project.name.startsWith('mobile')) {
    await card.locator('.k-card-link').tap(); await expect(card.locator('.k-card-open')).toBeFocused();
  } else { await card.locator('.k-card-link').hover(); await expect(page.locator('.k-preview .k-shot')).toHaveAttribute('data-loaded'); }
  await expect(info.project.name.startsWith('mobile') ? card.locator('.k-card-back .k-typed') : page.locator('.k-preview .k-typed')).toHaveText('open github.com/prabhavalabs/salli');
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  expect(await card.evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }))).toEqual(before);
  const shifts = await page.evaluate(() => {
    const { k9Cls, k9Shifts } = window as unknown as { k9Cls: number; k9Shifts: unknown[] };
    return { k9Cls, k9Shifts };
  });
  expect(shifts.k9Cls, JSON.stringify(shifts.k9Shifts)).toBe(0);
  expect(errors).toEqual([]);
});

test('no-JS cards remain ordinary title-only links with hidden backs', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage(); await page.goto('/#simple');
    const card = page.locator(cardSelector); await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole('link', { name: 'Salli', exact: true })).toBeVisible();
    await expect(card.locator('.k-card-back')).toBeHidden(); await card.locator('.k-card-link').click();
    await expect(page).toHaveURL(/\/projects\/salli/);
  } finally { await context.close(); }
});

test('card-only stylesheet and lazy closure meet their budgets', async () => {
  const css = await transform(readFileSync('src/styles/cards.css', 'utf8'), { loader: 'css', minify: true });
  expect(gzipSync(css.code).length).toBeLessThanOrEqual(Math.floor(1.6 * 1024));
  const budget = JSON.parse(readFileSync('dist/client/.budgets.json', 'utf8'));
  const cards = budget.rows.find((row: { metric: string; resource: string }) => row.metric === 'K story chunk' && row.resource.includes('/story-cards.'));
  expect(cards.bytes).toBeLessThanOrEqual(4096);
  expect(budget.rows.find((row: { metric: string; resource: string }) => row.metric === 'B1 initial JS' && row.resource === 'index.html').bytes).toBeLessThanOrEqual(114688);
});

test('capture light, dark, focus, edge, reduced motion, phones and six hover frames', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-webkit', 'One desktop and one phone artifact set');
  mkdirSync(resolve(artifacts, 'screenshots'), { recursive: true }); mkdirSync(resolve(artifacts, 'frames'), { recursive: true });
  const capture = (name: string) => page.screenshot({ path: resolve(artifacts, 'screenshots', `${name}.png`), scale: 'css' });
  if (info.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 390, height: 844 }); const card = await visit(page);
    await capture('phone-front'); await card.locator('.k-card-link').tap(); await expect(card.locator('.k-card-open')).toBeFocused();
    await expect(card.locator('.k-shot')).toHaveAttribute('data-loaded');
    await expect(card.locator('.k-card-back .k-typed')).toHaveText('open github.com/prabhavalabs/salli'); await capture('phone-back');
    await page.emulateMedia({ reducedMotion: 'reduce' }); const compact = await visit(page, '[data-k-cards="side"] [data-k-card]:first-child');
    await compact.locator('.k-card-link').tap(); await expect(compact.locator('.k-card-open')).toBeFocused(); await capture('phone-reduced-back');
    return;
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const [kind, selector] of [['highlight', cardSelector], ['standard', '[data-k-cards="side"] [data-k-card]:first-child']]) {
      const card = await visit(page, selector); await centre(page, selector); await page.mouse.move(5, 50); await capture(`${kind}-${theme}-rest`);
      await card.locator('.k-card-link').hover(); await expect(page.locator('.k-preview .k-shot')).toHaveAttribute('data-loaded');
      await expect(page.locator('.k-preview')).toHaveAttribute('data-complete');
      await expect(page.locator('.k-preview')).toHaveCSS('scale', '1');
      await expect(card).toHaveCSS('translate', '-6px -8px'); await capture(`${kind}-${theme}-hover`);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' }); const card = await visit(page);
  await card.evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().top - 430));
  await page.keyboard.press('Tab'); await card.locator('.k-card-link').focus(); await expect(page.locator('.k-preview')).toHaveAttribute('data-docked', 'true');
  await expect(page.locator('.k-preview')).toHaveAttribute('data-complete'); await expect(page.locator('.k-preview')).toHaveCSS('scale', '1'); await capture('focus-visible');
  await page.keyboard.press('Escape'); await card.locator('.k-card-link').blur();
  await card.evaluate(el => el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 1410, clientY: 600 })));
  await expect(page.locator('.k-preview .k-shot')).toHaveAttribute('data-loaded');
  await expect(page.locator('.k-preview')).toHaveAttribute('data-complete'); await expect(page.locator('.k-preview')).toHaveCSS('scale', '1'); await capture('preview-right-edge');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(card).toHaveAttribute('data-reduced', 'true'); await capture('reduced-motion');
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.mouse.move(5, 50);
  await card.locator('.k-card-link').hover();
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: resolve(artifacts, 'frames', `hover-${i + 1}.png`), scale: 'css' });
    if (i < 5) await page.waitForTimeout(120);
  }
});
