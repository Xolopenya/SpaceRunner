import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {beginResolvedRuntimeSearch,beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {ADAPTIVE_GEOMETRY as geometry} from '../src/experiments/adaptive-homing/transaction.ts';
import {AdaptiveHomingGameModel as After} from '../src/experiments/adaptive-homing/model.ts';
import {stats} from './director-fields.mjs';
const output=resolve('.cache/review/GAMEPLAY-003C4-FIX2'),{AdaptiveHomingGameModel:Before}=await import(pathToFileURL(join(output,'baseline/src/experiments/adaptive-homing/model.ts')).href);
const {ADAPTIVE_GEOMETRY:oldGeometry}=await import(pathToFileURL(join(output,'baseline/src/experiments/adaptive-homing/transaction.ts')).href);
await mkdir(output,{recursive:true});const oldRuns=JSON.parse(await readFile(join(output,'original-balanced-runs.json'))),frozen=JSON.parse(await readFile('tests/fixtures/homing-route-counterexamples.json'));
const witnesses=[];let audits=0;
function audit(w){const j=beginTrajectoryReplay(w.context,w.controls,{geometry});while(!j.getResult())j.advance();const r=j.getResult();assert.equal(r.decision,'accept');assert.equal(r.witness.hash,w.hash);audits++;witnesses.push(w);}
const gates=[];
for(const run of oldRuns)for(const o of run.publications.filter(o=>o.section.encounter==='moving-mine')){
 const check=o.publicationChecks[0],c=check.context;const row={seed:run.seed,history:run.history,section:o.section.id,context:c,hint:o.resolution?.hint,preferFresh:true};
 for(const version of ['before','after']){const traced=[],policy=version==='before'?oldGeometry:geometry,prediction=policy.prediction(c),step=prediction.stepAt.bind(prediction);prediction.stepAt=(s,input,elapsed,distance)=>{step(s,input,elapsed,distance);traced.push({tick:Math.round(s.elapsed*120),x:s.x,y:s.y,vx:s.vx,vy:s.vy,input,homing:s.homing});};
  const start=performance.now(),j=beginResolvedRuntimeSearch(c,{geometry:{...policy,prediction:()=>prediction}},version==='after'?undefined:row.hint);j.advance({propagations:3072,narrowQueries:6144},1);const r=j.getResult();assert.ok(r);assert.ok(j.metrics.propagations<=3072&&j.metrics.narrowQueries<=6144);
  row[version]={result:r,metrics:j.metrics,ms:performance.now()-start,trace:traced};if(version==='before')assert.deepEqual(r,check.result);if(r.decision==='accept')audit(r.witness);
 }gates.push(row);
}
function input(m,tick,history){const w=m.field.certificate;if(history==='witness'){let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0;for(const r of w?.controls??[]){if(at<r.ticks)return r.input;at-=r.ticks;}return{x:0,y:0};}
 const h=m.field.slots.find(h=>h.active&&h.kind===9)?.planned,plane=h?.motion.passTick,lead=history==='early-reversal'?160:30;
 return history==='neutral'?{x:0,y:0}:history==='horizontal'?{x:Math.floor(tick/180)%2?-1:1,y:0}:history==='boundary'?{x:1,y:1}:history==='touch'?{x:Math.sin(tick/93)*.85,y:Math.cos(tick/147)*.7}:{x:!plane||Math.round(m.elapsed*120)<plane-lead-72?0:Math.round(m.elapsed*120)<plane-lead?1:-1,y:0};
}
function run(Model,seed,history,cadence,tape){const m=new Model();m.ready();m.start(seed);const outcomes=[],frames=[],inputs=[];let tick=0,frame=0,last,empty=0,maxEmpty=0,streak=0,maxOmissions=0,maxMineOmissions=0,mineStreak=0,pauseChecked=false,restartChecked=false;
 const max=tape?tape.length:17000,target=history==='witness'?3000:1200;
 while(tick<max&&m.distance<target&&m.state==='PLAYING'){
  const count=cadence==='low'?12:cadence==='slow'?4:cadence==='catchup'&&frame%60===30?12:cadence?2:1;
  if(cadence)m.beginPlanningFrame();
  for(let n=0;n<count&&tick<max&&m.distance<target&&m.state==='PLAYING';n++,tick++){
   const axis=tape?.[tick]??input(m,tick,history);inputs.push(axis);m.step(1/120,axis);assert.equal(m.field.fault,undefined);
   if(!m.field.slots.some(s=>s.active&&s.z>=-100&&s.z<=8)){empty++;maxEmpty=Math.max(maxEmpty,empty);}else empty=0;
   const o=m.field.lastOutcome;if(o&&o!==last){last=o;outcomes.push(o);if(o.witness)audit(o.witness);if(o.status==='omitted-uncertified')maxOmissions=Math.max(maxOmissions,++streak);else streak=0;
    if(o.section.encounter==='moving-mine'){if(o.transaction?.hazards.some(h=>h.motion?.version==='adaptive-homing-v1'))mineStreak=0;else maxMineOmissions=Math.max(maxMineOmissions,++mineStreak);}}
  }
  if(cadence){m.finishPlanningFrame(count/120);const f=m.homing.planningFrame.latest;assert.ok(f.propagations<=6144&&f.queries<=12288);frames.push({...f});}frame++;
 }
 const mine=outcomes.filter(o=>o.section.encounter==='moving-mine'),published=mine.filter(o=>o.transaction?.hazards.some(h=>h.motion?.version==='adaptive-homing-v1'));
 const result={seed,history,cadence,ticks:tick,distance:m.distance,hull:m.hull,inputs,outcomes,frames,proposed:mine.length,published:published.length,omitted:mine.length-published.length,fallbacks:mine.filter(o=>o.status==='committed'&&!o.transaction?.hazards.some(h=>h.kind===9)).length,fullyOmitted:mine.filter(o=>o.status==='omitted-uncertified').length,maxEmptySeconds:maxEmpty/120,maxOmissions,maxMineOmissions,deadlines:outcomes.filter(o=>/DEADLINE|MISSED_PUBLICATION|COMPUTATION_BUDGET|ACTUAL_REPLAY_BUDGET/.test(o.reason??'')).length,preparation:stats(m.field.samples.filter(s=>s.phase!=='actual-gate'&&(s.propagations||s.queries)).map(s=>s.ms)),gate:stats(m.field.samples.filter(s=>s.phase==='actual-gate').map(s=>s.ms))};m.dispose();return result;
}
const runs=[];
for(const old of oldRuns){const before=run(Before,old.seed,old.history);assert.equal(before.published,old.published);assert.equal(before.proposed,old.proposed);const after=run(After,old.seed,old.history,null,before.inputs);runs.push({before,after});console.log(old.seed,old.history,before.published+'/'+before.proposed,after.published+'/'+after.proposed);}
const cadence=[];
for(const seed of [0,11,42])for(const history of ['witness','horizontal'])for(const mode of ['normal','slow','catchup','low']){const before=run(Before,seed,history,mode),after=run(After,seed,history,mode,before.inputs);cadence.push({before,after});}
const independentFlights=[0,11,42].map(seed=>run(After,seed,'witness','normal'));for(const r of independentFlights){assert.equal(r.hull,3);assert.ok(r.distance>=3000);}
const compact=r=>({...r,inputs:undefined,outcomes:undefined,frames:undefined});
const summary={frozen62:{before:gates.filter(g=>g.before.result.decision==='accept').length,after:gates.filter(g=>g.after.result.decision==='accept').length,recovered:gates.filter(g=>g.before.result.decision==='reject'&&g.after.result.decision==='accept').length,regressions:gates.filter(g=>g.before.result.decision==='accept'&&g.after.result.decision!=='accept').length},counterexamples:frozen.cases.map(c=>{const g=gates.find(g=>g.seed===c.seed&&g.history===c.history&&g.section===c.section);return{id:c.id,category:c.category,fullBeamRecovered:c.fullBeamRecovered,decision:g.after.result.decision,reason:g.after.result.reason,preferFresh:g.preferFresh,metrics:g.after.metrics};}),runs:runs.map(pair=>({before:compact(pair.before),after:compact(pair.after)})),cadence:cadence.map(pair=>({before:compact(pair.before),after:compact(pair.after)})),independentFlights:independentFlights.map(compact),audits,note:'Frozen62 actual roots give equal-input/equal-known-field comparison. Real games use exact baseline causal input tapes and stop at normal death/exposure limit; changed worlds may change proposal counts. Additional after witness flights use their own new certificates, not saved offline tapes.'};
await writeFile(join(output,'benchmark.json'),JSON.stringify(summary,null,2));await writeFile(join(output,'witnesses.json'),JSON.stringify({gates,runs,cadence,independentFlights,witnesses}));console.log(JSON.stringify({...summary,runs:undefined,cadence:undefined,independentFlights:undefined}));
