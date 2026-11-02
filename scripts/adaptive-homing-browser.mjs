import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {stats} from './director-fields.mjs';
import {analyzeHoming} from './adaptive-homing-analysis.mjs';

const smoke=process.argv.includes('--smoke'),output=resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-EXPERIMENT-003C4/final');
await mkdir(output,{recursive:true});await mkdir('test-results',{recursive:true});
const base='http://127.0.0.1:5201/',server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5201','--strictPort'],{windowsHide:true,stdio:'ignore'});
const screenshots=[],videos=[],results=[],stages=[],demonstrations=[];let browser;
const url=(policy='balanced',seed=42,extra='')=>base+'?debug=field&experiment=moving-mine&firstMine=1&seed='+seed+'&motion='+(policy==='target-lock'?'target-lock':'adaptive-homing&homing='+policy)+extra;
async function contextFor(name){return browser.newContext({viewport:name==='portrait'?{width:390,height:844}:name==='landscape'?{width:844,height:390}:{width:1280,height:800},deviceScaleFactor:name==='desktop'?1:2,isMobile:name!=='desktop',hasTouch:name!=='desktop'});}
async function shot(page,name){await page.screenshot({path:'test-results/'+name});screenshots.push(name);}
async function record(page){await page.evaluate(()=>{const stream=document.querySelector('#flight').captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1500000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(500);window.homingVideo={stream,chunks,recorder,startedAt:performance.now()};});}
async function stopVideo(page,filename){
 const data=await page.evaluate(()=>new Promise(done=>{const v=window.homingVideo;v.recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>done({base64:reader.result.split(',')[1],startedAt:v.startedAt});reader.readAsDataURL(new Blob(v.chunks,{type:'video/webm'}));v.stream.getTracks().forEach(t=>t.stop());};v.recorder.stop();}));
 const bytes=Buffer.from(data.base64,'base64');await writeFile('test-results/'+filename,bytes);
 const decoder=await page.context().newPage();await decoder.goto(base+'tests/browser/trajectory-harness.html');await decoder.setContent(`<video muted src="/test-results/${filename}"></video>`);await decoder.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const decoded=[];for(const time of [2,6])decoded.push(await decoder.evaluate(time=>new Promise(done=>{const v=document.querySelector('video');v.onseeked=()=>{const c=document.createElement('canvas');c.width=160;c.height=100;const ctx=c.getContext('2d');ctx.drawImage(v,0,0,160,100);let h=2166136261;for(const b of ctx.getImageData(0,0,160,100).data)h=Math.imul(h^b,16777619);done({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,hash:h>>>0});};v.currentTime=time;}),time));
 assert.notEqual(decoded[0].hash,decoded[1].hash);await decoder.close();await page.bringToFront();const row={filename,bytes:bytes.length,decoded,startedAt:data.startedAt,captureFps:30,poseTimeMapping:'Approximate video seconds=(RAF time-startedAt)/1000. Simulation ticks are authoritative. Canvas only, no HUD/audio.'};videos.push(row);return row;
}
async function instrument(page,actor='horizontal'){
 await page.evaluate(actor=>{
  const g=window.spaceRunner,m=g.model,step=m.step.bind(m),p=window.homingProfile={frames:[],steps:[],poses:[],publications:[],validations:[],jobStarts:new Map(),longTasks:[],last:performance.now(),active:true,first:null,inputEvents:[]};
  Object.defineProperty(g.input,'axis',{configurable:true,get:()=>{
   const tick=Math.round(m.elapsed*120);p.first??=m.homing?.encounters[0];let x=0;
   if(actor==='horizontal')x=Math.floor(tick/180)%2?-1:1;
   else if(p.first){const h=p.first.motion;
    if(actor==='bait')x=tick<h.passTick-232?0:tick<h.passTick-160?1:-1;
    else if(actor==='tracking')x=tick<h.startTick?0:tick<h.startTick+120?1:tick<h.startTick+240?-1:1;
    else if(actor==='collision')x=tick<h.startTick?0:tick<h.passTick-30?1:-1;
   }
   if(x!==p.lastInput){p.lastInput=x;p.inputEvents.push({tick,x,ship:{x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy},mine:m.homing?.current});}return{x,y:0};
  }});
  m.step=(dt,axis)=>{const start=performance.now(),before=m.field.planningTicks,id=m.field.pending?.section.id;if(id&&!p.jobStarts.has(id))p.jobStarts.set(id,start);step(dt,axis);if(p.active){p.steps.push({start,ms:performance.now()-start,elapsed:m.elapsed,chunk:m.field.planningTicks>before?{...m.field.samples.at(-1)}:null});const next=m.field.pending?.section.id;if(next&&!p.jobStarts.has(next))p.jobStarts.set(next,start);if(m.field.lastOutcome&&m.field.lastOutcome!==p.lastOutcome){p.lastOutcome=m.field.lastOutcome;p.publications.push(m.field.lastOutcome);p.validations.push({section:m.field.lastOutcome.section.id,wallMs:performance.now()-(p.jobStarts.get(m.field.lastOutcome.section.id)??start),metrics:m.field.lastOutcome.metrics});}}};
  const observer=new PerformanceObserver(list=>{if(p.active)p.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})));});observer.observe({type:'longtask'});
  const frame=time=>{if(!p.active)return;const info=g.world.renderer.info;p.frames.push({time,ms:time-p.last,elapsed:m.elapsed,state:m.state,calls:info.render.calls,triangles:info.render.triangles,active:m.field.slots.filter(s=>s.active).length});p.last=time;
   const h=m.field.slots.find(s=>s.active&&s.kind===9),mesh=g.world.collisionDebug.root.getObjectByName('moving-space-mine');
   if(h){const camera=g.world.camera,projected=mesh.position.clone().project(camera),cameraPoint=mesh.position.clone().applyMatrix4(camera.matrixWorldInverse),s=m.homing?.current;
    p.poses.push({time,tick:Math.round(m.elapsed*120),distance:m.distance,id:h.planned.id,x:h.x,y:h.y,z:h.z,planned:h.planned,homing:s,ship:{x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy},input:{...g.input.axis},visible:mesh.visible,
     projectedX:projected.x,projectedY:projected.y,projectedDiameterPixels:2*h.radius*g.world.renderer.domElement.clientHeight/(2*Math.tan(camera.fov*Math.PI/360)*-cameraPoint.z),inFrustum:Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1&&projected.z>=-1&&projected.z<=1,cameraDistance:mesh.position.distanceTo(camera.position),renderedX:mesh.position.x,renderedY:mesh.position.y,renderedZ:mesh.position.z});
   }requestAnimationFrame(frame);
  };requestAnimationFrame(frame);p.stop=()=>{p.active=false;observer.disconnect();m.step=step;delete g.input.axis;g.loop.stop();};
 },actor);
}
async function raw(page){return page.evaluate(()=>{const g=window.spaceRunner,m=g.model,p=window.homingProfile;p.stop();const arrays=new Set();for(const geo of g.assets.resources.geometries)for(const a of [...Object.values(geo.attributes),geo.index].filter(Boolean))arrays.add(a.isInterleavedBufferAttribute?a.data.array:a.array);
 return{frames:p.frames,steps:p.steps,poses:p.poses,publications:p.publications,validations:p.validations,longTasks:p.longTasks,inputEvents:p.inputEvents,first:p.first,feedback:m.homing?.trace(),elapsed:m.elapsed,distance:m.distance,state:m.state,hull:m.hull,hits:m.hitSerial,fault:m.field.fault,committed:m.field.committed,omitted:m.field.omitted,events:m.field.events,
 assets:{geometries:g.assets.resources.geometries.size,materials:g.assets.resources.materials.size,textures:g.assets.resources.textures.size,typedArrayBytes:[...arrays].reduce((n,a)=>n+a.byteLength,0)},resources:{...g.world.renderer.info.memory,calls:g.world.renderer.info.render.calls,triangles:g.world.renderer.info.render.triangles,programs:g.world.renderer.info.programs.length}};});}
async function restart(page,cdp){
 await page.evaluate(()=>{const g=window.spaceRunner,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);g.world.reset();for(let n=0;n<970;n++)m.step(1/120,{x:0,y:1});for(let n=0;n<20;n++)g.loop.render(1/60);});await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');
 return page.evaluate(heap=>{const g=window.spaceRunner,f=g.model.field;return{memory:{...g.world.renderer.info.memory},programs:g.world.renderer.info.programs.length,slots:f.slots.length,records:f.ledger.snapshot().length,activeMines:f.slots.filter(s=>s.active&&s.kind===9).length,requests:g.assets.requests,traceSamples:g.model.homing?.samples.length,heap};},heap);
}
async function micro(page,adaptive){return page.evaluate(async adaptive=>{
 const {mineX,mineY}=await import('/src/experiments/moving-mine/motion.ts'),{movingMineHit}=await import('/src/experiments/moving-mine/collision.ts'),{initialAdaptiveState,stepAdaptiveMine}=await import('/src/experiments/adaptive-homing/controller.ts'),{adaptiveHit}=await import('/src/experiments/adaptive-homing/prediction.ts');
 const h=window.homingProfile.poses[0]?.planned;if(!h)throw Error('No mine for microbenchmark');let state=adaptive?initialAdaptiveState(h):undefined;const updates=[],queries=[];let checksum=0;
 for(let batch=0;batch<25;batch++){let start=performance.now();for(let n=0;n<1000;n++){if(adaptive){state=stepAdaptiveMine({...state,tick:h.motion.startTick+n%240},{x:Math.sin(n/100)*4,y:0},h.motion);checksum+=state.x;}else checksum+=mineX(h,(h.motion.startTick+n%h.motion.durationTicks)/120)+mineY(h,(h.motion.startTick+n%h.motion.durationTicks)/120);}const update=performance.now()-start;
  const a={x:0,y:0,vx:0,vy:0,elapsed:h.motion.startTick/120,distance:h.passDistance,...(adaptive?{homing:state}:{})},b={...a,x:.05,elapsed:a.elapsed+1/120,distance:a.distance+20/120,...(adaptive?{homing:{...state,x:state.x+.01,tick:state.tick+1}}:{})};start=performance.now();for(let n=0;n<1000;n++){a.x=n%240/20-6;b.x=a.x+.05;checksum+=+(adaptive?adaptiveHit(a,b,h,.15):movingMineHit(a,b,h,.15));}const query=performance.now()-start;if(batch>=5){updates.push(update);queries.push(query);}}
 return{updateMsPer1000:updates,ccdMsPer1000:queries,checksum,note:'Isolated browser loop with five warmup batches excluded; not aggregate per-frame cost.'};
 },adaptive);}
try{
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 const cases=smoke?[['balanced','desktop',true]]:[['target-lock','desktop',true],['soft','desktop',true],['balanced','desktop',true],['aggressive','desktop',true],['balanced','portrait',true],['balanced','landscape',true],['target-lock','desktop',false],['balanced','desktop',false]];
 for(const[policy,viewport,capture]of cases){
  await browser?.close();browser=await chromium.launch({channel:'chrome',headless:true});const context=await contextFor(viewport),page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));page.on('request',r=>{if(r.url().includes('.glb'))requests.push(r.url());});
  await page.goto(url(policy));await page.locator('#launch').waitFor({state:'visible'});const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');await instrument(page);
  if(capture)await record(page);await page.locator('#launch').click();await page.waitForTimeout(smoke?8000:capture?45000:20000);const r=await raw(page),label=policy+(capture?'':'-unrecorded');const{profile}=await cdp.send('Profiler.stop');await cdp.send('Profiler.disable');await writeFile(join(output,`homing-${label}-${viewport}-cpu.json`),JSON.stringify(profile));
  assert.deepEqual(errors,[]);assert.equal(r.fault,undefined);assert.equal(requests.length,7);const chunks=r.steps.filter(s=>s.chunk).map(s=>s.chunk);for(const c of chunks)assert.ok(c.propagations<=3072&&c.queries<=6144);
  assert.ok(r.poses.length>30);for(const p of r.poses){assert.equal(p.x,p.renderedX);assert.equal(p.y,p.renderedY);assert.equal(p.z,p.renderedZ);if(p.homing){assert.equal(p.homing.targetX,p.ship.x);assert.equal(p.homing.targetY,p.ship.y);assert.equal(p.x,p.homing.x);assert.equal(p.y,p.homing.y);}}
  const summary={policy,viewport,recorded:capture,processIsolation:'Fresh Chrome process per profile; CPU sampler1ms',frameMs:stats(r.frames.slice(1).map(f=>f.ms)),playingMs:stats(r.frames.filter(f=>f.state==='PLAYING').map(f=>f.ms)),coldMs:stats(r.frames.slice(1).filter(f=>f.elapsed<2).map(f=>f.ms)),warmMs:stats(r.frames.filter(f=>f.state==='PLAYING'&&f.elapsed>=2).map(f=>f.ms)),matched20sMs:stats(r.frames.filter(f=>f.state==='PLAYING'&&f.elapsed>=2&&f.elapsed<20).map(f=>f.ms)),plannerMs:stats(chunks.filter(c=>c.propagations||c.queries).map(c=>c.ms)),gateMs:stats(chunks.filter(c=>c.phase==='actual-gate').map(c=>c.ms)),resolutionMs:stats(r.publications.filter(o=>o.resolution).map(o=>o.resolution.ms)),longTasks:r.longTasks,state:r.state,hull:r.hull,distance:r.distance,committed:r.committed,omitted:r.omitted,resources:r.resources,assets:r.assets,requests,errors,maximumDrawCalls:Math.max(...r.frames.map(f=>f.calls)),maximumTriangles:Math.max(...r.frames.map(f=>f.triangles))};
  summary.visibility=[...new Set(r.poses.map(p=>p.id))].map(id=>{const ps=r.poses.filter(p=>p.id===id),first=ps[0],m=first.planned.motion,sample=pixels=>ps.find(p=>p.visible&&p.inFrustum&&p.cameraDistance<190&&p.projectedDiameterPixels>=pixels);return{id,firstRendered:first,first4PixelProxy:sample(4),first12PixelProxy:sample(12),warningTick:m.warningTick,activationTick:m.startTick,passTick:m.passTick,lastRendered:ps.at(-1),visiblePursuitFrames:ps.filter(p=>p.visible&&p.inFrustum&&p.homing?.phase==='pursuit').length,note:'Projection/fog/frustum proxies are not human recognition measurements.'};});
  summary.fullValidationWallMs=stats(r.validations.map(v=>v.wallMs));summary.outliers=r.frames.filter(f=>f.ms>=30).map(f=>({...f,overlappingSteps:r.steps.filter(s=>s.start<=f.time&&s.start+s.ms>=f.time-f.ms),overlappingLongTasks:r.longTasks.filter(t=>t.start<=f.time&&t.start+t.ms>=f.time-f.ms)}));
  if(capture)summary.video=await stopVideo(page,`homing-${label}-${viewport}.webm`);await shot(page,`homing-${label}-${viewport}-live.png`);summary.micro=await micro(page,policy!=='target-lock');
  for(let n=0;n<5;n++)await restart(page,cdp);const before=await restart(page,cdp),samples=[];assert.equal(before.activeMines,1);for(let n=0;n<10;n++){const s=await restart(page,cdp);assert.deepEqual({...s,heap:undefined},{...before,heap:undefined});samples.push(s);}summary.restarts={before,samples,retainedHeapDelta:samples.at(-1).heap.usedSize-before.heap.usedSize};assert.equal(requests.length,7);
  if(policy==='balanced'&&viewport==='desktop'&&capture){
   await page.evaluate(async()=>{window.jobAuditModules={v:await import('/src/core/field-validator.ts'),a:await import('/src/experiments/adaptive-homing/transaction.ts')};});await cdp.send('HeapProfiler.collectGarbage');const beforeHeap=await cdp.send('Runtime.getHeapUsage');
   const jobs=await page.evaluate(()=>{const{v,a}=window.jobAuditModules,root={player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:1,distance:20},candidate=a.adaptiveTransaction(42,4,root),context={...root,committed:[],candidate,reservedUntilDistance:candidate.endDistance};window.auditJobs=Array.from({length:30},()=>{const j=v.beginKnownFieldValidation(context,{geometry:a.ADAPTIVE_GEOMETRY});j.advance({propagations:3072,narrowQueries:6144});return j;});return window.auditJobs.map(j=>({metrics:j.metrics,finished:!!j.getResult()}));});await cdp.send('HeapProfiler.collectGarbage');const duringHeap=await cdp.send('Runtime.getHeapUsage');await page.evaluate(()=>{delete window.auditJobs;delete window.jobAuditModules;});await cdp.send('HeapProfiler.collectGarbage');const afterHeap=await cdp.send('Runtime.getHeapUsage');summary.jobMemory={beforeHeap,duringHeap,afterHeap,jobs,retainedBytesPerJob:(duringHeap.usedSize-beforeHeap.usedSize)/30,note:'Thirty retained partly-advanced full-beam jobs, forced GC at each sample. Includes immutable contexts, branch state, frontier and generator storage; finite noisy estimate, not allocator attribution.'};
  }
  await writeFile(join(output,`homing-${label}-${viewport}-raw.json`),JSON.stringify(r));results.push(summary);console.log(JSON.stringify({policy,viewport,recorded:capture,warm:summary.warmMs,planner:summary.plannerMs,heap:summary.restarts.retainedHeapDelta}));await context.close();
 }
 // Actual fixed-step stage captures. No teleport, health override or removed debris.
 for(const viewport of ['desktop','portrait','landscape']){
  const context=await contextFor(viewport),page=await context.newPage();await page.goto(url('balanced',43,viewport==='desktop'?'&colliders=1':''));await page.locator('#launch').click();
  await page.evaluate(()=>{const g=window.spaceRunner,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(43);g.world.reset();window.stageSteps=0;});
  for(const[label,lead]of [['warning',420],['tracking-right',161],['reverse-input',160],['inertia',110],['heading-correction',8],['evasion',-30]]){
   const state=await page.evaluate(lead=>{const g=window.spaceRunner,m=g.model;let first=m.homing.encounters[0];while(!first){m.step(1/120,{x:0,y:0});first=m.homing.encounters[0];if(++window.stageSteps>4000)throw Error('No first mine');}
    while(Math.round(m.elapsed*120)<first.motion.passTick-lead){const t=Math.round(m.elapsed*120),x=t<first.motion.passTick-232?0:t<first.motion.passTick-160?1:-1;m.step(1/120,{x,y:0});if(++window.stageSteps>4000||m.state!=='PLAYING')throw Error('Stage failed');}for(let n=0;n<20;n++)g.loop.render(1/60);
    return{tick:Math.round(m.elapsed*120),distance:m.distance,hull:m.hull,hits:m.hitSerial,ship:{...m.ship},mine:m.homing.current,metadata:first,geometry:m.field.slots.filter(s=>s.active).map(s=>({kind:s.kind,x:s.x,y:s.y,z:s.z})),info:document.querySelector('#moving-mine-info').textContent};},lead);
   const filename=`homing-${viewport}-${label}.png`;await shot(page,filename);stages.push({screenshot:filename,...state});if(label==='evasion')assert.equal(state.hull,3);
  }await context.close();
 }
 for(const actor of ['tracking','bait','collision']){
  const context=await contextFor('desktop'),page=await context.newPage();await page.goto(url('balanced',actor==='collision'?42:43));await page.locator('#launch').waitFor({state:'visible'});await instrument(page,actor);await record(page);await page.locator('#launch').click();
  await page.waitForFunction(()=>window.homingProfile.first&&window.spaceRunner.model.distance>window.homingProfile.first.passDistance+6,{},{timeout:30000});const r=await raw(page);assert.equal(r.fault,undefined);assert.ok(r.feedback.samples.length>200);
  if(actor==='bait'){
   assert.equal(r.hull,3);assert.equal(r.hits,0);const reversal=r.inputEvents.find(e=>e.x===-1);assert.ok(reversal.ship.vx>6&&reversal.mine.vx>.3);const after=r.feedback.samples.filter(s=>s.tick>=reversal.tick),peak=Math.max(...after.map(s=>s.mine.x)),corrected=after.find(s=>s.mine.vx<0);
   assert.ok(corrected);r.baitEvidence={reversal,overshoot:peak-reversal.mine.x,correctionDelay:(corrected.tick-reversal.tick)/120,oppositeVelocityTicks:after.filter(s=>s.ship.vx<-.3&&s.mine.vx>.3).length};assert.ok(r.baitEvidence.overshoot>.25&&r.baitEvidence.correctionDelay>.25&&r.baitEvidence.oppositeVelocityTicks>15);
  }else if(actor==='collision'){assert.equal(r.hull,2);assert.equal(r.hits,1);}else{assert.ok(r.feedback.samples.some(s=>s.input.x===1)&&r.feedback.samples.some(s=>s.input.x===-1));assert.ok(r.feedback.samples.some(s=>s.mine.vx>.3)&&r.feedback.samples.some(s=>s.mine.vx<-.3));}
  const video=await stopVideo(page,`homing-demo-${actor}.webm`);await shot(page,`homing-demo-${actor}.png`);await writeFile(join(output,`homing-demo-${actor}-trace.json`),JSON.stringify(r));demonstrations.push({actor,video,hull:r.hull,hits:r.hits,baitEvidence:r.baitEvidence,inputEvents:r.inputEvents});await context.close();
 }
 await writeFile(join(output,smoke?'adaptive-homing-browser-smoke.json':'adaptive-homing-browser.json'),JSON.stringify({smoke,results,videos,screenshots,stages,demonstrations,note:'Actual Three.js canvas captures and authoritative120Hz states. Scripted causal input actors use only elapsed tick and already-published descriptor, no witness/future path, teleport or health override. Real keyboard/CDP touch covered by browser suite. Fresh-process45s recorded /20s unrecorded profiles share1ms CPU sampling; matched simulated[2,20] window reported. Mobile is emulation. Historical C3/B3 evidence is retained; time overlap does not prove a cause for frame gaps.'},null,2)+'\n');
 if(!smoke)await analyzeHoming(output);
}finally{await browser?.close();server.kill();}
