import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const baseline=process.argv.includes('--baseline'),port=baseline?5186:5187;
const directory=resolve(`.cache/review/GAMEPLAY-005B/${baseline?'baseline':'final'}`);
await mkdir(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(baseline?['.cache/review/GAMEPLAY-005B/baseline-project']:[]),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
server.stdout.on('data',d=>process.stdout.write(d));server.stderr.on('data',d=>process.stderr.write(d));
for(let n=0;n<150;n++){try{await fetch(`http://127.0.0.1:${port}`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try {
 for(const seed of [0,11,42]) {
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
  await page.goto(`http://127.0.0.1:${port}/?debug=integrated&seed=${seed}`,{waitUntil:'domcontentloaded'});await page.locator('#launch').waitFor();await page.evaluate(()=>{window.visualLaunch=performance.now();});await page.locator('#launch').click();
  const result=await page.evaluate(async()=>{
   const g=window.spaceRunner,m=g.model,w=g.world;
   const clockPath='/src/release/settings.ts',{flightSpeed}=await import(clockPath);
   g.loop.stop();let tick=0,frame=0,lastOutcome,lastScheduled=0,serial=0;
   const objects=[],byId=new Map(),proposals=new Map(),inputs=[],publications=[],drawn=new Set(),pixelsA=new Uint8Array(1280*800*4),pixelsB=new Uint8Array(pixelsA.length);
   const camera=w.flightCamera.camera,point=w.ship.position.clone();
   const nodeFor=(h,index)=>{
    if(h.kind===9)return w.collisionDebug.mine;
    if(h.kind>=4&&h.kind<=8){let ordinal=0;for(let i=0;i<index;i++){const s=m.field.slots[i];if(s.planned&&s.kind>=4&&s.kind<=8&&s.z<=8)ordinal++;}return w.collisionDebug.flow.instances[ordinal];}
    return w.hazards[index];
   };
   const register=(id,family,node,passDistance,x,y,radius,proposalTick,publicationTick)=>{
    if(byId.has(id))return byId.get(id);
    const row={id,family,phase:m.phase,proposalTick,publicationTick,firstActiveTick:tick,passDistance,x,y,radius,firstDraw:null,firstVisible:null,firstRecognizable:null};
    byId.set(id,row);objects.push(row);
    node.traverse(mesh=>{if(!mesh.isMesh)return;mesh.userData.visualProbeId=id;mesh.onBeforeRender=()=>drawn.add(mesh.userData.visualProbeId);});
    return row;
   };
   const sample=(row,node)=>{
    point.set(node.position.x,node.position.y,node.position.z).applyMatrix4(camera.matrixWorldInverse);
    const cameraDepth=-point.z,worldDepth=-node.position.z;
    let elapsed=m.elapsed,distance=m.distance,seconds=0;
    const leading=row.passDistance-row.radius-1.3;
    while(distance<leading&&seconds<20){elapsed+=1/120;distance+=flightSpeed(elapsed,distance,true)/120;seconds+=1/120;}
    const fog=w.scene.fog,t=Math.max(0,Math.min(1,(cameraDepth-fog.near)/(fog.far-fog.near))),visibility=1-t*t*(3-2*t);
    let minOpacity=1,maxOpacity=0,transparent=0;node.traverseVisible(n=>{if(!n.isMesh)return;for(const material of Array.isArray(n.material)?n.material:[n.material]){minOpacity=Math.min(minOpacity,material.opacity);maxOpacity=Math.max(maxOpacity,material.opacity);if(material.transparent)transparent++;}});
    const focal=800/(2*Math.tan(camera.fov*Math.PI/360));
    return{tick,frame,world:{x:node.position.x,y:node.position.y,z:node.position.z},cameraDepth,worldDepth,insideFrustum:drawn.has(row.id),
     speed:m.speed,secondsToLeadingCollision:seconds,secondsToCenter:Math.max(0,worldDepth)/m.speed,legacyFogContrast:visibility,
     projectedDiameterPx:2*row.radius*focal/Math.max(1,cameraDepth),opacity:maxOpacity,materialOpacity:{min:minOpacity,max:maxOpacity,transparentParts:transparent},
     reveal:typeof w.reveal?.diagnostic==='function'?w.reveal.diagnostic(row.id):null};
   };
   const pixelDifference=node=>{
    const gl=w.renderer.getContext();gl.readPixels(0,0,1280,800,gl.RGBA,gl.UNSIGNED_BYTE,pixelsA);
    const visible=node.visible;node.visible=false;w.renderer.render(w.scene,camera);gl.readPixels(0,0,1280,800,gl.RGBA,gl.UNSIGNED_BYTE,pixelsB);
    node.visible=visible;w.renderer.render(w.scene,camera);
    let changed=0,maxDelta=0;for(let i=0;i<pixelsA.length;i+=4){const d=Math.max(Math.abs(pixelsA[i]-pixelsB[i]),Math.abs(pixelsA[i+1]-pixelsB[i+1]),Math.abs(pixelsA[i+2]-pixelsB[i+2]));if(d>3)changed++;maxDelta=Math.max(maxDelta,d);}
    return{changedPixels:changed,maxChannelDelta:maxDelta};
   };
   const active=[];
   while(m.state==='PLAYING'&&m.distance<1500){
    m.beginPlanningFrame();
    for(let n=0;n<2;n++){
     const c=m.field.certificate;let at=c?Math.round((m.elapsed-c.context.elapsed)*120):0,input={x:0,y:0};
     for(const r of c?.controls??[]){if(at<r.ticks){input=r.input;break;}at-=r.ticks;}
     inputs.push({...input});m.step(1/120,input);tick++;
     if(m.field.scheduled!==lastScheduled){lastScheduled=m.field.scheduled;proposals.set(lastScheduled-1,tick);}
     const o=m.field.lastOutcome;if(o&&o!==lastOutcome){lastOutcome=o;
      publications.push({index:o.section.index,tick,distance:m.distance,status:o.status,reason:o.reason,ids:o.transaction?.hazards.map(h=>h.id),witness:o.witness?.hash});
      if(o.status==='committed')for(const h of o.transaction.hazards){const index=m.field.slots.findIndex(s=>s.planned?.id===h.id);
       const family=h.kind===9?'mine':h.kind>=4&&h.kind<=8?'station':h.kind===0?(h.radius>=.95?'large-asteroid':'asteroid'):'debris';
       register(h.id,family,nodeFor(h,index),h.passDistance,h.x,h.y,h.radius,proposals.get(o.section.index)??tick,tick);}
     }
     if(m.fragments.stats.placed>serial){serial=m.fragments.stats.placed;for(let i=0;i<m.fragments.slots.length;i++){const p=m.fragments.slots[i].proposal;if(p&&!byId.has(p.id))register(p.id,'fragment',w.fragments.meshes[i],p.passDistance,p.x,p.y,.6,tick,tick);}}
     if(m.field.fault)throw Error(m.field.fault);
    }
    m.finishPlanningFrame(1/60);frame++;drawn.clear();g.loop.render(1/60);camera.updateMatrixWorld();
    active.length=0;
    for(let i=0;i<m.field.slots.length;i++){const h=m.field.slots[i];if(h.active&&h.planned)active.push([byId.get(h.planned.id),nodeFor(h,i)]);}
    for(let i=0;i<m.fragments.slots.length;i++){const p=m.fragments.slots[i].proposal;if(p)active.push([byId.get(p.id),w.fragments.meshes[i]]);}
    for(const [row,node]of active){
     if(!row||row.firstRecognizable||!node.visible||!drawn.has(row.id))continue;
     if(!row.firstDraw)row.firstDraw=sample(row,node);
     // Exact first draw, then every fourth render frame until recognizable.
     if(row.firstDraw.frame!==frame&&frame%4!==0)continue;
     const s=sample(row,node),pixel=pixelDifference(node);s.pixel=pixel;
     if(!row.firstVisible&&pixel.changedPixels>=2&&pixel.maxChannelDelta>=5)row.firstVisible=s;
     const aperturePixels=5.6*800/(2*Math.tan(camera.fov*Math.PI/360))/Math.max(1,s.cameraDepth);
     if(pixel.changedPixels>=16&&pixel.maxChannelDelta>=24&&s.projectedDiameterPx>=6&&(row.family!=='station'||aperturePixels>=12))row.firstRecognizable={...s,aperturePixels:row.family==='station'?aperturePixels:undefined};
    }
   }
   const resources=performance.getEntriesByType('resource').filter(r=>r.name.includes('.glb')).map(r=>({name:r.name,responseEnd:r.responseEnd}));
   return{seed:m.seed,objects,publications,inputs,distance:m.distance,hull:m.hull,phase:m.phase,resources,
    launchTime:window.visualLaunch,assetsPreloadedBeforeLaunch:resources.every(r=>r.responseEnd<=window.visualLaunch),revealFallbacks:w.reveal?.fallbackCount??0,fog:{near:w.scene.fog.near,far:w.scene.fog.far,color:w.scene.fog.color.getHex()},camera:{far:camera.far,fov:camera.fov},
    note:'Pixel contribution is an actual same-frame render-minus-same-scene-with-object-hidden probe, not a human recognition measurement. First draw is exact; later contribution probes every4 render frames. Recognizable proxy: >=16 pixels,24 channel levels,6px diameter; station aperture>=12px. No simulation edits, teleports, inserted hazards or planner changes.'};
  });
  assert.deepEqual(errors,[]);assert.equal(result.hull,3);results.push(result);
  await writeFile(`${directory}/pop-in-${seed}.json`,JSON.stringify(result,null,2));
  console.log(seed,'objects',result.objects.length,'first detectable',result.objects.filter(r=>r.firstVisible).length,'distance',result.distance.toFixed(1));
  await page.close();
 }
 await writeFile(`${directory}/pop-in-summary.json`,JSON.stringify({baseline,browser:browser.version(),runs:results.map(({inputs,objects,...r})=>({...r,objects:objects.map(o=>({id:o.id,family:o.family,phase:o.phase,proposalTick:o.proposalTick,publicationTick:o.publicationTick,firstActiveTick:o.firstActiveTick,firstDraw:o.firstDraw,firstVisible:o.firstVisible,firstRecognizable:o.firstRecognizable}))}))},null,2));
}finally{await browser.close();server.kill();}
