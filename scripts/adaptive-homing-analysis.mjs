import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {stats} from './director-fields.mjs';

export async function analyzeHoming(output){
 const report=JSON.parse(await readFile(join(output,'adaptive-homing-browser.json'))),cases=[];
 for(const r of report.results){const label=r.policy+(r.recorded?'':'-unrecorded'),profile=JSON.parse(await readFile(join(output,`homing-${label}-${r.viewport}-cpu.json`))),nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of profile.nodes)for(const child of n.children??[])parents.set(child,n.id);
  const self=new Map(),inclusive=new Map();for(let i=0;i<(profile.samples??[]).length;i++){const id=profile.samples[i],ms=(profile.timeDeltas?.[i]??1000)/1000,name=nodes.get(id)?.callFrame.functionName??'(unknown)';self.set(name,(self.get(name)??0)+ms);let at=id;const seen=new Set();while(at){const n=nodes.get(at),f=n?.callFrame.functionName??'(unknown)';if(!seen.has(f)){inclusive.set(f,(inclusive.get(f)??0)+ms);seen.add(f);}at=parents.get(at);}}
  const interesting=['stepAdaptiveMine','adaptiveHit','simulate','search','replay','constructive','resolve','advance'];cases.push({policy:r.policy,viewport:r.viewport,recorded:r.recorded,coldMs:r.coldMs,warmMs:r.warmMs,matched20sMs:r.matched20sMs,plannerMs:r.plannerMs,gateMs:r.gateMs,resolutionMs:r.resolutionMs,fullValidationWallMs:r.fullValidationWallMs,controllerMsPer1000:stats(r.micro.updateMsPer1000),ccdMsPer1000:stats(r.micro.ccdMsPer1000),retainedHeapDelta:r.restarts.retainedHeapDelta,jobMemory:r.jobMemory,maximumDrawCalls:r.maximumDrawCalls,maximumTriangles:r.maximumTriangles,hotspots:interesting.map(name=>({name,selfMs:self.get(name)??0,inclusiveMs:inclusive.get(name)??0})),topSelf:[...self].sort((a,b)=>b[1]-a[1]).slice(0,20),outliers:r.outliers});
 }
 await writeFile(join(output,'adaptive-homing-timing-analysis.json'),JSON.stringify({cases,note:'CPU sample attribution is approximate1ms sampling, not wall-time partitioning. Full validation wall latency includes waits between bounded chunks; resolution and gate time are separate. Recorded45s and unrecorded20s cases compare the simulated[2,20] window. Raw profiles and every>=30ms interval/overlap remain available. No claim that a correlated function caused a frame gap.'},null,2)+'\n');
}
