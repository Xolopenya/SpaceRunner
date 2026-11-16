import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openGame,advance,chromium} from '../../../scripts/release-browser-lib.mjs';
const dir=resolve('.cache/review/FEEDBACK-001D-B'),rows=[];
for(const mode of ['before','after']){
 const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5199','--strictPort'],{cwd:mode==='before'?resolve(dir,'baseline'):process.cwd(),windowsHide:true,stdio:'ignore'});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5199')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const r=await openGame(browser,'http://127.0.0.1:5199/',{seed:42});
  const measure=await r.page.evaluate(()=>new Promise(done=>{
   const g=window.releaseQA,gaps=[],cost=[];let last=0,n=0;
   const frame=now=>{if(last)gaps.push(now-last);last=now;const start=performance.now();window.releaseStep();window.releaseStep();cost.push(performance.now()-start);if(++n<600)window.nativeRAF(frame);else done({gaps,cost,dom:document.getElementsByTagName('*').length,state:window.releaseState()});};window.nativeRAF(frame);
  }));
  const counters=[];
  for(let i=0;i<10;i++){
   await r.page.locator('#pause').click();await r.page.locator('#restart-pause').click();await r.page.evaluate(()=>window.releaseQA.loop.render(0));
   await r.cdp.send('HeapProfiler.collectGarbage');counters.push(await r.cdp.send('Memory.getDOMCounters'));
  }
  await r.page.evaluate(()=>window.releaseQA.dispose());await r.cdp.send('HeapProfiler.collectGarbage');
  rows.push({mode,measure,counters,disposed:await r.cdp.send('Memory.getDOMCounters'),errors:r.errors,failed:r.failed});await r.context.close();
 }finally{await browser.close();server.kill();await new Promise(r=>setTimeout(r,300));}
}
await writeFile(resolve(dir,'performance.json'),JSON.stringify({method:'Sequential production Chrome comparison; 600 native frames/mode, original certificate controls, 10 UI restarts/mode and actual disposal. No concurrent audit or regression browser processes intended. No physical-phone claim.',rows},null,2));
for(const r of rows){const p=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length*.95)];console.log(r.mode,JSON.stringify({rafP95:p(r.measure.gaps),updateRenderP95:p(r.measure.cost),counters:r.counters,disposed:r.disposed}));}
