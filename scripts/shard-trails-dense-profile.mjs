import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openGame,advance,chromium} from './release-browser-lib.mjs';
const root=resolve('.cache/review/FEEDBACK-001C2'),tape=JSON.parse(await readFile(resolve(root,'scenario-inputs.json'),'utf8')).scenarios.find(s=>s.name==='curve-complete');
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
 for(const source of ['baseline','final']){
  const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5196','--strictPort'],{cwd:source==='baseline'?resolve(root,'baseline-source'):process.cwd(),stdio:'ignore',windowsHide:true});
  try{
   for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5196/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
   for(let repeat=0;repeat<3;repeat++){
    const r=await openGame(browser,'http://127.0.0.1:5196/',{seed:tape.seed});await r.page.evaluate(async()=>{await window.releaseQA.audio.graph.samples.ready;});
    await advance(r.page,tape.inputs,tape.shots.find(s=>s.name==='depth-45').tick);
    const raw=await r.page.evaluate(inputs=>new Promise(resolve=>{
     const frames=[],longTasks=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({at:e.startTime,ms:e.duration});});observer.observe({type:'longtask',buffered:false});let previous=performance.now();
     const frame=()=>{const now=performance.now(),raf=now-previous;previous=now;const at=performance.now();window.releaseStep(inputs[window.releaseTick]);window.releaseStep(inputs[window.releaseTick]);const g=window.releaseQA,m=g.model;
      frames.push({raf,cpu:performance.now()-at,calls:g.world.renderer.info.render.calls,programs:g.world.renderer.info.programs.length,active:m.fragments.active.length});
      if(frames.length<240)window.nativeRAF(frame);else{observer.disconnect();resolve({frames,longTasks,cold:window.releaseCold,state:{ship:m.ship,distance:m.distance,elapsed:m.elapsed,hull:m.hull,hazards:m.field.slots,publications:m.field.events,mine:m.homing.current}});}
     };window.nativeRAF(frame);
    }),tape.inputs);
    const sorted=raw.frames.map(f=>f.raf).sort((a,b)=>a-b),row={source,repeat,browser:browser.version(),...raw,stateHash:createHash('sha256').update(JSON.stringify(raw.state)).digest('hex'),fps:raw.frames.length*1000/raw.frames.reduce((n,f)=>n+f.raf,0),p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};
    assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);rows.push(row);await r.context.close();console.log(source,repeat,row.fps.toFixed(2),row.p95,row.max,JSON.stringify(row.longTasks));
   }
  }finally{server.kill();}
 }
 for(let i=0;i<3;i++)assert.equal(rows[i].stateHash,rows[i+3].stateHash);
 await writeFile(resolve(root,'dense-profile.json'),JSON.stringify({method:'Targeted fresh-page repeat of the exact dense desktop setup after an original five-frame RAF gap. Three sequential runs/source, same240frames/prefix/input and real production graph. JS CPU, programs/draws/active and LongTaskObserver recorded; original outlier retained separately. No production tuning or hidden discarded attempt.',rows},null,2));
}finally{await browser.close();}
