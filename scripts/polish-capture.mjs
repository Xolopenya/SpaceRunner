import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const root='.cache/review/GAMEPLAY-005B2',rows=JSON.parse(await readFile(`${root}/final/polish-scenarios.json`,'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true}),receipts=[];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const corridorOnly=process.argv.includes('--corridor-only'),eventFilter=process.argv.find(a=>a.startsWith('--event='))?.slice(8);
async function start(page,url){page.setDefaultTimeout(120000);await page.addInitScript(()=>{window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{}});await page.goto(url);await page.locator('#launch').click();await page.evaluate(()=>{window.spaceRunner.loop.stop();window.polishTick=0;});}
async function advance(page,inputs,target,live=false){return page.evaluate(({inputs,target,live})=>new Promise(resolve=>{const g=window.spaceRunner,m=g.model;const step=()=>{const t=window.polishTick;if(t%2===0)m.beginPlanningFrame?.();m.step(1/120,inputs[t]??{x:0,y:0});window.polishTick++;if(t%2===1){m.finishPlanningFrame?.(1/60);g.loop.render(1/60)}};if(!live){const draw=g.world.renderer.render;g.world.renderer.render=()=>{};while(window.polishTick<target)step();g.world.renderer.render=draw;g.loop.render(0);resolve();return;}const frame=()=>{for(let n=0;n<2&&window.polishTick<target;n++)step();if(window.polishTick<target)window.nativeRAF(frame);else resolve()};window.nativeRAF(frame)}),{inputs,target,live})}
const servers=[];
try{
 for(const source of corridorOnly?['final']:['baseline','final']){
  const port=source==='baseline'?5194:5195,media=`${root}/${source}/media`;await mkdir(media,{recursive:true});
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(source==='baseline'?[`${root}/baseline-project`]:[]),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});servers.push(server);
  for(let i=0;i<150;i++){try{await fetch(`http://127.0.0.1:${port}`);break}catch{await new Promise(r=>setTimeout(r,100))}}
  if(!corridorOnly)for(const row of rows.filter(r=>!eventFilter||r.name===eventFilter)){
   const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:`${root}/${source}/video-raw`,size:{width:1280,height:800}}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
   await start(page,`http://127.0.0.1:${port}/?debug=integrated&colliders=1&seed=${row.seed}`);
   await page.locator('#collider-debug-info').evaluate(el=>el.hidden=true);
   await advance(page,row.inputs,Math.max(0,row.captureTick-240));
   await advance(page,row.inputs,row.captureTick,true);
   const receipt=await page.evaluate(()=>{const g=window.spaceRunner,m=g.model,w=g.world;return{tick:window.polishTick,distance:m.distance,ship:{...m.ship},hull:m.hull,count:m.fragments.count,contact:m.lastShipContact,pickup:m.fragments.lastPickup,selected:m.field.slots.filter(h=>h.planned).map(h=>h.planned),resources:{...w.renderer.info.memory},calls:w.renderer.info.render.calls,bank:w.ship.rotation.toArray()}});
   await page.screenshot({path:`${media}/${source}-${row.name}-overlay.png`});
   if(row.name==='lower-near-miss'){
    for(const [name,p]of [['side',[6,1,4]],['front',[0,1,-5]],['high',[0,5,3]]]){
     await page.evaluate(p=>{const w=window.spaceRunner.world,c=w.flightCamera.camera,m=window.spaceRunner.model;c.position.set(m.ship.x+p[0],m.ship.y+p[1],p[2]);c.lookAt(m.ship.x,m.ship.y,0);c.updateMatrixWorld();w.renderer.render(w.scene,c)},p);
     await page.screenshot({path:`${media}/${source}-wing-profile-${name}.png`});
    }
   }
   await page.evaluate(()=>{const w=window.spaceRunner.world;w.scene.getObjectByName('collision-debug-root').visible=false;w.flightCamera.reset();w.render(window.spaceRunner.model,0)});await page.screenshot({path:`${media}/${source}-${row.name}-clean.png`});
   await advance(page,row.inputs,Math.max(row.tick,row.captureTick+240),true);
   const end=await page.evaluate(()=>{const m=window.spaceRunner.model;return{hull:m.hull,count:m.fragments.count,contact:m.lastShipContact,state:m.state}});
   assert.deepEqual(errors,[]);if(row.name==='lower-near-miss')assert.equal(end.hull,source==='baseline'?2:3);
   if(row.name.endsWith('wing-hit'))assert.equal(end.contact?.part,row.name.slice(0,-4));
   if(row.name.startsWith('pickup'))assert.equal(end.count,row[source==='baseline'?'old':'next'].count);
   const video=page.video();await context.close();await copyFile(await video.path(),`${media}/${source}-${row.name}.webm`);receipts.push({source,name:row.name,seed:row.seed,inputHash:hash(row.inputs),receipt,end,errors});console.log(source,row.name,end);
  }
  if(source==='final'&&!eventFilter){
   for(const aperture of ['center','left','right','upper','lower']){
    const context=await browser.newContext({viewport:{width:1280,height:800},...(aperture==='center'?{recordVideo:{dir:`${root}/final/video-raw`,size:{width:1280,height:800}}}:{})}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await start(page,`http://127.0.0.1:${port}/?debug=field&experiment=large-structure&aperture=${aperture}&mode=isolated&seed=42`);
    await page.evaluate(()=>{document.querySelector('#structure-variants-debug-info').hidden=true;window.spaceRunner.world.flightCamera.setMode('hybrid-chase');});
    for(const depth of [170,80,15,0,-5]){
     const state=await page.evaluate(({depth,aperture})=>{
      const g=window.spaceRunner,m=g.model,w=g.world,goals={center:[0,0],left:[-3,0],right:[3,0],upper:[0,1.9],lower:[0,-1.9]},goal=goals[aperture];let h;const draw=w.renderer.render;w.renderer.render=()=>{};
      for(let i=0;i<7000;i++){h=m.field.slots.find(h=>h.planned&&h.kind>=4&&h.kind<=8);if(h&&h.z>=-depth)break;
       const input={x:Math.max(-1,Math.min(1,(goal[0]-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(goal[1]-m.ship.y)*2.6-m.ship.vy*.8))};m.step(1/120,input);window.polishTick++;if(window.polishTick%2===0)g.loop.render(1/60);
      }w.renderer.render=draw;g.loop.render(0);return{tick:window.polishTick,distance:m.distance,hull:m.hull,ship:{...m.ship},station:h?{...h}:null,counts:w.boundaries.warp.sides.map(s=>s.material.uniforms.exclusionCount.value)};
     },{depth,aperture});assert.ok(state.station,'No committed station');assert.equal(state.hull,3);
     for(const enabled of [false,true]){await page.evaluate(on=>{const g=window.spaceRunner;g.world.boundaries.warp.occlusion=on;g.world.render(g.model,0)},enabled);await page.screenshot({path:`${media}/corridor-${aperture}-${depth}-${enabled?'after':'before'}.png`})}
     receipts.push({source,name:`corridor-${aperture}-${depth}`,state,mode:'existing certified isolated station diagnostic; identical model state for live off/on'});
    }
    // Matched boundary response shots from four camera/ship offsets are real controls in restarted runs, never edited poses.
    for(const [name,goal]of [['left',[-6,0]],['right',[6,0]],['upper',[0,3.6]],['lower',[0,-3.6]]])if(aperture==='center'){
     await page.evaluate(()=>{const g=window.spaceRunner;g.model.pause();g.loop.render(0)});await page.locator('#restart-pause').click();
     const state=await page.evaluate(goal=>{const g=window.spaceRunner,m=g.model,w=g.world;g.loop.stop();const draw=w.renderer.render;w.renderer.render=()=>{};
      for(let i=0;i<200;i++){m.step(1/120,{x:Math.max(-1,Math.min(1,(goal[0]-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(goal[1]-m.ship.y)*2.6-m.ship.vy*.8))});g.loop.render(1/120)}w.renderer.render=draw;g.loop.render(0);return{ship:{...m.ship},distance:m.distance,hull:m.hull,counts:w.boundaries.warp.sides.map(s=>s.material.uniforms.exclusionCount.value)}},goal);
     for(const on of [false,true]){await page.evaluate(on=>{const g=window.spaceRunner;g.world.boundaries.warp.occlusion=on;g.world.render(g.model,0)},on);await page.screenshot({path:`${media}/corridor-boundary-${name}-${on?'after':'before'}.png`})}receipts.push({name:`corridor-boundary-${name}`,state});
    }
    assert.deepEqual(errors,[]);const video=page.video();await context.close();if(video)await copyFile(await video.path(),`${media}/corridor-station-live-comparison.webm`);
   }
  }
  server.kill();
 }
 await writeFile(`${root}/final/${eventFilter?'browser-extra-captures':'browser-captures'}.json`,JSON.stringify({browser:browser.version(),receipts,notes:['Native browser captures; no composited game images. Videos are silent. Accelerated prefixes, two120Hz ticks/native RAF in genuine event clips.','Original owner screenshot was not included in the supplied attachment. Corridor reconstruction uses the existing certified station diagnostic plus real control inputs, with unchanged geometry.']},null,2));
}finally{await browser.close();for(const s of servers)s.kill()}
