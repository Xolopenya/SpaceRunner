import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync('.cache/playwright/ffmpeg-1013/ffmpeg-win64.exe'))process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.cache/playwright');
const { chromium }=await import('@playwright/test');

const directory='.cache/review/VISUAL-006/final',media=`${directory}/media`,port=5198;
await mkdir(media,{recursive:true});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const modes=['legacy','fragmented-arcs','flowing-filaments','fragmented-warp'];
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});
for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${port}`);break}catch{await new Promise(r=>setTimeout(r,100));}}
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
async function open(viewport={width:1280,height:800},query='debug=visuals&seed=42',video=false){
 const context=await browser.newContext({viewport,...(video?{recordVideo:{dir:`${directory}/video-raw`,size:viewport}}:{})});
 const page=await context.newPage();page.setDefaultTimeout(120000);
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text())}});
 await page.addInitScript(()=>{window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{}});
 await page.goto(`http://127.0.0.1:${port}/?${query}`);await page.waitForFunction(()=>!!window.spaceRunner,null,{polling:100});
 await page.locator('#visual-comparison').evaluateAll(elements=>elements.forEach(e=>e.hidden=true));await page.locator('#launch').click();
 await page.evaluate(()=>{
  const g=window.spaceRunner;g.loop.stop();window.warpTick=0;
  for(const id of ['visual-comparison','collider-debug-info','structure-variants-debug-info']){const e=document.getElementById(id);if(e)e.hidden=true;}
  window.warpState=()=>{const m=g.model;return{state:m.state,ship:{...m.ship},hull:m.hull,distance:m.distance,elapsed:m.elapsed,phase:m.phase,immunity:m.invulnerability,
   hazards:m.field.slots,publications:m.field.events,ownership:m.field.ledger?.snapshot(),mine:m.homing?.current,fragments:m.fragments?.slots,count:m.fragments?.count,hits:m.hitSerial}};
  window.warpStep=(input)=>{const m=g.model,t=window.warpTick;if(t%2===0)m.beginPlanningFrame?.();
   if(!input){const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0;input={x:0,y:0};for(const c of w?.controls??[]){if(at<c.ticks){input=c.input;break}at-=c.ticks;}}
   m.step(1/120,input);window.warpTick++;if(t%2===1)m.finishPlanningFrame?.(1/60);return{...input};};
 });return{context,page};
}
async function gallery(page,name,receipts){
 const before=await page.evaluate(()=>JSON.stringify(window.warpState()));
 for(const mode of modes){
  const detail=await page.evaluate(mode=>{const g=window.spaceRunner,w=g.world;w.setVisualModes(mode==='legacy'?'warp':mode,'seamless');w.render(g.model,0);
   return{tick:window.warpTick,state:window.warpState(),calls:w.renderer.info.render.calls,memory:{...w.renderer.info.memory},active:w.boundaries.field.activeSegments,excluded:w.boundaries.field.excludedLinks};},mode);
  const stateHash=hash(detail.state);delete detail.state;
  await page.screenshot({path:`${media}/${name}-${mode}.png`});receipts.push({name,mode,stateHash,...detail});
  assert.equal(await page.evaluate(()=>JSON.stringify(window.warpState())),before);
 }
 console.log('captured',name);
}
async function advance(page,inputs,target,live=false){
 return page.evaluate(({inputs,target,live})=>new Promise(resolve=>{
  const g=window.spaceRunner,step=()=>{window.warpStep(inputs[window.warpTick]);if(window.warpTick%2===0)g.loop.render(1/60)};
  if(!live){const draw=g.world.renderer.render;g.world.renderer.render=()=>{};while(window.warpTick<target)step();g.world.renderer.render=draw;g.loop.render(0);resolve();return;}
  const frame=()=>{for(let i=0;i<2&&window.warpTick<target;i++)step();if(window.warpTick<target)window.nativeRAF(frame);else resolve()};window.nativeRAF(frame);
 }),{inputs,target,live});
}
try{
 if(process.argv.includes('--stills')||process.argv.includes('--desktop')){
  const receipts=[],events={},inputs=[];
  for(const [name,goal,ticks]of [['center',[0,0],120],['left',[-6,0],200],['right',[6,0],200],['upper',[0,3.6],200],['lower',[0,-3.6],200],['corner',[-6,-3.6],200],['fast-diagonal',[6,3.6],70]]){
   const {page,context}=await open();await page.evaluate(({goal,ticks})=>{const g=window.spaceRunner,m=g.model;for(let i=0;i<ticks;i++){window.warpStep({x:Math.max(-1,Math.min(1,(goal[0]-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(goal[1]-m.ship.y)*2.6-m.ship.vy*.8))});if(i%2===1)g.loop.render(1/60)}},{goal,ticks});
   await gallery(page,name,receipts);await context.close();
  }
  const {page,context}=await open();
  let iteration=0;
  while(true){
   const result=await page.evaluate(()=>{
    const g=window.spaceRunner,m=g.model,inputs=[];let event;
    const draw=g.world.renderer.render;g.world.renderer.render=()=>{};
    for(let i=0;i<60;i++){
     inputs.push(window.warpStep());if(window.warpTick%2===0)g.loop.render(1/60);
     const hazards=m.field.slots.filter(h=>h.planned),station=hazards.find(h=>h.kind>=4&&h.kind<=8&&h.z<=0);
     const candidates={asteroid:hazards.some(h=>h.kind===0&&h.z> -110&&h.z< -50),
      'station-approach':station&&station.z> -120&&station.z< -80,'station-close':station&&station.z> -22&&station.z< -18,
      'station-passage':station&&station.z> -1&&station.z<0,'fragment-obstacle':m.fragments.slots.some(f=>f.proposal&&f.proposal.passDistance-m.distance<100),
      mine:m.homing.current?.phase==='warning',phase2:m.phase===2};
     window.warpCaptured??={};for(const [name,yes]of Object.entries(candidates))if(yes&&!window.warpCaptured[name]){window.warpCaptured[name]=true;event=name;break;}
     if(event||m.distance>=1600||m.state!=='PLAYING')break;
    }g.world.renderer.render=draw;g.loop.render(0);
    return{inputs,event,tick:window.warpTick,distance:m.distance,hull:m.hull,state:m.state};
   });inputs.push(...result.inputs);if(iteration++%20===0)console.log('route',result.tick,result.distance,result.state);
   assert.ok(result.tick<12000,'Route exceeded bounded replay length');
   if(result.event){events[result.event]=result.tick;await gallery(page,result.event,receipts);}
   if(result.distance>=1600||result.state!=='PLAYING'){assert.equal(result.hull,3);break;}
  }
  console.log('route complete',inputs.length);assert.equal(Object.keys(events).length,7,JSON.stringify(events));
  await writeFile(`${directory}/warp-scenarios.json`,JSON.stringify({inputs,events,receipts,browser:browser.version(),errors},null,2));
  await context.close();console.log('closed desktop route');
 }
 if(process.argv.includes('--stills')||process.argv.includes('--mobile-stations')){
  const {inputs,events,receipts}=JSON.parse(await readFile(`${directory}/warp-scenarios.json`,'utf8'));
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   console.log('opening mobile',viewport);const {page,context}=await open(viewport);console.log('opened mobile',viewport.width);
   for(const [name,tick]of Object.entries(events).sort((a,b)=>a[1]-b[1])){console.log('replaying',viewport.width,name,tick);await advance(page,inputs,tick);await gallery(page,`${viewport.width}-${name}`,receipts);}await context.close();
  }
  for(const aperture of ['center','left','right','upper','lower']){
   const {page,context}=await open(undefined,`debug=field&experiment=large-structure&aperture=${aperture}&mode=isolated&seed=42`);
   for(const depth of [80,20,0]){
    await page.evaluate(({aperture,depth})=>{const g=window.spaceRunner,m=g.model,goal={center:[0,0],left:[-3,0],right:[3,0],upper:[0,1.9],lower:[0,-1.9]}[aperture];
     g.world.flightCamera.setMode('hybrid-chase');const draw=g.world.renderer.render;g.world.renderer.render=()=>{};
     for(let i=0;i<7000;i++){const h=m.field.slots.find(h=>h.planned&&h.kind>=4&&h.kind<=8);if(h&&h.z>=-depth)break;
      window.warpStep({x:Math.max(-1,Math.min(1,(goal[0]-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(goal[1]-m.ship.y)*2.6-m.ship.vy*.8))});if(i%2===1)g.loop.render(1/60);
     }g.world.renderer.render=draw;g.loop.render(0);},{aperture,depth});
    assert.equal(await page.evaluate(()=>window.spaceRunner.model.hull),3);await gallery(page,`aperture-${aperture}-${depth}`,receipts);
   }await context.close();
  }
  await writeFile(`${directory}/warp-scenarios.json`,JSON.stringify({inputs,events,receipts,browser:browser.version(),errors},null,2));
 }
 if(process.argv.includes('--videos')){
  const {inputs,events}=JSON.parse(await readFile(`${directory}/warp-scenarios.json`,'utf8')),receipts=[];
  for(const [name,mode,start,end]of [
   ['A-fragmented-arcs','fragmented-arcs',0,1440],['B-flowing-filaments','flowing-filaments',0,1440],['C-fragmented-warp','fragmented-warp',0,1440],
   ['D-station-legacy','legacy',Math.max(0,events['station-approach']-120),events['station-passage']+120],
   ['D-station-fragmented','fragmented-warp',Math.max(0,events['station-approach']-120),events['station-passage']+120],
   ['E-integrated-clean','fragmented-warp',0,inputs.length]]){
   const {page,context}=await open(undefined,`debug=visuals&warp=${mode}&seed=42`,true);await advance(page,inputs,start);await advance(page,inputs,end,true);
   const state=await page.evaluate(()=>window.warpState()),video=page.video();await context.close();await copyFile(await video.path(),`${media}/${name}.webm`);
   receipts.push({name,mode,start,end,stateHash:hash(state),state});console.log('recorded',name,end-start);
  }
  await writeFile(`${directory}/warp-videos.json`,JSON.stringify({browser:browser.version(),receipts,errors,note:'Native silent Chrome video, two120Hz simulation steps per native RAF. D prefixes accelerated before continuous playback. E is a continuous clean integrated run controlled by the recorded certificate inputs, not a human playtest.'},null,2));
 }
 if(process.argv.includes('--performance')){
  const {inputs}=JSON.parse(await readFile(`${directory}/warp-scenarios.json`,'utf8')),rows=[];
  const stats=a=>{const b=[...a].sort((a,b)=>a-b),q=p=>b[Math.floor((b.length-1)*p)];return{n:b.length,p50:q(.5),p95:q(.95),p99:q(.99),max:b.at(-1)}};
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}])for(const mode of modes){
   const {page,context}=await open(viewport,`debug=visuals&warp=${mode}&seed=42`);
   const cold=await page.evaluate(()=>{const g=window.spaceRunner,w=g.world,before=w.renderer.info.programs.length,at=performance.now();g.loop.render(0);return{firstDrawMs:performance.now()-at,programsBefore:before,programsAfter:w.renderer.info.programs.length}});
   await advance(page,inputs,2800);
   const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
   const heapBefore=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
   const result=await page.evaluate(inputs=>new Promise(resolve=>{
    const g=window.spaceRunner,m=g.model,w=g.world,f=w.boundaries.field,raf=[],update=[],calls=[],segments=[],cpu=[];let previous=performance.now(),first;
    const original=f.update.bind(f);let updateCost=0;f.update=(...args)=>{const at=performance.now();original(...args);updateCost+=performance.now()-at;};
    const frame=()=>{const now=performance.now();raf.push(now-previous);previous=now;window.warpStep(inputs[window.warpTick]);window.warpStep(inputs[window.warpTick]);
     updateCost=0;const at=performance.now();g.loop.render(1/60);cpu.push(performance.now()-at);if(first===undefined)first=cpu.at(-1);
     update.push(updateCost);calls.push(w.renderer.info.render.calls);segments.push(f.activeSegments);
     if(raf.length<600)window.nativeRAF(frame);else{
      const materials=new Set();w.scene.traverse(n=>{if(n.material)for(const mat of Array.isArray(n.material)?n.material:[n.material])materials.add(mat)});
      for(const mat of w.reveal.materials)materials.add(mat);
      resolve({raf,update,calls,segments,cpu,first,programs:w.renderer.info.programs.length,materials:materials.size,memory:{...w.renderer.info.memory},state:window.warpState()});
     }};window.nativeRAF(frame);
   }),inputs);
   const resets=[];for(let i=0;i<10;i++){await page.locator('#pause').click();await page.locator('#restart-pause').click();resets.push(await page.evaluate(()=>{const g=window.spaceRunner;g.world.render(g.model,0);return{distance:g.model.distance,hull:g.model.hull,memory:{...g.world.renderer.info.memory},programs:g.world.renderer.info.programs.length}}));}
   assert.ok(resets.every(r=>r.distance===0&&r.hull===3&&JSON.stringify(r.memory)===JSON.stringify(resets[0].memory)));
   await cdp.send('HeapProfiler.collectGarbage');const heapAfter=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
   const cleanup=await page.evaluate(()=>{const g=window.spaceRunner,w=g.world,f=w.boundaries.field;let disposed=0;f.geometry.addEventListener('dispose',()=>disposed++);f.material.addEventListener('dispose',()=>disposed++);g.dispose();f.dispose();return{disposed,memory:{...w.renderer.info.memory},programs:w.renderer.info.programs.length}});
   await writeFile(`${directory}/cleanup-${viewport.width}-${mode}.json`,JSON.stringify(cleanup,null,2));
   assert.equal(cleanup.disposed,2);assert.equal(cleanup.memory.geometries,0);
   const row={viewport,mode,cold,cleanup,rafMs:stats(result.raf),updateMs:stats(result.update),renderCallbackMs:stats(result.cpu),drawCalls:stats(result.calls),activeSegments:stats(mode==='legacy'?result.segments.map(()=>0):result.segments),activeParticles:0,
    firstSampleRenderMs:result.first,programs:result.programs,materials:result.materials,memory:result.memory,heapBefore,heapAfter,heapDelta:heapAfter-heapBefore,resets,stateHash:hash(result.state),raw:result};
   rows.push(row);await writeFile(`${directory}/warp-performance-progress.json`,JSON.stringify({rows},null,2));
   await context.close();console.log('measured',viewport.width,mode,'p95',row.rafMs.p95,'update',row.updateMs.p95,'cleanup',cleanup.memory);
  }
  assert.equal(new Set(rows.map(r=>r.stateHash)).size,1);
  assert.ok(rows.every(r=>r.cleanup.memory.textures===rows[0].cleanup.memory.textures),'New field changed baseline post-dispose texture count');
  await writeFile(`${directory}/warp-performance.json`,JSON.stringify({browser:browser.version(),rows,errors,note:'Sequential isolated modes, 600 native frames each, identical tick2800..4000 Phase2/station/mine history. Three viewport emulations; no physical phone/GPU timer. Heap delta includes resetting a progressed model, so is not an isolated field allocation metric. Cold firstDrawMs includes all first-use scene shaders, not only the field. No concurrent test/video workload.'},null,2));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.kill();}
