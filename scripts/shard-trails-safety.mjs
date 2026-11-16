import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {IntegratedModel} from '../src/integrated/model.ts';
import {ShipHazardCollision} from '../src/core/ship-hazard-collision.ts';
import {SHIP_COLLIDER} from '../src/core/ship-collider.ts';
import {FRAGMENT as S} from '../src/collectibles/settings.ts';
import {certifiedInput} from '../tests/fixtures/fragment-flight.ts';
const query=new ShipHazardCollision(),rows=[];
for(const seed of [0,7,11,42,28,291]){
 const m=new IntegratedModel();m.ready();m.start(seed);let pointChecks=0,unsafe=0;const trails=[];
 const publish=m.fragments.published.bind(m.fragments);
 m.fragments.published=(tx,root,known)=>{
  const old=m.fragments.stats.trails;publish(tx,root,known);if(old===m.fragments.stats.trails)return;
  const points=m.fragments.active.filter(p=>p.section===tx.firstCell&&p.trail).sort((a,b)=>a.passDistance-b.passDistance);
  assert.equal(points.length,3);const route=[{...points[0],passDistance:points[0].passDistance-S.approachDepth},...points,{...points[2],passDistance:points[2].passDistance+S.approachDepth}];
  for(let segment=1;segment<route.length;segment++)for(let sample=0;sample<=64;sample++){
   const a=route[segment-1],b=route[segment],t=sample/64,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,d=a.passDistance+(b.passDistance-a.passDistance)*t;
   for(const h of known)for(const part of SHIP_COLLIDER.parts){const p={x:x-h.x,y:y-h.y,z:h.passDistance-d};pointChecks++;
    if(query.hitPart(p,p,{...h,planned:h},root.elapsed+(d-root.distance)/36.72,0,part,S.clearance))unsafe++;
   }
  }
  trails.push({section:tx.firstCell,pattern:points[0].pattern,points,knownHazards:known.length,firstConservativeLead:(points[0].passDistance-root.distance)/36.72});
 };
 for(let tick=0;tick<(seed===28||seed===291?3600:21600)&&m.state==='PLAYING';tick++){if(tick%2===0)m.beginPlanningFrame();m.step(1/120,certifiedInput(m));if(tick%2===1){m.events.flush();m.finishPlanningFrame(1/60);}}
 rows.push({seed,seconds:m.elapsed,pointChecks,unsafe,trails,fault:m.field.fault});assert.equal(unsafe,0);assert.equal(m.field.fault,undefined);m.dispose();
}
assert.ok(rows.reduce((n,r)=>n+r.trails.length,0)>=4);
await writeFile('.cache/review/FEEDBACK-001C2/safety-audit.json',JSON.stringify({method:'Separate actual collision kernel,65 pose samples on each of four trail legs (including8m entry/exit), all three damage parts plus.28m margin, known admitted geometry, estimated future orientation. Six natural seeds. Finite independent geometric check, not a global reachability/human guarantee.',rows},null,2));
console.log(JSON.stringify(rows.map(r=>({seed:r.seed,trails:r.trails.length,checks:r.pointChecks,unsafe:r.unsafe}))));
