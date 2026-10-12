import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APPS } from '../../src/os/registry/apps';
import { test, expect, openApp, openMenu } from './fixtures';

interface Chunk { modules: string[]; imports: string[]; css: string[] }
const { chunks } = JSON.parse(readFileSync(resolve('dist/client/.css-scope.json'), 'utf8')) as { chunks: Record<string, Chunk> };
const artifacts = resolve('.astro/p3-css-artifacts');
mkdirSync(artifacts, { recursive: true });
test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'First-frame CSS and trace-based CLS measurements use Chromium.');
});

function appCss(appId: string): string[] {
  const entry = Object.keys(chunks).find(file => chunks[file]!.modules.some(module =>
    module.startsWith(`src/os/apps/${appId}/`) && /App\.tsx$/.test(module)))!;
  const seen = new Set<string>(); const css = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file); chunks[file]!.css.forEach(sheet => css.add(`/${sheet}`));
    chunks[file]!.imports.forEach(visit);
  };
  visit(entry);
  return [...css];
}

for (const app of Object.values(APPS).filter(app => app.phase === 'v1')) {
  test(`${app.name} awaits cold CSS and is styled in its first rendered frame with zero CLS`, async ({ page }) => {
    const css = appCss(app.id);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
      localStorage.setItem('serendib:motion', '"reduce"');
      Object.assign(window, { cssCls: 0 });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) (window as unknown as { cssCls: number }).cssCls += shift.value;
      } }).observe({ type: 'layout-shift', buffered: true });
    });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
    await page.evaluate(({ appId, css }) => {
      const state: { first: null | { missing: string[]; position: string; display: string }; done: boolean } = { first: null, done: false };
      Object.assign(window, { cssFrame: state });
      const frame = () => {
        const win = document.querySelector(`[data-window-id="${appId}"]`);
        const content = win?.querySelector('.window-content [data-scroll-root]');
        if (win && content) {
          const loaded = [...document.styleSheets].map(sheet => sheet.href && new URL(sheet.href).pathname);
          state.first = { missing: css.filter(sheet => !loaded.includes(sheet)), position: getComputedStyle(win).position, display: getComputedStyle(content).display };
          state.done = true;
        } else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, { appId: app.id, css });
    let release!: () => void; const hold = new Promise<void>(done => { release = done; });
    const win = page.locator(`[data-window-id="${app.id}"]`);
    try {
      if (css.length) {
        await page.route(url => css.includes(url.pathname), async route => { await hold; await route.continue(); });
      }
      const requested = css.length ? page.waitForRequest(request => css.includes(new URL(request.url()).pathname)) : null;
      if(await page.locator('html').getAttribute('data-mode')==='mobile') {if(app.id==='readme'){await openMenu(page,'Help');await page.getByRole('menuitem',{name:'Read me',exact:true}).click();}else await openApp(page,app.name);}
      else if (app.dockOrder !== null) await openApp(page, app.name);
      else if (app.desktopIcon) await page.getByRole('option', { name: app.desktopIcon.label, exact: true }).dblclick();
      else await page.locator('.now-sticky a').click({ force: true });
      if (requested) {
        await requested;
        await expect(win.locator('.window-content [data-scroll-root]')).toHaveCount(0);
      }
      release();
      await expect(win.locator('.window-content [data-scroll-root]')).toBeVisible();
      await page.waitForFunction(() => (window as unknown as { cssFrame: { done: boolean } }).cssFrame.done);
      const first = await page.evaluate(() => (window as unknown as { cssFrame: { first: { missing: string[]; position: string } } }).cssFrame.first);
      expect(first.missing).toEqual([]); expect(first.position).toBe('absolute');
      if (app.id === 'about') await expect(win.locator('.about-view')).toHaveCSS('display', 'flex');
      if (app.id === 'settings') await expect(win.locator('.settings-app')).toHaveCSS('display', 'grid');
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
      expect(await page.evaluate(() => (window as unknown as { cssCls: number }).cssCls)).toBe(0);
      expect(errors).toEqual([]);
      if (['about', 'settings'].includes(app.id)) await page.screenshot({ path: resolve(artifacts, `cold-${app.id}.png`) });
    } finally { release(); }
  });
}

for (const path of ['/about', '/projects/salli', '/settings?section=wallpaper']) {
  for (const javaScriptEnabled of [true, false]) {
    test(`${path} retains first-paint styling and zero CLS with JS ${javaScriptEnabled ? 'on' : 'off'}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 1440, height: 900 } });
      try {
        const page = await context.newPage();
        await page.addInitScript(() => localStorage.setItem('serendib:booted', 'true'));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Tracing.start', { categories: 'loading,devtools.timeline', transferMode: 'ReturnAsStream' });
        await page.goto(path);
        if (javaScriptEnabled) await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
        else await expect(page.locator('html')).toHaveClass('no-js');
        const win = page.locator(javaScriptEnabled ? '[data-window-id]' : '#static-window');
        await expect(win).toBeVisible();
        if (path === '/about') await expect(win.locator('.about-view')).toHaveCSS('display', 'flex');
        if (path.startsWith('/settings')) {
          await expect(win.locator('.settings-app')).toHaveCSS('display', 'grid');
          if (javaScriptEnabled) {
            await expect(win.getByRole('region', { name: 'Wallpaper', exact: true })).toBeVisible();
            await expect(page).toHaveURL(/section=wallpaper/);
          } else await expect(win.locator('#settings-static-wallpaper')).toHaveCount(1);
        }
        await page.evaluate(async () => { await document.fonts.ready; });
        // A screenshot waits for a compositor frame even with page JS disabled.
        await page.screenshot({ path: resolve(artifacts, `deep-${path.split('?')[0]!.replaceAll('/', '-')}-js-${javaScriptEnabled}.png`) });
        const completed = new Promise<{ stream?: string }>(done => cdp.once('Tracing.tracingComplete', done));
        await cdp.send('Tracing.end'); const { stream } = await completed;
        expect(stream).toBeDefined();
        let trace = '';
        for (;;) {
          const chunk = await cdp.send('IO.read', { handle: stream! });
          trace += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
          if (chunk.eof) break;
        }
        await cdp.send('IO.close', { handle: stream! }); await cdp.detach();
        const events = JSON.parse(trace).traceEvents as { name: string; args?: { data?: { score?: number; had_recent_input?: boolean } } }[];
        expect(events.some(event => event.name === 'firstContentfulPaint')).toBe(true);
        const cls = events.filter(event => event.name === 'LayoutShift' && !event.args?.data?.had_recent_input)
          .reduce((sum, event) => sum + (event.args?.data?.score ?? 0), 0);
        expect(cls).toBe(0);
      } finally { await context.close(); }
    });
  }
}
