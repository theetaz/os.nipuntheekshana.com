import { readdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });
const routes = [
  ['/projects', 'Projects'], ['/projects/salli', 'Salli — Projects'],
  ['/writing', 'Writing'], ['/writing/hello-world', 'Hello, world — again — Writing'],
  ['/writing/an-island-made-of-points', 'An island made of points — Writing'],
  ['/about', 'About'], ['/cv', 'CV'], ['/now', 'Now'], ['/readme', 'Read me.txt'],
  ['/terminal', 'Terminal'], ['/maps', 'Island'], ['/maps/play', 'Pin the city'],
  ['/activity', 'Activity'], ['/messages', 'Messages'], ['/settings', 'Settings'], ['/kooda', 'Kooda'],
] as const;

test('home has one visible h1 and working desktop and dock links @smoke', async ({ page, request }) => {
  expect((await page.goto('/'))?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nipun Theekshana');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.wallpaper')).toHaveCount(1);
  await expect(page.locator('#app-projects')).toHaveCount(1);
  await expect(page.locator('#os-initial-data')).toHaveCount(1);
  await expect(page.locator('.boot-screen')).toBeHidden();
  const hrefs = await page.locator('nav[aria-label="Dock"] a, nav[aria-label="Desktop"] a').evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  expect(hrefs).toContain('/projects');
  expect(hrefs).toContain('/maps/play');
  for (const href of new Set(hrefs.filter((href) => href.startsWith('/')))) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

for (const [path, title] of routes) {
  test(`${path} has crawlable content and adoption markup @smoke`, async ({ page }) => {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#static-window')).toHaveAttribute('data-query', '{}');
    await expect(page.locator('#static-window [data-scroll-root]')).toBeVisible();
    await expect(page.locator('#os-initial-data')).toHaveCount(1);
    for (const control of await page.locator('.traffic-light.js-only').all()) await expect(control).toBeHidden();
  });
}

test('every generated project and post has content and matching initial data', async ({ page }) => {
  for (const section of ['projects', 'writing']) {
    for (const slug of readdirSync(`dist/${section}`, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.html')).map((entry) => entry.name.slice(0, -5))) {
      const path = `/${section}/${slug}`;
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(page.locator('#static-window')).toHaveAttribute('data-route', slug);
      await expect(page.locator('#os-initial-data')).toHaveAttribute('data-key', `${section}:${slug}`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('#static-window [data-scroll-root]')).toContainText(/\S/);
    }
  }
});

test('Salli includes the case study, canonical, and a working close link @smoke', async ({ page }) => {
  await page.goto('/projects/salli');
  await expect(page.locator('#static-window [data-scroll-root]')).toContainText('The intelligence comes to the phone.');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://nipuntheekshana.com/work/salli');
  await page.getByRole('link', { name: 'Close (back to the desktop)' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('Simple view is a reading document without JavaScript @smoke', async ({ page }) => {
  await page.goto('/#simple');
  await expect(page.locator('#home-document')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.wallpaper')).toBeHidden();
  await expect(page.locator('.now-sticky')).toBeHidden();
  await expect(page.locator('.activity-strip')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Dock', exact: true })).toBeHidden();
  await page.goto('/projects/salli#simple');
  await expect(page.locator('.static-titlebar')).toBeHidden();
  expect(await page.locator('#static-window').evaluate((element) => getComputedStyle(element).position)).toBe('static');
  expect(await page.locator('#static-window').evaluate((element) => element.scrollHeight)).toBeGreaterThan(600);
  await expect(page.getByRole('navigation', { name: 'All sections' })).toBeVisible();
});

test('phone home and route content fit the viewport @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pocket apps' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.goto('/projects/salli');
  const bounds = await page.locator('#static-window').boundingBox();
  expect(bounds).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await expect(page.getByRole('link', { name: 'Close (back to the desktop)' })).toHaveText(/Home/);
});

test('unavailable controls are explained and utility pages are noindex', async ({ page }) => {
  for (const path of ['/settings', '/kooda']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('.static-document')).toContainText('JavaScript');
  }
});

test('unknown routes return 404 with fixed ocean coordinates @smoke', async ({ page }) => {
  expect((await page.goto('/nope'))?.status()).toBe(404);
  await expect(page.getByRole('dialog', { name: 'Lost at sea', exact: true })).toBeVisible();
  await expect(page.locator('#static-window')).toHaveCount(0);
  await expect(page.locator('#ocean-coordinates')).toHaveText('5.2140°N 79.1022°E');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});


test('no-JavaScript dark theme follows system appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('dark');
  expect(await page.locator('.ticket').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(42, 37, 28)');
});

test('the whole ticket and sticky are links', async ({ page }) => {
  await page.goto('/');
  await page.locator('.ticket').click({ position: { x: 20, y: 100 } });
  await expect(page).toHaveURL(/\/about$/);
  await page.goto('/');
  await page.locator('.now-sticky').click({ position: { x: 120, y: 80 } });
  await expect(page).toHaveURL(/\/now$/);
});

test('compact home keeps the ticket clickable and Projects keeps its accessible heading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'About me', exact: true })).toHaveAttribute('href', '/about');
  await page.locator('.ticket').click({ position: { x: 20, y: 100 } });
  await expect(page).toHaveURL(/\/about$/);
  await page.goto('/projects');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects');
  await expect(page.locator('h1')).toHaveCount(1);
});
