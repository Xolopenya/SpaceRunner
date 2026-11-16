import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openGame,chromium} from '../../../scripts/release-browser-lib.mjs';
const live=process.argv.includes('--live'),prefix=live?'public':'local';
const url=live?'https://xolopenya.github.io/SpaceRunner/':'http://127.0.0.1:5188/SpaceRunner/';
const dir=resolve('.cache/review/RELEASE-001'),evidence=resolve(dir,'evidence');await mkdir(evidence,{recursive:true});
const server=live?null:spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5188','--strictPort'],{env:{...process.env,GITHUB_ACTIONS:'true'},stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 if(server){let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(url)).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);}
 const html=await(await fetch(url)).text(),entry=html.match(/src="([^"]+\.js)"/)[1];
 const entryResponse=await fetch(new URL(entry,url));assert.equal(entryResponse.status,200);assert.ok(entryResponse.headers.get('content-type')?.includes('javascript'),'Preview must serve project-prefixed JavaScript, not HTML fallback');
 const r=await openGame(browser,url,{seed:42,viewport:{width:1280,height:800}}),shots=[];
 const shot=async name=>{const path=`${prefix}-${name}.png`;await r.page.screenshot({path:resolve(evidence,path)});shots.push({path,...await r.page.evaluate(()=>{const g=window.releaseQA;return{state:g.model.state,elapsed:g.model.elapsed,distance:g.model.distance,hull:g.model.hull,energy:g.model.fragments.count,best:g.platform.scores.best,focus:document.activeElement?.id,cinematic:g.world.destruction.sequence.active};})});};
 await r.page.waitForFunction(()=>window.releaseQA.audio.status==='running',null,{polling:100});
 await r.page.evaluate(async()=>{const g=window.releaseQA;await g.audio.graph.samples.ready;window.smokeFacts=[];g.model.events.subscribe(e=>window.smokeFacts.push(e));window.smokeAudio=g.audio.graph;});
 await r.page.keyboard.down('KeyD');
 const movement=await r.page.evaluate(()=>{const g=window.releaseQA;for(let i=0;i<30;i++){g.loop.update(1/120);g.loop.render(1/120);}return g.model.ship.x;});
 await r.page.keyboard.up('KeyD');assert.ok(movement>0);await shot('keyboard');
 await r.page.locator('#pause').click();await r.page.locator('#restart-pause').click();await r.page.evaluate(()=>{window.releaseTick=0;window.releaseQA.loop.render(0);});
 // Read-only pilot picks legal input axes. No entity, HP, pickup or score injection.
 const drive=async(pilot,goal)=>r.page.evaluate(({pilot,goal})=>{
  const g=window.releaseQA,m=g.model,draw=g.world.renderer.render;g.world.renderer.render=()=>{};
  try{for(let tick=0;tick<24000&&m.state==='PLAYING';tick++){
   const p=m.fragments.active.slice().sort((a,b)=>a.passDistance-b.passDistance)[0];
   if(goal==='visible-fragment'&&p&&p.passDistance-m.distance<55)break;
   let axis={x:0,y:0};
   if(pilot){const cert=m.field.certificate;let at=cert?Math.round((m.elapsed-cert.context.elapsed)*120):0;
    for(const c of cert?.controls??[]){if(at<c.ticks){axis=c.input;break;}at-=c.ticks;}
    if(p&&p.passDistance-m.distance<Math.max(55,m.speed*2.4)){const target=p.approach??p;axis={x:Math.max(-1,Math.min(1,(target.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(target.y-m.ship.y)*2.6-m.ship.vy*.8))};}
   }
   window.releaseStep(axis);
   if(goal==='collected'&&m.fragments.count>0)break;
   if(goal==='damage'&&m.hull<3)break;
  }}finally{g.world.renderer.render=draw;g.loop.render(0);}
  return{state:m.state,distance:m.distance,hull:m.hull,energy:m.fragments.count,fragments:m.fragments.active.length};
 },{pilot,goal});
 const approach=await drive(true,'visible-fragment');assert.ok(approach.fragments>0);await shot('collectible-approach');
 const pickup=await drive(true,'collected');assert.ok(pickup.energy>0);assert.equal(pickup.state,'PLAYING');await shot('collected');
 await drive(false,'damage');await shot('damage');
 const death=await drive(false,'death');assert.equal(death.state,'GAME_OVER');assert.equal(await r.page.locator('#game-over').isVisible(),false);await shot('cinematic');
 await r.page.evaluate(()=>{for(let i=0;i<150;i++)window.releaseQA.loop.render(1/60);});
 assert.equal(await r.page.locator('#game-over').isVisible(),true);assert.equal(await r.page.locator('#replay').evaluate(n=>document.activeElement===n),true);
 assert.equal(await r.page.locator('#final-score').textContent(),Math.floor(death.distance).toLocaleString('en-US'));
 assert.equal(await r.page.locator('#final-energy').textContent(),String(death.energy).padStart(2,'0'));
 assert.equal(await r.page.locator('#new-record').isVisible(),true);await shot('results-with-energy');
 const best=Math.floor(death.distance);await r.page.locator('#back-menu').click();await r.page.evaluate(()=>window.releaseQA.loop.render(0));
 assert.equal(await r.page.locator('#launch').evaluate(n=>document.activeElement===n),true);
 assert.equal(await r.page.locator('#menu-best').textContent(),best.toLocaleString('en-US'));
 await r.page.evaluate(()=>{const g=window.releaseQA,a=g.audio.context.createAnalyser();a.fftSize=2048;g.audio.graph.musicBus.connect(a);window.menuAnalyser=a;});
 await r.page.waitForFunction(()=>{const a=window.menuAnalyser,b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return Math.sqrt(b.reduce((sum,x)=>sum+x*x,0)/b.length)>1e-6;},null,{polling:100});
 const audio=await r.page.evaluate(()=>{const g=window.releaseQA,a=window.menuAnalyser,b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);a.disconnect();return{state:g.model.state,status:g.audio.status,context:g.audio.context.state,sameGraph:g.audio.graph===window.smokeAudio,menuRms:Math.sqrt(b.reduce((s,x)=>s+x*x,0)/b.length),layers:g.audio.graph.score.layers.map(l=>l.gain.value),scoreSources:g.audio.graph.score.sources.length,samples:g.audio.graph.samples.status,settings:g.audio.settings};});
 assert.equal(audio.state,'MENU');assert.equal(audio.sameGraph,true);assert.equal(audio.status,'running');await shot('menu-music-best');
 await r.page.locator('#launch').click();await r.page.evaluate(()=>{window.releaseTick=0;window.releaseQA.loop.render(0);});await shot('launched-from-menu');
 await drive(false,'death');await r.page.locator('#skip-destruction').click();await shot('skipped-results');
 await r.page.locator('#replay').click();await r.page.evaluate(()=>window.releaseQA.loop.render(0));
 const reset=await r.page.evaluate(()=>{const g=window.releaseQA;return{state:g.model.state,hull:g.model.hull,distance:g.model.distance,energy:g.model.fragments.count,focus:document.activeElement?.id};});
 assert.deepEqual(reset,{state:'PLAYING',hull:3,distance:0,energy:0,focus:'flight'});await shot('replayed');
 for(const viewport of [{width:390,height:844},{width:932,height:430}]){
  await r.page.setViewportSize(viewport);await r.page.waitForFunction(()=>{const g=window.releaseQA,b=document.getElementById('flight').getBoundingClientRect();return Math.abs(g.world.flightCamera.camera.aspect-b.width/b.height)<1e-6;},null,{polling:100});await r.page.evaluate(()=>window.releaseQA.loop.render(0));await shot(`${viewport.width}x${viewport.height}`);
 }
 await r.page.locator('#pause').click();await r.page.locator('#resume').click();
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);
 const facts=await r.page.evaluate(()=>window.smokeFacts);
 const scripts=await r.page.locator('script[src]').evaluateAll(ns=>ns.map(n=>n.src));
 await writeFile(resolve(dir,`${prefix}-smoke.json`),JSON.stringify({url,browser:browser.version(),method:'Ordinary production URL, genuine Launch/keyboard/buttons; CDP observes existing Game. Original fixed simulation, legal automated pilot axes for pickup, neutral input for natural damage/death. Accelerated waits/held screenshots, not a human playtest. No entities, HP, score, storage or server responses modified. Main-menu music measured from music bus after Back to menu; it is the existing ambient score layer.',movement,approach,pickup,death,audio,reset,shots,facts,scripts,requests:r.requests,errors:r.errors,failed:r.failed},null,2));
 await r.context.close();console.log(JSON.stringify({prefix,shots:shots.length,energy:death.energy,score:Math.floor(death.distance),menuRms:audio.menuRms,errors:r.errors.length,failed:r.failed.length}));
}finally{await browser.close();server?.kill();}
