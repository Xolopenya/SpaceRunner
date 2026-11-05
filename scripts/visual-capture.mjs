import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const baseline=process.argv.includes('--baseline'),port=baseline?5186:5187,phase=baseline?'baseline':'final';
const directory=`.cache/review/GAMEPLAY-005B/${phase}`,media=`${directory}/media`;
await mkdir(media,{recursive:true});
const data=JSON.parse(await readFile('.cache/review/GAMEPLAY-005B/baseline/pop-in-42.json','utf8'));
const rows=[];
for(const family of ['asteroid','large-asteroid','station','mine','fragment']){
 const o=data.objects.find(o=>o.family===family&&o.firstVisible);assert.ok(o,family);
 rows.push({name:family,seed:42,tick:o.firstVisible.tick,end:o.firstVisible.tick+240,inputs:data.inputs,id:o.id});
}
rows.push({name:'phase2',seed:42,tick:2810,end:3050,inputs:data.inputs});
function motion(name,target,ticks=220){const input=[],s={x:0,y:0,vx:0,vy:0};return{name,seed:42,tick:ticks,end:ticks+30,target,inputs:input};}
for(const [name,x,y]of [['center',0,0],['left',-6,0],['right',6,0],['upper',0,3.6],['lower',0,-3.6],['corner-lu',-6,3.6],['corner-ll',-6,-3.6],['corner-ru',6,3.6],['corner-rl',6,-3.6]])rows.push(motion(name,{x,y}));
rows.push({name:'corridor',seed:42,tick:450,end:450,target:'corridor',inputs:[]});
if(!baseline)rows.push({name:'integrated',seed:42,tick:4500,end:4500,start:2000,inputs:data.inputs});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(baseline?['.cache/review/GAMEPLAY-005B/baseline-project']:[]),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
server.stdout.on('data',d=>process.stdout.write(d));server.stderr.on('data',d=>process.stderr.write(d));
for(let n=0;n<150;n++){try{await fetch(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const combinations=baseline?[['legacy','legacy']]:[['legacy','legacy'],['warp','legacy'],['legacy','seamless'],['warp','seamless']];
try{
 for(const [boundaries,reveal]of combinations)for(const row of rows){
  if(!baseline&&!(boundaries==='warp'&&reveal==='seamless')&&['integrated','corridor'].includes(row.name))continue;
  const video=['asteroid','station','mine','fragment','corridor','integrated'].includes(row.name)&&(baseline||boundaries==='warp'&&reveal==='seamless');
  const context=await browser.newContext({viewport:{width:1280,height:800},...(video?{recordVideo:{dir:`${directory}/video-raw`,size:{width:1280,height:800}}}:{})});
  const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.nativeRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
  const query=baseline?'debug=integrated':`debug=visuals&boundaries=${boundaries}&reveal=${reveal}`;
  await page.goto(`http://127.0.0.1:${port}/?${query}&seed=42`);await page.locator('#launch').click();
  if(!baseline)await page.locator('#visual-comparison').evaluate(el=>el.hidden=true);
  await page.evaluate(()=>{const g=window.spaceRunner;g.loop.stop();window.visualTick=0;});
  const advance=async(target,live=false)=>page.evaluate(({row,target,live})=>new Promise(resolve=>{
   const g=window.spaceRunner,m=g.model;
   const step=()=>{const t=window.visualTick;if(t%2===0)m.beginPlanningFrame();let axis=row.inputs[t];
    if(!axis){const goal=row.target==='corridor'?(t<160?{x:6,y:0}:{x:0,y:0}):row.target;
     axis={x:Math.max(-1,Math.min(1,(goal.x-m.ship.x)*1.6-m.ship.vx*.3)),y:Math.max(-1,Math.min(1,(goal.y-m.ship.y)*1.6-m.ship.vy*.3))};}
    m.step(1/120,axis);window.visualTick++;if(t%2===1){m.finishPlanningFrame(1/60);g.loop.render(1/60);}};
   if(!live){const draw=g.world.renderer.render;g.world.renderer.render=()=>{};while(window.visualTick<target)step();g.world.renderer.render=draw;g.loop.render(0);resolve();return;}
   const frame=()=>{for(let n=0;n<2&&window.visualTick<target;n++)step();if(window.visualTick<target)window.nativeRAF(frame);else{g.loop.render(0);resolve();}};window.nativeRAF(frame);
  }),{row,target,live});
  const start=row.start??Math.max(0,row.tick-(video?60:0));await advance(start);
  if(video)await advance(row.tick,true);else await advance(row.tick);
  const name=`${phase}-${row.name}-${boundaries}-${reveal}`,shot=`${name}.png`;
  await page.screenshot({path:`${media}/${shot}`});
  const state=await page.evaluate(()=>{const m=window.spaceRunner.model;return{tick:window.visualTick,distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},hull:m.hull,count:m.fragments.count,phase:m.phase,
   hazards:m.field.slots.map(h=>({...h})),fragments:m.fragments.active,current:m.homing.current,publications:m.field.events.map(e=>({...e}))};});
  const hash=createHash('sha256').update(JSON.stringify(state)).digest('hex');
  if(video)await advance(row.end,true);
  const capture=page.video();await context.close();let file;
  if(video){file=`${name}.webm`;await copyFile(await capture.path(),`${media}/${file}`);}
  assert.deepEqual(errors,[]);results.push({name:row.name,boundaries,reveal,screenshot:shot,video:file,stateHash:hash,state});console.log(name,state.tick,state.distance.toFixed(1));
 }
 const hashes=new Map();for(const r of results){const key=`${r.name}/${r.state.tick}`;if(hashes.has(key))assert.equal(r.stateHash,hashes.get(key),key);else hashes.set(key,r.stateHash);}
 await writeFile(`${directory}/visual-captures.json`,JSON.stringify({baseline,browser:browser.version(),results,note:'Exact baseline source or feature DEV A/B. Matched ordinary120Hz inputs; two ticks per native RAF in visible clips, accelerated prefixes. Clean HUD captures hide the DEV selector. No simulation/health/geometry edits. Native silent25fps WebM; scene cadence60Hz.'},null,2));
}finally{await browser.close();server.kill();}
