import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openGame,advance,chromium} from '../../../scripts/release-browser-lib.mjs';
const dir=resolve('.cache/review/FEEDBACK-001D-B');await mkdir(resolve(dir,'evidence'),{recursive:true});
const rows=[],performanceRows=[];
for(const mode of ['before','after']){
 const cwd=mode==='before'?resolve(dir,'baseline'):process.cwd();
 const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5199','--strictPort'],{cwd,windowsHide:true,stdio:'ignore'});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5199')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[1024,600],[390,844],[360,800],[932,430],[768,1024],[800,450]]){
   const r=await openGame(browser,'http://127.0.0.1:5199/',{viewport:{width,height},seed:42,videoDir:width===1280?resolve(dir,'raw-video'):undefined});
   const shot=async label=>{
    const path=`${mode}-${width}x${height}-${label}.png`;await r.page.screenshot({path:resolve(dir,'evidence',path)});
    rows.push(await r.page.evaluate(({path,mode,label})=>{
     const g=window.releaseQA,m=g?.model,ids=['hull','energy-block','phase-label','damage','phase-notice','pause'];
     const rects=ids.map(id=>document.getElementById(id)).filter(n=>n.getClientRects().length).map(n=>({id:n.id,text:n.textContent,rect:n.getBoundingClientRect().toJSON()}));
     return{path,mode,label,viewport:{width:innerWidth,height:innerHeight},elapsed:m?.elapsed,hull:m?.hull,phase:m?.phase,energy:m?.fragments.count,ship:m?{...m.ship}:null,rects,dom:document.getElementsByTagName('*').length};
    },{path,mode,label}));
   };
   await shot('normal');await advance(r.page,Array.from({length:3200},()=>({x:0,y:0})),2840);await shot('phase');
   await advance(r.page,Array.from({length:3200},()=>({x:0,y:0})),2950);await shot('hit');
   if(width===1280){await r.page.evaluate(()=>new Promise(done=>{let n=120;const f=()=>{window.releaseStep({x:0,y:0});window.releaseStep({x:0,y:0});if(--n)window.nativeRAF(f);else done();};window.nativeRAF(f);}));await shot('critical');}
   await r.page.locator('#pause').click();await r.page.locator('#paused [data-sound-open]').click();await shot('audio');await r.page.keyboard.press('Escape');
   await r.page.reload();await r.page.locator('#launch').waitFor();await shot('menu');
   const video=r.page.video();await r.context.close();if(video)await copyFile(await video.path(),resolve(dir,'evidence',`${mode}-timing.webm`));
   console.log(mode,width,height);
  }
 }finally{await browser.close();server.kill();await new Promise(r=>setTimeout(r,300));}
}
for(const after of rows.filter(r=>r.mode==='after')){
 const before=rows.find(r=>r.mode==='before'&&r.label===after.label&&r.viewport.width===after.viewport.width);
 if(!['menu','audio','critical'].includes(after.label))assert.deepEqual({elapsed:after.elapsed,hull:after.hull,ship:after.ship},{elapsed:before.elapsed,hull:before.hull,ship:before.ship});
 if(['normal','phase','hit'].includes(after.label))for(let i=0;i<after.rects.length;i++)for(let j=i+1;j<after.rects.length;j++){
  const a=after.rects[i].rect,b=after.rects[j].rect;assert.ok(Math.min(a.right,b.right)<=Math.max(a.left,b.left)||Math.min(a.bottom,b.bottom)<=Math.max(a.top,b.top),`${after.path}: ${after.rects[i].id}/${after.rects[j].id}`);
 }
}
await writeFile(resolve(dir,'captures.json'),JSON.stringify({method:'Matched production seed42, original fixed simulation, neutral inputs; accelerated prefixes, native two-second post-contact clip; no HP/hazard injection. Menu/audio are UI comparisons. Fine pointer at all sizes; touch/hybrid separately verified by browser tests.',rows},null,2));
