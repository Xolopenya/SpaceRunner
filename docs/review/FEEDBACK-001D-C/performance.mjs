import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openGame,advance,chromium} from '../../../scripts/release-browser-lib.mjs';
const dir=resolve('.cache/review/FEEDBACK-001D-C'),rows=[],environment={node:process.version,platform:process.platform};
for(const mode of ['before','after']){
 const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5203','--strictPort'],{cwd:mode==='before'?resolve(dir,'baseline'):process.cwd(),windowsHide:true,stdio:'ignore'});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 environment.chrome=browser.version();
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5203')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const r=await openGame(browser,'http://127.0.0.1:5203/',{seed:42});
  await r.page.waitForFunction(()=>window.releaseQA.audio.status==='running',null,{polling:50});
  await r.page.evaluate(async()=>{const g=window.releaseQA;await g.audio.graph.samples.ready;window.retainedResultsAudio=[g.audio.graph,g.audio.context,...g.audio.graph.score.sources];window.resultsEvents=[];g.model.events.subscribe(e=>window.resultsEvents.push(e.type));});
  const measure=await r.page.evaluate(()=>new Promise(done=>{const g=window.releaseQA,gaps=[],cost=[];let n=0,last=0;const frame=now=>{if(last)gaps.push(now-last);last=now;const at=performance.now();window.releaseStep({x:0,y:0});window.releaseStep({x:0,y:0});cost.push(performance.now()-at);if(++n<600)window.nativeRAF(frame);else done({gaps,cost,state:window.releaseState()});};window.nativeRAF(frame);}));
  const cycles=[];
  for(let i=0;i<10;i++){
   await advance(r.page,Array.from({length:6500},()=>({x:0,y:0})),6500);
   if(i%2===0)await r.page.locator('#skip-destruction').click();else await r.page.evaluate(()=>{for(let i=0;i<150;i++)window.releaseQA.loop.render(1/60);});
   if(mode==='after'&&i%2===0){await r.page.locator('#back-menu').click();await r.page.evaluate(()=>window.releaseQA.loop.render(0));await r.page.locator('#launch').click();}
   else await r.page.locator('#replay').click();
   await r.page.evaluate(()=>{window.releaseTick=0;window.releaseQA.loop.render(0);});
   await r.cdp.send('HeapProfiler.collectGarbage');
   const facts=await r.page.evaluate(()=>{const g=window.releaseQA;return{runId:g.model.runId,distance:g.model.distance,hull:g.model.hull,energy:g.model.fragments.count,dom:document.getElementsByTagName('*').length,events:g.model.events.subscriberCount,ends:window.resultsEvents.filter(e=>e==='run.ended').length,resources:{...g.world.renderer.info.memory},programs:g.world.renderer.info.programs.length,voices:g.audio.graph.voices.size,scoreSources:g.audio.graph.score.sources.length,sameAudio:[g.audio.graph,g.audio.context,...g.audio.graph.score.sources].every((x,i)=>x===window.retainedResultsAudio[i]),cinematic:g.world.destruction.sequence.active};});
   assert.equal(facts.ends,i+1);assert.equal(facts.runId,i+2);assert.equal(facts.distance,0);assert.equal(facts.hull,3);assert.equal(facts.energy,0);assert.equal(facts.sameAudio,true);assert.equal(facts.cinematic,false);
   cycles.push({...facts,cdp:await r.cdp.send('Memory.getDOMCounters')});
  }
  assert.ok(cycles.every(c=>c.events===cycles[0].events&&c.dom===cycles[0].dom&&c.programs===cycles[0].programs&&JSON.stringify(c.resources)===JSON.stringify(cycles[0].resources)&&c.voices<=6));
  await r.page.evaluate(()=>window.releaseQA.dispose());await r.cdp.send('HeapProfiler.collectGarbage');
  rows.push({mode,measure,cycles,disposed:await r.cdp.send('Memory.getDOMCounters'),errors:r.errors,failed:r.failed});await r.context.close();
 }finally{await browser.close();server.kill();await new Promise(r=>setTimeout(r,200));}
}
await writeFile(resolve(dir,'performance.json'),JSON.stringify({environment,method:'Sequential Chrome production before/after, 1280x800, 600 native frames each; original fixed neutral flight/deaths, 10 replay/menu cycles per version; before only replay because no menu path. Audio fully loaded; graph/context/score sources retained. Run only after browser tests and capture jobs finish.',rows},null,2));
for(const r of rows){const p=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length*.95)];console.log(r.mode,JSON.stringify({rafP95:p(r.measure.gaps),cpuP95:p(r.measure.cost),cycles:r.cycles,disposed:r.disposed,errors:r.errors,failed:r.failed}));}
