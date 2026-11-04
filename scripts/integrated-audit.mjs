import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { IntegratedModel, INTEGRATED_GEOMETRY } from '../src/integrated/model.ts';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { certifiedInput, fragmentInput } from '../tests/fixtures/fragment-flight.ts';

export const directory = process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-005A/final';
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const stats = values => { const s = [...values].sort((a,b)=>a-b), p = q => s[Math.min(s.length-1, Math.floor(s.length*q))] ?? 0;
  return { n:s.length, p50:p(.5), p95:p(.95), p99:p(.99), max:s.at(-1) ?? 0 }; };
export function state(m) {
  return { distance:m.distance, elapsed:m.elapsed, ship:{...m.ship}, hull:m.hull, phase:m.phase, state:m.state, count:m.fragments.count,
    pickup:m.fragments.lastPickup, fragments:m.fragments.active, hazards:m.field.slots.map(h=>({...h})), current:m.homing.current,
    events:m.field.events.map(e=>({...e})), fault:m.field.fault };
}
await mkdir(directory,{recursive:true});
const rows=[], scenarios=[]; let replays=0;
const scenariosOnly=process.argv.includes('--scenarios-only');
for(const seed of (scenariosOnly?[42]:[0,1,7,11,16,20,42,99])) for(const policy of (scenariosOnly?['witness']:['witness','neutral','collect'])) {
  const m=new IntegratedModel();m.ready();m.start(seed);
  const inputs=[],steps=[],frames=[],decisions=[],seen=new Set(),placements=[]; let last,peak=0,mineTicks=0,allTicks=0;
  const capture = name => { if(seed!==42||policy!=='witness'||seen.has(name))return;seen.add(name);
    const snapshot=state(m);scenarios.push({name,seed,tick:inputs.length,inputs:inputs.slice(),state:snapshot,stateHash:digest(snapshot)}); };
  while(m.state==='PLAYING'&&m.distance<2500) {
    m.beginPlanningFrame();
    for(let n=0;n<2&&m.state==='PLAYING';n++) {
      const axis=policy==='neutral'?{x:0,y:0}:policy==='collect'?fragmentInput(m,m.fragments.active[0]):certifiedInput(m);
      inputs.push({...axis});const t=performance.now();m.step(1/120,axis);steps.push(performance.now()-t);assert.equal(m.field.fault,undefined);
      const mines=m.field.slots.filter(h=>h.active&&h.planned?.motion);peak=Math.max(peak,mines.length);assert.ok(mines.length<=1);allTicks++;
      if(mines.length&&m.homing.current?.phase!=='waiting')mineTicks++;
      for(const p of m.fragments.active)if(!placements.some(a=>a.id===p.id))placements.push(p);
      capture(m.distance>120&&m.distance<121?'ordinary':'skip');
      if(m.fragments.count>0)capture('pickup');
      if(m.phase===2)capture('phase2');
      if(m.field.slots.some(h=>h.active&&h.kind>=4&&h.kind<=8&&Math.abs(h.z)<.4))capture('station');
      if(m.homing.current?.phase==='pursuit'&&mines.some(h=>h.z< -12&&h.z> -14))capture('mine');
      const o=m.field.lastOutcome;if(!o||o===last)continue;last=o;
      if(o.witness) { const j=beginTrajectoryReplay(o.witness.context,o.witness.controls,{geometry:INTEGRATED_GEOMETRY});while(!j.getResult())j.advance();
        const r=j.getResult();assert.equal(r.decision,'accept');assert.equal(r.witness.hash,o.witness.hash);replays++; }
      decisions.push({distance:m.distance,status:o.status,reason:o.reason,selected:o.section.encounter,aperture:o.section.aperture,
        ids:o.transaction?.hazards.map(h=>h.id),witness:o.witness?.hash,metrics:o.metrics});
    }
    m.finishPlanningFrame(1/60);frames.push(m.homing.planningFrame.latest.ms);
  }
  if(policy==='witness'){assert.equal(m.hull,3);assert.equal(m.phase,2);assert.ok(m.homing.encounters.length>0);}
  const row={seed,policy,distance:m.distance,elapsed:m.elapsed,hull:m.hull,phase:m.phase,count:m.fragments.count,stats:{...m.fragments.stats},
    peakMines:peak,minePresenceFraction:mineTicks/allTicks,admittedMines:decisions.filter(d=>d.ids?.some(id=>id.startsWith('adaptive-homing-v1'))).length,
    decisions,placements,fixedStepMs:stats(steps),plannerFrameMs:stats(frames),maxPlannerChunkMs:m.field.maxChunkMs};
  rows.push(row);m.dispose();console.log(seed,policy,row.distance.toFixed(1),'hull',row.hull,'mines',row.admittedMines,'energy',row.count);
}
// A short real-input sequence demonstrates strengthened right/lower perimeter cues.
const m=new IntegratedModel();m.ready();m.start(42);const inputs=[];
for(let tick=0;tick<450&&m.state==='PLAYING';tick++) {
  const axis=tick<150?{x:1,y:0}:tick<250?{x:0,y:-1}:tick<340?{x:-1,y:1}:{x:0,y:0};
  inputs.push(axis);m.step(1/120,axis);
  if([0,149,249,339,449].includes(tick)){const snapshot=state(m);scenarios.push({name:`boundary-${tick+1}`,seed:42,tick:tick+1,inputs:inputs.slice(),state:snapshot,stateHash:digest(snapshot)});}
}m.dispose();
const selected=scenarios.filter(s=>s.name!=='skip');
assert.ok(['ordinary','pickup','station','mine','phase2','boundary-250'].every(name=>selected.some(s=>s.name===name)));
await writeFile(`${directory}/integrated-scenarios.json`,JSON.stringify(selected));
if(!scenariosOnly) await writeFile(`${directory}/integrated-audit.json`,JSON.stringify({node:process.version,rows,replays,
  note:'24 actual three-hull runs stop at death or2500m. Witness pilot follows currently admitted controls; collect pilot uses optional reward pursuit. Not human approval. Timing includes this host workload, not a device guarantee.'},null,2));
