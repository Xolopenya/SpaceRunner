import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FRAGMENT as S} from '../src/collectibles/settings.ts';
import {proposeTrail,trailScheduled,trailSegmentClear} from '../src/collectibles/trails.ts';
import {FieldGenerator} from '../src/core/field-generator.ts';
import {FragmentRun} from '../src/collectibles/run.ts';
import {SHIP_COLLIDER} from '../src/core/ship-collider.ts';
import {Ship} from '../src/core/ship.ts';
import {IntegratedModel} from '../src/integrated/model.ts';
import {CONFIG} from '../src/config.ts';
import {certifiedInput} from './fixtures/fragment-flight.ts';
import type {FragmentProposal} from '../src/collectibles/placement.ts';
const root={player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},distance:0,elapsed:0};
const policy={profile:SHIP_COLLIDER,assist:S.pickupAssist,wingAssist:S.wingPickupAssist};
const tx={...new FieldGenerator(42).propose(8,6),startDistance:120,endDistance:320};
const seed:FragmentProposal={id:'controlled-trail-1',section:8,anchor:'controlled',situation:'debris',x:2.7,y:-.5,passDistance:210};
const place=(pattern:'straight'|'curve'|'offset')=>proposeTrail(seed,tx,root,[],[],policy,pattern)!;

for(const pattern of ['straight','curve','offset'] as const)test(`${pattern} trail has three deterministic,22m-spaced,distinct owned shards`,()=>{
 const points=place(pattern);assert.equal(points.length,3);assert.deepEqual(place(pattern),points);
 assert.equal(new Set(points.map(p=>p.id)).size,3);assert.ok(points.every(p=>p.trail===seed.id&&p.pattern===pattern&&p.anchor===seed.anchor&&Object.isFrozen(p)));
 for(let i=1;i<3;i++)assert.equal(points[i]!.passDistance-points[i-1]!.passDistance,22);
 if(pattern==='curve')assert.ok(Math.hypot(points[2]!.x-points[0]!.x,points[2]!.y-points[0]!.y)>2);
 else assert.ok(points.every(p=>p.x===seed.x&&p.y===seed.y));
});

test('trail bonus budget is one upgrade per12 groups, independent of RNG, with no catch-up',()=>{
 for(const seed of [0,7,11,42,119])for(let block=0;block<12;block++)assert.equal(Array.from({length:12},(_,i)=>trailScheduled(seed,block*12+i)).filter(Boolean).length,1);
 assert.equal(S.ordinaryCadence.reduce((a,b)=>a+b,0)/S.ordinaryCadence.length,2.75);
});

test('trail traversal uses real bounded steering at maximum forward speed and rewards each shard once',()=>{
 for(const pattern of ['straight','curve','offset'] as const){
  const points=place(pattern),run=new FragmentRun(SHIP_COLLIDER,S.pickupAssist,S.wingPickupAssist),ship=new Ship();let distance=0,t=0;const events:any[]=[];
  points.forEach((p,i)=>Object.assign(run.slots[i]!,{state:'active',proposal:p}));run.onCollected=p=>events.push(p);
  while(distance<points[2]!.passDistance+10){const p=run.active.slice().sort((a,b)=>a.passDistance-b.passDistance)[0],x=ship.x,y=ship.y,d=distance;
   ship.update(CONFIG.step,p?{x:Math.max(-1,Math.min(1,(p.x-ship.x)*2.6-ship.vx*.8)),y:Math.max(-1,Math.min(1,(p.y-ship.y)*2.6-ship.vy*.8))}:{x:0,y:0});
   distance+=36.72*CONFIG.step;t+=CONFIG.step;run.step(x,y,d,ship.x,ship.y,distance,t);assert.ok(Math.hypot(ship.vx,ship.vy)<=8+1e-9);
  }
  assert.equal(run.count,3);assert.equal(events.length,3);assert.deepEqual(events.map(e=>e.reward),[1,1,1]);assert.equal(events.at(-1).total,3);
  run.step(ship.x,ship.y,distance,ship.x,ship.y,distance+10,t+1);assert.equal(run.count,3);
 }
});

test('continuous route checks reject a between-shard solid, moving hazard, bounds, late lead and duplicates',()=>{
 const a=place('straight')[0]!,b=place('straight')[1]!,h={...tx.hazards[0]!,x:a.x,y:a.y,passDistance:(a.passDistance+b.passDistance)/2,radius:.3};
 assert.equal(trailSegmentClear(a,b,[h],policy),false);
 assert.equal(proposeTrail(seed,tx,root,[h],[],policy,'straight'),undefined);
 assert.equal(proposeTrail({...seed,x:5.8},tx,root,[],[],policy,'straight'),undefined);
 assert.equal(proposeTrail(seed,tx,{...root,distance:190},[],[],policy,'straight'),undefined);
 assert.equal(proposeTrail(seed,tx,root,[],[a],policy,'straight'),undefined);
 assert.equal(proposeTrail({...seed,x:.2,y:0},tx,root,[],[],policy,'offset'),undefined);
 const motion={...h,motion:{version:'adaptive-homing-v1'} as any,x:-5,y:3};assert.equal(trailSegmentClear(a,b,[motion],policy),false);
});

test('body and both wings gain only the configured forgiveness, and blocking geometry still rejects pickup',()=>{
 assert.ok(Math.abs(S.pickupAssist/.36-1.125)<1e-12);assert.ok(Math.abs(S.wingPickupAssist/.10-1.125)<1e-12);
 for(const [x,y,part] of [[0,1.12,'body'],[-2.075,-.30,'left-wing'],[2.075,-.30,'right-wing']] as const){
  for(const [assist,wing,expected] of [[.36,.10,0],[S.pickupAssist,S.wingPickupAssist,1]]){const r=new FragmentRun(SHIP_COLLIDER,assist,wing);Object.assign(r.slots[0]!,{state:'active',proposal:{...seed,x,y,passDistance:10}});r.step(0,0,9,0,0,11,1);assert.equal(r.count,expected);if(expected)assert.equal(r.lastPickup.part,part);}
 }
 const r=new FragmentRun(SHIP_COLLIDER,S.pickupAssist,S.wingPickupAssist);Object.assign(r.slots[0]!,{state:'active',proposal:{...seed,x:2.075,y:-.3,passDistance:10}});
 const h={...tx.hazards[0]!,x:1.6,y:-.3,passDistance:10,radius:.2,collisionProfile:'sphere' as any};
 r.step(0,0,9,0,0,11,1,[h]);assert.equal(r.count,0);assert.ok(r.stats.occluded>0);
});

test('eight-slot capacity and all trail counters/identities clear on restart without replacing slots',()=>{
 const r=new FragmentRun(SHIP_COLLIDER,S.pickupAssist,S.wingPickupAssist),slots=[...r.slots];
 r.slots.forEach((s,i)=>Object.assign(s,{state:'active',proposal:{...seed,id:'full'+i}}));
 r.published(tx,root,tx.hazards);r.published({...tx,firstCell:9},root,tx.hazards);assert.equal(r.slots.length,8);assert.equal(r.stats.skipped,1);assert.equal(r.stats.placed,0);
 r.reset();assert.equal(r.active.length,0);assert.ok(slots.every((s,i)=>s===r.slots[i]&&!s.proposal));assert.ok(Object.values(r.stats).every(v=>v===0));
});

test('collectible-only changes leave exact integrated hazard admissions, witnesses, mines, movement and damage unchanged at matched inputs',()=>{
 for(const seed of [0,7,11,42]){
  const a=new IntegratedModel(),b=new IntegratedModel();a.ready();b.ready();a.start(seed);b.start(seed);b.fragments.published=()=>{};
  for(let tick=0;tick<2600&&a.state==='PLAYING';tick++){
   if(tick%2===0){a.beginPlanningFrame();b.beginPlanningFrame();}const input=certifiedInput(a);a.step(CONFIG.step,input);b.step(CONFIG.step,input);if(tick%2===1){a.finishPlanningFrame(1/60);b.finishPlanningFrame(1/60);}
   assert.deepEqual(a.ship,b.ship);assert.equal(a.distance,b.distance);assert.equal(a.hull,b.hull);assert.deepEqual(a.homing.current,b.homing.current);assert.equal(a.field.certificate?.hash,b.field.certificate?.hash);
  }
  assert.deepEqual(a.field.events,b.field.events);assert.deepEqual(a.field.slots,b.field.slots);assert.equal(a.field.fault,undefined);a.dispose();b.dispose();
 }
});
