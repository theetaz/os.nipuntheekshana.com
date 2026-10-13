import { test, expect, FIXED_DATE, openApp, waitForWindow } from './fixtures';

test('home responds successfully and has a title @smoke', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/\S/);
  expect(errors).toEqual([]);
});

test('preview preserves a missing route status @smoke', async ({ request }) => {
  const response = await request.get('/nonexistent');
  expect(response.status()).toBe(404);
});

test('fixtures fix wall time, preserve timers and skip boot @smoke', async ({ page }) => {
  await page.goto('/');
  const state = await page.evaluate(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return {
      now: Date.now(),
      date: new Date().toISOString(),
      callable: Date(),
      explicit: new Date('2000-01-01T00:00:00Z').toISOString(),
      utc: Date.UTC(2000, 0, 1),
      booted: localStorage.getItem('serendib:booted'),
    };
  });
  expect(state.now).toBe(Date.parse(FIXED_DATE));
  expect(state.date).toBe(new Date(FIXED_DATE).toISOString());
  expect(Date.parse(state.callable)).toBe(state.now);
  expect(state.explicit).toBe('2000-01-01T00:00:00.000Z');
  expect(state.utc).toBe(Date.UTC(2000, 0, 1));
  expect(state.booted).toBe('true');
  await expect(page.locator('html')).not.toHaveAttribute('data-boot');
  await expect(page.locator('.boot-screen')).toBeHidden();
});

test.describe('boot opt-in', () => {
  test.use({ boot: true });
  test('leaves the boot preference unset @smoke', async ({ page }) => {
    // An inert document avoids racing the future boot overlay's persistence.
    await page.route('**/fixture-boot', (route) => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Fixture</title>',
    }));
    await page.goto('/fixture-boot');
    expect(await page.evaluate(() => localStorage.getItem('serendib:booted'))).toBeNull();
  });
});

test('app helpers use accessible dock and window names @smoke', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <nav class="static-dock os-dock" aria-label="Dock"><ul role="toolbar" aria-label="Apps">
      <li role="presentation"><a class="os-dock-link" data-dock-item data-dock-app="projects" href="/projects" aria-label="Projects" onclick="event.preventDefault();document.querySelector('[role=dialog]').hidden=false">Projects</a></li>
    </ul></nav>
    <section role="dialog" aria-label="Projects" hidden>App content</section>
  `);
  await openApp(page, 'Projects');
  await expect(await waitForWindow(page, 'Projects')).toHaveText('App content');
});
