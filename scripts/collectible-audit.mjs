import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ReleaseModel, RELEASE_GEOMETRY } from '../src/release/model.ts';
import { CONFIG } from '../src/config.ts';
import { fragmentClear } from '../src/collectibles/placement.ts';
import { FragmentRun } from '../src/collectibles/run.ts';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { certifiedInput, fragmentInput } from '../tests/fixtures/fragment-flight.ts';

const directory = process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-004/final';
await mkdir(directory, { recursive: true });
const rows = []; let audits = 0;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const percentiles = values => { const sorted = [...values].sort((a,b) => a-b); return { n: sorted.length, p50: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.floor(sorted.length*.95)], max: sorted.at(-1) }; };
for (const seed of [0,11,42]) for (const policy of ['ignore','collect']) {
  const m = new ReleaseModel(); m.ready(); m.start(seed);
  const placements = [], pickups = [], outcomes = [], updateSamples = [], placementSamples = [];
  const seen = new Set(); let last, count = 0;
  const step = m.fragments.step.bind(m.fragments), publish = m.fragments.published.bind(m.fragments);
  m.fragments.step = (...args) => { const t = performance.now(); step(...args); updateSamples.push(performance.now()-t); };
  m.fragments.published = (...args) => { const t = performance.now(); publish(...args); placementSamples.push(performance.now()-t); };
  while (m.distance < 1500 && m.state === 'PLAYING') {
    const target = m.fragments.active.filter(p=>p.passDistance > m.distance-1).sort((a,b)=>a.passDistance-b.passDistance)[0];
    m.step(CONFIG.step, policy === 'collect' ? fragmentInput(m,target) : certifiedInput(m));
    assert.equal(m.field.fault, undefined); assert.equal(m.fragments.stats.published,m.field.committed);
    for (const p of m.fragments.active) if (!seen.has(p.id)) {
      seen.add(p.id); assert.ok(fragmentClear(p,m.field.ledger.knownHazards(m.distance)));
      assert.ok(m.field.ledger.knownHazards(m.distance).some(h=>h.id===p.anchor));
      placements.push({...p, publishedDistance:m.distance, warningSeconds:(p.passDistance-m.distance)/m.speed});
    }
    if (m.fragments.count > count) { pickups.push({count:m.fragments.count,distance:m.distance,hull:m.hull,target}); count=m.fragments.count; }
    if(m.field.lastOutcome && m.field.lastOutcome !== last) {
      last=m.field.lastOutcome;
      if(last.witness) { const replay=beginTrajectoryReplay(last.witness.context,last.witness.controls,{geometry:RELEASE_GEOMETRY});while(!replay.getResult())replay.advance();assert.equal(replay.getResult().decision,'accept');audits++; }
      outcomes.push({status:last.status,index:last.section.index,encounter:last.section.encounter,witness:last.witness?.hash,hazards:last.transaction?.hazards});
    }
  }
  if(policy==='ignore') assert.equal(m.hull,3);
  const row={seed,policy,distance:m.distance,hull:m.hull,count:m.fragments.count,stats:{...m.fragments.stats},placements,pickups,
    decisions:outcomes,identityHash:hash({placements,pickups,outcomes}),updateMs:percentiles(updateSamples),placementMs:percentiles(placementSamples),ordinaryPublicationRate:m.fragments.stats.ordinary/m.distance*100};
  rows.push(row);m.dispose();console.log(seed,policy,row.distance.toFixed(1),row.count,row.stats.placed);
}
// Exact sweep cost measured with all eight slots active, including broad misses.
const run=new FragmentRun();for(let i=0;i<run.slots.length;i++)Object.assign(run.slots[i],{state:'active',proposal:{id:`bench/${i}`,x:i*.4,y:0,passDistance:200,section:4,anchor:'bench',situation:'debris'}});
const costs=[];for(let sample=0;sample<200;sample++){const t=performance.now();for(let i=0;i<1000;i++)run.step(0,0,0,.01,.01,.3,1);costs.push((performance.now()-t)/1000);}
const memory=[];const m=new ReleaseModel();m.ready();for(let i=0;i<50;i++){m.state='GAME_OVER';m.start(42);for(let t=0;t<60;t++)m.step(CONFIG.step,{x:0,y:0});if(i%10===0){global.gc?.();memory.push({restart:i,...process.memoryUsage(),slots:m.fragments.slots.length,active:m.fragments.active.length});}}m.dispose();global.gc?.();memory.push({restart:50,...process.memoryUsage()});
await writeFile(`${directory}/collectible-audit.json`,JSON.stringify({node:process.version,rows,audits,eightActiveSweepMs:percentiles(costs),memory,notes:['Finite automated pilots; no human approval.','Local placement heuristic does not certify the complete pickup route.','Memory uses --expose-gc when available; allocator samples are not a leak proof.']},null,2));
console.log('Collectible audit passed; independent hazard witness replays:',audits);
