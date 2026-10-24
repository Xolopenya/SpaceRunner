import {test,expect} from '@playwright/test';
import type {RuntimeGameModel} from '../../src/debug/runtime-game-model.ts';

test('developer field boots with complete stable geometry, real assets and keyboard controls',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug=field&seed=42');await page.locator('#launch').click();
 await expect.poll(()=>page.evaluate(()=>(window.spaceRunner!.model as RuntimeGameModel).field.committed)).toBeGreaterThan(0);
 const state=await page.evaluate(()=>{const m=window.spaceRunner!.model as RuntimeGameModel;return{events:m.field.events,slots:m.field.hazards.length,ids:m.field.slots.filter(s=>s.planned).map(s=>s.planned!.id),depths:m.field.slots.filter(s=>s.planned).map(s=>s.z),fault:m.field.fault};});
 expect(state.slots).toBe(72);expect(new Set(state.ids).size).toBe(state.ids.length);expect(new Set(state.depths).size).toBeGreaterThan(1);expect(state.fault).toBeUndefined();
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');
 expect(await page.evaluate(()=>window.spaceRunner!.model.ship.x)).toBeGreaterThan(.5);
 await page.screenshot({path:'test-results/runtime-desktop.png'});expect(errors).toEqual([]);
});

test('dev pause/focus, real hull destruction and restart preserve pending-job lifecycle',async({page})=>{
 await page.goto('/?debug=field&seed=42');await page.locator('#launch').click();await page.waitForTimeout(250);
 await page.locator('#pause').click();const before=await page.evaluate(()=>{const m=window.spaceRunner!.model as RuntimeGameModel;return[m.elapsed,m.distance,m.field.planningTicks,m.field.scheduled];});
 await page.waitForTimeout(300);expect(await page.evaluate(()=>{const m=window.spaceRunner!.model as RuntimeGameModel;return[m.elapsed,m.distance,m.field.planningTicks,m.field.scheduled];})).toEqual(before);
 await page.locator('#resume').click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect.poll(()=>page.evaluate(()=>window.spaceRunner!.model.state)).toBe('PAUSED');
 await page.screenshot({path:'test-results/runtime-paused.png'});await page.locator('#resume').click();
 // Accelerated fixed-step lifecycle coverage, separately from real-time FPS runs.
 for(let batch=0;batch<160;batch++){
  if(await page.evaluate(()=>{const m=window.spaceRunner!.model;for(let i=0;i<120&&m.state==='PLAYING';i++)m.step(1/120,{x:0,y:0});return m.state==='GAME_OVER';}))break;
 }
 await expect.poll(()=>page.evaluate(()=>window.spaceRunner!.model.state)).toBe('GAME_OVER');
 expect(await page.evaluate(()=>({hull:window.spaceRunner!.model.hull,hits:window.spaceRunner!.model.hitSerial}))).toEqual({hull:0,hits:3});
 await page.screenshot({path:'test-results/runtime-game-over.png'});await page.locator('#replay').click();
 expect(await page.evaluate(()=>{const m=window.spaceRunner!.model as RuntimeGameModel;return{hull:m.hull,fault:m.field.fault,slots:m.field.hazards.length};})).toEqual({hull:3,fault:undefined,slots:72});
});

test('all four encounter families render in a causal actual-model continuous run',async({page})=>{
 await page.goto('/?debug=field&seed=42');await page.locator('#launch').click();const seen=new Set<string>();
 await page.evaluate(()=>(window.spaceRunner! as unknown as {loop:{stop():void}}).loop.stop());
 for(let batch=0;batch<200&&seen.size<4;batch++){
  const result=await page.evaluate(()=>{const m=window.spaceRunner!.model as RuntimeGameModel;
   for(let i=0;i<120&&m.state==='PLAYING';i++){const w=m.field.certificate;let tick=w?Math.round((m.elapsed-w.context.elapsed)*120):0,input={x:0,y:0};if(w)for(const r of w.controls){if(tick<r.ticks){input=r.input;break;}tick-=r.ticks;}m.step(1/120,input);}
   (window.spaceRunner! as unknown as {loop:{render(dt:number):void}}).loop.render(1/60);
   return{families:m.field.events.filter(e=>e.status==='committed'&&e.family!=='ambient').map(e=>e.family),fault:m.field.fault,state:m.state,slots:m.field.slots.filter(s=>s.planned).length};});
  for(const f of result.families)seen.add(f);expect(result.fault).toBeUndefined();expect(result.slots).toBeLessThanOrEqual(32);
  if(result.state==='GAME_OVER')break;
 }
 expect([...seen].sort()).toEqual(['alternating','narrowing','scattered','vertical-weave']);
 await page.screenshot({path:'test-results/runtime-depths.png'});
});

test.describe('mobile runtime',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 test('portrait pointer controls, rotated layout and pause work with real continuous hazards',async({page})=>{
  await page.goto('/?debug=field&seed=42');await page.locator('#launch').click();
  await expect.poll(()=>page.evaluate(()=>(window.spaceRunner!.model as RuntimeGameModel).field.committed)).toBeGreaterThan(0);
  const box=(await page.locator('#flight').boundingBox())!,x=box.x+box.width*.5,y=box.y+box.height*.65;
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+65,y:y-45}]});
  await page.waitForTimeout(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>window.spaceRunner!.model.ship.x)).toBeGreaterThan(.2);
  await page.screenshot({path:'test-results/runtime-portrait.png'});await page.setViewportSize({width:844,height:390});
  await page.locator('#pause').click();await expect.poll(()=>page.evaluate(()=>window.spaceRunner!.model.state)).toBe('PAUSED');
 });
});

test('production ignores the experimental selector and contains no runtime planning implementation',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:4173/?debug=field&seed=42');await page.locator('#launch').click();
 expect(await page.evaluate(()=>window.spaceRunner)).toBeUndefined();
 const src=await page.locator('script[type=module]').getAttribute('src');const response=await page.request.get(new URL(src!,'http://127.0.0.1:4173/').href);expect(response.ok()).toBe(true);const js=await response.text();
 for(const sentinel of ['ACTUAL_REPLAY_BUDGET','CHANGED_POOL_GEOMETRY','runtime requires normal policy'])expect(js).not.toContain(sentinel);
 expect(requests.some(u=>/field-runtime|runtime-game-model|field-validator/.test(u))).toBe(false);
});
