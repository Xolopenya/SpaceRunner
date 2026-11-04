import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Vector3 } from 'three';
import { FlightCamera, CAMERA_MODES } from '../src/camera/flight-camera.ts';

const baseline='3b63f1d9ebb25cf6d79639447a2692dfc8af5538',directory=process.env.REVIEW_RESULT_DIR??'.cache/review/CAMERA-001/final';
const names=execFileSync('git',['ls-tree','-r','--name-only',baseline,'--','src','.github'],{encoding:'utf8'}).trim().split('\n');
const protectedFiles=[];
for(const path of names.filter(p=>!['src/world.ts','src/main.ts'].includes(p))) {
 const old=execFileSync('git',['show',`${baseline}:${path}`]),raw=await readFile(path),next=path.endsWith('.glb')?raw:Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n'));assert.ok(old.equals(next),`Protected gameplay/audio/HUD/deploy source changed: ${path}`);
 protectedFiles.push({path,sha256:createHash('sha256').update(next).digest('hex')});
}
const metrics=[];
for(const mode of CAMERA_MODES) {
 const camera=new PerspectiveCamera(58,1,.1,260),rig=new FlightCamera(camera);rig.resize(1280,800);rig.reset();rig.setMode(mode);
 const times=[];for(let batch=0;batch<120;batch++){const start=performance.now();for(let i=0;i<1000;i++)rig.update(Math.sin(i*.01)*6,Math.cos(i*.01)*3.6,i/120,0,1/60);times.push((performance.now()-start)/1000);}
 times.sort((a,b)=>a-b);const p=q=>times[Math.min(times.length-1,Math.floor(times.length*q))];
 const positions=[],wingBounds=[];
 for(const x of [-6,-3,0,3,6]){rig.reset();for(let i=0;i<240;i++)rig.update(x,0,0,0,1/60);camera.updateMatrixWorld();positions.push({x,ndc:new Vector3(x,0,0).project(camera).toArray(),direction:camera.getWorldDirection(new Vector3()).toArray()});wingBounds.push([new Vector3(x-1.4,0,0).project(camera).x,new Vector3(x+1.4,0,0).project(camera).x]);}
 metrics.push({mode,updateMs:{p50:p(.5),p95:p(.95),p99:p(.99),max:times.at(-1)},positions,wingBounds,centerNdcSpan:Math.max(...positions.map(p=>p.ndc[0]))-Math.min(...positions.map(p=>p.ndc[0])),note:'120 batches x1000 scalar updates; includes Three.lookAt. Static positions settled240 frames, no impact. NDC metrics are diagnostics, not readability approval.'});
}
await mkdir(directory,{recursive:true});await writeFile(`${directory}/camera-audit.json`,JSON.stringify({baseline,protectedFiles,metrics,allocations:'FlightCamera.update creates no objects/arrays. Reuses the existing PerspectiveCamera and Three lookAt scratch objects; source inspection, not a sampled heap-allocation profiler.'},null,2));
console.log(JSON.stringify({protected:protectedFiles.length,metrics},null,2));
