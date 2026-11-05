import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {FragmentRun} from '../src/collectibles/run.ts';import {FRAGMENT} from '../src/collectibles/settings.ts';import {SHIP_COLLIDER} from '../src/core/ship-collider.ts';import {ShipHazardCollision} from '../src/core/ship-hazard-collision.ts';
import {FragmentRun as OldRun} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/collectibles/run.ts';import {SHIP_COLLIDER as OLD} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/core/ship-collider.ts';import {ShipHazardCollision as OldQuery} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/core/ship-hazard-collision.ts';
const stats=v=>{const a=[...v].sort((a,b)=>a-b),p=q=>a[Math.min(a.length-1,Math.floor(a.length*q))];return{n:a.length,p50:p(.5),p95:p(.95),p99:p(.99),max:p(1)}};
const rows=[],from={x:-1.7,y:.35,z:-.6},to={x:-1.7,y:.35,z:-.8},h={kind:0,radius:.65,phase:0,spin:0},wall={id:'bench-wall',kind:4,radius:13,phase:0,spin:0,x:0,y:0,passDistance:10};
for(const source of ['baseline','final']){
 const q=source==='baseline'?new OldQuery():new ShipHazardCollision(),times=[];for(let i=0;i<20000;i++)q.hit(from,to,h,120,1/120);
 for(let n=0;n<200;n++){const at=performance.now();for(let i=0;i<2000;i++)q.hit(from,to,h,120,1/120);times.push((performance.now()-at)/2000)}
 const pickup=[];for(const mode of ['eight-distant-active','eight-wall-occluded']){
  const r=source==='baseline'?new OldRun(OLD,.26):new FragmentRun(SHIP_COLLIDER,FRAGMENT.pickupAssist,FRAGMENT.wingPickupAssist);
  for(let i=0;i<r.slots.length;i++)Object.assign(r.slots[i],{state:'active',proposal:{id:String(i),x:mode==='eight-wall-occluded'?2.95+i*.005:i*.5,y:0,passDistance:mode==='eight-wall-occluded'?10:200}});
  const args=mode==='eight-wall-occluded'?[1.45,0,9.9,1.45,0,10.1,120,[wall]]:[0,0,0,.01,.01,.3,120,[]];
  for(let i=0;i<10000;i++)r.step(...args);const t=[];
  for(let n=0;n<200;n++){const at=performance.now();for(let i=0;i<500;i++)r.step(...args);t.push((performance.now()-at)/500)}assert.equal(r.count,0);if(mode==='eight-wall-occluded')assert.ok(r.stats.occluded>0);
  pickup.push({mode,perStepMs:stats(t),checks:r.stats.checks,occluded:r.stats.occluded});
 }
 rows.push({source,collisionQueryMs:stats(times),pickup});
}
await writeFile('.cache/review/GAMEPLAY-005B2/final/isolated-cpu.json',JSON.stringify({rows,note:'Sequential warmed Node kernels without browser/test/capture workload. Finite host timing, not a device guarantee. Pickup benchmark has eight permanently active distant misses or eight explicitly wall-occluded fixtures, never synthetic repeated collection events.'},null,2));console.log(JSON.stringify(rows,null,2));
