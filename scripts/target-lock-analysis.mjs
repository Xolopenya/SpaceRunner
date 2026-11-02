import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stats } from './director-fields.mjs';

export async function analyzeTargetTimings(directory) {
  const report=JSON.parse(await readFile(join(directory,'target-lock-browser.json'),'utf8')),cases=[];
  for(const r of report.results){
    const label=(r.variant==='target-lock'?'target':r.variant)+(r.recorded?'':'-unrecorded'),raw=JSON.parse(await readFile(join(directory,`target-lock-${label}-${r.viewport}-raw.json`),'utf8'));
    const slow=raw.frames.filter(f=>f.ms>=30).map(f=>{
      const overlapping=raw.steps.filter(s=>s.start<=f.time&&s.start+s.ms>=f.time-f.ms),chunks=overlapping.filter(s=>s.chunk&&(s.chunk.propagations||s.chunk.queries));
      return{time:f.time,elapsed:f.elapsed,state:f.state,frameMs:f.ms,cold:f.elapsed<2,modelSteps:overlapping.length,
        maximumStepMs:Math.max(0,...overlapping.map(s=>s.ms)),totalStepMs:overlapping.reduce((n,s)=>n+s.ms,0),billedPlannerChunks:chunks.length,
        maximumPlannerMs:Math.max(0,...chunks.map(s=>s.chunk.ms)),chunks:chunks.map(s=>({elapsed:s.elapsed,...s.chunk})),
        overlappingLongTasks:raw.longTasks.filter(t=>t.start<=f.time&&t.start+t.ms>=f.time-f.ms),
        note:'Time overlap is correlation; RAF boundaries and model instrumentation do not partition GPU, encoder or host scheduling costs.'};
    });
    cases.push({variant:r.variant,viewport:r.viewport,recorded:r.recorded,coldMs:stats(raw.frames.slice(1).filter(f=>f.elapsed<2).map(f=>f.ms)),warmMs:r.warmMs,matched20sMs:r.matched20sMs,
      plannerMs:r.plannerMs,gateMs:r.gateMs,targetResolutionMs:r.targetResolutionMs??null,
      micro:r.micro?{poseMsPer1000:stats(r.micro.poseBatchMs.map(v=>v/10)),ccdMsPer1000:stats(r.micro.ccdBatchMs)}:null,
      drawCalls:r.maximumDrawCalls,triangles:r.maximumTriangles,retainedHeapDelta:r.restarts.retainedHeapDelta,
      slowFrames:slow,topPlannerChunks:raw.steps.filter(s=>s.chunk&&(s.chunk.propagations||s.chunk.queries)).sort((a,b)=>b.chunk.ms-a.chunk.ms).slice(0,20)});
  }
  const analysis={cases,note:'Exact run records; fresh Chrome per case, all use CPU1ms sampling. Recorded45s versus unrecorded20s comparisons use the matched simulated[2,20]s window. No causal attribution to Target-Lock or a claimed fix of historical33ms pacing/83.7ms validator anomalies. Prior adverse records remain in logs/baseline/ with SHA inventory.'};
  await writeFile(join(directory,'target-lock-final-timing-analysis.json'),JSON.stringify(analysis,null,2)+'\n');return analysis;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await analyzeTargetTimings(resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-EXPERIMENT-003C3/final'));
