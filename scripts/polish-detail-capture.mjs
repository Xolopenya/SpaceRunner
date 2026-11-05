import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {readFile,writeFile,copyFile} from 'node:fs/promises';import {chromium} from '@playwright/test';
const root='.cache/review/GAMEPLAY-005B2',rows=JSON.parse(await readFile(`${root}/final/polish-scenarios.json`,'utf8')),near=rows.find(r=>r.name==='lower-near-miss'),receipts=[],servers=[];
const browser=await chromium.launch({channel:'chrome'});
async function boot(p,url){p.setDefaultTimeout(120000);await p.addInitScript(()=>{window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{}});await p.goto(url);await p.locator('#launch').click();await p.evaluate(()=>window.spaceRunner.loop.stop());}
try{for(const source of ['baseline','final']){
 const port=source==='baseline'?5194:5195,server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(source==='baseline'?[`${root}/baseline-project`]:[]),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});servers.push(server);
 for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${port}`);break}catch{await new Promise(r=>setTimeout(r,100))}}
 for(const mode of ['settled','banked']){
  const context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage();await boot(p,`http://127.0.0.1:${port}/?debug=integrated&colliders=1&seed=${near.seed}`);await p.locator('#collider-debug-info').evaluate(el=>el.hidden=true);
  const state=await p.evaluate(({near,mode})=>{const g=window.spaceRunner,m=g.model,w=g.world,draw=w.renderer.render;w.renderer.render=()=>{};const ticks=mode==='settled'?near.captureTick-24:60;
   for(let i=0;i<ticks;i++){if(i%2===0)m.beginPlanningFrame();m.step(1/120,mode==='settled'?near.inputs[i]:{x:1,y:1});if(i%2===1){m.finishPlanningFrame(1/60);g.loop.render(1/60)}}w.renderer.render=draw;g.loop.render(0);return{hull:m.hull,distance:m.distance,ship:{...m.ship},bank:w.ship.rotation.toArray(),parts:m.shipColliderProfile.parts}}, {near,mode});assert.equal(state.hull,3);
  for(const [angle,position]of [['rear',[0,1,5]],['side',[6,1,3]],['front',[0,1,-5]]]){
   await p.evaluate(position=>{const g=window.spaceRunner,w=g.world,m=g.model,c=w.flightCamera.camera;c.position.set(m.ship.x+position[0],m.ship.y+position[1],position[2]);c.lookAt(m.ship.x,m.ship.y,0);c.updateMatrixWorld();w.renderer.render(w.scene,c)},position);await p.screenshot({path:`${root}/${source}/media/${source}-profile-${mode}-${angle}.png`});
  }receipts.push({source,mode,state});await context.close();
 }
 if(source==='final'){
  const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:`${root}/final/video-raw`,size:{width:1280,height:800}}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await boot(p,`http://127.0.0.1:${port}/?debug=integrated&seed=42`);
  const setup=await p.evaluate(async()=>{const g=window.spaceRunner,m=g.model,w=g.world,{wreckProfile}=await import('/src/experiments/structure-variants/profile.ts');let h;
   const draw=w.renderer.render;w.renderer.render=()=>{};window.wallTick=0;
   while(window.wallTick<12000&&m.state==='PLAYING'){
    h=m.field.slots.find(h=>h.planned&&h.kind>=4&&h.kind<=8&&h.z< -30&&h.z> -60);if(h)break;
    const c=m.field.certificate;let t=c?Math.round((m.elapsed-c.context.elapsed)*120):0,input={x:0,y:0};for(const r of c?.controls??[]){if(t<r.ticks){input=r.input;break}t-=r.ticks}
    if(window.wallTick%2===0)m.beginPlanningFrame();m.step(1/120,input);window.wallTick++;if(window.wallTick%2===0){m.finishPlanningFrame(1/60);g.loop.render(1/60)}
   }if(!h)throw Error('No accepted station fixture anchor');const a=wreckProfile(h).aperture,slot=m.fragments.slots.findIndex(s=>s.state!=='active');if(slot<0)throw Error('No fixture reward slot');
   const proposal={id:'DEV-FIXTURE-wall-block',section:0,anchor:h.planned.id,situation:'aperture',x:h.x+a.x+2.95,y:h.y+a.y,passDistance:h.planned.passDistance};Object.assign(m.fragments.slots[slot],{state:'active',proposal});window.wallFixture={slot,proposal,goal:{x:h.x+a.x+1.45,y:h.y+a.y},beforeOccluded:m.fragments.stats.occluded};
   w.renderer.render=draw;g.loop.render(0);const label=document.createElement('div');label.textContent='DEV FIXTURE: reward intentionally inside a real station wall; must remain uncollected';label.style.cssText='position:absolute;bottom:60px;left:18px;color:#ffdc90;background:#07111e;padding:10px;font:12px monospace';document.getElementById('game').append(label);return{anchor:{...h.planned},fixture:window.wallFixture,hull:m.hull};
  });
  const result=await p.evaluate(()=>new Promise(resolve=>{const g=window.spaceRunner,m=g.model,f=window.wallFixture;const frame=()=>{for(let i=0;i<2;i++){if(window.wallTick%2===0)m.beginPlanningFrame();m.step(1/120,{x:Math.max(-1,Math.min(1,(f.goal.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(f.goal.y-m.ship.y)*2.6-m.ship.vy*.8))});window.wallTick++;if(window.wallTick%2===0){m.finishPlanningFrame(1/60);g.loop.render(1/60)}}if(m.distance<f.proposal.passDistance+8&&m.state==='PLAYING')window.nativeRAF(frame);else resolve({distance:m.distance,hull:m.hull,state:m.fragments.slots[f.slot].state,occluded:m.fragments.stats.occluded-f.beforeOccluded,count:m.fragments.count})};window.nativeRAF(frame)}));
  assert.notEqual(result.state,'collected');assert.ok(result.occluded>0);assert.deepEqual(errors,[]);await p.screenshot({path:`${root}/final/media/fixture-station-wall-block.png`});const video=p.video();await context.close();await copyFile(await video.path(),`${root}/final/media/fixture-station-wall-block.webm`);receipts.push({source,name:'fixture-station-wall-block',setup,result,errors,note:'Only reward is an explicit invalid-placement fixture. Station and player follow real committed geometry and ordinary controls; not a natural fragment spawn.'});
 }
 server.kill();
}await writeFile(`${root}/final/detail-captures.json`,JSON.stringify(receipts,null,2));}finally{await browser.close();for(const s of servers)s.kill()}
