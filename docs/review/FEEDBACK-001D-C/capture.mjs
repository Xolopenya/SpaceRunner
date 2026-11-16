import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openGame,advance,chromium} from '../../../scripts/release-browser-lib.mjs';
const mode=process.argv[2],dir=resolve('.cache/review/FEEDBACK-001D-C');
await mkdir(resolve(dir,'evidence'),{recursive:true});
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5203','--strictPort'],{cwd:mode==='before'?resolve(dir,'baseline'):process.cwd(),stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5203')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const [width,height] of [[1280,720],[1920,1080],[1366,768],[1024,600],[800,450],[390,844],[360,800],[932,430],[768,1024]]){
  const r=await openGame(browser,'http://127.0.0.1:5203/',{seed:42,viewport:{width,height},videoDir:width===1280?resolve(dir,'raw-video'):undefined});
  const shot=async label=>{
   const path=`${mode}-${width}x${height}-${label}.png`;await r.page.screenshot({path:resolve(dir,'evidence',path)});
   rows.push(await r.page.evaluate(({path,label})=>{const g=window.releaseQA,m=g.model;return{path,label,width:innerWidth,height:innerHeight,elapsed:m.elapsed,state:m.state,score:m.score,hull:m.hull,energy:m.fragments.count,cinematic:g.world.destruction.sequence.active,best:g.platform.scores.best,completed:g.results?.completed,focus:document.activeElement?.id,rects:[...document.querySelectorAll('#final-score,#final-best,#final-energy,#new-record,#record-comparison,#replay,#back-menu,#seed')].filter(n=>n.getClientRects().length).map(n=>({id:n.id,text:n.textContent,rect:n.getBoundingClientRect().toJSON()}))};},{path,label}));
   await writeFile(resolve(dir,`${mode}-captures.json`),JSON.stringify({method:'Original production seed42 neutral controls. Accelerated original fixed simulation, held original cinematic then normal rendering; no HP/hazard or UI text injection.',rows},null,2));
  };
  await advance(r.page,Array.from({length:6500},()=>({x:0,y:0})),6500);await shot('cinematic');
  await r.page.evaluate(()=>{const g=window.releaseQA;for(let i=0;i<150;i++)g.loop.render(1/60);});await shot('results');
  if(mode==='after'){
   await r.page.locator('#back-menu').click();await r.page.evaluate(()=>window.releaseQA.loop.render(0));await shot('menu');
   await r.page.locator('#launch').click();await r.page.evaluate(()=>window.releaseQA.loop.render(0));await shot('relaunched');
   await r.page.evaluate(()=>{window.releaseTick=0;});await advance(r.page,Array.from({length:6500},()=>({x:0,y:0})),6500);
   await r.page.locator('#skip-destruction').click();await shot('equal-skipped-results');
   await r.page.locator('#replay').click();await r.page.evaluate(()=>window.releaseQA.loop.render(0));await shot('replayed');
  }
  if(width===1280)await r.page.evaluate(()=>new Promise(done=>{let n=90;const frame=()=>{window.releaseQA.loop.render(1/60);if(--n)window.nativeRAF(frame);else done();};window.nativeRAF(frame);}));
  const video=r.page.video();await r.context.close();if(video)await copyFile(await video.path(),resolve(dir,'evidence',`${mode}-results.webm`));
  console.log(mode,width,height);
 }
}finally{await browser.close();server.kill();}
