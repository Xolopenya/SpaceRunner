import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {stats} from './director-fields.mjs';
const output=resolve(process.env.HOMING_PROFILE_DIR??'.cache/review/GAMEPLAY-003C4-FIX/browser');await mkdir(output,{recursive:true});
const baseline=resolve('.cache/review/GAMEPLAY-003C4-FIX/baseline'),vite=resolve('node_modules/vite/bin/vite.js');
const cases=process.argv.includes('--smoke')?[['landscape',true]]:[['desktop',false],['portrait',false],['landscape',false],['landscape',true]];
const results=[];
for(const version of ['before','after']){
 const port=version==='before'?5211:5212,base=`http://127.0.0.1:${port}/`,server=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:version==='before'?baseline:process.cwd(),windowsHide:true,stdio:'ignore'});
 let browser;
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
  for(const[viewport,stress]of cases){
   browser=await chromium.launch({channel:'chrome',headless:true});
   const context=await browser.newContext({viewport:viewport==='desktop'?{width:1280,height:800}:viewport==='portrait'?{width:390,height:844}:{width:844,height:390},deviceScaleFactor:viewport==='desktop'?1:2,isMobile:viewport!=='desktop',hasTouch:viewport!=='desktop'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'?debug=field&experiment=moving-mine&motion=adaptive-homing&seed=42&firstMine=1');await page.locator('#launch').waitFor({state:'visible'});
   const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
   await page.evaluate(async ({stress,timed})=>{
    const g=window.spaceRunner,m=g.model,p=window.stabilization={frames:[],renderFrames:[],steps:[],publications:[],longTasks:[],inputs:[],timers:{propagation:{calls:0,ms:0},collision:{calls:0,ms:0}},last:performance.now(),active:true};
    const {AdaptivePrediction}=await import('/src/experiments/adaptive-homing/prediction.ts');
    if(timed)for(const [key,names]of [['propagation',['step','stepAt']],['collision',['hit','hitGameplay']]])for(const name of names){const original=AdaptivePrediction.prototype[name];AdaptivePrediction.prototype[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{p.timers[key].calls++;p.timers[key].ms+=performance.now()-start;}};}
    Object.defineProperty(g.input,'axis',{configurable:true,get:()=>{const tick=Math.round(m.elapsed*120),input={x:Math.floor(tick/180)%2?-1:1,y:0};return input;}});
    const step=m.step.bind(m);m.step=(dt,input)=>{const start=performance.now(),before=m.field.planningTicks,plannerBefore=m.field.schedulerMs;step(dt,input);if(!p.active)return;const chunk=m.field.planningTicks>before?{...m.field.samples.at(-1)}:null;p.steps.push({start,ms:performance.now()-start,plannerMs:m.field.schedulerMs-plannerBefore,tick:Math.round(m.elapsed*120),chunk});const o=m.field.lastOutcome;if(o&&o!==p.lastOutcome){p.lastOutcome=o;p.publications.push(o);}p.inputs.push({tick:Math.round(m.elapsed*120),...input});};
    const render=g.loop.render.bind(g.loop);let firstStep=0;g.loop.render=dt=>{render(dt);if(!p.active)return;const steps=p.steps.slice(firstStep);firstStep=p.steps.length;p.renderFrames.push({time:performance.now(),ms:dt*1000,elapsed:m.elapsed,state:m.state,active:m.field.slots.filter(s=>s.active).length,chunks:steps.filter(s=>s.chunk&&(s.chunk.propagations||s.chunk.queries)).length,plannerMs:steps.reduce((n,s)=>n+s.plannerMs,0),propagations:steps.reduce((n,s)=>n+(s.chunk?.propagations??0),0),queries:steps.reduce((n,s)=>n+(s.chunk?.queries??0),0),accounting:m.homing.planningFrame?.latest});};
    const observer=new PerformanceObserver(list=>p.active&&p.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration}))));observer.observe({type:'longtask'});
    const frame=time=>{if(!p.active)return;p.frames.push({time,ms:time-p.last,elapsed:m.elapsed,state:m.state,active:m.field.slots.filter(s=>s.active).length,nearby:m.field.slots.filter(s=>s.active&&s.z>=-100&&s.z<=8).length,accounting:m.homing.planningFrame?.latest});p.last=time;
     // Explicit matched adverse condition, reported separately from natural RAF.
     if(stress&&p.frames.length%90===0){const until=performance.now()+60;while(performance.now()<until){}}requestAnimationFrame(frame);};requestAnimationFrame(frame);
    p.stop=()=>{p.active=false;observer.disconnect();g.loop.stop();m.step=step;g.loop.render=render;delete g.input.axis;};
   },{stress,timed:process.argv.includes('--timed')});
   await page.locator('#launch').click();await page.waitForTimeout(process.argv.includes('--smoke')?15000:30000);
   const raw=await page.evaluate(()=>{const p=window.stabilization,g=window.spaceRunner,m=g.model;p.stop();return{frames:p.frames,renderFrames:p.renderFrames,steps:p.steps,publications:p.publications,longTasks:p.longTasks,inputs:p.inputs,timers:p.timers,fault:m.field.fault,hull:m.hull,distance:m.distance,events:m.field.events,resources:{...g.world.renderer.info.memory,programs:g.world.renderer.info.programs.length},requests:g.assets.requests};});assert.deepEqual(errors,[]);assert.equal(raw.fault,undefined);
   const {profile}=await cdp.send('Profiler.stop');await cdp.send('Profiler.disable');
   const label=`${version}-${viewport}${stress?'-stress':''}`;
   const chunks=raw.steps.filter(s=>s.chunk).map(s=>s.chunk),frames=raw.frames.slice(1).map(f=>{const steps=raw.steps.filter(s=>s.start>=f.time-f.ms&&s.start<f.time);return{...f,chunks:steps.filter(s=>s.chunk&&(s.chunk.propagations||s.chunk.queries)).length,plannerMs:steps.reduce((n,s)=>n+(s.chunk?.ms??0),0),propagations:steps.reduce((n,s)=>n+(s.chunk?.propagations??0),0),queries:steps.reduce((n,s)=>n+(s.chunk?.queries??0),0)};});
   const warm=frames.filter(f=>f.state==='PLAYING'&&f.elapsed>=2),planning=raw.renderFrames.filter(f=>f.chunks);
   if(version==='after')for(const f of raw.renderFrames)assert.ok(f.propagations<=6144&&f.queries<=12288,JSON.stringify(f));
   const summary={version,viewport,stress,errors,hull:raw.hull,distance:raw.distance,raf:stats(frames.map(f=>f.ms)),warmRaf:stats(warm.map(f=>f.ms)),coldRaf:stats(frames.filter(f=>f.elapsed<2).map(f=>f.ms)),plannerChunk:stats(chunks.filter(c=>c.propagations||c.queries).map(c=>c.ms)),plannerPerFrame:stats(planning.map(f=>f.plannerMs)),maxChunks:Math.max(0,...raw.renderFrames.map(f=>f.chunks)),maxPropagations:Math.max(0,...raw.renderFrames.map(f=>f.propagations)),maxQueries:Math.max(0,...raw.renderFrames.map(f=>f.queries)),gate:stats(chunks.filter(c=>c.phase==='actual-gate').map(c=>c.ms)),resolution:stats(raw.publications.filter(o=>o.resolution).map(o=>o.resolution.ms)),timers:raw.timers,longTasks:raw.longTasks,resources:raw.resources};
   // restart memory and retained active planning jobs, equal workload per version
   const reset=async()=>{await page.evaluate(()=>{const g=window.spaceRunner,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);for(let n=0;n<970;n++)m.step(1/120,{x:0,y:1});for(let n=0;n<2;n++)g.loop.render(1/60);});await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');return{...heap,runtime:await page.evaluate(()=>{const g=window.spaceRunner,m=g.model;return{memory:{...g.world.renderer.info.memory},programs:g.world.renderer.info.programs.length,slots:m.field.slots.length,records:m.field.ledger.snapshot().length,requests:g.assets.requests,trace:m.homing.samples.length,activeMines:m.field.slots.filter(s=>s.active&&s.kind===9).length};})};};
   for(let i=0;i<5;i++)await reset();const beforeHeap=await reset(),heaps=[];for(let i=0;i<10;i++){const h=await reset();assert.deepEqual(h.runtime,beforeHeap.runtime);heaps.push(h);}summary.restartMemory={beforeHeap,heaps,delta:heaps.at(-1).usedSize-beforeHeap.usedSize};summary.browserVersion=browser.version();
   if(viewport==='desktop'){
    await page.evaluate(async()=>{window.jobModules={v:await import('/src/core/field-validator.ts'),a:await import('/src/experiments/adaptive-homing/transaction.ts')};});await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Runtime.getHeapUsage');
    const jobs=await page.evaluate(()=>{const{v,a}=window.jobModules,r={player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:1,distance:20},candidate=a.adaptiveTransaction(42,4,r);window.retainedJobs=Array.from({length:30},()=>{const job=v.beginKnownFieldValidation({...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance},{geometry:a.ADAPTIVE_GEOMETRY});job.advance({propagations:3072,narrowQueries:6144});return job;});return window.retainedJobs.map(j=>j.metrics);});
    await cdp.send('HeapProfiler.collectGarbage');const during=await cdp.send('Runtime.getHeapUsage');await page.evaluate(()=>{delete window.retainedJobs;delete window.jobModules;});await cdp.send('HeapProfiler.collectGarbage');summary.activeJobMemory={before,during,after:await cdp.send('Runtime.getHeapUsage'),jobs,estimatedPerJob:(during.usedSize-before.usedSize)/30};
   }
   await page.screenshot({path:join(output,label+'.png')});
   await writeFile(join(output,label+'-raw.json'),JSON.stringify({...raw,frameWork:frames}));await writeFile(join(output,label+'-cpu.json'),JSON.stringify(profile));results.push(summary);await writeFile(join(output,'comparison.json'),JSON.stringify({conditions:{durationMs:30000,seed:42,input:'x alternates every180 simulation ticks, y0; normal hull',samplerUs:1000,stress:'60ms busy wait every90 observer RAFs; separately labeled',timed:process.argv.includes('--timed'),frameAccounting:'Exact loop.render boundary; observer RAF is only used for unbounded RAF deltas. DEV panel delta is clamped by original loop.'},results},null,2));
   console.log(JSON.stringify({label,planner:summary.plannerPerFrame,maxChunks:summary.maxChunks,maxPropagations:summary.maxPropagations,warm:summary.warmRaf}));await browser.close();browser=undefined;
  }
 }finally{await browser?.close();server.kill();}
}
