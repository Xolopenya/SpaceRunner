import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
const output=resolve('.cache/review/GAMEPLAY-003C4-FIX2/media');await mkdir(output,{recursive:true});const evidence=[];
for(const version of ['before','after']){
 const port=version==='before'?5251:5252,base=`http://127.0.0.1:${port}/`,server=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:version==='before'?resolve('.cache/review/GAMEPLAY-003C4-FIX2/baseline'):process.cwd(),windowsHide:true,stdio:'ignore'});let browser;
 try{
  for(let n=0;n<100;n++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const actor of ['bait','late']){
   const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+`?debug=field&experiment=moving-mine&motion=adaptive-homing&seed=${actor==='bait'?43:42}&firstMine=1`);await page.locator('#launch').waitFor({state:'visible'});
   await page.evaluate(actor=>{
    const g=window.spaceRunner,m=g.model,p=window.demo={trace:[],first:null,events:[],chunks:[]},step=m.step.bind(m);
    Object.defineProperty(g.input,'axis',{configurable:true,get:()=>{p.first??=m.homing.encounters[0];const tick=Math.round(m.elapsed*120),motion=p.first?.motion;let x=0;if(motion)x=actor==='bait'?(tick<motion.passTick-232?0:tick<motion.passTick-160?1:-1):(tick<motion.startTick?0:tick<motion.passTick-30?1:-1);if(x!==p.last){p.last=x;p.events.push({tick,x,ship:{x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy},mine:m.homing.current});}return{x,y:0};}});
    m.step=(dt,input)=>{step(dt,input);p.trace.push({tick:Math.round(m.elapsed*120),elapsed:m.elapsed,distance:m.distance,input,ship:{x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy},mine:m.homing.current,hull:m.hull});};
    const stream=document.querySelector('#flight').captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1500000});p.stream=stream;p.recorder=recorder;p.blobs=[];recorder.ondataavailable=e=>e.data.size&&p.blobs.push(e.data);recorder.start(500);
   },actor);
   await page.locator('#launch').click();const shots=[];
   for(const[label,lead]of [['warning',420],['right',161],['inertia',110],['correction',8],['passed',-30]]){
    await page.waitForFunction(lead=>{const p=window.demo;return p.first&&Math.round(window.spaceRunner.model.elapsed*120)>=p.first.motion.passTick-lead;},lead,{timeout:30000});const path=`${version}-${actor}-${label}.png`;await page.screenshot({path:join(output,path)});shots.push(path);
   }
   const data=await page.evaluate(()=>new Promise(done=>{const p=window.demo,g=window.spaceRunner,m=g.model;g.loop.stop();p.recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>done({base64:reader.result.split(',')[1],trace:p.trace,first:p.first,events:p.events,hull:m.hull,hits:m.hitSerial,fault:m.field.fault});reader.readAsDataURL(new Blob(p.blobs,{type:'video/webm'}));p.stream.getTracks().forEach(t=>t.stop());};p.recorder.stop();}));
   const bytes=Buffer.from(data.base64,'base64');delete data.base64;const filename=`${version}-${actor}.webm`;await writeFile(join(output,filename),bytes);
   assert.deepEqual(errors,[]);assert.equal(data.fault,undefined);assert.equal(data.hull,actor==='bait'?3:2);assert.equal(data.hits,actor==='bait'?0:1);
   if(actor==='bait'){const reversal=data.events.find(e=>e.x===-1),after=data.trace.filter(s=>s.tick>=reversal.tick&&s.mine),corrected=after.find(s=>s.mine.vx<0);data.bait={reversal,overshoot:Math.max(...after.map(s=>s.mine.x))-reversal.mine.x,delay:(corrected.tick-reversal.tick)/120,oppositeTicks:after.filter(s=>s.ship.vx<-.3&&s.mine.vx>.3).length};assert.ok(data.bait.overshoot>.25&&data.bait.delay>.25&&data.bait.oppositeTicks>15);}
   const decoder=await context.newPage();await decoder.setContent('<video muted></video>');await decoder.evaluate(b64=>{document.querySelector('video').src='data:video/webm;base64,'+b64;},bytes.toString('base64'));await decoder.waitForFunction(()=>document.querySelector('video').readyState>=2);
   const decoded=[];for(const time of [2,6])decoded.push(await decoder.evaluate(time=>new Promise(done=>{const v=document.querySelector('video');v.onseeked=()=>{const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');x.drawImage(v,0,0,160,100);let h=2166136261;for(const b of x.getImageData(0,0,160,100).data)h=Math.imul(h^b,16777619);done({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,hash:h>>>0});};v.currentTime=time;}),time));assert.notEqual(decoded[0].hash,decoded[1].hash);
   await writeFile(join(output,`${version}-${actor}-trace.json`),JSON.stringify(data));evidence.push({version,actor,filename,bytes:bytes.length,decoded,shots,bait:data.bait,hull:data.hull,hits:data.hits});await context.close();console.log(version,actor,data.hull,data.bait?.delay);
  }
 }finally{await browser?.close();server.kill();}
}
await writeFile(join(output,'manifest.json'),JSON.stringify({evidence,note:'Real-time RAF canvas VP8/30fps; normal hull and causal tick inputs, full known ordinary field. No teleport, invulnerability override or witness input. Screenshots include real HUD. Canvas video is silent.'},null,2));
