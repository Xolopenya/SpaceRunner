import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openGame,advance,chromium} from './release-browser-lib.mjs';
const root=resolve('.cache/review/FEEDBACK-001C1'),mode=process.argv[2]??'final',out=resolve(root,mode,'guidance');await mkdir(out,{recursive:true});
let tapes;
try{tapes=JSON.parse(await readFile(resolve(root,'scenario-inputs.json'),'utf8'));}catch{tapes=JSON.parse(await readFile('.cache/review/VISUAL-007B/scenarios.json','utf8'));}
const analysis=JSON.parse(await readFile(resolve(root,'pickup-analysis.json'),'utf8'));
if(!tapes.some(t=>t.name==='pickup-screen-miss'))tapes.push(analysis.scenarios.find(t=>t.name==='pickup-screen-miss'));
const names=['pickup-body','pickup-left-wing','pickup-right-wing','pickup-phase2','pickup-screen-miss'];
tapes=tapes.filter(t=>names.includes(t.name));await writeFile(resolve(root,'scenario-inputs.json'),JSON.stringify(tapes));
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5191','--strictPort'],{cwd:mode==='baseline'?resolve(root,'baseline-source'):process.cwd(),stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),receipts=[];
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5191/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const name of names)for(const viewport of [{width:1280,height:800},{width:390,height:844},...(name==='pickup-body'?[{width:844,height:390}]:[])]) {
  const tape=tapes.find(t=>t.name===name);assert.ok(tape);
  const r=await openGame(browser,'http://127.0.0.1:5191/',{viewport,seed:tape.seed,videoDir:resolve(out,'raw-video')});
  await r.page.waitForFunction(()=>window.releaseQA.audio.status==='running');await r.page.evaluate(async()=>{await window.releaseQA.audio.graph.samples?.ready;});
  const shots=tape.shots.filter(s=>/fragment-(distant|close|inspect|debris)$|pickup$|after-pickup$|^depth-/.test(s.name)).sort((a,b)=>a.tick-b.tick);
  for(const shot of shots) {
   await advance(r.page,tape.inputs,shot.tick);
   for(const enabled of mode==='baseline'?[false]:[false,true]) {
    await r.page.evaluate(enabled=>{const g=window.releaseQA;if(g.world.guidance)g.world.guidance.enabled=enabled;g.world.render(g.model,0);},enabled);
    const file=`${name}-${viewport.width}-${shot.name}-${enabled?'on':'off'}.png`;await r.page.screenshot({path:resolve(out,file)});
    receipts.push(await r.page.evaluate(({file,enabled})=>{
     const g=window.releaseQA,m=g.model,w=g.world,c=w.camera,project=(x,y,z)=>{const p=new w.ship.position.constructor(x,y,z);p.project(c);return p.toArray();};
     const p=m.fragments.slots.find(s=>s.state==='active')?.proposal;
     return{file,enabled,tick:window.releaseTick,ship:{...m.ship},distance:m.distance,hull:m.hull,count:m.fragments.count,pickup:{...m.fragments.lastPickup},
      target:p,diagnostics:w.guidance?{...w.guidance.diagnostics}:null,projection:p?{ship:project(m.ship.x,m.ship.y,0),corridor:project(m.ship.x,m.ship.y,m.distance-p.passDistance),shard:project(p.x,p.y,m.distance-p.passDistance)}:null,
      resources:{...w.renderer.info.memory},calls:w.renderer.info.render.calls,programs:w.renderer.info.programs.length,fault:m.field.fault??null};
    },{file,enabled}));
   }
  }
  await r.context.close();assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);
  for(const enabled of mode==='baseline'?[false]:[false,true]) {
   const live=await openGame(browser,'http://127.0.0.1:5191/',{viewport,seed:tape.seed,videoDir:resolve(out,'raw-video')});
   await live.page.evaluate(enabled=>{if(window.releaseQA.world.guidance)window.releaseQA.world.guidance.enabled=enabled;},enabled);
   await advance(live.page,tape.inputs,Math.max(0,tape.endTick-420));await advance(live.page,tape.inputs,tape.endTick,true);
   const video=live.page.video();await live.context.close();await copyFile(await video.path(),resolve(out,`${name}-${viewport.width}-${enabled?'on':'off'}.webm`));
   assert.deepEqual(live.errors,[]);assert.deepEqual(live.failed,[]);
  }
  console.log(mode,name,viewport.width);
 }
 await writeFile(resolve(out,'captures.json'),JSON.stringify({mode,browser:browser.version(),method:'Exact existing natural input tapes and original production IntegratedModel. No hazard, position, HP or pickup-rule edits. Paired final ON/OFF shots share identical simulation state; held shots and accelerated prefixes; native-RAF final approaches; silent full-page video.',receipts},null,2));
}finally{await browser.close();server.kill();}
