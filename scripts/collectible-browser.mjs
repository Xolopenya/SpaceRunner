import assert from 'node:assert/strict';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const dir=process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-004/final';
await mkdir(dir,{recursive:true});await mkdir('.cache/review/GAMEPLAY-004/evidence',{recursive:true});await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
 for(const mode of ['pickup','ignore','station']) {
  const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:'.cache/review/GAMEPLAY-004/evidence',size:{width:1280,height:800}}});
  const page=await context.newPage(),errors=[];page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/?debug=collectibles&seed=42');await page.locator('#launch').click();
  const initial=await page.evaluate(async mode=>{
   const g=window.spaceRunner;g.loop.stop();const {fragmentInput,certifiedInput}=await import('/tests/fixtures/fragment-flight.ts');
   const pilot=()=>{const m=g.model,p=m.fragments.active.filter(p=>p.passDistance>m.distance-1).sort((a,b)=>a.passDistance-b.passDistance)[0];return mode==='ignore'?certifiedInput(m):fragmentInput(m,p);};
   Object.defineProperty(g.input,'axis',{get:pilot,configurable:true});
   const end=mode==='station'?480:190;
   while(g.model.distance<end&&g.model.state==='PLAYING')g.model.step(1/120,pilot());
   const render=g.loop.render,frames=[];let previous=performance.now();g.loop.render=dt=>{const now=performance.now();frames.push(now-previous);previous=now;render(dt);};window.fragmentFrameTimes=frames;
   g.loop.render(1/60);g.loop.start();return{distance:g.model.distance,hull:g.model.hull,count:g.model.fragments.count,stats:{...g.model.fragments.stats}};
  },mode);
  const pass=mode==='station'?564:285.6627569999546;
  await page.waitForFunction(d=>window.spaceRunner.model.distance>d,pass-28,{timeout:20000});
  await page.screenshot({path:`test-results/collectible-${mode}-approach.png`});
  await page.waitForFunction(d=>window.spaceRunner.model.distance>d,pass-7,{timeout:10000});
  await page.screenshot({path:`test-results/collectible-${mode}-near.png`});
  await page.waitForFunction(d=>window.spaceRunner.model.distance>d,pass+3,{timeout:10000});
  await page.screenshot({path:`test-results/collectible-${mode}-after.png`});
  const final=await page.evaluate(()=>{const g=window.spaceRunner,m=g.model;return{distance:m.distance,hull:m.hull,count:m.fragments.count,stats:{...m.fragments.stats},pickup:{...m.fragments.lastPickup},audio:g.audio.graph.counts.pickup,drawCalls:g.world.renderer.info.render.calls,memory:{...g.world.renderer.info.memory},frameTimes:window.fragmentFrameTimes};});
  assert.equal(final.hull,3);assert.deepEqual(errors,[]);
  if(mode==='ignore')assert.equal(final.count,0);else assert.ok(final.count>initial.count);
  if(mode!=='ignore')assert.ok(final.audio>=1);
  await page.locator('#pause').click();const frozen=await page.evaluate(()=>JSON.stringify(window.spaceRunner.model.fragments));await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.stringify(window.spaceRunner.model.fragments)),frozen);
  await page.locator('#resume').click();
  const video=page.video();await context.close();await copyFile(await video.path(),`test-results/collectible-${mode}.webm`);
  results.push({mode,url:'http://127.0.0.1:5173/?debug=collectibles&seed=42',initial,final,errors});console.log(mode,'real-time capture passed',final);
 }
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 await page.goto('http://127.0.0.1:5173/?debug=collectibles&seed=42');await page.locator('#launch').click();
 const measurements=await page.evaluate(async()=>{
  const g=window.spaceRunner;g.loop.stop();const m=g.model,{fragmentInput}=await import('/tests/fixtures/fragment-flight.ts');
  const run=()=>{m.state='GAME_OVER';m.start(42);while(m.distance<275&&m.state==='PLAYING')m.step(1/120,fragmentInput(m,m.fragments.active[0]));g.loop.render(1/60);};run();
  const view=g.world.fragments,samples=[];
  for(const enabled of [false,true,false,true]){
   const saved=view.update; if(!enabled){view.root.visible=false;view.update=()=>{};}
   const ms=[];for(let i=0;i<110;i++){const t=performance.now();g.world.render(m,1/60);if(i>=20)ms.push(performance.now()-t);}
   samples.push({enabled,ms,drawCalls:g.world.renderer.info.render.calls});view.update=saved;
  }
  const memory=[];for(let restart=0;restart<20;restart++){run();memory.push({restart,...g.world.renderer.info.memory,active:m.fragments.active.length,slots:m.fragments.slots.length,heap:performance.memory?.usedJSHeapSize});}
  return{samples,memory,active:m.fragments.active.length,gpu:g.world.renderer.getContext().getParameter(g.world.renderer.getContext().RENDERER)};
 });
 const audio=await page.evaluate(async()=>{
  const {AudioGraph}=await import('/src/audio/graph.ts');const {AUDIO}=await import('/src/audio/settings.ts');
  const rows=[];for(const [master,sfx,music,muted]of[[1,1,0,false],[.5,1,0,false],[1,.5,0,false],[1,1,1,false],[1,1,0,true]]){
   const c=new OfflineAudioContext(1,44100,44100),graph=new AudioGraph(c,{master,sfx,music,muted});graph.play('pickup',.1);const b=await c.startRendering(),data=b.getChannelData(0);let power=0,peak=0;for(const v of data){power+=v*v;peak=Math.max(peak,Math.abs(v));}rows.push({master,sfx,music,muted,rms:Math.sqrt(power/data.length),peak});graph.dispose();}
  return rows;
 });
 assert.ok(audio[0].rms>0);assert.ok(Math.abs(audio[1].rms/audio[0].rms-.5)<.02);assert.ok(Math.abs(audio[2].rms/audio[0].rms-.5)<.02);assert.equal(audio[4].peak,0);assert.equal(audio[0].rms,audio[3].rms);
 const mem=measurements.memory;assert.ok(mem.every(m=>m.geometries===mem[0].geometries&&m.textures===mem[0].textures&&m.slots===8));
 const death=await page.evaluate(async()=>{const g=window.spaceRunner,m=g.model,{fragmentInput}=await import('/tests/fixtures/fragment-flight.ts');while(m.state==='PLAYING'&&m.distance<5000)m.step(1/120,fragmentInput(m,m.fragments.active[0]));g.loop.render(1/60);return{state:m.state,hull:m.hull,count:m.fragments.count,distance:m.distance};});
 assert.equal(death.state,'GAME_OVER');assert.equal(death.hull,0);assert.equal(Number(await page.locator('#final-energy').textContent()),death.count);await page.screenshot({path:'test-results/collectible-game-over.png'});
 await context.close();await writeFile(`${dir}/collectible-browser.json`,JSON.stringify({browser:browser.version(),results,measurements,audio,death,note:'Real Chrome render/capture of actual ReleaseModel simulation; automated pilot, no human approval. No obstacle insertion, teleport or hull override. Performance samples are headless local CPU submissions, not physical-device FPS. Real-time videos start after an unrendered simulated prefix; game-over screenshot uses a genuine damage-ended continuation.'},null,2));
 console.log('Collectible browser evidence, audio and20 restart resource checks passed');
} finally {await browser.close();}
