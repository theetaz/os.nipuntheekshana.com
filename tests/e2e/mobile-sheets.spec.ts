import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.beforeEach(async ({},info)=>{test.skip(!info.project.name.startsWith('mobile'),'Sheets are covered by the mobile projects.');});
const sheet=(page:Page)=>page.locator('[data-sheet]:visible');
async function projects(page:Page){await page.goto('/');await page.locator('[data-shell="mobile"] .phone-dock a[href="/projects"]').click();await expect(sheet(page).getByRole('option',{name:'Salli',exact:true})).toBeVisible();return sheet(page);}
async function gesture(page:Page,events:{type:string;y:number;at:number}[]){await page.evaluate(events=>{const header=document.querySelector('[data-sheet-header]')!;for(const event of events){const pointer=new PointerEvent(event.type,{bubbles:true,cancelable:true,pointerId:9,pointerType:'touch',button:0,clientX:innerWidth/2,clientY:event.y});Object.defineProperty(pointer,'timeStamp',{value:event.at});(event.type==='pointerdown'?header:window).dispatchEvent(pointer);}},events);}
for(const size of [{width:390,height:844},{width:412,height:915}]){
  test(`one modal sheet, named container, focus, share and in-app back at ${size.width}×${size.height}`,async({page})=>{
    await page.setViewportSize(size);const app=await projects(page);await expect(app).toHaveAttribute('aria-modal','true');await expect(page.locator('[data-sheet]:visible')).toHaveCount(1);
    await expect.poll(()=>app.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    expect(await app.locator('.window-content').evaluate(el=>getComputedStyle(el).containerName)).toBe('window');
    const header=app.locator('[data-sheet-header]');await expect.poll(async()=>(await header.boundingBox())!.height).toBe(52);
    for(const control of await header.locator('a,button').all()){const b=(await control.boundingBox())!;expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);}
    await app.getByRole('option',{name:'Salli',exact:true}).click();await expect(page).toHaveURL(/\/projects\/salli$/);await expect(app.getByRole('heading',{name:'Salli',exact:true})).toBeVisible();
    await page.goBack();await expect(page).toHaveURL(/\/projects$/);await expect(app.getByRole('option',{name:'Salli',exact:true})).toBeVisible();
    await app.getByRole('option',{name:'Salli',exact:true}).click();await app.getByRole('link',{name:'Back to Projects',exact:true}).click();await expect(page).toHaveURL(/\/projects$/);
    await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async(data:ShareData)=>{Object.assign(window,{shared:data});}});});
    await app.getByRole('button',{name:'Share',exact:true}).click();expect(await page.evaluate(()=>(window as unknown as {shared:ShareData}).shared.url)).toBe('https://os.nipuntheekshana.com/projects');
    await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{Object.assign(window,{copied:text});}}});});
    await app.getByRole('button',{name:'Share',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {copied:string}).copied)).toBe('https://os.nipuntheekshana.com/projects');
    await expect(page.locator('.os-toast')).toHaveCSS('opacity','1');
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    await app.getByRole('link',{name:'Home',exact:true}).click();await expect(app).toHaveCount(0);await expect(page).toHaveURL(/\/$/);await expect(page.locator('[data-shell="mobile"] .phone-dock a[href="/projects"]')).toBeFocused();
  });
  test(`static content adoption stays within 1 px at ${size.width}×${size.height}`,async({page})=>{
    await page.setViewportSize(size);
    for(const [path,module] of [['/projects/salli','ProjectsApp'],['/writing/an-island-made-of-points','WritingApp'],['/now','NowApp'],['/readme','ReadmeApp'],['/cv','CvApp']]){
      let release!:()=>void;const held=new Promise<void>(done=>{release=done;});await page.route(`**/${module}.*.js`,async route=>{await held;await route.continue();});
      try{await page.goto(path!,{waitUntil:'domcontentloaded'});await expect(page.locator('#static-window')).toBeVisible();const before=(await page.locator('#static-window [data-scroll-root]').boundingBox())!;await expect(page.locator('[data-sheet][data-adopting]')).toHaveCSS('opacity','0');release();await expect(page.locator('#static-window')).toHaveAttribute('hidden','');expect(await sheet(page).evaluate(el=>getComputedStyle(el).opacity),path+' handoff opacity').toBe('1');const after=(await sheet(page).locator('[data-scroll-root]').boundingBox())!;for(const key of ['x','y','width','height'] as const)expect(Math.abs(before[key]-after[key]),path+' '+key).toBeLessThanOrEqual(1);}
      finally{release();await page.unroute(`**/${module}.*.js`);}
    }
  });
}
test('Writing deep link loads its reader in one sheet; desktop w survives and is not presented',async({page})=>{
  await page.goto('/writing/an-island-made-of-points?w=cv,projects/salli');const app=sheet(page);await expect(app.locator('.writing-article')).toBeVisible();await expect(page.locator('[data-sheet]:visible')).toHaveCount(1);await expect(app).toHaveAttribute('data-app','writing');
  await app.getByRole('link',{name:'Back to Writing',exact:true}).click();await expect(page).toHaveURL(/\/writing\?w=cv%2Cprojects%2Fsalli$/);await expect(page.locator('[data-sheet]:visible')).toHaveCount(1);
  await app.getByRole('link',{name:'Home',exact:true}).click();await expect(page).toHaveURL(/\/\?w=cv%2Cprojects%2Fsalli$/);await expect(page.locator('[data-sheet]:visible')).toHaveCount(0);
});
test('swipe thresholds, resistance after 200 px, cancellation and velocity',async({page})=>{
  const app=await projects(page);await gesture(page,[{type:'pointerdown',y:26,at:0},{type:'pointermove',y:146,at:1000},{type:'pointerup',y:146,at:1100}]);await expect.poll(async()=>Math.abs((await app.boundingBox())!.y)).toBeLessThan(1);
  await gesture(page,[{type:'pointerdown',y:26,at:2000},{type:'pointermove',y:426,at:3000}]);expect((await app.boundingBox())!.y).toBeCloseTo(300,0);
  await gesture(page,[{type:'pointercancel',y:426,at:3100}]);await expect.poll(async()=>Math.abs((await app.boundingBox())!.y)).toBeLessThan(1);
  await gesture(page,[{type:'pointerdown',y:26,at:4000},{type:'pointermove',y:147,at:5000},{type:'pointerup',y:147,at:5100}]);await expect(app).toHaveCount(0);
  await page.locator('[data-shell="mobile"] .phone-dock a[href="/projects"]').click();await expect(sheet(page)).toBeVisible();await gesture(page,[{type:'pointerdown',y:26,at:6000},{type:'pointermove',y:76,at:6050},{type:'pointerup',y:76,at:6051}]);await expect(sheet(page)).toHaveCount(0);
});
test('a 150 px touch swipe on the header closes to home',async({page})=>{
  const app=await projects(page);
  await page.evaluate(()=>{
    const header=document.querySelector('[data-sheet-header]')!;
    for(const [type,y,at] of [['touchstart',26,0],['touchmove',176,1000],['touchend',176,1100]] as const){
      const touch={identifier:12,target:header,clientX:innerWidth/2,clientY:y};
      // WebKit exposes TouchEvent but its constructor is not callable.
      const event=document.createEvent('TouchEvent');event.initEvent(type,true,true);
      Object.defineProperties(event,{changedTouches:{value:[touch]},touches:{value:type==='touchend'?[]:[touch]}});
      Object.defineProperty(event,'timeStamp',{value:at});header.dispatchEvent(event);
    }
  });
  await expect(app).toHaveCount(0);await expect(page).toHaveURL(/\/$/);
});
test('FLIP starts at its icon; reduced motion fades; commands can switch apps',async({page})=>{
  await page.goto('/');await expect(page.locator('[data-shell="mobile"] [data-phone-home]')).toBeVisible();
  await page.evaluate(()=>{Object.assign(window,{sheetFrames:[]});const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if((this as HTMLElement).hasAttribute('data-sheet'))(window as unknown as {sheetFrames:unknown[]}).sheetFrames.push(frames);return animate.call(this,frames,options);};});
  const app=await projects(page); // Navigation resets instrumentation: install before this launch below.
  await app.getByRole('link',{name:'Home',exact:true}).click();await expect(app).toHaveCount(0);
  await page.evaluate(()=>{Object.assign(window,{sheetFrames:[]});const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if((this as HTMLElement).hasAttribute('data-sheet'))(window as unknown as {sheetFrames:unknown[]}).sheetFrames.push(frames);return animate.call(this,frames,options);};});
  await page.locator('[data-shell="mobile"] .phone-dock a[href="/projects"]').click();await expect(app).toBeVisible();await expect.poll(()=>page.evaluate(()=>JSON.stringify((window as unknown as {sheetFrames:unknown[]}).sheetFrames))).toContain('scale(');
  await app.getByRole('button',{name:'App commands'}).click();await page.getByRole('menuitem',{name:'Go',exact:true}).click();await page.getByRole('menuitem',{name:'Terminal',exact:true}).click();await expect(sheet(page)).toHaveAttribute('data-app','terminal');
  await sheet(page).getByRole('button',{name:'App commands'}).click();await page.getByRole('menuitem',{name:'Apps',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'Projects',exact:true}).click();await expect(sheet(page)).toHaveAttribute('data-app','projects');
  await app.getByRole('link',{name:'Home',exact:true}).click();await expect(app).toHaveCount(0);await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>Object.assign(window,{sheetFrames:[]}));await page.locator('[data-shell="mobile"] .phone-dock a[href="/projects"]').click();await expect(app).toBeVisible();const frames=await page.evaluate(()=>JSON.stringify((window as unknown as {sheetFrames:unknown[]}).sheetFrames));expect(frames).toContain('opacity');expect(frames).not.toContain('scale(');
});
test('Hello world deep link, Back with w, and visualViewport updates use the existing sheet',async({page})=>{
  await page.goto('/writing/hello-world?w=cv');await expect(sheet(page).getByRole('heading',{name:'Hello, world — again',exact:true})).toBeVisible();
  await sheet(page).getByRole('link',{name:'Back to Writing'}).click();await expect(page).toHaveURL(/\/writing\?w=cv$/);
  await page.goBack();await expect(page).toHaveURL(/\/writing\/hello-world\?w=cv$/);await expect(sheet(page).getByRole('heading',{name:'Hello, world — again',exact:true})).toBeVisible();
  await page.evaluate(()=>{const viewport=visualViewport!;Object.defineProperty(viewport,'height',{configurable:true,value:500});viewport.dispatchEvent(new Event('resize'));});
  await expect.poll(async()=>(await sheet(page).boundingBox())!.height).toBe(500);
  await page.evaluate(()=>{const viewport=visualViewport!;delete (viewport as unknown as {height?:number}).height;viewport.dispatchEvent(new Event('resize'));});
  await expect.poll(async()=>(await sheet(page).boundingBox())!.height).toBe(await page.evaluate(()=>innerHeight));
});
test('a story launch locks the document and restores its scroll after Home and browser Back',async({page})=>{
  await page.goto('/'); await expect(page.locator('[data-shell="mobile"] [data-phone-home]')).toBeVisible();
  await page.evaluate(()=>window.scrollTo({top:1500,behavior:'instant'}));
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(1500);
  const card=page.locator('#story [data-k-card] .k-card-link[href="/projects/salli"]').first();
  await card.scrollIntoViewIfNeeded();
  await card.focus(); await page.evaluate(()=>document.fonts.ready);
  const before=await page.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight}));
  // Keyboard opens a story card directly; touch keeps its flip-then-open contract.
  await page.keyboard.press('Enter');
  const app=sheet(page); await expect(app).toHaveAttribute('data-app','projects');
  await expect(app).not.toHaveAttribute('data-sheet-animating');
  await expect(page.locator('html')).toHaveClass(/k-scroll-lock/);
  await expect(page.locator('#static-phone-home')).toHaveCSS('visibility','hidden');
  await expect(page.locator('#story')).toHaveCSS('visibility','hidden');
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(before.height);
  await expect(page.locator('html')).toHaveCSS('overflow-y','hidden');
  const wheelBlocked=await page.locator('#story').evaluate(el=>{const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:500});el.dispatchEvent(event);return event.defaultPrevented;}); expect(wheelBlocked).toBe(true);
  const blocked=await page.locator('#story').evaluate(el=>{
    const event=new Event('touchmove',{bubbles:true,cancelable:true}); el.dispatchEvent(event); return event.defaultPrevented;
  }); expect(blocked).toBe(true);
  expect(await page.evaluate(()=>scrollY)).toBe(before.y);
  await app.getByRole('button',{name:'App commands',exact:true}).click(); await page.getByRole('menuitem',{name:'Home',exact:true}).click();
  await expect(app).toHaveCount(0); await expect(page.locator('html')).not.toHaveClass(/k-scroll-lock/);
  await expect.poll(()=>page.evaluate(y=>Math.abs(scrollY-y),before.y)).toBeLessThanOrEqual(2);
  await expect(page.locator('#story')).toHaveCSS('visibility','visible');
  await card.focus(); await page.keyboard.press('Enter'); await expect(app).toBeVisible();
  await page.goBack(); await expect(app).toHaveCount(0);
  await expect.poll(()=>page.evaluate(y=>Math.abs(scrollY-y),before.y)).toBeLessThanOrEqual(2);
});
test('Kooda toolbar starts below the resting 52 px sheet header in both themes',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const theme of ['light','dark'] as const){
    await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'}); await page.goto('/kooda');
    const app=sheet(page); await expect(page.locator('#static-window')).toHaveAttribute('hidden','');
    await expect(app).not.toHaveAttribute('data-sheet-animating');
    await expect.poll(async()=>(await app.boundingBox())!.y).toBe(0);
    const header=(await app.locator('[data-sheet-header]').boundingBox())!;
    const toolbar=(await app.getByRole('button',{name:'Empty Kooda',exact:true}).boundingBox())!;
    expect(header.height).toBe(52); expect(toolbar.y).toBeGreaterThanOrEqual(header.y+header.height);
    expect(toolbar.height).toBeGreaterThanOrEqual(44);
    expect(await app.locator('[data-sheet-header]').evaluate(el=>({height:getComputedStyle(el,'::after').height,animation:getComputedStyle(el,'::after').animationName}))).toEqual({height:'4px',animation:'none'});
  }
});
for(const size of [{width:360,height:780},{width:390,height:844},{width:412,height:915}])test(`phone artifacts at ${size.width}×${size.height} @visual`,async({page},info)=>{
  test.skip(info.project.name!=='mobile-chromium','Screenshots are recorded once in Chromium; WebKit has the functional checks.');
  const {mkdir}=await import('node:fs/promises');await mkdir('.astro/k12-artifacts/screenshots',{recursive:true});await page.setViewportSize(size);
  for(const theme of ['light','dark'] as const){
    await page.emulateMedia({colorScheme:theme});await page.goto('/');await expect(page.locator('[data-shell="mobile"] [data-mochi-body]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
    const shot=async(scene:string)=>{await page.screenshot({path:`.astro/k12-artifacts/screenshots/${size.width}x${size.height}-${theme}-${scene}.png`});};
    await page.locator('.phone-mini-prop img').evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).decode())));
    await shot('home');await page.locator('#ws-hello').scrollIntoViewIfNeeded();await shot('story');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.locator('[data-shell="mobile"] .phone-dock a[href="/projects"]').click();await expect(sheet(page).getByRole('option',{name:'Salli',exact:true})).toBeVisible();await expect.poll(async()=>(await sheet(page).boundingBox())!.y).toBe(0);await shot('projects');
    await sheet(page).getByRole('option',{name:'Salli',exact:true}).click();await expect(sheet(page).getByRole('heading',{name:'Salli',exact:true})).toBeVisible();await shot('salli');
    await page.goto('/writing/hello-world');await expect(page.locator('#static-window')).toHaveAttribute('hidden','');await expect(sheet(page).getByRole('heading',{name:'Hello, world — again',exact:true})).toBeVisible();await shot('writing');
    await page.goto('/');const icon=page.locator('[data-shell="mobile"] .phone-dock a').first();await expect(icon).toBeVisible();await icon.dispatchEvent('pointerdown',{button:0,pointerId:20,pointerType:'touch',clientX:50,clientY:size.height-60});const menu=page.getByRole('menu',{name:'App context menu'});await expect(menu).toBeVisible();await menu.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});await shot('menu');await icon.dispatchEvent('pointerup',{pointerId:20});await page.keyboard.press('Escape');
    await icon.click();await expect(sheet(page).getByRole('option',{name:'Salli',exact:true})).toBeVisible();await expect.poll(async()=>(await sheet(page).boundingBox())!.y).toBe(0);await gesture(page,[{type:'pointerdown',y:26,at:0},{type:'pointermove',y:116,at:1000}]);await shot('mid-swipe');await gesture(page,[{type:'pointercancel',y:116,at:1100}]);
  }
});
