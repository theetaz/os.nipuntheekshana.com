import { test as base, expect, type Page } from '@playwright/test';
import { pendingPhoneCapability, desktopOnlyCapability } from './p4-pending';

export const FIXED_DATE = '2026-10-11T17:41:00Z';

export const test = base.extend<{ boot: boolean }>({
  boot: [false, { option: true }],
  page: async ({ page, boot }, use, info) => {
    base.skip(desktopOnlyCapability(info), 'Desktop spatial/status controls; phone equivalents are tested in mobile-home and mobile-sheets.');
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

export async function openMenu(page: Page, name: string) {
  if (await page.locator('html').getAttribute('data-mode') === 'mobile' && await page.locator('[data-shell="mobile"]').count()) {
    if(await page.getByRole('menu').count()){await page.keyboard.press('Escape');await page.keyboard.press('Escape');}
    const current=page.locator('[data-sheet]:visible');
    if(await current.count()) await current.getByRole('button',{name:'App commands',exact:true}).click();
    else await page.locator('[data-shell="mobile"]').getByRole('link',{name:'Kottu menu',exact:true}).click();
    await page.getByRole('menuitem',{name,exact:true}).click();
  } else await page.getByRole('menubar').getByRole('menuitem',{name,exact:true}).click();
}

export async function openApp(page: Page, name: string) {
  if (await page.locator('html').getAttribute('data-mode') === 'mobile' && await page.locator('[data-shell="mobile"]').count()) {
    const current=page.locator('[data-sheet]:visible');
    if(await current.count()) {
      await openMenu(page,'Apps');
      const running=page.getByRole('menuitemcheckbox',{name,exact:true});
      if(await running.count()){await running.click();return;}
      await page.keyboard.press('Escape');await page.keyboard.press('Escape');
      if(name==='Settings') {await current.getByRole('button',{name:'App commands',exact:true}).click();await page.getByRole('menuitem',{name:'System Settings…',exact:true}).click();return;}
      await openMenu(page,'Go');await page.getByRole('menuitem',{name,exact:true}).click();return;
    }
    await expect(page.locator('[data-shell="mobile"] .phone-home')).toBeVisible();
    const launcher=page.locator('[data-shell="mobile"] [data-phone-icon]').filter({has:page.locator('svg')}).and(page.getByRole('link',{name,exact:true})).first();
    if(await launcher.count()) await launcher.click();
    else {await openMenu(page,'Go');await page.getByRole('menuitem',{name,exact:true}).click();}
    return;
  }
  const dock=page.getByRole('navigation',{name:'Dock',exact:true}).getByRole('toolbar',{name:'Apps',exact:true});
  await dock.getByRole('button',{name,exact:true}).or(dock.getByRole('link',{name,exact:true})).click();
}

export async function waitForWindow(page: Page, title: string) {
  const window = page.getByRole('dialog', { name: title, exact: true });
  await expect(window).toBeVisible();
  return window;
}

export async function closeApp(page: Page, name: string) {
  if(await page.locator('html').getAttribute('data-mode')==='mobile') {
    if(await page.getByRole('menu').count()){await page.keyboard.press('Escape');await page.keyboard.press('Escape');}
    await page.locator('[data-sheet]:visible').getByRole('button',{name:'App commands',exact:true}).click();
    await page.getByRole('menuitem',{name:'Home',exact:true}).click();
  } else await page.getByRole('button',{name:`Close ${name}`,exact:true}).click();
}
