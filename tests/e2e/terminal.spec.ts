import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page, Locator } from '@playwright/test';
import { test, expect, openMenu, openApp } from './fixtures';
import { expectAboveKeyboard, expectAccessibleSheet, expectNoHorizontalOverflow, expectTapTargets, hideKeyboard, openFromHome, phoneOnly, showKeyboard } from './phone-sheet-checks';

const terminal = (page: Page, id = 'terminal') => page.locator(`[data-window-id="${id}"]`);
const output = (win: Locator) => win.locator('.terminal-output > [aria-live="off"]');
async function start(page: Page) {
  await page.goto('/terminal');
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  const win = terminal(page); await expect(win.getByRole('textbox', { name: 'Terminal command' })).toBeVisible(); return win;
}
async function command(win: Locator, source: string) {
  const input = win.locator('.terminal-input-wrap input');
  await expect(input).not.toHaveAttribute('readonly'); await input.fill(source); await input.press('Enter');
  // Enter can return before React has committed the submitted command.
  await expect(input).toHaveValue('');
  await expect(input).not.toHaveAttribute('readonly');
}

test('help, hidden files, && navigation, 18 content files, cat and unknown commands', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const win = await start(page);
  await command(win, 'help'); await expect(output(win)).toContainText('Explore: ls, cd, pwd, cat, open');
  await command(win, 'ls -a'); await expect(output(win)).toContainText('.secrets');
  await command(win, 'cd projects && ls');
  // Offscreen scrollback uses content-visibility; Firefox omits it from innerText.
  const files = (await output(win).textContent())!; expect(files.match(/[a-z0-9-]+\.md/g)).toHaveLength(19); // about.md plus 18 projects
  await command(win, 'cd ~ && cat now.txt'); await expect(output(win)).toContainText('Updated');
  await command(win, 'no-such-command'); await expect(output(win)).toContainText('nsh: command not found: no-such-command. Try help.');
  await expect(win.locator('.term-err').last()).toHaveText('no-such-command'); expect(errors).toEqual([]);
});

test('Tab completion, double Tab candidates, history draft and persistent recall', async ({ page }) => {
  const win = await start(page); const input = win.getByRole('textbox', { name: 'Terminal command' });
  await input.fill('neo'); await input.press('Tab'); await expect(input).toHaveValue('neofetch ');
  await input.press('Enter'); await expect(output(win)).toContainText('18 projects, 2 posts');
  await input.fill('draft'); await input.press('ArrowUp'); await expect(input).toHaveValue('neofetch ');
  await input.press('ArrowDown'); await expect(input).toHaveValue('draft');
  await input.fill('cat no'); await input.press('Tab'); await expect(input).toHaveValue('cat now.txt ');
  await input.fill('c'); await input.press('Tab'); await input.press('Tab'); await expect(output(win)).toContainText('cat  cd  clear  contact  cv');
  await command(win, 'echo persisted'); await page.reload();
  await expect(page.locator('#static-window')).toHaveAttribute('hidden', ''); await input.focus(); await input.press('ArrowUp'); await expect(input).toHaveValue('echo persisted');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:terminal:history')!))).toEqual(['neofetch ', 'echo persisted']);
});

test('completion cannot replace a later select-all selection on the next frame', async ({ page }) => {
  const win = await start(page); const input = win.getByRole('textbox', { name: 'Terminal command' });
  await command(win, 'cat now.txt'); await expect(output(win)).toContainText('Updated');
  await page.evaluate(() => {
    const request = window.requestAnimationFrame; const cancel = window.cancelAnimationFrame;
    const queued = new Map<number, FrameRequestCallback>(); let id = 0;
    window.requestAnimationFrame = callback => { queued.set(++id, callback); return id; };
    window.cancelAnimationFrame = handle => { queued.delete(handle); };
    Object.assign(window, { releaseTerminalFrames: () => {
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      const callbacks = [...queued.values()]; queued.clear(); callbacks.forEach(callback => callback(performance.now()));
    } });
  });
  try {
    await input.fill('cat no'); await input.press('Tab'); await expect(input).toHaveValue('cat now.txt ');
    await expect(input).not.toHaveAttribute('readonly');
    await input.evaluate(element => {
      (element as HTMLInputElement).select();
      (window as unknown as { releaseTerminalFrames(): void }).releaseTerminalFrames();
    });
    await page.keyboard.insertText('c'); await expect(input).toHaveValue('c');
    await input.press('Tab'); await expect(input).not.toHaveAttribute('readonly'); await input.press('Tab');
    await expect(output(win)).toContainText('cat  cd  clear  contact  cv');
  } finally { await page.evaluate(() => (window as unknown as { releaseTerminalFrames(): void }).releaseTerminalFrames()); }
});

test('open projects/salli and output links open the matching window; exit closes this instance', async ({ page }) => {
  const win = await start(page);
  await command(win, 'open projects/salli'); await expect(page.locator('[data-window-id="projects"]')).toBeVisible(); await expect(page).toHaveURL(/\/projects\/salli/);
  if(await page.locator('html').getAttribute('data-mode')==='mobile')await openApp(page,'Terminal');
  await win.getByRole('textbox', { name: 'Terminal command' }).focus(); await command(win, 'writing');
  const link = output(win).getByRole('link', { name: 'an-island-made-of-points', exact: true }); await link.click();
  await expect(page.locator('[data-window-id="writing"]')).toBeVisible();
  if(await page.locator('html').getAttribute('data-mode')==='mobile')await openApp(page,'Terminal');
  const input = win.getByRole('textbox', { name: 'Terminal command' }); await input.focus(); await input.fill('exit'); await input.press('Enter'); await expect(win).toHaveCount(0);
  if(await page.locator('html').getAttribute('data-mode')==='mobile')await openApp(page,'Projects');
  await expect(page.locator('[data-window-id="projects"]')).toBeVisible();
});

test('a loading app owns focus and cannot raise itself after returning to Terminal', async ({ page }) => {
  let release!: () => void; const held = new Promise<void>(done => { release = done; });
  await page.route('**/data/work/salli.json', async route => { await held; await route.continue(); });
  try {
    const win = await start(page); const input = win.getByRole('textbox', { name: 'Terminal command' });
    await command(win, 'open projects/salli');
    const projects = page.locator('[data-window-id="projects"]');
    await expect(projects).toBeFocused();
    const phone=await page.locator('html').getAttribute('data-mode')==='mobile';
    if(phone)await openApp(page,'Terminal');
    await input.focus(); await expect(win).toHaveAttribute('data-focused', 'true');
    release();
    if(phone){await expect(projects.getByRole('heading', { name: 'Salli', exact: true, includeHidden:true })).toBeAttached();await expect(projects.getByRole('definition',{includeHidden:true}).filter({ hasText: '99.52%' })).toBeAttached();}
    else{await expect(projects.getByRole('heading', { name: 'Salli', exact: true })).toBeVisible();await expect(projects.getByRole('definition').filter({ hasText: '99.52%' })).toBeVisible();}
    await expect(win).toHaveAttribute('data-focused', 'true'); await expect(input).toBeFocused();
    await command(win, 'writing');
    await output(win).getByRole('link', { name: 'an-island-made-of-points', exact: true }).click();
    await expect(page.locator('[data-window-id="writing"]')).toHaveAttribute('data-focused', 'true');
  } finally { release(); }
});

test('?cmd=neofetch runs once, removes cmd with replace and rejects arbitrary command links', async ({ page }) => {
  await page.goto('/terminal?cmd=neofetch'); const win = terminal(page);
  await expect(output(win)).toContainText('Kottu OS 2.0 "Pettah"');
  await expect(output(win)).toContainText('Kernel    Astro 7 + React 19');
  await expect(output(win)).toContainText('WM        Hyprland-ish (in your browser)');
  await expect(win.locator('.terminal-input-line > span')).toHaveText('nipun@kottu:~$ ');
  await expect(output(win)).toContainText('Kernel'); await expect(page).toHaveURL(/\/terminal$/);
  await expect(output(win).locator('.terminal-line', { hasText: 'Packages' })).toHaveCount(1);
  await command(win, 'theme dark'); await expect(output(win).locator('.terminal-line', { hasText: 'Packages' })).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:terminal:history')!))).toEqual(['theme dark']);
  await page.goto('/terminal?cmd=theme%20light'); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(output(terminal(page))).not.toContainText('theme light');
});

test('OS preferences, screensaver and duplicate sessions use existing APIs', async ({ page }) => {
  const win = await start(page); const input = win.getByRole('textbox', { name: 'Terminal command' });
  await command(win, 'theme dark && accent lagoon && wallpaper paper && sound on');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.locator('html')).toHaveAttribute('data-accent', 'lagoon');
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'paper');
  expect(await page.evaluate(() => localStorage.getItem('serendib:sound'))).toBe('true');
  await command(win, 'cd projects'); await input.press('Alt+KeyN');
  const second = terminal(page, 'terminal~2'); await expect(second).toBeVisible();
  await command(second, 'pwd'); await expect(output(second)).toContainText('/home/nipun'); await expect(second.locator('.window-title')).toContainText('nsh 2');
  await expect(win.locator('.terminal-input-line')).toContainText('~/projects');
  await command(second, 'sleep'); await expect(page.locator('.screensaver')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('.screensaver')).toHaveCount(0);
  const secondInput = second.getByRole('textbox', { name: 'Terminal command' }); await secondInput.fill('exit'); await secondInput.press('Enter'); await expect(second).toHaveCount(0); await expect(win).toBeVisible();
});

test('keyboard shortcuts, text-size limits, menu commands, and focus escape via Shift Tab', async ({ page }) => {
  const win = await start(page); const input = win.getByRole('textbox', { name: 'Terminal command' });
  await input.fill('abcdef'); await input.press('Control+KeyA'); expect(await input.evaluate(el => (el as HTMLInputElement).selectionStart)).toBe(0);
  await input.press('Control+KeyE'); expect(await input.evaluate(el => (el as HTMLInputElement).selectionStart)).toBe(6);
  await input.press('Control+KeyC'); await expect(input).toHaveValue(''); await expect(output(win)).toContainText('^C');
  for (let i = 0; i < 8; i++) await input.press('Alt+Equal'); await expect(win.locator('.terminal-body')).toHaveCSS('font-size', '17px');
  await openMenu(page, 'View');
  await expect(page.getByRole('menuitem', { name: 'Bigger text', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Smaller text', exact: true }).click(); await expect(win.locator('.terminal-body')).toHaveCSS('font-size', '16px');
  await input.focus(); await input.press('Control+KeyL'); await expect(output(win)).toHaveText('');
  await input.press('Shift+Tab'); await expect(input).not.toBeFocused(); expect(await win.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await win.locator('.terminal-body').click({ position: { x: 20, y: 50 } }); await expect(input).toBeFocused();
});

test('failed content can be retried and Control C prevents a pending open from taking effect', async ({ page }) => {
  const win = await start(page); let attempts = 0;
  await page.route('**/data/profile.json', async route => {
    attempts++; if (attempts === 1) await route.fulfill({ status: 503, body: '{}' }); else await route.continue();
  });
  await command(win, 'now'); await expect(output(win)).toContainText("Couldn't load data (503). Try again.");
  await command(win, 'now'); await expect(output(win)).toContainText('Updated');
  await page.unroute('**/data/profile.json'); await page.reload(); await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.route('**/data/projects.json', async route => { await hold; await route.continue(); });
  try {
    const input = win.getByRole('textbox', { name: 'Terminal command' }); await input.fill('open projects/salli'); await input.press('Enter');
    await expect(input).toHaveAttribute('readonly', ''); await input.press('Control+KeyC'); release();
    await command(win, 'echo still here'); await expect(output(win)).toContainText('still here'); await expect(page.locator('[data-window-id="projects"]')).toHaveCount(0);
  } finally { release(); }
});

test('static banner and help survive adoption with matching text, rect, scroll and zero CLS @visual', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(done => { release = done; });
  await page.addInitScript(() => {
    Object.assign(window, { terminalCls: 0 });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) (window as unknown as { terminalCls: number }).terminalCls += shift.value;
    } }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.route('**/TerminalApp.*.js', async route => { await hold; await route.continue(); });
  try {
    await page.goto('/terminal', { waitUntil: 'domcontentloaded' }); await expect(terminal(page)).toHaveAttribute('data-adopting', '');
    const staticWin = page.locator('#static-window'); const rect = await staticWin.boundingBox();
    const paragraph = await staticWin.locator('.terminal-welcome p').first().textContent(); const help = await staticWin.locator('.terminal-help').textContent();
    await staticWin.locator('[data-scroll-root]').evaluate(el => { (el as HTMLElement).focus(); el.scrollTop = 20; });
    const scroll = await staticWin.locator('[data-scroll-root]').evaluate(el => el.scrollTop);
    release(); await expect(staticWin).toHaveAttribute('hidden', '');
    const managed = terminal(page); const after = await managed.boundingBox();
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(rect![key] - after![key])).toBeLessThanOrEqual(1);
    await expect(managed.locator('.terminal-welcome p').first()).toHaveText(paragraph!); await expect(managed.locator('.terminal-help')).toHaveText(help!);
    expect(await managed.locator('[data-scroll-root]').evaluate(el => el.scrollTop)).toBe(scroll);
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
    expect(await page.evaluate(() => (window as unknown as { terminalCls: number }).terminalCls)).toBe(0);
  } finally { release(); }
});

test('route has no serious accessibility violations and produces light/dark desktop and narrow artifacts @visual', async ({ page }) => {
  const artifactDir = resolve('.astro/p3-6-artifacts'); mkdirSync(artifactDir, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const win = await start(page); await command(win, 'neofetch');
    const results = await new AxeBuilder({ page }).include('[data-window-id="terminal"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await expect(win.locator('.terminal-caret')).toHaveCSS('animation-name', 'none');
    await page.screenshot({ path: resolve(artifactDir, `terminal-${theme}-desktop.png`) });
    // P4 phone app hosting is still a stub. Exercise the actual named window container at narrow width.
    await win.evaluate(el => { (el as HTMLElement).style.width = '390px'; });
    await expect(win.getByRole('group', { name: 'Quick commands' })).toBeHidden();
    expect(await win.locator('.terminal-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: resolve(artifactDir, `terminal-${theme}-narrow.png`) });
  }
});

test('@mobile Terminal opens from home with 12 px text, quick commands and a command line above the keyboard at 360 px', async ({ page }, info) => {
  test.skip(phoneOnly(info), 'Phone sheets are covered by the mobile projects.');
  await page.setViewportSize({ width: 360, height: 780 });
  const win = await openFromHome(page, '/terminal');
  await expect(win).toHaveAttribute('data-app', 'terminal');
  const input = win.getByRole('textbox', { name: 'Terminal command' });
  await expect(win.locator('.terminal-body')).toHaveCSS('font-size', '12px');
  // The field lays out at 16 px (no iOS focus zoom) and is scaled to the 12 px line.
  await expect(input).toHaveCSS('font-size', '16px');
  expect((await input.boundingBox())!.height).toBeCloseTo(20, 0);
  const chips = win.getByRole('group', { name: 'Quick commands' });
  await expect(chips.getByRole('button')).toHaveText(['help', 'ls', 'projects', 'now', 'neofetch', 'contact']);
  const chipsBox = (await chips.boundingBox())!; const body = (await win.locator('.terminal-body').boundingBox())!;
  expect(chipsBox.y).toBeGreaterThanOrEqual(body.y + body.height - 1); expect(chipsBox.y + chipsBox.height).toBeLessThanOrEqual(780.5);
  await expectNoHorizontalOverflow(win); await expectTapTargets(win, '.terminal-input-wrap input'); await expectAccessibleSheet(page);
  // Chips run commands without taking focus from the command line, so the keyboard stays up.
  await input.tap(); await expect(input).toBeFocused();
  await chips.getByRole('button', { name: 'neofetch', exact: true }).tap();
  await expect(output(win)).toContainText('Kernel'); await expect(input).toBeFocused();
  await chips.getByRole('button', { name: 'projects', exact: true }).tap();
  await expect(output(win)).toContainText('18 projects.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('serendib:terminal:history') ?? '[]'))).toEqual(['neofetch', 'projects']);
  await expectNoHorizontalOverflow(win);
  await showKeyboard(page, 400);
  await expectAboveKeyboard(input, 400); await expectAboveKeyboard(chips, 400);
  // Output that was read to its end stays anchored there as the sheet shrinks.
  await expectAboveKeyboard(win.locator('.terminal-line').filter({ hasText: '18 projects.' }).last(), 400);
  // Scrolling the output back keeps the command line pinned above the chips.
  await win.locator('.terminal-body').evaluate(node => { node.scrollTop = 0; });
  await expectAboveKeyboard(input, 400); await expect(input).toBeInViewport();
  await command(win, 'whoami'); await expect(output(win)).toContainText('engineer from Sri Lanka');
  await expectAboveKeyboard(win.locator('.terminal-line').filter({ hasText: 'engineer from Sri Lanka' }).last(), 400);
  await hideKeyboard(page);
  // A chosen size still wins over the phone default.
  await openMenu(page, 'View'); await page.getByRole('menuitem', { name: 'Bigger text', exact: true }).click();
  await expect(win.locator('.terminal-body')).toHaveCSS('font-size', '13px');
  expect((await input.boundingBox())!.height).toBeCloseTo(20, 0);
  await expectNoHorizontalOverflow(win); await expectAccessibleSheet(page);
});

test('no-JS route shows the banner, help, fallback links and readable phone content', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/terminal'); const win = page.locator('#static-window');
    await expect(win).toContainText('Kottu OS 2.0 "Pettah"'); await expect(win).toContainText('Explore: ls, cd, pwd, cat, open');
    await expect(win).toContainText("JavaScript is off, so this terminal can't run commands.");
    await expect(win.getByRole('link', { name: 'ls projects', exact: true })).toHaveAttribute('href', '/projects');
    expect(await win.locator('.terminal-body').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    mkdirSync(resolve('.astro/p3-6-artifacts'), { recursive: true }); await page.screenshot({ path: resolve('.astro/p3-6-artifacts/terminal-phone-390x844.png') });
  } finally { await context.close(); }
});

test('static route is accessible with application scripts removed', async ({ page }) => {
  // axe uses timers, so audit the same server HTML in a script-capable browser with all site scripts removed.
  await page.route('**/terminal', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '') });
  });
  await page.goto('/terminal'); await expect(page.locator('html')).toHaveClass('no-js');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const results = await new AxeBuilder({ page }).include('#static-window').analyze();
    expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  }
});
