import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test.beforeEach(async ({}, info) => { test.skip(!info.project.name.startsWith('mobile'), 'Phone home is covered by the mobile projects.'); });
for (const size of [{width:390,height:844},{width:412,height:915}]) {
  test(`phone home and tap targets at ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size); await page.goto('/'); await expect(page.locator('html')).toHaveClass(/os-ready/);
    const home=page.locator('[data-shell="mobile"] [data-phone-home]'); await expect(home).toBeVisible();
    await expect(home.locator('.phone-wordmark')).toHaveText('serendib'); await expect(home.getByRole('heading',{level:1})).toHaveText('Nipun Theekshana');
    await expect(home.getByRole('heading',{name:'Now',exact:true})).toBeVisible(); await expect(home.locator('[data-mochi-body]')).toBeVisible();
    await expect(home.locator('.phone-grid li')).toHaveCount(12); await expect(home.locator('.phone-dock li')).toHaveCount(4);
    for(const el of await home.locator('[data-phone-icon], .phone-home-header a, [data-mochi-body]').all()) { const box=(await el.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
    expect(await home.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await expect(page.locator('.static-menubar:visible, .static-dock:visible, [data-shell="desktop"]:visible')).toHaveCount(0);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    const skip=page.locator('[data-phone-skip]');await skip.focus();
    expect((await skip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual((await home.locator('.phone-home-header').boundingBox())!.height);
    expect((await new AxeBuilder({page}).withRules(['target-size','label-content-name-mismatch']).analyze()).violations).toEqual([]);
  });
  test(`SSR home links and hydration geometry at ${size.width}×${size.height}`, async ({browser,baseURL}) => {
    const context=await browser.newContext({viewport:size,javaScriptEnabled:false}); const page=await context.newPage();
    await page.goto(baseURL!+'/'); const home=page.locator('#static-phone-home [data-phone-home]'); await expect(home).toBeVisible();
    await expect(home.getByRole('heading',{level:1})).toHaveText('Nipun Theekshana'); await expect(home.locator('[data-phone-icon]')).toHaveCount(16);
    for(const link of await home.locator('[data-phone-icon]').all()) expect(await link.getAttribute('href')).toBeTruthy();
    const rects=await home.locator('.phone-ticket,.phone-widgets,.phone-grid,.phone-dock').evaluateAll(els=>els.map(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};}));
    await home.getByRole('link',{name:'Projects',exact:true}).click(); await expect(page.locator('#static-window')).toBeVisible(); await context.close();
    const js=await browser.newContext({viewport:size}); const live=await js.newPage(); await live.addInitScript(()=>localStorage.setItem('serendib:booted','true'));
    let release!:()=>void;const held=new Promise<void>(done=>{release=done;});await live.route('**/PhoneRuntime.*.js',async route=>{await held;await route.continue();});
    await live.goto(baseURL!+'/',{waitUntil:'domcontentloaded'});const heading=await live.locator('#static-phone-home h1').elementHandle();release();
    const hydrated=live.locator('[data-shell="mobile"] [data-phone-home]'); await expect(hydrated).toBeVisible();
    expect(await heading!.evaluate(el=>el.isConnected)).toBe(true);
    const after=await hydrated.locator('.phone-ticket,.phone-widgets,.phone-grid,.phone-dock').evaluateAll(els=>els.map(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};}));
    for(let i=0;i<rects.length;i++) for(const key of ['x','y','w','h'] as const) expect(Math.abs(rects[i]![key]-after[i]![key])).toBeLessThanOrEqual(1);
    await js.close();
  });
}
test('a prevented companion preload leaves the static widget usable without a React error',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>window.addEventListener('vite:preloadError',()=>Object.assign(window,{companionPreloadFailed:true})));
  await page.route('**/Mochi.*.js',route=>route.abort());
  const failed=page.waitForRequest('**/Mochi.*.js');await page.goto('/');await failed;
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {companionPreloadFailed?:boolean}).companionPreloadFailed)).toBe(true);
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  expect(errors).toEqual([]);
  const home=page.locator('[data-shell="mobile"] [data-phone-home]');
  await expect(home.locator('.phone-mochi-placeholder')).toBeVisible();
  await home.getByRole('link',{name:'Projects',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Projects',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
test('500 ms icon hold opens a touch menu; moving beyond 8 px cancels it',async({page})=>{
  await page.goto('/'); const icon=page.locator('[data-shell="mobile"] .phone-dock a').first(); await expect(icon).toBeVisible();
  await page.clock.install({time:new Date('2026-10-11T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-11T12:00:01Z'));
  await icon.dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:50,clientY:740,pointerType:'touch'});
  const menu=page.getByRole('menu',{name:'App context menu'});await page.clock.runFor(499);await expect(menu).toBeHidden();await page.clock.runFor(1); await expect(menu).toBeVisible(); await expect(menu.getByRole('menuitem',{name:'Open',exact:true})).toBeVisible(); await expect(menu.getByRole('menuitem',{name:'Copy link',exact:true})).toBeVisible();
  await icon.dispatchEvent('pointerup',{pointerId:1}); await page.keyboard.press('Escape'); await expect(menu).toBeHidden();
  await icon.dispatchEvent('pointerdown',{button:0,pointerId:2,clientX:50,clientY:740}); await icon.dispatchEvent('pointermove',{pointerId:2,clientX:59,clientY:740});
  await page.clock.runFor(550); await expect(menu).toBeHidden(); await icon.dispatchEvent('pointerup',{pointerId:2});
});
test('appearance, full-screen Spotlight, system power and Mochi widget are usable',async({page})=>{
  await page.goto('/'); const home=page.locator('[data-shell="mobile"] [data-phone-home]'); await expect(home).toBeVisible();
  await home.getByRole('link',{name:'Appearance',exact:true}).click(); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await home.getByRole('link',{name:'Spotlight',exact:true}).click(); const search=page.getByRole('dialog',{name:'Spotlight search'}); await expect(search).toBeVisible(); await expect(search.getByRole('combobox')).toBeFocused();
  const box=(await search.boundingBox())!; expect(box.x).toBe(0); expect(box.y).toBe(0); await page.keyboard.press('Escape');
  const pet=home.locator('[data-mochi-body]'); await expect(pet).toBeVisible(); await pet.click(); expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('serendib:mochi')??'{}').pets)).toBeGreaterThanOrEqual(1);
  await home.getByRole('link',{name:'Serendib menu'}).click(); await page.getByRole('menuitem',{name:'Sleep',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Night Mail screensaver'})).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog',{name:'Night Mail screensaver'})).toBeHidden();
});
test('landscape grid uses six columns; Mochi holds open its menu without dragging',async({page})=>{
  await page.setViewportSize({width:844,height:390});await page.goto('/');const home=page.locator('[data-shell="mobile"] [data-phone-home]');await expect(home).toBeVisible();
  expect(await home.locator('.phone-grid ul').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(6);
  const pet=home.locator('[data-mochi-body]');await expect(pet).toBeVisible();await home.evaluate(el=>{el.scrollTop=200;});const before=await pet.boundingBox();
  const box=before!;const point={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+50,point.y+20);await page.mouse.up();
  expect(await pet.boundingBox()).toEqual(before);
  await page.mouse.move(point.x,point.y);await page.mouse.down();await expect(page.getByRole('menu',{name:'Mochi context menu'})).toBeVisible();await page.mouse.up();await page.keyboard.press('Escape');
});
