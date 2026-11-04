import {test,expect,launch} from './helpers.ts';
const url='/?debug=field&experiment=moving-mine&motion=adaptive-homing&seed=42&firstMine=1';
test('live coupled poses, actual target, trace export and pause/restart remain authoritative',async({page})=>{
 let requests=0;page.on('request',r=>{if(r.url().includes('space-mine.glb'))requests++;});await launch(page,url);
 const result=await page.evaluate(()=>{const g=window.spaceRunner! as any,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);
  for(let n=0;n<970;n++)m.step(1/120,{x:n<700?0:1,y:0});g.loop.render(1/60);
  const current=m.homing.current,h=m.field.slots.find((h:any)=>h.active&&h.kind===9),mesh=g.world.collisionDebug.root.getObjectByName('moving-space-mine'),trail=g.world.collisionDebug.root.getObjectByName('adaptive-mine-trail');
  const state={current,ship:{x:m.ship.x,y:m.ship.y},pose:{x:mesh.position.x,y:mesh.position.y,z:mesh.position.z},slot:{x:h.x,y:h.y,z:h.z},trailCount:trail.geometry.drawRange.count,metadata:JSON.stringify(h.planned),memory:{...g.world.renderer.info.memory}};
  const before=JSON.stringify(m.homing.trace()),elapsed=m.elapsed;m.pause();for(let n=0;n<120;n++)m.step(1/120,{x:-1,y:1});const paused=JSON.stringify(m.homing.trace())===before&&m.elapsed===elapsed;
  m.resume();for(let n=0;n<30;n++)m.step(1/120,{x:-1,y:0});const frozenConfig=JSON.stringify(h.planned)===state.metadata,changed=m.homing.current.vx!==current.vx;
  const memories=[];for(let r=0;r<4;r++){m.state='GAME_OVER';m.start(42);g.world.reset();for(let n=0;n<970;n++)m.step(1/120,{x:n<700?0:1,y:0});g.loop.render(1/60);memories.push({...g.world.renderer.info.memory});}
  return{state,paused,frozenConfig,changed,memories,fault:m.field.fault,trace:m.field.exportDiagnosticTrace()};
 });
 expect(result.state.current.targetX).toBe(result.state.ship.x);expect(result.state.current.targetY).toBe(result.state.ship.y);expect(result.state.pose).toEqual(result.state.slot);expect(result.state.trailCount).toBeGreaterThan(3);
 expect(result.paused).toBe(true);expect(result.frozenConfig).toBe(true);expect(result.changed).toBe(true);for(const memory of result.memories)expect(memory).toEqual(result.state.memory);expect(result.fault).toBeUndefined();expect(requests).toBe(1);
 const download=page.waitForEvent('download');await page.locator('#mixed-flow-export').click();expect((await download).suggestedFilename()).toContain('trace');expect((result.trace as any).feedback.samples.length).toBeLessThanOrEqual(960);expect((result.trace as any).feedback.version).toBe('adaptive-homing-v1');
});
for(const [lead,hull]of [[132,3],[30,2]] as const)test(`real adaptive ${lead===132?'bait reversal escapes':'late reversal collides'} with existing hull rules`,async({page})=>{
 await launch(page,url);const r=await page.evaluate(lead=>{const g=window.spaceRunner! as any,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);let first;
  while(m.distance<184&&m.state==='PLAYING'){first??=m.homing.encounters[0];const tick=Math.round(m.elapsed*120),motion=first?.motion;const x=!motion||tick<motion.startTick?0:tick<motion.passTick-lead?1:-1;m.step(1/120,{x,y:0});}g.loop.render(1/60);
  return{hull:m.hull,hits:m.hitSerial,fault:m.field.fault,samples:m.homing.samples,metadata:first};},lead);
 expect(r.hull).toBe(hull);expect(r.hits).toBe(hull===3?0:1);expect(r.fault).toBeUndefined();const moving=r.samples.filter((s:any)=>s.mine.phase==='pursuit');expect(moving.some((s:any)=>s.mine.vx>.1)).toBe(true);expect(moving.some((s:any)=>s.mine.vx<-.1)).toBe(true);
 if(lead===30){
  const death=await page.evaluate(()=>{const g=window.spaceRunner! as any,m=g.model;for(let n=0;n<20000&&m.state==='PLAYING';n++)m.step(1/120,{x:0,y:0});g.loop.render(1/60);return{state:m.state,hull:m.hull,fault:m.field.fault};});
  expect(death.state).toBe('GAME_OVER');expect(death.hull).toBe(0);expect(death.fault).toBeUndefined();await expect(page.locator('#game')).toHaveAttribute('data-state','GAME_OVER');
  await page.locator('#replay').click();await expect(page.locator('#game')).toHaveAttribute('data-state','PLAYING');expect(await page.evaluate(()=>(window.spaceRunner!.model as any).homing.samples.length)).toBeLessThan(120);
 }
});
test('native keyboard input changes the live pursuit target and mine course',async({page})=>{
 await launch(page,url);await page.waitForFunction(()=>{const m=window.spaceRunner!.model as any;return m.homing.current?.phase==='pursuit';},{},{timeout:20000});
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(650);await page.keyboard.up('ArrowRight');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(650);await page.keyboard.up('ArrowLeft');
 const r=await page.evaluate(()=>{const m=window.spaceRunner!.model as any;return{samples:m.homing.samples,fault:m.field.fault};});expect(r.fault).toBeUndefined();expect(r.samples.some((s:any)=>s.input.x===1)).toBe(true);expect(r.samples.some((s:any)=>s.input.x===-1)).toBe(true);expect(new Set(r.samples.filter((s:any)=>s.mine.phase==='pursuit').map((s:any)=>s.mine.targetX)).size).toBeGreaterThan(20);
});
for(const viewport of [{width:390,height:844},{width:844,height:390}])test(`adaptive touch pursuit at ${viewport.width}x${viewport.height}`,async({browser})=>{
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();await launch(page,url);await page.waitForFunction(()=>{const m=window.spaceRunner!.model as any;return m.homing.current?.phase==='pursuit';},{},{timeout:20000});
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:viewport.width*.4,y:viewport.height*.5}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:viewport.width*.8,y:viewport.height*.5}]});await page.waitForTimeout(450);
 const r=await page.evaluate(()=>{const m=window.spaceRunner!.model as any;return{x:m.ship.x,target:m.homing.current.targetX,inputs:m.homing.samples.slice(-40).map((s:any)=>s.input.x),fault:m.field.fault};});
 expect(r.x).toBeGreaterThan(.5);expect(r.target).toBe(r.x);expect(r.inputs.some((x:number)=>x>0)).toBe(true);expect(r.fault).toBeUndefined();await context.close();
});
test('production excludes adaptive selector, diagnostics while the integrated mine stays available',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('.glb'))requests.push(r.url());});await page.goto('http://127.0.0.1:4173'+url+'&homing=aggressive');await expect(page.locator('#game')).toHaveAttribute('data-state','MENU');expect(await page.evaluate(()=>window.spaceRunner)).toBeUndefined();expect(requests.length).toBe(7);expect(requests.some(r=>r.includes('space-mine'))).toBe(true);await expect(page.locator('#moving-mine-info')).toHaveCount(0);
});
