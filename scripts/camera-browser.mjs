import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { scenarios, directory, digest } from './camera-scenarios.mjs';

const rows=await scenarios(),modes=['baseline','full-chase','hybrid-chase'];
await mkdir('test-results',{recursive:true});await mkdir('.cache/review/CAMERA-001/video',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],screenshots=[],videos=[];
const stats=values=>{const sorted=values.slice().sort((a,b)=>a-b),p=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]??0;return{n:sorted.length,p50:p(.5),p95:p(.95),p99:p(.99),max:sorted.at(-1)??0};};
async function pageFor(context){
 const page=await context.newPage();page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  window.researchRAF=requestAnimationFrame.bind(window);const pending=new Map();let next=0;
  window.requestAnimationFrame=cb=>{pending.set(++next,cb);return next;};window.cancelAnimationFrame=id=>pending.delete(id);
 });return page;
}
async function prepare(page,row,mode,diagnostic,endTick=row.tick,live=false){
 const url=`http://127.0.0.1:5173/?debug=camera&camera=${mode}&seed=${row.seed}${diagnostic?'&colliders=1':''}`;
 await page.goto(url);await page.locator('#launch').click();await page.waitForFunction(()=>window.spaceRunner&&document.getElementById('camera-research'),null,{polling:20});
 const inputs=row.inputs.slice(0,endTick),prefix=live?Math.max(0,endTick-480):endTick;
 await page.evaluate(({inputs,prefix})=>{
  const g=window.spaceRunner,m=g.model;g.loop.stop();window.cameraResearchInputs=inputs;window.cameraResearchTick=0;
  const draw=g.world.renderer.render;g.world.renderer.render=()=>{};
  for(let tick=0;tick<prefix;tick++){m.step(1/120,inputs[tick]);if(tick%2===1)g.loop.render(1/60);}
  g.world.renderer.render=draw;window.cameraResearchTick=prefix;g.loop.render(0);
  window.cameraResearchFrames=[];window.cameraResearchCost=[];
  const rig=g.world.flightCamera,update=rig.update.bind(rig);
  rig.update=(...args)=>{const before=performance.now();update(...args);window.cameraResearchCost.push(performance.now()-before);};
 },{inputs,prefix});
 return url;
}
async function measure(page,row){return await page.evaluate(async row=>{
 const {Vector3}=await import('/node_modules/three/build/three.module.js'),g=window.spaceRunner,m=g.model,w=g.world,c=w.flightCamera.camera;c.updateMatrixWorld();w.ship.updateMatrixWorld(true);
 const projected=new Vector3(),bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,vertices:0,clipped:0};
 w.ship.traverse(n=>{if(!n.isMesh)return;const a=n.geometry.getAttribute('position');for(let i=0;i<a.count;i++){projected.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld).project(c);bounds.vertices++;if(Math.abs(projected.x)>1||Math.abs(projected.y)>1)bounds.clipped++;bounds.minX=Math.min(bounds.minX,projected.x);bounds.maxX=Math.max(bounds.maxX,projected.x);bounds.minY=Math.min(bounds.minY,projected.y);bounds.maxY=Math.max(bounds.maxY,projected.y);}});
 const h=row.event.hazard??row.event.contact,hazard=h?new Vector3(h.x,h.y,h.passDistance!==undefined?h.passDistance-m.distance:h.z).project(c).toArray():null;
 const state={distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},state:m.state,hull:m.hull,phase:m.phase,speed:m.speed,hitSerial:m.hitSerial,invulnerability:m.invulnerability,hazards:m.field.hazards.map(h=>({...h})),fragments:m.fragments.active.map(p=>({...p})),count:m.fragments.count,pickup:m.fragments.lastPickup,contact:m.lastShipContact,publications:m.field.events.map(e=>({...e}))};
 return {tick:window.cameraResearchTick,state,camera:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,aspect:c.aspect,near:c.near,far:c.far,shipNdc:new Vector3(m.ship.x,m.ship.y,0).project(c).toArray(),bounds,hazardNdc:hazard,hazardCenterInFrame:hazard?Math.abs(hazard[0])<=1&&Math.abs(hazard[1])<=1&&Math.abs(hazard[2])<=1:null},resources:{...w.renderer.info.memory,drawCalls:w.renderer.info.render.calls},frames:window.cameraResearchFrames,cost:window.cameraResearchCost};
 },row);}
async function runTo(page,target){
 await page.evaluate(target=>new Promise(resolve=>{
  const g=window.spaceRunner,m=g.model,inputs=window.cameraResearchInputs;let previous=performance.now();
  if(window.cameraResearchTick>=target){resolve();return;}
  const frame=()=>{
   const now=performance.now();window.cameraResearchFrames.push(now-previous);previous=now;
   for(let n=0;n<2&&window.cameraResearchTick<target;n++){m.step(1/120,inputs[window.cameraResearchTick]);window.cameraResearchTick++;}
   g.loop.render(1/60);
   if(window.cameraResearchTick<target)window.researchRAF(frame);else resolve();
  };window.researchRAF(frame);
 }),target);
}
async function capture(page,row,mode,suffix=''){
 const file=`camera-${row.event.name}-${mode}${suffix}.png`;await page.screenshot({path:`test-results/${file}`});screenshots.push(file);const measured=await measure(page,row);const {state,frames,cost,...rest}=measured;return{file,...rest,stateHash:digest(state),state,raf:stats(frames),cameraUpdateMs:stats(cost)};
}
try{
 for(const mode of modes){
  const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:'.cache/review/CAMERA-001/video',size:{width:1280,height:800}}}),page=await pageFor(context),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const row of rows){
   const live=!row.event.name.startsWith('aperture-'),diagnostic=['left-boundary','right-boundary','wing-hit'].includes(row.event.name);
   const url=await prepare(page,row,mode,diagnostic,row.tick,live);
   if(!diagnostic)await page.locator('#camera-research').evaluate(el=>el.hidden=true);
   if(live)await runTo(page,row.captureTick);
   const shot=await capture(page,row,mode);
   if(live)await runTo(page,row.tick);
   const final=await measure(page,row);assert.equal(digest(final.state),row.stateHash,`Node/Chrome state mismatch: ${row.event.name}/${mode}`);
   if(mode!=='baseline')assert.equal(shot.stateHash,results.find(r=>r.scenario===row.event.name&&r.mode==='baseline').shot.stateHash);
   results.push({scenario:row.event.name,mode,url,event:row.event,shot,finalStateHash:digest(final.state),raf:stats(final.frames),cameraUpdateMs:stats(final.cost)});
   console.log(row.event.name,mode,'matched',shot.tick,shot.state.hull,shot.state.count);
  }
  // The real selector changes policy at an exact fixed state; then flight continues.
  await page.locator('#camera-research').evaluate(el=>el.hidden=false);
  const identity=await page.evaluate(()=>JSON.stringify(window.spaceRunner.model));
  for(const selected of modes){await page.locator(`[data-camera="${selected}"]`).click();await page.evaluate(()=>{const g=window.spaceRunner;g.loop.render(0);});assert.equal(await page.evaluate(()=>JSON.stringify(window.spaceRunner.model)),identity);await page.waitForTimeout(300);}
  const video=page.video();await context.close();const file=`camera-${mode}.webm`;await copyFile(await video.path(),`test-results/${file}`);videos.push(file);assert.deepEqual(errors,[]);
 }
 // Selector clicks while actual recorded steering/forward motion keep advancing.
 {
  const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:'.cache/review/CAMERA-001/video',size:{width:1280,height:800}}}),page=await pageFor(context),row=rows.find(r=>r.event.name==='sustained');
  await prepare(page,row,'baseline',true,row.tick,true);
  const playback=runTo(page,row.tick),switches=[];
  for(const [tick,mode] of [[410,'full-chase'],[550,'hybrid-chase'],[700,'baseline']]){
   await page.waitForFunction(tick=>window.cameraResearchTick>=tick,tick,{polling:20});const before=await page.evaluate(()=>window.spaceRunner.model.distance);await page.locator(`[data-camera="${mode}"]`).click();const after=await page.evaluate(()=>({distance:window.spaceRunner.model.distance,tick:window.cameraResearchTick,mode:window.spaceRunner.world.flightCamera.mode}));assert.ok(after.distance>=before);assert.equal(after.mode,mode);switches.push({before,...after});
  }
  await playback;const final=await measure(page,row);assert.equal(digest(final.state),row.stateHash);results.push({scenario:'live-switching',switches,finalStateHash:digest(final.state)});
  const video=page.video();await context.close();const file='camera-switching.webm';await copyFile(await video.path(),`test-results/${file}`);videos.push(file);
 }
 // Same real trajectory at all arena extremes, and two mobile aspect ratios.
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await pageFor(context),movement=rows.find(r=>r.event.name==='sustained');
 for(const [name,tick] of [['center',0],['left',150],['right',390],['upper',510],['lower',650],['corner',850]])for(const mode of modes){
  const row={...movement,event:{name:`position-${name}`}};await prepare(page,row,mode,false,tick);await page.locator('#camera-research').evaluate(el=>el.hidden=true);const shot=await capture(page,row,mode);results.push({scenario:row.event.name,mode,shot});
 }
 for(const [name,width,height] of [['portrait',390,844],['mobile-landscape',844,390]]){
  const mobileContext=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1}),mobile=await pageFor(mobileContext);
  for(const scenario of ['left-boundary','station'])for(const mode of modes){const row=rows.find(r=>r.event.name===scenario);await prepare(mobile,row,mode,false,row.captureTick);await mobile.locator('#camera-research').evaluate(el=>el.hidden=true);const shot=await capture(mobile,row,mode,`-${name}`);results.push({scenario,viewport:name,mobileTouch:true,mode,shot});}
  await mobileContext.close();
 }
 await page.setViewportSize({width:1280,height:800});await prepare(page,movement,'full-chase',false,150);
 // Freeze paused pose and sample twenty genuine UI restarts, without new cameras/resources.
 const resources=await page.evaluate(()=>{const g=window.spaceRunner,m=g.model,c=g.world.flightCamera.camera;const rows=[];m.pause();g.loop.render(0);const before=c.position.toArray();for(let i=0;i<100;i++){m.step(1/120,{x:1,y:1});g.loop.render(1/60);}const frozen=JSON.stringify(before)===JSON.stringify(c.position.toArray());for(let n=0;n<20;n++){document.getElementById('restart-pause').click();m.pause();g.loop.render(0);for(const mode of ['baseline','full-chase','hybrid-chase']){document.querySelector(`[data-camera="${mode}"]`).click();g.loop.render(0);}rows.push({...g.world.renderer.info.memory,sameCamera:c===g.world.flightCamera.camera,distance:m.distance,hull:m.hull,count:m.fragments.count});}return{frozen,rows};});
 assert.equal(resources.frozen,true);assert.ok(resources.rows.every(r=>r.sameCamera&&r.distance===0&&r.hull===3&&r.count===0&&r.geometries===resources.rows[0].geometries&&r.textures===resources.rows[0].textures));await context.close();
 const hashes=new Map();for(const r of results.filter(r=>r.shot)){const key=`${r.scenario}/${r.shot.tick}`;if(hashes.has(key))assert.equal(r.shot.stateHash,hashes.get(key),`Matched tick changed across camera/viewport: ${key}`);else hashes.set(key,r.shot.stateHash);}
 await writeFile(`${directory}/camera-browser.json`,JSON.stringify({browser:browser.version(),results,screenshots,videos,resources,note:'Native silent Chrome WebM. Actual ReleaseModel, accepted ordinary hazards, fixed120Hz recorded inputs and60Hz render ticks; unrendered prefixes still update original presentation with renderer draw temporarily suppressed. Last4s per primary scenario played in native RAF,2 fixed simulation ticks per RAF; scheduling stalls do not change history. No teleports, inserted hazards, physics or health edits. Diagnostic wing hit uses existing explicitly labeled recorded ghost. Clean captures hide DEV overlay. No human approval claimed.'},null,2));
}finally{await browser.close();}
