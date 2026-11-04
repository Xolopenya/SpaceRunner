import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';

const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-005A/final';
const scenarios=JSON.parse(await readFile(`${directory}/integrated-scenarios.json`,'utf8'));
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stats=v=>{const s=[...v].sort((a,b)=>a-b),p=q=>s[Math.min(s.length-1,Math.floor(s.length*q))]??0;return{n:s.length,p50:p(.5),p95:p(.95),p99:p(.99),max:s.at(-1)??0};};
await mkdir(`${directory}/media`,{recursive:true});
let server;
try { await fetch('http://127.0.0.1:5185'); } catch {
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5185','--strictPort'],{stdio:'ignore',windowsHide:true});
 let ready=false;for(let n=0;n<100;n++){try{await fetch('http://127.0.0.1:5185');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
 assert.ok(ready,'Local Vite server did not start');
}
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
async function create(viewport,video) {
 const context=await browser.newContext({viewport,...(video?{recordVideo:{dir:`${directory}/video-raw`,size:viewport}}:{})});
 const page=await context.newPage();page.setDefaultTimeout(120000);
 await page.addInitScript(()=>{window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
 return{context,page};
}
async function prepare(page,row,diagnostic=false) {
 const url=`http://127.0.0.1:5185/?seed=${row.seed}${diagnostic?'&debug=integrated&colliders=1':''}`;
 await page.goto(url);await page.locator('#launch').waitFor();
 await page.evaluate(async()=>{const path='/src/game.ts',{Game}=await import(path),original=Game.prototype.start;
  Game.prototype.start=function(){window.captureGame=this;original.call(this);};});
 await page.locator('#launch').click();
 await page.evaluate(()=>{const g=window.captureGame;g.loop.stop();window.captureTick=0;window.captureFrames=[];window.captureCosts=[];});
 return url;
}
async function advance(page,row,target,live=false) {
 await page.evaluate(({inputs,target,live})=>new Promise(resolve=>{
  const g=window.captureGame,m=g.model;
  const step=()=>{const t=window.captureTick;if(t%2===0)m.beginPlanningFrame();m.step(1/120,inputs[t]);window.captureTick++;
   if(t%2===1){m.finishPlanningFrame(1/60);g.loop.render(1/60);}};
  if(!live){const draw=g.world.renderer.render;g.world.renderer.render=()=>{};
   while(window.captureTick<target)step();g.world.renderer.render=draw;g.loop.render(0);resolve();return;}
  let previous=performance.now();const frame=()=>{const now=performance.now();window.captureFrames.push(now-previous);previous=now;
   const start=performance.now();for(let n=0;n<2&&window.captureTick<target;n++)step();window.captureCosts.push(performance.now()-start);
   if(window.captureTick<target)window.nativeRAF(frame);else{g.loop.render(0);resolve();}};window.nativeRAF(frame);
 }),{inputs:row.inputs,target,live});
}
async function measure(page) {
 return page.evaluate(()=>{const g=window.captureGame,m=g.model,w=g.world;
  return{state:{distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},hull:m.hull,phase:m.phase,state:m.state,count:m.fragments.count,
   pickup:m.fragments.lastPickup,fragments:m.fragments.active,hazards:m.field.slots.map(h=>({...h})),current:m.homing.current,events:m.field.events.map(e=>({...e})),fault:m.field.fault},
   resources:{...w.renderer.info.memory,drawCalls:w.renderer.info.render.calls},bounds:w.boundaries.sides.map(s=>s.material.opacity),
   camera:{mode:w.flightCamera.mode,position:w.flightCamera.camera.position.toArray(),fov:w.flightCamera.camera.fov,aspect:w.flightCamera.camera.aspect},
   frames:window.captureFrames,costs:window.captureCosts,gpu:w.renderer.getContext().getParameter(w.renderer.getContext().RENDERER)};});
}
try {
 for(const name of ['ordinary','pickup','station','mine','phase2','boundary-450']) {
  const row=scenarios.find(s=>s.name===name);assert.ok(row,name);
  const {context,page}=await create({width:1280,height:800},true),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=await prepare(page,row),prefix=Math.max(0,row.tick-600);
  await advance(page,row,prefix);await advance(page,row,row.tick,true);
  const m=await measure(page);assert.equal(digest(m.state),row.stateHash,`Node/Chrome causal mismatch: ${name}`);assert.deepEqual(errors,[]);
  const screenshot=`integrated-${name}.png`;await page.screenshot({path:`${directory}/media/${screenshot}`});
  const video=page.video();await context.close();const videoName=`integrated-${name}.webm`;await copyFile(await video.path(),`${directory}/media/${videoName}`);
  const {frames,costs,state,...rest}=m;results.push({name,url,tick:row.tick,stateHash:digest(state),distance:state.distance,hull:state.hull,energy:state.count,...rest,rafMs:stats(frames),updateAndRenderMs:stats(costs),screenshot,video:videoName});
  console.log(name,state.distance.toFixed(1),'hull',state.hull,'energy',state.count);
 }
 const {context,page}=await create({width:1280,height:800},false);
 for(const [name,diagnostic] of [['mine',true],['station',true],['boundary-250',true]]) {
  const row=scenarios.find(s=>s.name===name);await prepare(page,row,diagnostic);await advance(page,row,row.tick);
  const shot=`integrated-${name}-colliders.png`;await page.screenshot({path:`${directory}/media/${shot}`});const m=await measure(page);
  assert.equal(digest(m.state),row.stateHash);results.push({name,diagnostic,screenshot:shot,bounds:m.bounds,stateHash:digest(m.state)});
 }
 for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
  await page.setViewportSize(viewport);
  for(const name of ['mine','boundary-250','station']){
   const row=scenarios.find(s=>s.name===name);await prepare(page,row);await advance(page,row,row.tick);
   const shot=`integrated-${name}-${viewport.width}x${viewport.height}.png`;await page.screenshot({path:`${directory}/media/${shot}`});const m=await measure(page);assert.equal(digest(m.state),row.stateHash);
   results.push({name,viewport,screenshot:shot,camera:m.camera,bounds:m.bounds,resources:m.resources,stateHash:digest(m.state)});
  }
 }
 await context.close();
 // Separate native RAF measurement of ordinary simulation/rendering. No video encoding or replay pacing.
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]) {
  const context=await browser.newContext({viewport}),page=await context.newPage();await page.goto('http://127.0.0.1:5185/?seed=42&debug=integrated');await page.locator('#launch').click();
  const measured=await page.evaluate(()=>new Promise(resolve=>{const g=window.spaceRunner,frames=[],costs=[],planners=[];let previous=performance.now();
   const render=g.world.render.bind(g.world);g.world.render=(...args)=>{const t=performance.now();render(...args);costs.push(performance.now()-t);planners.push(g.model.homing.planningFrame.latest.ms);};
   const frame=now=>{frames.push(now-previous);previous=now;if(frames.length<600)requestAnimationFrame(frame);else resolve({frames,costs,planners,hull:g.model.hull,distance:g.model.distance,drawCalls:g.world.renderer.info.render.calls,memory:{...g.world.renderer.info.memory},gpu:g.world.renderer.getContext().getParameter(g.world.renderer.getContext().RENDERER)});};requestAnimationFrame(frame);
  }));
  results.push({name:'native-performance',viewport,...measured,frames:undefined,costs:undefined,planners:undefined,rafMs:stats(measured.frames),renderMs:stats(measured.costs),plannerMs:stats(measured.planners)});await context.close();
 }
 await mkdir('test-results',{recursive:true});
 for(const row of results)for(const name of [row.screenshot,row.video])if(name)await copyFile(`${directory}/media/${name}`,`test-results/${name}`);
 await writeFile(`${directory}/integrated-browser.json`,JSON.stringify({browser:browser.version(),results,
  note:'Clean ordinary Play captures use no debug URL. Only existing Game.start is observed by test script; inputs are actual recorded120Hz axes. Prefixes fast-forward while preserving two-tick planning cadence; final up-to5s uses2ticks/native RAF and silent native Chrome WebM. Exact Node/Chrome state hashes are checked. Performance rows separately use ordinary native GameLoop RAF, no video. Viewport emulation is not physical phone evidence.'},null,2));
} finally {await browser.close();server?.kill();}
