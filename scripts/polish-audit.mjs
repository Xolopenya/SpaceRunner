import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {IntegratedModel,INTEGRATED_GEOMETRY} from '../src/integrated/model.ts';
import {beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {IntegratedModel as Old,INTEGRATED_GEOMETRY as OLD_GEOMETRY} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/integrated/model.ts';
import {beginTrajectoryReplay as oldReplay} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/core/field-validator.ts';
import {certifiedInput,fragmentInput} from '../tests/fixtures/fragment-flight.ts';
import {SHIP_COLLIDER} from '../src/core/ship-collider.ts';
import {ShipHazardCollision} from '../src/core/ship-hazard-collision.ts';
import {FragmentRun} from '../src/collectibles/run.ts';
import {FRAGMENT} from '../src/collectibles/settings.ts';
const dir='.cache/review/GAMEPLAY-005B2/final';await mkdir(dir,{recursive:true});
const pct=v=>{const s=[...v].sort((a,b)=>a-b),p=q=>s[Math.min(s.length-1,Math.floor(s.length*q))]??0;return{n:s.length,p50:p(.5),p95:p(.95),p99:p(.99),max:p(1)}};
const rows=[],traces=[],records=new Map();let replays=0;
function witness(m){return certifiedInput(m)}
for(const source of ['baseline','final'])for(const seed of [0,1,7,11,16,20,42,99])for(const policy of ['witness','neutral','collect']){
 const Model=source==='baseline'?Old:IntegratedModel,geometry=source==='baseline'?OLD_GEOMETRY:INTEGRATED_GEOMETRY,replay=source==='baseline'?oldReplay:beginTrajectoryReplay;
 const m=new Model();m.ready();m.start(seed);let last,serial=0,pickups=0;const decisions=[],inputs=[],steps=[],pickupMs=[],frames=[],events=[],placements=[];let omissions=0,maxOmissions=0;
 const pickupStep=m.fragments.step.bind(m.fragments);m.fragments.step=(...args)=>{const at=performance.now();pickupStep(...args);pickupMs.push(performance.now()-at)};
 while(m.state==='PLAYING'&&m.distance<2500){
  m.beginPlanningFrame();for(let n=0;n<2&&m.state==='PLAYING';n++){
   const input=policy==='witness'?witness(m):policy==='neutral'?{x:0,y:0}:fragmentInput(m,m.fragments.active[0]);inputs.push({...input});const at=performance.now();m.step(1/120,input);steps.push(performance.now()-at);assert.equal(m.field.fault,undefined);
   for(const p of m.fragments.active)if(!placements.some(q=>q.id===p.id))placements.push(p);
   if(m.hitSerial!==serial){serial=m.hitSerial;events.push({tick:inputs.length,hull:m.hull,ship:{...m.ship},distance:m.distance,contact:m.lastShipContact});}
   if(m.fragments.count!==pickups){pickups=m.fragments.count;events.push({tick:inputs.length,pickup:{...m.fragments.lastPickup},hull:m.hull,distance:m.distance});}
   const o=m.field.lastOutcome;if(!o||o===last)continue;last=o;
   if(o.witness){const j=replay(o.witness.context,o.witness.controls,{geometry});while(!j.getResult())j.advance();assert.equal(j.getResult().decision,'accept');assert.equal(j.getResult().witness.hash,o.witness.hash);replays++;}
   const accepted=o.status==='committed';omissions=accepted?0:omissions+1;maxOmissions=Math.max(maxOmissions,omissions);
   decisions.push({distance:m.distance,status:o.status,reason:o.reason,encounter:o.section.encounter,aperture:o.section.aperture,firstCell:o.section.firstCell,endDistance:o.section.endDistance,hazards:o.transaction?.hazards,witness:o.witness?.hash,metrics:o.metrics});
  }m.finishPlanningFrame(1/60);frames.push(m.homing.planningFrame.latest.ms);
 }
 if(policy==='witness'){assert.equal(m.hull,3);assert.equal(m.phase,2);}
 const passes=decisions.flatMap(d=>d.hazards??[]).map(h=>h.passDistance).sort((a,b)=>a-b);
 const row={source,seed,policy,distance:m.distance,hull:m.hull,count:m.fragments.count,committed:m.field.committed,omitted:m.field.omitted,maxOmissions,maxPublishedCenterGap:Math.max(0,...passes.slice(1).map((d,i)=>d-passes[i])),
 mines:decisions.filter(d=>d.hazards?.some(h=>h.kind===9)).length,stations:decisions.filter(d=>d.hazards?.some(h=>h.kind>=4&&h.kind<=8)).length,
 stats:{...m.fragments.stats},queryMetrics:m.shipCollisionMetrics,work:m.field.samples,decisions,events,placements,fixedStepMs:pct(steps),pickupMs:pct(pickupMs),plannerFrameMs:pct(frames)};
 rows.push(row);records.set(`${source}/${seed}/${policy}`,{inputs,row});
 // Retain full real input histories for independently reproducible gameplay captures.
 if(policy==='witness'&&seed===42||events.some(e=>e.contact?.bodyClear))traces.push({source,seed,policy,inputs,events});
 console.log(source,seed,policy,'hull',row.hull,'pub',row.committed,'omit',row.omitted,'energy',row.count);m.dispose();
}
// Identical recorded BEFORE witness inputs, same time horizon, new geometry.
const matched=[];
for(const seed of [0,1,7,11,16,20,42,99]){
 const before=records.get(`baseline/${seed}/witness`),m=new IntegratedModel();m.ready();m.start(seed);let last;const decisions=[];
 for(let tick=0;tick<before.inputs.length&&m.state==='PLAYING';tick++){
  if(tick%2===0)m.beginPlanningFrame();m.step(1/120,before.inputs[tick]);if(tick%2===1)m.finishPlanningFrame(1/60);assert.equal(m.field.fault,undefined);
  const o=m.field.lastOutcome;if(o&&o!==last){last=o;decisions.push({status:o.status,reason:o.reason,distance:m.distance,family:o.section.encounter,metrics:o.metrics,ids:o.transaction?.hazards.map(h=>h.id)});}
 }
 const prefix=before.row.decisions.filter(d=>d.distance<=m.distance);matched.push({seed,distance:m.distance,hull:m.hull,before:{committed:prefix.filter(d=>d.status==='committed').length,omitted:prefix.filter(d=>d.status!=='committed').length},after:{committed:m.field.committed,omitted:m.field.omitted},decisions});m.dispose();
}
const collisionCosts=[];
for(const Model of [Old,IntegratedModel]){const model=new Model(),q=model.collisions,t=[];for(let n=0;n<100;n++){const at=performance.now();for(let i=0;i<1000;i++)q.hit({x:-1.7,y:.35,z:-.6},{x:-1.7,y:.35,z:-.8},{kind:0,radius:.65,phase:0,spin:0},120,1/120);t.push((performance.now()-at)/1000)}collisionCosts.push({profile:q.profile,timingMs:pct(t)});model.dispose();}
const pickupCandidates=[];
for(const assist of [.26,.30,.32,.34,.36,.38])for(const gap of [1.02,1.04,1.06,1.08,1.10,1.12]){
 const r=new FragmentRun(SHIP_COLLIDER,assist,FRAGMENT.wingPickupAssist);Object.assign(r.slots[0],{state:'active',proposal:{id:'calibration',x:0,y:gap,passDistance:10}});r.step(0,0,8,0,0,12,120);pickupCandidates.push({assist,gap,collected:r.count===1});
}
await writeFile(`${dir}/polish-audit.json`,JSON.stringify({rows,matched,replays,collisionCosts,pickupCandidates,notes:['Own witness and collect feedback histories differ between profiles. Identical BEFORE witness inputs are reported separately.','Maximum published center gap is center-to-center distance of committed hazards, not a promise of empty screen duration.','CPU values are host measurements, not GPU timers or a phone guarantee.']},null,2));
await writeFile(`${dir}/gameplay-traces.json`,JSON.stringify(traces));console.log('Replays:',replays);
