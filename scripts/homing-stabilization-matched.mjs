// Identical frozen full-beam contexts, work, witnesses and rendered scene.
// This isolates scheduling from state-dependent live publication differences.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {stats} from './director-fields.mjs';
const output=resolve('.cache/review/GAMEPLAY-003C4-FIX/matched');await mkdir(output,{recursive:true});const results=[];
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5231','--strictPort'],{windowsHide:true,stdio:'ignore'});let browser;
try{
 for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:5231/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const capped of [false,true]){
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:5231/?debug=field&experiment=moving-mine&motion=adaptive-homing&firstMine=1&seed=42');await page.locator('#launch').waitFor({state:'visible'});
  const raw=await page.evaluate(async capped=>{
   const g=window.spaceRunner;g.loop.stop();
   const {beginKnownFieldValidation,beginTrajectoryReplay}=await import('/src/core/field-validator.ts'),{adaptiveTransaction,ADAPTIVE_GEOMETRY}=await import('/src/experiments/adaptive-homing/transaction.ts'),{HomingPlanningFrame}=await import('/src/experiments/adaptive-homing/planning-frame.ts');
   const contexts=[0,11,42].map(seed=>{const r={player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:1,distance:20},candidate=adaptiveTransaction(seed,4,r);return{...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance};});
   const finish=j=>{while(!j.getResult())j.advance();return j.getResult();};
   for(let i=0;i<3;i++)finish(beginKnownFieldValidation(contexts[2],{geometry:ADAPTIVE_GEOMETRY}));
   const frames=[],jobs=[],replays=[],counter=new HomingPlanningFrame();let index=0,job=beginKnownFieldValidation(contexts[0],{geometry:ADAPTIVE_GEOMETRY}),previous=performance.now();
   await new Promise(done=>{const frame=time=>{
    let chunks=0,ms=0,p=0,q=0;counter.begin();
    for(let step=0;step<12&&index<9;step++){
     // These are frozen-context offline jobs, not advancing simulation ticks.
     // Do not consume a job call on an exhausted propagation allowance.
     const budget=capped?counter.budget(false):{propagations:3072,narrowQueries:6144};if(!budget.propagations||!budget.narrowQueries)break;
     const before=job.metrics,start=performance.now();job.advance(budget);const elapsed=performance.now()-start,after=job.metrics,dp=after.propagations-before.propagations,dq=after.narrowQueries-before.narrowQueries;
     chunks++;ms+=elapsed;p+=dp;q+=dq;counter.spent(dp,dq,elapsed);
     const r=job.getResult();if(r){jobs.push({context:contexts[index%3],result:r,metrics:after});index++;if(index<9)job=beginKnownFieldValidation(contexts[index%3],{geometry:ADAPTIVE_GEOMETRY});}
    }
    g.loop.render(1/60);counter.finish(1/60);frames.push({rafMs:time-previous,chunks,ms,propagations:p,queries:q});previous=time;
    if(index>=9)done();else requestAnimationFrame(frame);
   };requestAnimationFrame(frame);});
   for(const row of jobs){if(row.result.decision==='accept'){const start=performance.now(),r=finish(beginTrajectoryReplay(row.result.witness.context,row.result.witness.controls,{geometry:ADAPTIVE_GEOMETRY}));replays.push({ms:performance.now()-start,result:r});}}
   return{capped,frames,jobs,replays};
  },capped);
  for(const j of raw.jobs)assert.equal(j.result.decision,'accept');for(const r of raw.replays)assert.equal(r.result.decision,'accept');
  if(capped)for(const f of raw.frames)assert.ok(f.propagations<=6144&&f.queries<=12288);
  await writeFile(join(output,(capped?'after':'before')+'-raw.json'),JSON.stringify(raw));
  results.push({capped,frames:raw.frames.length,plannerPerFrame:stats(raw.frames.map(f=>f.ms)),raf:stats(raw.frames.slice(1).map(f=>f.rafMs)),replay:stats(raw.replays.map(r=>r.ms)),maxChunks:Math.max(...raw.frames.map(f=>f.chunks)),maxPropagations:Math.max(...raw.frames.map(f=>f.propagations)),work:raw.jobs.map(j=>j.metrics),witnessHashes:raw.jobs.map(j=>j.result.witness.hash)});await browser.close();browser=undefined;
 }
 assert.deepEqual(results[0].witnessHashes,results[1].witnessHashes);
 // Per-job planningTicks differ by chunk splitting only; all executed work equals.
 for(let n=0;n<9;n++)for(const key of ['propagations','narrowQueries','searchPropagations','replayPropagations','mineUpdates','peakFrontier','peakExpansion'])assert.equal(results[0].work[n][key],results[1].work[n][key]);
 await writeFile(join(output,'summary.json'),JSON.stringify({conditions:'Same current/frozen-unchanged validator/controller,9 full beam jobs3seeds,3JIT warmups,fresh Chrome per policy,844x390/DPR2,12work opportunities/render,same menu scene. This isolates scheduling and does not measure live actual-root publication.',results},null,2));console.log(JSON.stringify(results));
}finally{await browser?.close();server.kill();}
