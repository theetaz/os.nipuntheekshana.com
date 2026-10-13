import { test, expect, openApp } from './fixtures';

test.use({ viewport: { width: 1440, height: 900 } });
test('desktop drag survives repeated animated unsnaps in each browser profile', async ({ page }) => {
  await page.goto('/'); await openApp(page, 'Projects');
  const win = page.locator('[data-window-id="projects"]');
  await expect(win.locator('h1')).toHaveText('Projects');
  const settled = () => expect.poll(() => win.evaluate(el => el.getAnimations().length)).toBe(0);
  await settled();
  for (let cycle = 0; cycle < 3; cycle++) {
    const normal = (await win.boundingBox())!;
    await win.getByRole('button', { name: 'Maximise Projects', exact: true }).click(); await settled();
    const maximised = (await win.boundingBox())!;
    const bar = (await win.locator('[data-window-titlebar]').boundingBox())!;
    const start = { x: bar.x + 200, y: bar.y + bar.height / 2 };
    const ratio = (start.x - maximised.x) / maximised.width;
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y + 50);
    await expect(win).toHaveAttribute('data-dragging');
    await expect.poll(() => win.evaluate(el => Number.parseFloat((el as HTMLElement).style.width))).toBe(normal.width);
    await page.mouse.move(start.x + 120, start.y + 110, { steps: 8 }); await page.mouse.up(); await settled();
    await expect(win).toHaveAttribute('data-mode', 'normal'); await expect(win).not.toHaveAttribute('data-dragging');
    const restored = (await win.boundingBox())!;
    expect(Math.abs(restored.width - normal.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(restored.height - normal.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(restored.x - Math.round(start.x + 120 - ratio * normal.width))).toBeLessThanOrEqual(1);
    expect(Math.abs(restored.y - (start.y + 110 - 20))).toBeLessThanOrEqual(1);
    await expect(page.locator('html')).not.toHaveAttribute('data-window-interaction');
  }
});
