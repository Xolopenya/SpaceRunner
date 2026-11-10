import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {openGame, advance, chromium} from './release-browser-lib.mjs';

export const dir = resolve('.cache/review/VISUAL-007A');
const mode = process.argv[2] ?? 'capture', source = process.argv[3] ?? 'after';
const baseline = 'd5b02d8';
const hash = data => createHash('sha256').update(data).digest('hex');
await mkdir(dir, {recursive:true});
if (mode === 'freeze') {
  const frozen = resolve(dir,'before-source');
  const files = execFileSync('git',['ls-tree','-r','--name-only',baseline,'src','public','index.html','package.json','vite.config.ts']).toString().trim().split('\n');
  for(const path of files){const dest=resolve(frozen,path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,execFileSync('git',['show',`${baseline}:${path}`]));}
  execFileSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build','--base','/'],{cwd:frozen,stdio:'inherit'});
  await writeFile(resolve(dir,'baseline.json'),JSON.stringify({commit:execFileSync('git',['rev-parse',baseline]).toString().trim(),files},null,2));
  process.exit(0);
}
const cwd = source === 'before' ? resolve(dir,'before-source') : process.cwd();
const port = source === 'before' ? 5191 : 5192;
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd,stdio:'ignore',windowsHide:true});
const url=`http://127.0.0.1:${port}/`;
for(let i=0;i<100;i++){try{await fetch(url);break}catch{await new Promise(r=>setTimeout(r,100))}}
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const tapes=JSON.parse(await readFile(resolve(dir,'scenarios.json'),'utf8'));
  if(mode==='capture'){
    const out=resolve(dir,source);await mkdir(out,{recursive:true});const receipts=[];
    for(const tape of tapes.filter(t=>!process.argv[4]||t.name===process.argv[4])){
      const r=await openGame(browser,url,{seed:tape.seed,videoDir:resolve(out,'raw-video')});
      await advance(r.page,tape.inputs,tape.startTick);
      for(const shot of tape.shots){
        await advance(r.page,tape.inputs,shot.tick,true);
        await r.page.screenshot({path:resolve(out,`${shot.name}.png`)});
        const state=await r.page.evaluate(()=>window.releaseState());
        receipts.push({name:shot.name,tick:shot.tick,state,sha256:hash(JSON.stringify(state))});
        if(['mine-close','aperture-passage'].includes(shot.name)){
          for(const viewport of [{width:390,height:844},{width:844,height:390}]){
            await r.page.setViewportSize(viewport);
            await r.page.waitForFunction(()=>{const g=window.releaseQA,rect=document.getElementById('flight').getBoundingClientRect();return Math.abs(g.world.flightCamera.camera.aspect-rect.width/rect.height)<1e-6},null,{polling:50});
            await r.page.evaluate(()=>window.releaseQA.loop.render(0));
            await r.page.screenshot({path:resolve(out,`${shot.name}-${viewport.width}.png`)});
          }
          await r.page.setViewportSize({width:1280,height:800});
          await r.page.waitForFunction(()=>Math.abs(window.releaseQA.world.flightCamera.camera.aspect-1.6)<1e-6,null,{polling:50});
        }
      }
      await advance(r.page,tape.inputs,tape.endTick,true);
      assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);
      const video=r.page.video();await r.context.close();await copyFile(await video.path(),resolve(out,`${tape.name}.webm`));
      console.log(source,tape.name,tape.shots.map(s=>s.name).join(', '));
    }
    const previous=process.argv[4]?JSON.parse(await readFile(resolve(out,'captures.json'),'utf8')).receipts:[];
    await writeFile(resolve(out,'captures.json'),JSON.stringify({source,url,browser:browser.version(),method:'Unmodified production app. CDP observes Launch; seeded input replay follows existing fixed updates and render. Accelerated prefix, then two 120Hz simulation steps per native browser frame. No entities inserted or model state edited. Extra orientation stills pause simulation for viewport changes. See video-validation.json for keyframe prefix trimming.',receipts:[...previous.filter(p=>!receipts.some(r=>r.name===p.name)),...receipts]},null,2));
  } else if(mode==='performance'){
    const rows=[];
    for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
      const tape=tapes.find(t=>t.name==='integrated-flight'),r=await openGame(browser,url,{seed:tape.seed,viewport});
      await advance(r.page,tape.inputs,Math.max(0,tape.startTick-600));
      const raw=await r.page.evaluate(inputs=>new Promise(resolve=>{
        const g=window.releaseQA,w=g.world,raf=[],render=[],calls=[],triangles=[];let previous=performance.now();
        const frame=()=>{const now=performance.now();raf.push(now-previous);previous=now;g.model.beginPlanningFrame();g.model.step(1/120,inputs[window.releaseTick++]);g.model.step(1/120,inputs[window.releaseTick++]);
          const at=performance.now();g.loop.render(1/60);render.push(performance.now()-at);calls.push(w.renderer.info.render.calls);triangles.push(w.renderer.info.render.triangles);
          if(raf.length<900)window.nativeRAF(frame);else {const materials=new Set();w.scene.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m)});for(const m of w.reveal.materials)materials.add(m);
            resolve({raf,render,calls,triangles,state:window.releaseState(),materials:materials.size,memory:{...w.renderer.info.memory},programs:w.renderer.info.programs.length});}};window.nativeRAF(frame);
      }),tape.inputs);
      const resets=[];for(let i=0;i<10;i++){await r.page.locator('#pause').click();await r.page.locator('#restart-pause').click();resets.push(await r.page.evaluate(()=>{const g=window.releaseQA;g.loop.render(0);return{hull:g.model.hull,distance:g.model.distance,memory:{...g.world.renderer.info.memory},programs:g.world.renderer.info.programs.length}}));}
      assert.ok(resets.every(s=>s.hull===3&&s.distance===0&&JSON.stringify(s.memory)===JSON.stringify(resets[0].memory)));
      assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);await r.context.close();
      const stats=a=>{const b=[...a].sort((a,b)=>a-b),p=q=>b[Math.floor((b.length-1)*q)];return{n:b.length,p50:p(.5),p95:p(.95),p99:p(.99),max:b.at(-1)}};
      rows.push({viewport,...raw,summary:Object.fromEntries(['raf','render','calls','triangles'].map(k=>[k,stats(raw[k])])),resets});console.log(source,viewport,rows.at(-1).summary);
    }
    await writeFile(resolve(dir,`${source}-performance.json`),JSON.stringify({source,browser:browser.version(),rows},null,2));
  } else throw Error(`Unknown mode ${mode}`);
} finally {await browser.close();server.kill();}
