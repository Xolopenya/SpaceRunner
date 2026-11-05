import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const root='.cache/review/GAMEPLAY-005B',trace=JSON.parse(await readFile(`${root}/baseline/pop-in-42.json`,'utf8'));
const scenarios=['asteroid','large-asteroid','station','mine','fragment'].map(name=>({name,tick:trace.objects.find(o=>o.family===name&&o.firstVisible).firstVisible.tick+120}));
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
 for(const source of ['baseline','final']){
  const port=source==='baseline'?5192:5193,server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(source==='baseline'?[`${root}/baseline-project`]:[]),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});
  try{
   for(let n=0;n<150;n++){try{await fetch(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
   const cases=[...scenarios.map(s=>({...s,viewport:{width:1280,height:800}})),...['portrait','landscape'].map(name=>({name:`mine-${name}`,tick:3851,viewport:name==='portrait'?{width:390,height:844}:{width:844,height:390}}))];
   for(const row of cases){
    const context=await browser.newContext({viewport:row.viewport}),page=await context.newPage();page.setDefaultTimeout(120000);
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
    const query=source==='baseline'?'debug=integrated':'debug=visuals&boundaries=warp&reveal=seamless';
    await page.goto(`http://127.0.0.1:${port}/?${query}&seed=42`);await page.locator('#launch').click();if(source==='final')await page.locator('#visual-comparison').evaluate(el=>el.hidden=true);
    const result=await page.evaluate(({inputs,tick})=>{
     const g=window.spaceRunner,m=g.model,w=g.world;g.loop.stop();const draw=w.renderer.render;w.renderer.render=()=>{};
     for(let i=0;i<tick;i++){if(i%2===0)m.beginPlanningFrame();m.step(1/120,inputs[i]);if(i%2===1){m.finishPlanningFrame(1/60);g.loop.render(1/60);}}
     w.renderer.render=draw;g.loop.render(0);
     return{distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},hull:m.hull,phase:m.phase,count:m.fragments.count,hazards:m.field.slots.map(h=>({...h})),fragments:m.fragments.active,current:m.homing.current,publications:m.field.events};
    },{inputs:trace.inputs,tick:row.tick});
    const name=`${source}-${row.name}-readable.png`;await mkdir(`${root}/${source}/media`,{recursive:true});await page.screenshot({path:`${root}/${source}/media/${name}`});
    rows.push({source,...row,screenshot:name,stateHash:createHash('sha256').update(JSON.stringify(result)).digest('hex'),distance:result.distance,hull:result.hull});await context.close();console.log(name,row.tick);
   }
  }finally{server.kill();}
 }
 for(const b of rows.filter(r=>r.source==='baseline'))assert.equal(rows.find(r=>r.source==='final'&&r.name===b.name).stateHash,b.stateHash,b.name);
 await writeFile(`${root}/final/matched-readable-stills.json`,JSON.stringify({rows,note:'Native page screenshots exactly120 ticks after the baseline first detectable frame, plus identical tick3851 at mobile aspect ratios. The baseline/feature simulation hashes must match. These are the matched readability images; decoded video-end frames are supplementary and can differ by a capture frame.'},null,2));
}finally{await browser.close();}
