import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {stats} from './director-fields.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function runtimeBrowser(output){
 await mkdir(output,{recursive:true});await mkdir(join(root,'test-results'),{recursive:true});
 const servers=[['5193',[]],['5194',['preview']]].map(([port,prefix])=>spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),...prefix,'--host','127.0.0.1','--port',port,'--strictPort'],{cwd:root,windowsHide:true,stdio:'ignore'}));
 let browser;const cases=[];
 try{
  for(const port of ['5193','5194']){let ready=false;for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Local render server not ready');}
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const band of ['early','established'])for(const mobile of [false,true])for(const experimental of [false,true]){
   const viewport=mobile?{width:390,height:844}:{width:1280,height:800},context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const navigation=performance.now();await page.goto(`http://127.0.0.1:5193/?debug=${experimental?'field':'inspect'}&seed=42`);await page.locator('#launch').waitFor({state:'visible'});
   const readyMs=performance.now()-navigation;
   if(band==='established'){
    await page.locator('#launch').click();await prepareEstablished(page,experimental);
   }
   await page.evaluate(()=>{
    const g=window.spaceRunner,m=g.model,w=g.world,step=m.step.bind(m),render=w.render.bind(w);
    const p={frames:[],steps:[],renders:[],chunks:[],inputLatency:[],longTasks:[],active:true,last:performance.now(),started:performance.now(),pendingInput:null,firstVisible:null,firstNear:null,firstHit:null,lastHits:m.hitSerial,start:{elapsed:m.elapsed,distance:m.distance,committed:m.field.committed??0}};
    window.runtimeProfile=p;
    const input=e=>{if(e.type==='pointermove'||/^(Arrow|Key[WASD])/.test(e.code??''))p.pendingInput={at:performance.now(),type:e.type,code:e.code};};
    window.addEventListener('keydown',input,true);window.addEventListener('pointermove',input,true);
    m.step=(dt,axis)=>{const before=m.field.schedulerMs??0,oldTick=m.field.planningTicks??0,x=m.ship.vx,y=m.ship.vy,start=performance.now();step(dt,axis);if(p.active){const end=performance.now();if((m.field.planningTicks??0)>oldTick)p.chunks.push({...m.field.samples.at(-1)});p.steps.push({start,end,ms:end-start,schedulerMs:(m.field.schedulerMs??0)-before,state:m.state,active:m.field.hazards.filter(h=>h.active).length,pending:!!m.field.pending});if(p.pendingInput&&(axis.x||axis.y)&&(x!==m.ship.vx||y!==m.ship.vy)){p.inputLatency.push({...p.pendingInput,ms:end-p.pendingInput.at});p.pendingInput=null;}if(m.hitSerial!==p.lastHits){p.firstHit??={elapsed:m.elapsed,distance:m.distance};p.lastHits=m.hitSerial;}}};
    w.render=(model,dt)=>{const start=performance.now();render(model,dt);if(p.active)p.renders.push(performance.now()-start);};
    const observer=new PerformanceObserver(list=>{if(p.active)for(const e of list.getEntries())p.longTasks.push({start:e.startTime,ms:e.duration});});observer.observe({type:'longtask',buffered:false});
    const frame=now=>{if(!p.active)return;p.frames.push({ms:now-p.last,elapsed:m.elapsed,distance:m.distance,state:m.state});p.last=now;
     if(!p.firstVisible)for(const group of w.hazards){if(!group.visible)continue;const v=group.position.clone().project(w.camera),depth=-group.position.clone().applyMatrix4(w.camera.matrixWorldInverse).z;if(Math.abs(v.x)<=1&&Math.abs(v.y)<=1&&depth>0&&depth<190){p.firstVisible={elapsed:m.elapsed,distance:m.distance,viewDepth:depth,wallMs:now-p.started};break;}}
     if(!p.firstNear&&m.field.hazards.some(h=>h.active&&Math.abs(h.z)<=h.radius+.57))p.firstNear={elapsed:m.elapsed,distance:m.distance};
     p.frameId=requestAnimationFrame(frame);};p.frameId=requestAnimationFrame(frame);
    p.stop=()=>{p.active=false;cancelAnimationFrame(p.frameId);observer.disconnect();window.removeEventListener('keydown',input,true);window.removeEventListener('pointermove',input,true);m.step=step;w.render=render;};
   });
   if(band==='early')await page.locator('#launch').click();
   const cdp=await context.newCDPSession(page);let touch;
   if(mobile&&band==='early'){const box=await page.locator('#flight').boundingBox();touch={x:box.x+box.width*.5,y:box.y+box.height*.65};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});}
   const directions=['ArrowRight','ArrowUp','ArrowLeft','ArrowDown'];let held;
   const start=performance.now();let index=0;
   while(performance.now()-start<12000){
    if(band==='established'){await page.waitForTimeout(200);continue;}
    if(mobile){const a=index%4,amplitude=[30,60,15][Math.floor(index/4)%3];await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touch.x+(a===0?amplitude:a===2?-amplitude:0),y:touch.y+(a===1?-amplitude:a===3?amplitude:0)}]});}
    else{if(held)await page.keyboard.up(held);held=directions[index%4];await page.keyboard.down(held);}index++;await page.waitForTimeout(200);
   }
   if(held)await page.keyboard.up(held);if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const raw=await page.evaluate(()=>{const p=window.runtimeProfile,g=window.spaceRunner,m=g.model,w=g.world;p.stop();delete g.input.axis;const gl=w.renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');return{start:p.start,frames:p.frames,steps:p.steps,renders:p.renders,inputLatency:p.inputLatency,longTasks:p.longTasks,firstVisible:p.firstVisible,firstNear:p.firstNear,firstHit:p.firstHit,
    gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:w.renderer.getPixelRatio(),elapsed:m.elapsed,distance:m.distance,state:m.state,hull:m.hull,hits:m.hitSerial,audio:g.audio.status,
    field:{scheduled:m.field.scheduled??null,committed:m.field.committed??null,omitted:m.field.omitted??null,fault:m.field.fault,samples:p.chunks,retainedSamples:m.field.samples?.length??0,events:m.field.events??[],firstPublication:m.field.firstPublication??null,firstOpportunity:m.field.firstOpportunity??null,known:m.field.slots?.filter(s=>s.planned).length??null},renderer:{...w.renderer.info.memory,drawCalls:w.renderer.info.render.calls}};});
   const name=`runtime-${experimental?'new':'old'}-${mobile?'portrait':'desktop'}${band==='early'?'':'-established'}`;await page.screenshot({path:join(root,'test-results',name+'.png')});
   const activeFrames=raw.frames.slice(1).filter(f=>f.state==='PLAYING'),samples=raw.field.samples;
   const summary={name,band,actor:band==='early'?'actual keyboard/CDP touch changing input':'research-only causal actor, based on already published witness (new) or visible wave (old); no future tape',viewport,experimental,mobile,readyMs,frames:stats(raw.frames.slice(1).map(f=>f.ms)),startupFrames:stats(raw.frames.slice(1).filter(f=>f.elapsed<1).map(f=>f.ms)),steadyFrames:stats(raw.frames.slice(1).filter(f=>f.elapsed>=1&&f.state==='PLAYING').map(f=>f.ms)),activeFrames:stats(activeFrames.map(f=>f.ms)),stepCpu:stats(raw.steps.map(s=>s.ms)),renderCpu:stats(raw.renders),
    schedulerTotalMs:raw.steps.reduce((n,s)=>n+s.schedulerMs,0),chunks:stats(samples.filter(s=>!['ready','failed','actual-gate'].includes(s.phase)).map(s=>s.ms)),actualGate:stats(samples.filter(s=>s.phase==='actual-gate').map(s=>s.ms)),
    inputLatency:stats(raw.inputLatency.map(v=>v.ms)),maxActive:raw.steps.reduce((n,s)=>Math.max(n,s.active),0),maxPending:raw.steps.reduce((n,s)=>Math.max(n,Number(s.pending)),0),
    longTasks:raw.longTasks.map(t=>({...t,overlappingSchedulerMs:raw.steps.filter(s=>s.start<t.start+t.ms&&s.end>t.start).reduce((n,s)=>n+s.schedulerMs,0)})),
    firstVisible:raw.firstVisible,firstNear:raw.firstNear,firstHit:raw.firstHit,elapsed:raw.elapsed,distance:raw.distance,state:raw.state,hull:raw.hull,hits:raw.hits,audio:raw.audio,gpu:raw.gpu,pixelRatio:raw.pixelRatio,field:raw.field,renderer:raw.renderer,errors};
   assert.deepEqual(errors,[]);if(experimental){assert.equal(raw.field.fault,undefined);assert.ok(raw.field.committed>0&&raw.field.known<=32);assert.equal(raw.audio,'running');}
   await page.locator('#pause').click();const paused=await page.evaluate(()=>{const m=window.spaceRunner.model;return{elapsed:m.elapsed,ticks:m.field.planningTicks??null,distance:m.distance};});await page.waitForTimeout(250);
   assert.deepEqual(await page.evaluate(()=>{const m=window.spaceRunner.model;return{elapsed:m.elapsed,ticks:m.field.planningTicks??null,distance:m.distance};}),paused);
   await page.locator('#resume').click();await page.waitForTimeout(100);summary.pause={before:paused,after:await page.evaluate(()=>({elapsed:window.spaceRunner.model.elapsed,state:window.spaceRunner.model.state})),verified:true};
   if(experimental&&!mobile&&band==='early'){
    // Memory stress is separate from real-time performance. Match the exact
    // pending-job phase; warm UI/audio/JIT before taking the baseline.
    await page.evaluate(()=>window.spaceRunner.loop.stop());
    async function restart(){await page.evaluate(()=>{const g=window.spaceRunner;g.runtimeOldPending=g.model.field.pending;g.model.state='GAME_OVER';g.syncState();});await page.locator('#replay').click();
     await page.evaluate(()=>{const g=window.spaceRunner;for(let i=0;i<20;i++)g.model.step(1/120,{x:0,y:0});g.loop.render(1/60);});
     assert.equal(await page.evaluate(()=>!window.spaceRunner.runtimeOldPending||window.spaceRunner.runtimeOldPending.getResult()?.reason==='CANCELLED'),true);await page.evaluate(()=>delete window.spaceRunner.runtimeOldPending);}
    for(let i=0;i<5;i++)await restart();
    await cdp.send('HeapProfiler.collectGarbage');const baseline=await cdp.send('Runtime.getHeapUsage'),before=await resources(page),snapshots=[];
    for(let i=0;i<10;i++){
     await restart();
     if((i+1)%5===0){await cdp.send('HeapProfiler.collectGarbage');snapshots.push({restarts:i+1,heap:await cdp.send('Runtime.getHeapUsage'),resources:await resources(page)});}
    }
    const after=await resources(page);assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);assert.equal(after.windowListeners,before.windowListeners);assert.equal(after.canvasListeners,before.canvasListeners);assert.equal(after.slots,72);
    summary.restartMemory={method:'After real performance run:5 warmups then10 engineered GAME_OVER→real Replay actions, with loop stopped ONLY for this separate memory stress. Every sample is after exactly20 real120Hz steps and a real rendered frame, one pending job. Native CDP GC/heap, renderer resources/listeners. Natural destruction is covered separately by playable tests.',baseline,before,snapshots,after,retainedDelta:snapshots.at(-1).heap.usedSize-baseline.usedSize};
    await page.evaluate(()=>window.spaceRunner.loop.start());
    summary.video=await recordCanvas(page,root);if(summary.video.produced)summary.video.decoding=await verifyCanvasVideo(browser,root);
   }
   await writeFile(join(output,name+'-raw.json'),JSON.stringify(raw,null,2)+'\n');cases.push(summary);await context.close();console.log(`Rendered ${name}: ${summary.frames.p50.toFixed(2)}/${summary.frames.p95.toFixed(2)}/${summary.frames.max.toFixed(2)}ms median/p95/max; ${raw.field.committed??'wave'} commits.`);
  }
  // Production URL must remain an ordinary wave game, with no exposed dev model.
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5194/?debug=field&seed=42');await page.locator('#launch').click();assert.equal(await page.evaluate(()=>window.spaceRunner),undefined);await page.close();
  const startupInvestigation=await inspectStartup(browser,output);
  const result={generatedAt:new Date().toISOString(),browser:browser.version(),cases,startupInvestigation,productionDebugGlobalAbsent:true,
   methodology:'Eight12s real-time render/audio runs. Four early cases use actual matched keyboard/CDP touch sequences. Four established cost cases reach D4200 through accelerated actual120Hz causal histories, then run the original RAF loop in real time with a source-specific causal reference actor; they are not matched human-input comparisons. No stopped loop or accelerated ticks during performance samples. Complete launch frame maxima coexist with separately labeled post1s/established intervals. First center-frustum/fog190 is a visibility proxy, not human legibility. Mobile is emulation. Long-task overlaps do not uniquely attribute an entire task to generation.'};
  await writeFile(join(output,'runtime-browser.json'),JSON.stringify(result,null,2)+'\n');return result;
 }finally{await browser?.close();for(const server of servers)server.kill();}
}

async function resources(page){
 const cdp=await page.context().newCDPSession(page),counts={};
 for(const [name,expression]of[['windowListeners','window'],['canvasListeners','document.querySelector("#flight")']]){const remote=await cdp.send('Runtime.evaluate',{expression});const r=await cdp.send('DOMDebugger.getEventListeners',{objectId:remote.result.objectId});counts[name]=r.listeners.length;await cdp.send('Runtime.releaseObject',{objectId:remote.result.objectId});}
 await cdp.detach();return{...counts,...await page.evaluate(()=>{const g=window.spaceRunner;return{...g.world.renderer.info.memory,slots:g.model.field.hazards.length,pending:Number(!!g.model.field.pending),records:g.model.field.ledger.snapshot().length,samples:g.model.field.samples.length,events:g.model.field.events.length,audio:g.audio.status};})};
}
async function prepareEstablished(page,experimental){
 await page.evaluate(experimental=>{
  const g=window.spaceRunner,m=g.model;g.loop.stop();
  const control=()=>{if(experimental){const w=m.field.certificate;if(!w)return{x:0,y:0};let tick=Math.round((m.elapsed-w.context.elapsed)*120);for(const r of w.controls){if(tick<r.ticks)return r.input;tick-=r.ticks;}return{x:0,y:0};}
   const wave=m.field.waves.filter(w=>w.active&&w.z<=2).sort((a,b)=>b.z-a.z)[0];const target=wave?.safeX??m.ship.x;return{x:Math.max(-1,Math.min(1,(target-m.ship.x)*2-m.ship.vx*.35)),y:0};};
  g.runtimeActor=control;Object.defineProperty(g.input,'axis',{configurable:true,get:control});
 },experimental);
 for(let batch=0;batch<400;batch++){
  const done=await page.evaluate(()=>{const g=window.spaceRunner,m=g.model;for(let i=0;i<240&&m.distance<4200&&m.state==='PLAYING';i++)m.step(1/120,g.runtimeActor());g.loop.render(1/60);if(m.state==='GAME_OVER')throw new Error('Causal prehistory actor died before established performance window');return m.distance>=4200;});
  if(done){await page.evaluate(()=>window.spaceRunner.loop.start());return;}
 }
 throw new Error('Bounded established prehistory did not finish');
}
async function inspectStartup(browser,output){
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5193/?debug=field&seed=42');await page.locator('#launch').waitFor({state:'visible'});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await page.locator('#launch').click();await page.waitForTimeout(1600);
 const {profile}=await cdp.send('Profiler.stop');await cdp.send('Profiler.disable');await page.close();
 await writeFile(join(output,'runtime-startup-cpu.json'),JSON.stringify(profile,null,2)+'\n');
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),weights=new Map();
 for(let i=0;i<(profile.samples?.length??0);i++){const id=profile.samples[i];weights.set(id,(weights.get(id)??0)+(profile.timeDeltas?.[i]??0)/1000);}
 const top=[...weights].map(([id,selfMs])=>({selfMs,frame:nodes.get(id).callFrame})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,24);
 return{method:'Separate actual Launch CPU sampling in Chrome after the frame runs; self-time samples identify synchronous initialization code, without changing audio or gameplay.',top};
}
async function recordCanvas(page,root){
 const supported=await page.evaluate(()=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported('video/webm;codecs=vp8'));
 if(!supported)return{produced:false,reason:'Native VP8 MediaRecorder unavailable'};
 await page.evaluate(()=>{const stream=document.querySelector('#flight').captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1200000});window.runtimeRecording={stream,chunks,recorder};recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(500);});
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(2200);await page.keyboard.up('ArrowRight');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(2200);await page.keyboard.up('ArrowLeft');await page.waitForTimeout(3000);
 const data=await page.evaluate(()=>new Promise(resolve=>{const r=window.runtimeRecording;r.recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(r.chunks,{type:'video/webm'}).arrayBuffer());r.stream.getTracks().forEach(t=>t.stop());delete window.runtimeRecording;resolve(Array.from(bytes));};r.recorder.stop();}));
 const bytes=Buffer.from(data),file='runtime-flight-canvas.webm';assert.ok(bytes.length>1024);await writeFile(join(root,'test-results',file),bytes);
 return{produced:true,file,bytes:bytes.length,note:'Actual native canvas capture (~7.4s), VP8 WebM, silent and canvas-only. DOM HUD is represented in actual screenshots; no synthetic frames.'};
}
export async function verifyCanvasVideo(browser,root){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 try{
  await page.goto('http://127.0.0.1:5193/tests/browser/trajectory-harness.html');
  await page.setContent('<html><body style="margin:0;background:#000"><video id="recorded" style="width:1280px;height:800px" muted autoplay playsinline src="/test-results/runtime-flight-canvas.webm"></video></body></html>');
  await page.locator('video').evaluate(v=>v.play());await page.waitForTimeout(2200);
  const first=await frameHash(page);await page.screenshot({path:join(root,'test-results/runtime-video-frame.png')});await page.waitForTimeout(2500);const second=await frameHash(page);
  assert.ok(first.width>0&&first.time>0);assert.notEqual(first.hash,second.hash,'Recorded video must contain actual changing frames');
  return{first,second,verified:true};
 }finally{await page.close();}
}
async function frameHash(page){return page.evaluate(()=>{const v=document.querySelector('video'),c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d');ctx.drawImage(v,0,0);let hash=2166136261;const p=ctx.getImageData(0,0,c.width,c.height).data;for(let i=0;i<p.length;i+=16)hash=Math.imul(hash^p[i],16777619);return{time:v.currentTime,width:v.videoWidth,height:v.videoHeight,hash:(hash>>>0).toString(16)};});}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runtimeBrowser(resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-001B-5A/browser-precommit'));
