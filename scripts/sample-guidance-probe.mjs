import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {openGame,chromium} from './release-browser-lib.mjs';
const dir=resolve('.cache/review/FEEDBACK-001C1/final/probes');await mkdir(dir,{recursive:true});
const server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5189','--strictPort'],{stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5189/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const r=await openGame(browser,'http://127.0.0.1:5189/',{seed:0});
 for(const name of ['clear','ship-ray-blocked','camera-blocked','depth60','depth12']){
  const row=await r.page.evaluate(name=>{
   const g=window.releaseQA,m=g.model,w=g.world,guide=w.guidance;
   // Explicit secondary geometry fixture. Natural input replays are separate.
   m.field.hazards.forEach(h=>h.active=false);m.fragments.reset();const depth=name==='depth60'?60:name==='depth12'?12:30;
   m.fragments.slots[0].state='active';m.fragments.slots[0].proposal={id:'controlled-probe',section:6,anchor:'controlled',situation:'debris',x:m.ship.x,y:m.ship.y,passDistance:m.distance+depth};
   if(name.includes('blocked'))Object.assign(m.field.hazards[0],{active:true,x:m.ship.x,y:m.ship.y,z:name==='camera-blocked'?-15:-8,radius:name==='camera-blocked'?3:.35,kind:0,phase:0,spin:0,planned:undefined});
   w.reveal.setMode('legacy');const snapshot=()=>JSON.stringify({ship:m.ship,hull:m.hull,distance:m.distance,count:m.fragments.count,fragments:m.fragments.slots,hazards:m.field.slots,ledger:m.field.ledger.snapshot()});
   const before=snapshot();guide.enabled=false;w.render(m,0);const off=w.renderer.info.render.calls;guide.enabled=true;w.render(m,0);
   const visible=guide.marker.mesh.visible,diag={...guide.diagnostics},on=w.renderer.info.render.calls,resources={...w.renderer.info.memory};
   const at=performance.now();for(let i=0;i<2000;i++)guide.update(m,w.ship,w.camera,w.width,w.height);const cpuPerUpdate=(performance.now()-at)/2000;
   return{name,depth,visible,diag,off,on,resources,cpuPerUpdate,unchanged:before===snapshot(),markerZ:guide.marker.mesh.position.z};
  },name);
  assert.ok(row.unchanged);assert.ok(row.on-row.off>=1&&row.on-row.off<=2);
  if(name==='camera-blocked')assert.equal(row.visible,false);
  else {assert.equal(row.visible,true);assert.equal(row.markerZ,-row.depth);assert.equal(row.diag.aligned,name!=='ship-ray-blocked');}
  if(name==='ship-ray-blocked')assert.equal(row.diag.blocked,true);
  await r.page.screenshot({path:resolve(dir,name+'.png')});rows.push(row);
 }
 const disposal=await r.page.evaluate(()=>{const g=window.releaseQA,w=g.world,before={...w.renderer.info.memory};w.guidance.dispose();w.render(g.model,0);return{before,after:{...w.renderer.info.memory}};});
 assert.equal(disposal.before.geometries-disposal.after.geometries,2);assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);
 await r.context.close();await writeFile(resolve(dir,'probes.json'),JSON.stringify({method:'Secondary controlled world-geometry fixtures, not naturally generated shards or human attempts. Same production renderer/query; no model stepping. Natural input-driven ON/OFF evidence is in guidance/.',browser:browser.version(),rows,disposal},null,2));
}finally{await browser.close();server.kill();}
