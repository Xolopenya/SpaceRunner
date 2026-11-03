import assert from 'node:assert/strict';
import { mkdir,writeFile,copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-004B/final';
await mkdir(directory,{recursive:true});await mkdir('test-results',{recursive:true});await mkdir('.cache/review/GAMEPLAY-004B/video',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const mode of ['before','after','wing-left','wing-right','station']){
  const seed=mode==='wing-right'?1:42,port=mode==='before'?5273:5173;
  const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:'.cache/review/GAMEPLAY-004B/video',size:{width:1280,height:800}}});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${port}/?debug=collectibles&${mode.startsWith('wing')?'colliders=1&':''}seed=${seed}`;
  await page.goto(url);await page.locator('#launch').click();
  const prefix=await page.evaluate(mode=>{
   const g=window.spaceRunner;g.loop.stop();const m=g.model;
   const certified=()=>{let tick=m.field.certificate?Math.round((m.elapsed-m.field.certificate.context.elapsed)*120):0;for(const run of m.field.certificate?.controls??[]){if(tick<run.ticks)return run.input;tick-=run.ticks;}return{x:0,y:0};};
   const immediate=mode.startsWith('wing');
   const pilot=()=>{const p=m.fragments.active.filter(p=>p.passDistance>m.distance-1).sort((a,b)=>a.passDistance-b.passDistance)[0];
    if(!p)return immediate?{x:0,y:0}:certified();
    if(!immediate&&p.passDistance-m.distance>Math.max(55,m.speed*2.4))return certified();
    const target=mode==='before'||mode==='after'?{x:p.x,y:p.y-.9}:p.approach??p;
    return{x:Math.max(-1,Math.min(1,(target.x-m.ship.x)*1.6-m.ship.vx*.3)),y:Math.max(-1,Math.min(1,(target.y-m.ship.y)*1.6-m.ship.vy*.3))};
   };
   const inputs=[];Object.defineProperty(g.input,'axis',{get:()=>{const axis=pilot();inputs.push(axis);return axis;},configurable:true});window.shipEvidenceInputs=inputs;
   const target=mode==='wing-left'?110:mode==='wing-right'?1015:mode==='station'?510:240;
   while(m.distance<target&&m.state==='PLAYING'){const input=pilot();inputs.push(input);m.step(1/120,input);}
   const frames=[];let previous=performance.now(),render=g.loop.render;g.loop.render=dt=>{const now=performance.now();frames.push(now-previous);previous=now;render(dt);};window.shipEvidenceFrames=frames;
   g.loop.render(1/60);g.loop.start();return{distance:m.distance,hull:m.hull,count:m.fragments.count};
  },mode);
  if(mode.startsWith('wing')){
   assert.equal(prefix.hull,3);
   await page.waitForFunction(()=>window.spaceRunner.model.lastShipContact?.bodyClear);
   await page.evaluate(()=>window.spaceRunner.loop.stop());
   await page.screenshot({path:`test-results/004b-${mode}-contact.png`});
  }else{
   const pass=mode==='station'?564:285.6627569999546;
   await page.waitForFunction(pass=>window.spaceRunner.model.distance>=pass-2.5,pass);
   await page.screenshot({path:`test-results/004b-${mode}-near.png`});
   await page.waitForFunction(pass=>window.spaceRunner.model.distance>=pass+3,pass);
   await page.screenshot({path:`test-results/004b-${mode}-after.png`});
   await page.evaluate(()=>window.spaceRunner.loop.stop());
  }
  const final=await page.evaluate(()=>{const g=window.spaceRunner,m=g.model;return{distance:m.distance,hull:m.hull,count:m.fragments.count,contact:m.lastShipContact,pickup:m.fragments.lastPickup,stats:{...m.fragments.stats},metrics:m.shipCollisionMetrics,frames:window.shipEvidenceFrames,inputs:window.shipEvidenceInputs,drawCalls:g.world.renderer.info.render.calls,geometries:g.world.renderer.info.memory.geometries,textures:g.world.renderer.info.memory.textures};});
  assert.deepEqual(errors,[]);
  if(mode.startsWith('wing')){assert.equal(final.hull,2);assert.equal(final.contact.bodyClear,true);assert.equal(final.contact.part,mode==='wing-left'?'left-wing':'right-wing');assert.ok([0,1].includes(final.contact.kind));}
  else {assert.equal(final.hull,3);if(mode==='before')assert.equal(final.count,0);else if(mode==='after')assert.equal(final.count,1);else{assert.equal(final.count,2);assert.equal(final.pickup.part,'right-wing');}}
  const video=page.video();await context.close();await copyFile(await video.path(),`test-results/004b-${mode}.webm`);
  results.push({mode,url,prefix,final,errors});console.log(mode,'passed',final.distance,final.count,final.contact?.part??final.pickup.part);
 }
 // Actual magnetic animation, deterministic pause, restart and resource reuse.
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 await page.goto('http://127.0.0.1:5173/?debug=collectibles&colliders=1&seed=42');await page.locator('#launch').click();
 const resources=await page.evaluate(async()=>{
  const g=window.spaceRunner,m=g.model;g.loop.stop();const {fragmentInput}=await import('/tests/fixtures/fragment-flight.ts');
  const collect=()=>{m.state='GAME_OVER';m.start(42);g.world.reset();while(!m.fragments.count&&m.state==='PLAYING'&&m.distance<400)m.step(1/120,fragmentInput(m,m.fragments.active[0]));g.loop.render(1/60);};collect();
  const state=()=>g.world.fragments.root.children.map(n=>({visible:n.visible,p:n.position.toArray(),scale:n.scale.toArray()}));
  const before=JSON.stringify(state());m.pause();for(let i=0;i<100;i++){m.step(1/120,{x:1,y:0});g.loop.render(1/60);}const frozen=before===JSON.stringify(state());m.resume();
  const rows=[];for(let restart=0;restart<20;restart++){collect();rows.push({restart,...g.world.renderer.info.memory,count:m.fragments.count,slots:m.fragments.slots.length});}
  m.state='GAME_OVER';m.start(42);g.world.reset();g.loop.render(1/60);const resetVisible=g.world.fragments.root.children.filter(n=>n.visible).length;
  return{frozen,rows,resetCount:m.fragments.count,resetVisible};
 });
 assert.equal(resources.frozen,true);assert.equal(resources.resetCount,0);assert.equal(resources.resetVisible,0);assert.ok(resources.rows.every(r=>r.geometries===resources.rows[0].geometries&&r.textures===resources.rows[0].textures&&r.slots===8));await context.close();
 await writeFile(`${directory}/ship-browser.json`,JSON.stringify({browser:browser.version(),results,resources,note:'Real-time Chrome captures after actual unrendered simulation prefixes. Wing capture stops after the genuine hit; DEV ghost explicitly holds recorded asteroid pose .6s. No inserted obstacles, teleport, hull override, fake frames or production deployment. Silent WebM.'},null,2));
}finally{await browser.close();}
