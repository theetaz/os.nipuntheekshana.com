import { writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

test('layout emits crawlable metadata, two font preloads and ordered landmarks', async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Nipun Theekshana — Serendib OS');
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://os.nipuntheekshana.com');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://os.nipuntheekshana.com/og.png');
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schemas.map((value) => JSON.parse(value)['@type'])).toEqual(['WebSite', 'Person']);
  const layers = await page.locator('body > *').evaluateAll((elements) => elements.map((element) => element.id || element.className?.toString() || element.tagName));
  expect(layers.slice(0, 3)).toEqual(['simple', 'skip-link', 'skip-link']);
  expect(layers.indexOf('wallpaper os-chrome')).toBeGreaterThan(2);
  expect(layers.indexOf('ws-desktop')).toBeGreaterThan(layers.indexOf('wallpaper os-chrome'));
  expect(layers.indexOf('content')).toBeGreaterThan(layers.indexOf('ws-desktop'));
  expect(layers.indexOf('static-phone-home')).toBeGreaterThan(layers.indexOf('content'));
  expect(layers.indexOf('story')).toBeGreaterThan(layers.indexOf('static-phone-home'));
  await expect(page.locator('#app-projects')).toHaveCount(1);
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(page.getByRole('link', { name: 'Skip to content', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(await page.locator('html').getAttribute('data-mode')==='mobile'?page.locator('#phone-content'):page.locator('#content')).toBeFocused();
  expect(errors).toEqual([]);
});

test('disabling JavaScript preserves the server no-js state and content', async ({ browser, baseURL, browserName }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass('no-js');
    expect(await page.locator('html').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('light');
    await expect(page.locator('html')).not.toHaveAttribute('data-boot');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nipun Theekshana');
    // macOS WebKit uses Option-Tab to include links in sequential navigation.
    const nextLink = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    await page.keyboard.press(nextLink);
    await page.keyboard.press(nextLink);
    await expect(page.locator('.skip-link[href="#simple"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#simple$/);
  } finally {
    await context.close();
  }
});

test('stored dark preference resolves before first paint on reload', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Chrome Performance trace uses CDP');
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('serendib:theme', '"dark"');
    localStorage.setItem('serendib:booted', 'true');
  });
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (document.documentElement?.dataset.theme === 'dark') {
        performance.mark('serendib-dark-resolved');
        observer.disconnect();
      }
    });
    observer.observe(document, { subtree: true, attributes: true, childList: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,loading', transferMode: 'ReturnAsStream' });
  try {
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForFunction(() => performance.getEntriesByName('first-paint').length > 0);
    const timing = await page.evaluate(() => ({
      resolved: performance.getEntriesByName('serendib-dark-resolved')[0]?.startTime,
      firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
      theme: document.documentElement.dataset.theme,
    }));
    expect(timing.resolved).toBeDefined();
    expect(timing.firstPaint).toBeGreaterThanOrEqual(timing.resolved!);
    expect(timing.theme).toBe('dark');

    const complete = new Promise<{ stream?: string }>((resolve) => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await complete;
    expect(stream).toBeDefined();
    let trace = '';
    for (;;) {
      const chunk = await cdp.send('IO.read', { handle: stream! });
      trace += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
      if (chunk.eof) break;
    }
    await cdp.send('IO.close', { handle: stream! });
    expect(JSON.parse(trace).traceEvents.some((event: { name: string }) => event.name === 'serendib-dark-resolved')).toBe(true);
    const tracePath = testInfo.outputPath('dark-first-paint.json');
    await writeFile(tracePath, trace);
    await testInfo.attach('Chrome Performance trace', { path: tracePath, contentType: 'application/json' });
    await testInfo.attach('first-paint timing', { body: JSON.stringify(timing), contentType: 'application/json' });
  } finally {
    await cdp.detach();
  }
});
