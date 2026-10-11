import { readdirSync } from 'node:fs';
import { test, expect } from './fixtures';

test('every route hydrates without React warnings or browser errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' || /hydration|did not match|server rendered/i.test(message.text())) errors.push(message.text()); });
  const projects = readdirSync('dist/projects').filter(name => name.endsWith('.html')).map(name => `/projects/${name.slice(0, -5)}`);
  for (const route of ['/', '/projects', ...projects, '/writing', '/writing/hello-world', '/writing/an-island-made-of-points',
    '/about', '/cv', '/terminal', '/maps', '/maps/play', '/activity', '/messages', '/now', '/settings', '/kooda', '/readme', '/404']) {
    await page.goto(route); await expect(page.locator('html')).toHaveClass(/os-ready/);
    if (route !== '/' && route !== '/404') await expect(page.locator('#static-window')).toHaveAttribute('hidden', '');
    if (route === '/404') { await expect(page.locator('#static-alert')).toBeVisible(); await expect(page.locator('[data-window-id]')).toHaveCount(0); }
  }
  expect(errors).toEqual([]);
});
