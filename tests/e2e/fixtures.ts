import { test as base, expect, type Page } from '@playwright/test';
import { pendingPhoneCapability } from './p4-pending';

export const FIXED_DATE = '2026-10-11T17:41:00Z';

export const test = base.extend<{ boot: boolean }>({
  boot: [false, { option: true }],
  page: async ({ page, boot }, use, info) => {
    const pending = pendingPhoneCapability(info);
    if (pending) base.fixme(true, pending);
    await page.addInitScript(({ date, boot }) => {
      // Freeze wall time only: timers and performance.now() still advance.
      const NativeDate = Date;
      const timestamp = NativeDate.parse(date);
      const FixedDate = new Proxy(NativeDate, {
        apply: () => new NativeDate(timestamp).toString(),
        construct: (target, args, newTarget) => Reflect.construct(
          target, args.length ? args : [timestamp], newTarget,
        ),
        get: (target, property, receiver) => property === 'now'
          ? () => timestamp : Reflect.get(target, property, receiver),
      });
      globalThis.Date = FixedDate;
      // about:blank and contexts with storage disabled have no localStorage.
      try {
        if (boot) localStorage.removeItem('serendib:booted');
        else localStorage.setItem('serendib:booted', 'true');
      } catch { /* Storage is unavailable in this document. */ }
    }, { date: FIXED_DATE, boot });
    await use(page);
  },
});

export { expect };

export async function openApp(page: Page, name: string) {
  const dock = page.getByRole('navigation', { name: 'Dock', exact: true })
    .getByRole('toolbar', { name: 'Apps', exact: true });
  const launcher = dock.getByRole('button', { name, exact: true })
    .or(dock.getByRole('link', { name, exact: true }));
  if (await page.locator('html').getAttribute('data-mode') === 'mobile') {
    test.fixme(await launcher.count() === 0, 'P4-1/P4-2: the phone launcher/app switcher does not yet expose this desktop Dock action.');
  }
  await launcher.click();
}

export async function waitForWindow(page: Page, title: string) {
  const window = page.getByRole('dialog', { name: title, exact: true });
  await expect(window).toBeVisible();
  return window;
}
