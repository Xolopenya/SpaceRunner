import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openGame,advance,chromium} from './release-browser-lib.mjs';
const root=resolve('.cache/review/FEEDBACK-001C2'),mode=process.argv[2]??'final',out=resolve(root,mode,'visuals');await mkdir(out,{recursive:true});
const scenarios=JSON.parse(await readFile(resolve(root,'scenario-inputs.json'),'utf8')).scenarios;
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5191','--strictPort'],{cwd:mode==='baseline'?resolve(root,'baseline-source'):process.cwd(),stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),receipts=[],videos=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5191/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const scenario of scenarios)for(const viewport of [{width:1280,height:800},...(scenario.pattern==='curve'&&scenario.name!=='typical'?[{width:390,height:844}]:[]),...(scenario.name==='curve-complete'?[{width:844,height:390}]:[])]){
  const r=await openGame(browser,'http://127.0.0.1:5191/',{viewport,seed:scenario.seed});
  await r.page.waitForFunction(()=>window.releaseQA.audio.status==='running');await r.page.evaluate(async()=>{await window.releaseQA.audio.graph.samples.ready;});
  const extra=scenario.name==='typical'?[{name:'flow-30s',tick:3600},{name:'flow-45s',tick:5400}]:[];
  const shots=[...scenario.shots,...extra].sort((a,b)=>a.tick-b.tick);
  for(const shot of shots){
   await advance(r.page,scenario.inputs,shot.tick);await r.page.evaluate(()=>{const g=window.releaseQA;g.world.render(g.model,0);});
   const file=`${scenario.name}-${viewport.width}-${shot.name.replace(/[^a-z0-9-]/gi,'_')}.png`;await r.page.screenshot({path:resolve(out,file)});
   const receipt=await r.page.evaluate(({file,shot,scenario,viewport})=>{
    const g=window.releaseQA,m=g.model,w=g.world,group=w.fragments.root;
    return{file,scenario:scenario.name,seed:scenario.seed,viewport,shot:shot.name,tick:window.releaseTick,ship:{...m.ship},hull:m.hull,distance:m.distance,phase:m.phase,count:m.fragments.count,
     active:m.fragments.active,stats:{...m.fragments.stats},pickup:{...m.fragments.lastPickup},camera:w.flightCamera.mode,guidance:!!w.guidance,
     visibleShards:group.children.filter(c=>c.visible&&c.type==='Group').length,resources:{...w.renderer.info.memory},calls:w.renderer.info.render.calls,programs:w.renderer.info.programs.length,fault:m.field.fault};
   },{file,shot,scenario:{name:scenario.name,seed:scenario.seed},viewport});
   assert.equal(receipt.fault,undefined);assert.equal(receipt.camera,'hybrid-chase');if(mode==='final')assert.equal(receipt.guidance,false);receipts.push(receipt);
  }
  if(mode==='final'){const last=receipts.at(-1);assert.equal(last.count,scenario.count,`Replay count: ${scenario.name}`);assert.equal(last.hull,scenario.hull,`Replay hull: ${scenario.name}`);}
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);await r.context.close();
  if(viewport.width!==844&&(mode==='final'||scenario.name==='curve-complete')){
   const live=await openGame(browser,'http://127.0.0.1:5191/',{viewport,seed:scenario.seed,videoDir:resolve(out,'raw-video')});
   await live.page.evaluate(async()=>{await window.releaseQA.audio.graph.samples.ready;});
   const start=scenario.name==='typical'?Math.max(0,scenario.endTick-4800):Math.max(0,scenario.endTick-720);
   await advance(live.page,scenario.inputs,start);await advance(live.page,scenario.inputs,scenario.endTick,true);
   const endpoint=await live.page.evaluate(()=>{const m=window.releaseQA.model;return{count:m.fragments.count,hull:m.hull,distance:m.distance,phase:m.phase};});
   if(mode==='final'){assert.equal(endpoint.count,scenario.count);assert.equal(endpoint.hull,scenario.hull);}
   const video=live.page.video();await live.context.close();const file=`${scenario.name}-${viewport.width}.webm`;await copyFile(await video.path(),resolve(out,file));videos.push({file,scenario:scenario.name,viewport,startTick:start,endTick:scenario.endTick,endpoint,method:'Silent real full-page native-RAF approach, after accelerated prefix; original production model/camera, supplied bounded input tape. No model pose/HP/hazard edits.'});
   assert.deepEqual(live.errors,[]);assert.deepEqual(live.failed,[]);
  }
  console.log(mode,scenario.name,scenario.seed,viewport.width);
 }
 await writeFile(resolve(out,'captures.json'),JSON.stringify({mode,browser:browser.version(),receipts,videos},null,2));
}finally{await browser.close();server.kill();}
