import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openGame,advance,chromium} from './release-browser-lib.mjs';
const dir='.cache/review/RELEASE-007/final';await mkdir(dir,{recursive:true});
const safety=JSON.parse(await readFile(`${dir}/release-safety.json`,'utf8')),inputs=safety.rows.find(r=>r.variant==='candidate'&&r.seed===42&&r.cadence===2).inputs;
const frozen=resolve('.cache/review/RELEASE-007/approved');
// Reconstruct build inputs not needed by the Node-only safety snapshot.
for(const path of ['index.html','package.json','vite.config.ts',...execFileSync('git',['ls-tree','-r','--name-only',safety.approved,'public']).toString().trim().split('\n')]){
 const dest=resolve(frozen,path);await mkdir(resolve(dest,'..'),{recursive:true});await writeFile(dest,execFileSync('git',['show',`${safety.approved}:${path}`]));
}
execFileSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build'],{cwd:frozen,env:{...process.env,GITHUB_ACTIONS:'true'},stdio:'inherit'});
const hash=b=>createHash('sha256').update(b).digest('hex'),stats=a=>{const b=[...a].sort((a,b)=>a-b),p=q=>b[Math.floor((b.length-1)*q)];return{n:b.length,p50:p(.5),p95:p(.95),p99:p(.99),max:b.at(-1)}};
const servers=[],rows=[],browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const source of ['approved','candidate']){
 const port=source==='approved'?5190:5188,server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:source==='approved'?frozen:process.cwd(),env:{...process.env,GITHUB_ACTIONS:'true'},stdio:'ignore',windowsHide:true});servers.push(server);
 for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${port}/SpaceRunner/`);break}catch{await new Promise(r=>setTimeout(r,100))}}
 for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
  const r=await openGame(browser,`http://127.0.0.1:${port}/SpaceRunner/`,{viewport});const script=r.requests.find(r=>/\/assets\/index-[^/]+\.js$/.test(r.url));assert.ok(script);const bundleSha256=hash(Buffer.from(await(await fetch(script.url)).arrayBuffer()));await advance(r.page,inputs,2400);
  await r.cdp.send('HeapProfiler.collectGarbage');const before=await r.page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
  const raw=await r.page.evaluate(inputs=>new Promise(resolve=>{
   const g=window.releaseQA,w=g.world,m=g.model,field=w.boundaries.field,raf=[],render=[],simulation=[],warp=[],planning=[],calls=[],programEvents=[],longTasks=[];let previous=performance.now(),lastPrograms=w.renderer.info.programs.length,update=0;
   const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration})});observer.observe({type:'longtask',buffered:false});const start=performance.now(),original=field.update.bind(field);
   field.update=(...args)=>{const at=performance.now();original(...args);update+=performance.now()-at;};
   const frame=()=>{const at=performance.now();raf.push(at-previous);previous=at;
    m.beginPlanningFrame();const t=performance.now();m.step(1/120,inputs[window.releaseTick++]);m.step(1/120,inputs[window.releaseTick++]);simulation.push(performance.now()-t);
    update=0;const draw=performance.now();g.loop.render(1/60);render.push(performance.now()-draw);warp.push(update);planning.push({...m.homing.planningFrame.latest});calls.push(w.renderer.info.render.calls);
    const programs=w.renderer.info.programs.length;if(programs!==lastPrograms){programEvents.push({frame:raf.length,programs});lastPrograms=programs;}
    if(raf.length<600)window.nativeRAF(frame);else window.nativeRAF(()=>{observer.disconnect();const materials=new Set();w.scene.traverse(n=>{if(n.material)for(const mat of Array.isArray(n.material)?n.material:[n.material])materials.add(mat)});for(const mat of w.reveal.materials)materials.add(mat);
     const state=window.releaseState();resolve({raf,render,simulation,warp,planning,calls,programEvents,longTasks:longTasks.filter(e=>e.start>=start),state,cold:window.releaseCold,materials:materials.size,memory:{...w.renderer.info.memory},programs:lastPrograms});});};window.nativeRAF(frame);
  }),inputs);
  const resets=[];for(let n=0;n<10;n++){await r.page.locator('#pause').click();await r.page.locator('#restart-pause').click();resets.push(await r.page.evaluate(()=>{const g=window.releaseQA;g.loop.render(0);return{distance:g.model.distance,count:g.model.fragments.count,hull:g.model.hull,memory:{...g.world.renderer.info.memory},programs:g.world.renderer.info.programs.length}}));}
  assert.ok(resets.every(s=>s.distance===0&&s.count===0&&s.hull===3&&JSON.stringify(s.memory)===JSON.stringify(resets[0].memory)));
  await r.cdp.send('HeapProfiler.collectGarbage');const after=await r.page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);
  const state=raw.state;delete state.resources;delete state.programs;
  rows.push({source,viewport,bundleSha256,rafMs:stats(raw.raf),renderMs:stats(raw.render),simulationMs:stats(raw.simulation),warpMs:stats(raw.warp),planningMs:stats(raw.planning.map(p=>p.ms)),drawCalls:stats(raw.calls),
   cold:raw.cold,materials:raw.materials,memory:raw.memory,programs:raw.programs,longTasks:raw.longTasks,programEvents:raw.programEvents,heapBefore:before,heapAfter:after,heapDelta:after-before,resets,stateHash:hash(JSON.stringify(state)),raw});
  console.log(source,viewport.width,'RAF p95',rows.at(-1).rafMs.p95,'max',rows.at(-1).rafMs.max,'longtasks',raw.longTasks.length);await r.context.close();
 }
 server.kill();
}
assert.equal(new Set(rows.map(r=>r.stateHash)).size,1);
assert.equal(new Set(rows.map(r=>r.bundleSha256)).size,1,'Canonical approved/candidate bundles differ');
await writeFile(`${dir}/release-performance.json`,JSON.stringify({rows,browser:browser.version(),note:'Sequential genuine approved/candidate Pages production builds. Same seed42 inputs/ticks2400..3600 (Phase1,Phase2,station and mine).600 native frames/case; no parallel tests/video. Explicit GC heap samples include model resets. Main-thread longtasks and simulation/render/field/planning CPU are recorded; no GPU timer/physical phone claim.'},null,2));
}finally{await browser.close();for(const s of servers)s.kill();}
