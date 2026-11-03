import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {AdaptiveHomingGameModel} from '../src/experiments/adaptive-homing/model.ts';
import {ADAPTIVE_GEOMETRY as geometry,isAdaptive} from '../src/experiments/adaptive-homing/transaction.ts';
import {beginTrajectoryReplay,beginKnownFieldValidation} from '../src/core/field-validator.ts';
import {ReleaseModel} from '../src/release/model.ts';
const output=resolve('.cache/review/GAMEPLAY-003C4-FIX/corpus');await mkdir(output,{recursive:true});
const frozen=resolve('.cache/review/GAMEPLAY-003C4-FIX/baseline');
const {AdaptiveHomingGameModel:Before}=await import(pathToFileURL(join(frozen,'src/experiments/adaptive-homing/model.ts')).href);
const {ReleaseModel:BeforeRelease}=await import(pathToFileURL(join(frozen,'src/release/model.ts')).href);
const evidence=JSON.parse(await readFile('.cache/review/GAMEPLAY-003C4-FIX/before/adaptive-homing-witnesses.json'));
const finish=j=>{while(!j.getResult())j.advance();return j.getResult();};let audits=0;
function replay(w){const r=finish(beginTrajectoryReplay(w.context,w.controls,{geometry}));assert.equal(r.decision,'accept');assert.equal(r.witness.hash,w.hash);audits++;}
function input(m,tick,history){
 const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0;
 if(history==='witness'){for(const run of w?.controls??[]){if(at<run.ticks)return run.input;at-=run.ticks;}return{x:0,y:0};}
 const mine=m.field.slots.find(h=>h.active&&h.kind===9)?.planned,plane=mine?.motion.passTick,lead=history==='early-reversal'?160:30;
 return history==='neutral'?{x:0,y:0}:history==='horizontal'?{x:Math.floor(tick/180)%2?-1:1,y:0}:history==='boundary'?{x:1,y:1}:history==='touch'?{x:Math.sin(tick/93)*.85,y:Math.cos(tick/147)*.7}:{x:!plane||Math.round(m.elapsed*120)<plane-lead-72?0:Math.round(m.elapsed*120)<plane-lead?1:-1,y:0};
}
function signature(o){return{status:o.status,reason:o.reason,section:o.section.id,witness:o.witness?.hash,transaction:o.transaction};}
function run(Model,seed,history,cadence){
 const m=new Model();m.ready();m.start(seed);const outcomes=[],frames=[];let last,tick=0,maxGap=0,gap=0,empty=0,samples=0,activeSum=0,maxOmissions=0,streak=0;
 while(tick<17000&&m.distance<(history==='witness'?3000:1200)&&m.state==='PLAYING'){
  const count=cadence==='catchup'&&frames.length%60===30?12:2;
  m.beginPlanningFrame?.();
  for(let n=0;n<(cadence?count:1)&&tick<17000&&m.distance<(history==='witness'?3000:1200)&&m.state==='PLAYING';n++,tick++){
   // Freeze the old model's observations as the actual input tape for matching.
   const axis=input(m,tick,history);m.step(1/120,axis);assert.equal(m.field.fault,undefined);
   const active=m.field.slots.filter(s=>s.active),near=active.some(s=>s.z>=-100&&s.z<=8);activeSum+=active.length;samples++;if(!near){empty++;gap++;maxGap=Math.max(maxGap,gap);}else gap=0;
   const o=m.field.lastOutcome;if(o&&o!==last){last=o;outcomes.push(o);if(o.witness)replay(o.witness);if(o.section.encounter==='moving-mine'){if(o.transaction?.hazards.some(isAdaptive))streak=0;else maxOmissions=Math.max(maxOmissions,++streak);}}
  }
  m.finishPlanningFrame?.(count/120);if(cadence&&m.homing.planningFrame){const f=m.homing.planningFrame.latest;assert.ok(f.propagations<=6144&&f.queries<=12288);frames.push(f);}else frames.push({});
 }
 const proposed=outcomes.filter(o=>o.section.encounter==='moving-mine'),mines=proposed.filter(o=>o.transaction?.hazards.some(isAdaptive));
 const result={seed,history,cadence,ticks:tick,distance:m.distance,hull:m.hull,proposed:proposed.length,published:mines.length,omitted:proposed.length-mines.length,maxOmissions,meanActive:activeSum/samples,emptySeconds:empty/120,maxEmptySeconds:maxGap/120,outcomes,frames:cadence?frames:undefined};m.dispose();return result;
}
const comparisons=[];
for(const old of evidence.runs.filter(r=>r.policy==='balanced')){
 const after=run(AdaptiveHomingGameModel,old.seed,old.history,null);
 assert.deepEqual(after.outcomes.map(signature),old.publications.map(signature));assert.equal(after.hull,old.hull);comparisons.push(after);
}
const framed=[];
for(const seed of [0,11,42])for(const history of ['witness','horizontal','touch']){
 // Normal2-step frame grouping has the exact same observations as the frozen run.
 const before=run(Before,seed,history,'normal'),after=run(AdaptiveHomingGameModel,seed,history,'normal');
 assert.deepEqual(after.outcomes.map(signature),before.outcomes.map(signature));assert.equal(after.hull,before.hull);
 framed.push({before,after,catchup:run(AdaptiveHomingGameModel,seed,history,'catchup')});
}
const omissions=[];
for(const old of evidence.runs.filter(r=>r.policy==='balanced'))for(const o of old.publications.filter(o=>o.section.encounter==='moving-mine'&&!o.transaction?.hazards.some(isAdaptive))){
 const check=o.publicationChecks?.[0],primary=o.attempts[0],result=check?.result;
 const reason=primary.reason??o.reason??'',category=reason.includes('INSUFFICIENT_REACTION')?'insufficient-reaction':reason.includes('NO_WITNESS_FOUND')?'bounded-proposal-no-witness':reason.includes('DEADLINE')?'planning-deadline':reason.includes('STALE')?'actual-state-mismatch':reason.includes('CAPACITY')?'capacity-or-ownership':'other';
 const detail=result?.detail??'',hitId=detail.replace(/@\d+$/,''),committedConflict=!!check?.context.committed.some(h=>h.id===hitId);
 // Offline counterfactual, no runtime authorization and no extra runtime search.
 const full=check&&category==='bounded-proposal-no-witness'?finish(beginKnownFieldValidation(check.context,{geometry})):undefined;
 if(full?.decision==='accept')replay(full.witness);
 omissions.push({seed:old.seed,history:old.history,section:o.section.id,category,reason,committedConflict,hitId,fallbackStatus:o.status,fallbackReason:o.reason,primary:check,fullSearchCounterfactual:full});
}
const production=[];
const observation=m=>({state:m.state,ship:{...m.ship},elapsed:m.elapsed,distance:m.distance,hull:m.hull,phase:m.phase,speed:m.speed,events:m.field.events,geometry:m.field.ledger.knownHazards(m.distance),witness:m.field.certificate?.hash});
for(const seed of [0,11,42])for(const history of ['witness','neutral','horizontal']){
 const a=new BeforeRelease(),b=new ReleaseModel();a.ready();b.ready();a.start(seed);b.start(seed);let ticks=0,phase2=false;
 for(;ticks<15000&&a.state==='PLAYING';ticks++){const axis=input(a,ticks,history);a.step(1/120,axis);b.step(1/120,axis);phase2||=b.phase===2;if(ticks%120===0)assert.deepEqual(observation(b),observation(a));}
 assert.deepEqual(observation(b),observation(a));production.push({seed,history,ticks,phase2,state:b.state,hull:b.hull,distance:b.distance});a.dispose();b.dispose();
}
const summary={comparisons:comparisons.length,proposed:comparisons.reduce((n,r)=>n+r.proposed,0),published:comparisons.reduce((n,r)=>n+r.published,0),omitted:comparisons.reduce((n,r)=>n+r.omitted,0),audits,categories:omissions.reduce((m,r)=>(m[r.category]=(m[r.category]??0)+1,m),{}),committedConflicts:omissions.filter(r=>r.committedConflict).length,fullSearchRecovered:omissions.filter(r=>r.fullSearchCounterfactual?.decision==='accept').length,framed:framed.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,{...v,outcomes:undefined,frames:undefined}]))),production,note:'Original Balanced21-case corpus uses original witness-following/causal policies. Normal2-step before/after decisions are equal. Catchup12steps every60frames is separately labeled. Policies derived from published geometry may diverge after a different decision. Counterfactual full beam cannot authorize runtime publication.'};
await writeFile(join(output,'summary.json'),JSON.stringify(summary,null,2));await writeFile(join(output,'evidence.json'),JSON.stringify({comparisons,framed,omissions,production}));console.log(JSON.stringify(summary));
