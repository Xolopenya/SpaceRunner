import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {simulateRuntime,INPUT_HISTORIES,recordedInputs} from '../tests/fixtures/runtime-simulation.ts';
import {APPROVED_SEEDS} from '../tests/fixtures/trajectory-corpus.ts';
import {stats} from './director-fields.mjs';
import {ObstacleField} from '../src/core/obstacles.ts';
import {FlightPrediction} from '../src/core/field-prediction.ts';
import {CONFIG,difficulty} from '../src/config.ts';
import {HazardCollision} from '../src/core/hazard-collision.ts';
import {matchedWindowPresence,summarizePresence} from './runtime-window-analysis.mjs';
import {measureRuntimeModels} from './runtime-model-benchmark.mjs';

const logicalOnly=process.argv.includes('--logical-only');
const output=resolve(process.env.REVIEW_RESULT_DIR??`.cache/review/GAMEPLAY-001B-5A/${logicalOnly?'logical-gate':'final'}`);
await mkdir(output,{recursive:true});
const runs=[],rows=[],chunks=[],oldComparisons=[];
const maximum=values=>values.reduce((a,b)=>Math.max(a,b),0);
function run(options,labels){
 const r=simulateRuntime({...options,audit:true,recordInputs:[0,42].includes(options.seed)});
 assert.equal(r.remainingRecords,0);assert.ok(r.peakHazards<=32&&r.peakRecords<=16);
 for(const c of r.chunks)assert.ok(c.propagations<=3072&&c.queries<=6144);
 for(const o of r.outcomes)assert.ok(o.attempts.length<=2&&o.metrics.searches<=2&&o.metrics.replays<=4);
 const index=runs.length;
 for(const c of r.chunks)chunks.push({...c,run:index});
 for(const [i,o]of r.outcomes.entries())rows.push({run:index,index:i,labels,section:o.section,status:o.status,reason:o.reason,
   count:o.status==='committed'?o.transaction.hazards.length:0,proposed:o.attempts[0]?.transaction?.hazards.length??0,
   metrics:o.metrics,attempts:o.attempts.map(a=>({kind:a.kind,reason:a.reason})),
   lead:o.witness&&o.transaction.hazards.length?Math.min(...o.transaction.hazards.map(h=>h.passDistance-h.radius-CONFIG.ship.radius-.15))-o.witness.context.distance:null});
 runs.push({labels,...r,chunks:undefined});return r;
}
for(const seed of APPROVED_SEEDS){for(const history of INPUT_HISTORIES)run({seed,history,sections:8},{band:'early',regime:'actual',history,seed});}
console.log('Completed16 approved seeds ×12 unknown-input histories ×8 consecutive sections.');
for(const firstCell of [256,1024])for(const seed of APPROVED_SEEDS)for(const history of ['neutral','rapid','boundary','touch']){
 run({seed,history,sections:6,firstCell,elapsed:(firstCell*24-128+840)/34},{band:firstCell===256?'middle':'late',regime:'actual',history,seed});
}
console.log('Completed middle/late warm-start cohorts:16 seeds ×4 input histories ×6 sections in each band.');
for(let seed=256;seed<272;seed++)for(const history of ['irregular','late-change'])run({seed,history,sections:4},{band:'early',regime:'stress',history,seed});
for(const seed of [0,42])for(const history of ['rapid','late-change','touch'])for(const coordinator of ['actual','b4-held','b4-oracle']){
 run({seed,history,sections:8,coordinator},{band:'early',regime:'coordinator-comparison',history,seed,coordinator});
}
for(const seed of [0,42])for(const history of ['rapid','late-change','touch'])run({seed,history,sections:8,replayMode:'full'},
 {band:'early',regime:'unculled-budget-comparison',history,seed});
const repeated=run({seed:42,history:'touch',sections:8},{band:'early',regime:'repeat',history:'touch',seed:42});
assert.equal(repeated.hash,runs.find(r=>r.labels.regime==='actual'&&r.seed===42&&r.history==='touch').hash);
console.log(`Completed ${rows.length} scheduled decisions; every committed certificate passed the unpruned independent audit.`);

// Matched source windows; actors continue after first contact for state-veto
// research. These are not successful post-death gameplay/survival episodes.
for(const r of runs.filter(r=>r.labels.regime==='actual'&&r.labels.band==='early'))oldComparisons.push(oldField(r));
const matchedPresence=runs.filter(r=>r.labels.regime==='actual'&&r.labels.band==='early').map((r,i)=>matchedWindowPresence(r,oldComparisons[i]));
const groupKeys=[...new Set(rows.map(r=>JSON.stringify(r.labels)))];
const groups=groupKeys.map(key=>{const labels=JSON.parse(key),rs=rows.filter(r=>JSON.stringify(r.labels)===key);return summarize(rs,labels);});
const actualRows=rows.filter(r=>['actual','stress','repeat'].includes(r.labels.regime)),actualChunks=chunks.filter(c=>['actual','stress','repeat'].includes(runs[c.run].labels.regime));
const work=actualChunks.filter(c=>!['ready','failed','actual-gate'].includes(c.phase));
const actors=runs.filter(r=>['actual','stress','repeat'].includes(r.labels.regime));
const depthGaps=key=>oldComparisons.flatMap(r=>{const q=r[key].map(h=>h.passDistance).sort((a,b)=>a-b);return q.slice(1).map((v,i)=>v-q[i]);});
const metrics={baseline:'d523cc4286d825594affbf9151cdae395b3ae721',generatedAt:new Date().toISOString(),node:process.version,
 corpus:{seeds:APPROVED_SEEDS,histories:INPUT_HISTORIES,totalScheduled:rows.length,totalRuns:runs.length,actual:summarize(actualRows),
   inputAccess:'Runtime API receives current root/input/complete known field only. Future tape access exists solely in the explicitly labeled B-4 oracle comparison driver.'},
 groups,byHistory:INPUT_HISTORIES.map(history=>summarize(actualRows.filter(r=>r.labels.history===history),{history})),
 timing:{preparation:stats(runs.filter(r=>['actual','stress','repeat'].includes(r.labels.regime)).flatMap(r=>r.preparations)),workChunk:stats(work.map(c=>c.ms)),
 actualGate:stats(actualChunks.filter(c=>c.phase==='actual-gate').map(c=>c.ms)),outliers:actualChunks.filter(c=>c.ms>16)},
 bounds:{maxPropagationsPerTick:maximum(actualChunks.map(c=>c.propagations)),maxQueriesPerTick:maximum(actualChunks.map(c=>c.queries)),
 peakHazards:Math.max(...runs.map(r=>r.peakHazards)),peakRecords:Math.max(...runs.map(r=>r.peakRecords)),
 maxSearches:Math.max(...rows.map(r=>r.metrics.searches)),maxReplays:Math.max(...rows.map(r=>r.metrics.replays))},
 audit:{certificates:runs.reduce((n,r)=>n+r.audits,0),fullQueries:runs.reduce((n,r)=>n+r.auditQueries,0),violations:0},
 motion:{method:'Exact120Hz physical motion. Reversal proxy:velocity sign over0.3 after more than0.75-unit excursion. Input changes and simulated reversals are not human decisions or forced avoidance.',
  byHistory:INPUT_HISTORIES.map(history=>{const rs=actors.filter(r=>r.history===history),distance=rs.reduce((n,r)=>n+r.distance,0);return{history,runs:rs.length,distance,xTravel:stats(rs.map(r=>r.xTravel)),yTravel:stats(rs.map(r=>r.yTravel)),inputChanges:rs.reduce((n,r)=>n+r.inputChanges,0),xReversals:rs.reduce((n,r)=>n+r.xReversals,0),yReversals:rs.reduce((n,r)=>n+r.yReversals,0),reversalsPer1000:rs.reduce((n,r)=>n+r.xReversals+r.yReversals,0)*1000/distance,uniqueContactHazards:rs.reduce((n,r)=>n+r.uniqueContactHazards,0),survivedToWindowEnd:rs.filter(r=>r.firstActualContact===undefined).length,nearbyEmptyFraction:rs.reduce((n,r)=>n+r.nearbyEmptySeconds,0)/rs.reduce((n,r)=>n+r.seconds,0)};})},
 bootstrap:{method:'Explicit cell4 ownership; complete first ambient transaction uses the same normal validation and actual-state final gate. No forced acceptance or shortened reaction.',
  cases:rows.filter(r=>r.labels.regime==='actual'&&r.labels.band==='early'&&r.index===0).length,
  firstCommitted:rows.filter(r=>r.labels.regime==='actual'&&r.labels.band==='early'&&r.index===0&&r.status==='committed').length,
  firstPublicationElapsed:stats(runs.filter(r=>r.labels.regime==='actual'&&r.labels.band==='early').map(r=>r.outcomes.find(o=>o.status==='committed')?.witness.context.elapsed).filter(Number.isFinite))},
 knownLimits:['Actors in logical cohorts continue collision-independently after actual contact; first-contact distances and contact substeps are separate from game hull events.',
 'Middle/late initial states are explicit warm starts, not reconstructed human histories. Finite tests are not universal fairness or human readability proofs.'],
 oldComparison:{windows:oldComparisons.length,oldHazards:oldComparisons.reduce((n,r)=>n+r.oldCount,0),newHazards:oldComparisons.reduce((n,r)=>n+r.newCount,0),
 distance:oldComparisons.reduce((n,r)=>n+r.end,0),oldDepthGaps:stats(depthGaps('oldPositions')),newDepthGaps:stats(depthGaps('newPositions')),nearby:summarizePresence(matchedPresence)},browser:null};
await writeFile(join(output,'runtime-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
await writeFile(join(output,'runtime-samples.json'),JSON.stringify({rows,chunks,oldComparisons},null,2)+'\n');
await writeFile(join(output,'runtime-traces.json'),JSON.stringify(runs,null,2)+'\n');
await writeFile(join(output,'runtime-window-analysis.json'),JSON.stringify({windows:matchedPresence,summary:summarizePresence(matchedPresence)},null,2)+'\n');
console.log(JSON.stringify({corpus:metrics.corpus,audit:metrics.audit,timing:metrics.timing,bounds:metrics.bounds,oldComparison:metrics.oldComparison},null,2));
if(!logicalOnly){const models=await measureRuntimeModels(output);metrics.actualModels={cases:models.cases,audits:models.audits,violations:models.violations,bootstrap:models.bootstrap,longPassive:models.longPassiveSummary};const {runtimeBrowser}=await import('./runtime-browser.mjs');metrics.browser=await runtimeBrowser(output);await writeFile(join(output,'runtime-metrics.json'),JSON.stringify(metrics,null,2)+'\n');}

function summarize(rs,labels={}){const outcomes={},reasons={},fallbacks={};for(const r of rs){outcomes[r.status]=(outcomes[r.status]??0)+1;if(r.reason){const key=r.reason.split(':').slice(0,2).join(':');reasons[key]=(reasons[key]??0)+1;}for(const a of r.attempts)if(a.kind!=='primary')fallbacks[a.kind]=(fallbacks[a.kind]??0)+1;}
 const units=rs.reduce((n,r)=>n+r.section.cellCount*24,0);return{...labels,scheduled:rs.length,outcomes,reasons,fallbacks,spanUnits:units,proposed:rs.reduce((n,r)=>n+r.proposed,0),hazards:rs.reduce((n,r)=>n+r.count,0),admittedPer100:rs.reduce((n,r)=>n+r.count,0)*100/units,lead:stats(rs.map(r=>r.lead).filter(v=>v!==null))};}

function oldField(r){
 const field=new ObstacleField(),prediction=new FlightPrediction(),collision=new HazardCollision(),state={x:0,y:0,vx:0,vy:0,elapsed:0,distance:0};field.reset(r.seed);
 const tape=recordedInputs(r.seed^0x5a19,r.history,r.steps),spawned=[],slotQ=Array(72).fill(-Infinity),contact=new Set();let firstContact=null,substeps=0,nearbyEmpty=0;
 for(let tick=0;tick<r.steps;tick++){
  const previous={...state};prediction.step(state,tape[tick]);field.update(CONFIG.step,difficulty(state.elapsed).speed,state.distance,state.elapsed);
  const travel=state.distance-previous.distance;
  for(const [i,h]of field.hazards.entries())if(h.active){const q=state.distance-h.z;if(Math.abs(slotQ[i]-q)>1){slotQ[i]=q;spawned.push({...h,passDistance:q});}
   if(collision.hit({x:previous.x-h.x,y:previous.y-h.y,z:-(h.z-travel)},{x:state.x-h.x,y:state.y-h.y,z:-h.z},h,state.elapsed,CONFIG.step)){firstContact??=state.distance;contact.add(`${i}/${slotQ[i]}`);substeps++;}}
  if(!field.hazards.some(h=>h.active&&Math.abs(h.z)<=10+h.radius))nearbyEmpty++;
 }
 const end=r.outcomes.at(-1).section.endDistance,old=spawned.filter(h=>h.passDistance>=0&&h.passDistance<end),fresh=r.hazards.filter(h=>h.passDistance>=0&&h.passDistance<end);
 const gaps=hs=>{const q=hs.map(h=>h.passDistance).sort((a,b)=>a-b);return stats(q.slice(1).map((v,i)=>v-q[i]));};
 return{seed:r.seed,history:r.history,start:0,end,oldCount:old.length,newCount:fresh.length,oldPer100:old.length*100/end,newPer100:fresh.length*100/end,oldPositions:old,newPositions:fresh,
 oldGaps:gaps(old),newGaps:gaps(fresh),oldFirstContact:firstContact,newFirstContact:r.firstActualContact??null,oldContactSubsteps:substeps,newContactSubsteps:r.contacts,
 oldNearbyEmptySeconds:nearbyEmpty*CONFIG.step,newNearbyEmptySeconds:r.nearbyEmptySeconds,seconds:r.seconds,
 note:r.history==='abandoned-witness'?'Old uses the recorded non-witness history; early witness-following new controller differs. Excluded from matched-input claims.':'Same seed, driver inputs and spatial window. Hull/immune deletion is disabled in this logical comparison.'};
}
