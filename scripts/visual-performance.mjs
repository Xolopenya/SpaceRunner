import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const directory='.cache/review/GAMEPLAY-005B/final';await mkdir(directory,{recursive:true});
const inputs=JSON.parse(await readFile('.cache/review/GAMEPLAY-005B/baseline/pop-in-42.json','utf8')).inputs;
const stats=v=>{const a=[...v].sort((x,y)=>x-y),p=q=>a[Math.min(a.length-1,Math.floor(q*a.length))]??0;return{n:a.length,p50:p(.5),p95:p(.95),p99:p(.99),max:a.at(-1)??0};};
const rows=[],browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const source of ['baseline','feature']){
  const port=source==='baseline'?5190:5191;
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(source==='baseline'?['.cache/review/GAMEPLAY-005B/baseline-project']:[]),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});
  try{
   for(let n=0;n<150;n++){try{await fetch(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
   const modes=source==='baseline'?[['legacy','legacy']]:[['legacy','legacy'],['warp','legacy'],['legacy','seamless'],['warp','seamless']];
   for(const viewport of [{width:1280,height:800},{width:390,height:844}])for(const [boundaries,reveal]of modes){
    const context=await browser.newContext({viewport}),page=await context.newPage();page.setDefaultTimeout(120000);
    await page.addInitScript(()=>{window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
    const query=source==='baseline'?'debug=integrated':`debug=visuals&boundaries=${boundaries}&reveal=${reveal}`;
    await page.goto(`http://127.0.0.1:${port}/?${query}&seed=42`);await page.locator('#launch').click();
    if(source==='feature')await page.locator('#visual-comparison').evaluate(el=>el.hidden=true);
    const cdp=await context.newCDPSession(page);
    const setup=await page.evaluate(inputs=>{
     const g=window.spaceRunner,m=g.model,w=g.world;g.loop.stop();window.perfTick=0;
     const draw=w.renderer.render;w.renderer.render=()=>{};
     while(window.perfTick<3000){const t=window.perfTick;if(t%2===0)m.beginPlanningFrame();m.step(1/120,inputs[t]);window.perfTick++;if(t%2===1){m.finishPlanningFrame(1/60);g.loop.render(1/60);}}
     w.renderer.render=draw;const at=performance.now();g.loop.render(0);const coldRenderMs=performance.now()-at;
     const materialCount=()=>{const set=new Set();w.scene.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])set.add(m);});for(const m of w.reveal?.materials??[])set.add(m);return set.size;};
     window.perfMaterials=materialCount;
     return{coldRenderMs,memory:{...w.renderer.info.memory},programs:w.renderer.info.programs.length,materials:materialCount()};
    },inputs);
    await cdp.send('HeapProfiler.collectGarbage');const heapBefore=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
    const raw=await page.evaluate(inputs=>new Promise(resolve=>{
     const g=window.spaceRunner,m=g.model,w=g.world,frames=[],world=[],draw=[],visual=[],planner=[],drawCalls=[],programs=[];let previous=performance.now();
     const renderer=w.renderer.render.bind(w.renderer);let drawing=0;w.renderer.render=(...args)=>{const t=performance.now();renderer(...args);drawing+=performance.now()-t;};
     const frame=()=>{const now=performance.now();frames.push(now-previous);previous=now;
      m.beginPlanningFrame();for(let n=0;n<2;n++){m.step(1/120,inputs[window.perfTick++]);}m.finishPlanningFrame(1/60);const planned=m.homing.planningFrame.latest.ms;
      drawing=0;const t=performance.now();g.loop.render(1/60);const cost=performance.now()-t;world.push(cost);draw.push(drawing);visual.push(Math.max(0,cost-drawing));
      planner.push(planned);drawCalls.push(w.renderer.info.render.calls);programs.push(w.renderer.info.programs.length);
      if(window.perfTick<4200)window.nativeRAF(frame);else resolve({frames,world,draw,visual,planner,drawCalls,programs,state:{distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},hull:m.hull,count:m.fragments.count,
       hazards:m.field.slots.map(h=>({...h})),fragments:m.fragments.active,current:m.homing.current,publications:m.field.events},resources:{...w.renderer.info.memory},materials:window.perfMaterials(),fallbacks:w.reveal?.fallbackCount??0});};window.nativeRAF(frame);
    }),inputs);
    // Genuine UI reset, no new World/assets. Freeze start pose after every reset.
    const resets=[];for(let i=0;i<10;i++){
     await page.locator('#pause').click();await page.locator('#restart-pause').click();
     resets.push(await page.evaluate(()=>{const g=window.spaceRunner;g.world.render(g.model,0);return{distance:g.model.distance,count:g.model.fragments.count,hull:g.model.hull,
      memory:{...g.world.renderer.info.memory},materials:window.perfMaterials(),programs:g.world.renderer.info.programs.length};}));
    }
    assert.ok(resets.every(r=>r.distance===0&&r.count===0&&r.hull===3&&r.materials===resets[0].materials&&JSON.stringify(r.memory)===JSON.stringify(resets[0].memory)));
    await cdp.send('HeapProfiler.collectGarbage');const heapAfter=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
    const stateHash=createHash('sha256').update(JSON.stringify(raw.state)).digest('hex');
    const row={source,viewport,boundaries,reveal,stateHash,setup,rafMs:stats(raw.frames),worldCpuMs:stats(raw.world),rendererCpuMs:stats(raw.draw),nonRendererCpuMs:stats(raw.visual),plannerMs:stats(raw.planner),drawCalls:stats(raw.drawCalls),
     programs:stats(raw.programs),materials:raw.materials,resources:raw.resources,fallbacks:raw.fallbacks,heapBefore,heapAfter,heapDelta:heapBefore===null||heapAfter===null?null:heapAfter-heapBefore,resets,raw};
    rows.push(row);console.log(source,viewport.width,boundaries,reveal,'RAF p95',row.rafMs.p95,'world p95',row.worldCpuMs.p95,'materials',row.materials);await context.close();
   }
  }finally{server.kill();}
 }
 assert.equal(new Set(rows.map(r=>r.stateHash)).size,1,'A/B changed actual simulation at the matched endpoint');
 await writeFile(`${directory}/visual-performance.json`,JSON.stringify({browser:browser.version(),rows,
  note:'Exact frozen005A and all four005B visual combinations, same seed/input/tick3000..4200/600 native RAF frames; no video encoding or parallel suite. Cold first draw measured separately. nonRendererCpuMs is Game render callback minus WebGLRenderer.render (includes ordinary HUD/audio/VFX/camera work), not a GPU timer. Heap after explicit Chrome GC before playback and after10 UI resets is a finite lifecycle sample. Portrait uses desktop viewport emulation.'},null,2));
}finally{await browser.close();}
