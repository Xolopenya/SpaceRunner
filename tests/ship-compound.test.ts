import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { SHIP_COLLIDER as S, BODY_COLLIDER } from '../src/core/ship-collider.ts';
import { ShipHazardCollision } from '../src/core/ship-hazard-collision.ts';
import { HazardCollision } from '../src/core/hazard-collision.ts';
import { ClearanceHazardCollision } from '../src/core/field-clearance.ts';
import { ShipPrediction } from '../src/core/ship-prediction.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { beginKnownFieldValidation, beginTrajectoryReplay, beginRuntimePublicationCheck, runtimeAxialDisjoint } from '../src/core/field-validator.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { FieldValidationContext } from '../src/core/field-types.ts';
import { ReleaseModel, RELEASE_GEOMETRY } from '../src/release/model.ts';
import { wreckTransaction } from '../src/experiments/structure-variants/encounter.ts';
import { WRECK_GEOMETRY } from '../src/experiments/structure-variants/encounter.ts';
import { WreckCollision,APERTURE_NAMES } from '../src/experiments/structure-variants/profile.ts';
import { FragmentRun } from '../src/collectibles/run.ts';
import { FRAGMENT } from '../src/collectibles/settings.ts';
import { obstacle, context, knownControls, fixtureOptions } from './fixtures/trajectory-fixtures.ts';
import { certifiedInput } from './fixtures/fragment-flight.ts';
const query = new ShipHazardCollision();
const body = new ShipHazardCollision(BODY_COLLIDER);
const h = { kind:0, radius:.65, phase:0, spin:0 };
const zero = {x:0,y:0,z:0};
function complete(j:ValidationJob){while(!j.getResult())j.advance();return j.getResult()!;}
function trace(c:FieldValidationContext){const p=new ShipPrediction(),state={...c.player,elapsed:c.elapsed,distance:c.distance,...(c.release?{release:true as const}:{})};
  const exit=Math.max(c.distance,...[...c.committed,...c.candidate.hazards].map(h=>h.passDistance+RELEASE_GEOMETRY.axialExtent(h)+S.axialExtent+.15));let end=0,tick=0;
  do {p.step(state,{x:0,y:0});tick++;if(!end&&tick>=54&&state.distance>exit)end=tick+39;}while(!end||tick<end);
  return [{ticks:tick,input:{x:0,y:0}}];}

test('shared measured profile has body plus symmetric wings, fixed game axes and conservative extents',()=>{
  assert.equal(S.parts.length,3);assert.equal(S.parts[0]!.radius,.42);assert.equal(S.parts[1]!.offsetX,-S.parts[2]!.offsetX);
  for(const p of S.parts){assert.ok(Math.abs(p.offsetZ)+p.radius<=S.axialExtent);assert.ok(Math.hypot(p.offsetX,p.offsetY,p.offsetZ)+p.radius<=S.enclosingRadius);assert.ok(Object.isFrozen(p));}
});
test('asteroid hits body, ONLY left wing and ONLY right wing; a narrow miss clears the full union',()=>{
  assert.ok(query.hit(zero,zero,h,0,CONFIG.step));
  for(const sign of [-1,1]){const relative={x:-sign*1.7,y:.35,z:-.7};assert.equal(body.hit(relative,relative,h,0,CONFIG.step),false);assert.ok(query.hit(relative,relative,h,0,CONFIG.step));assert.equal(query.lastPart,sign<0?'left-wing':'right-wing');}
  const miss={x:-(1.02+.28+h.radius+.001),y:.35,z:-.7};assert.equal(query.hit(miss,miss,h,0,CONFIG.step),false);
});
test('wing sweeps remain continuous at high forward speed and diagonal lateral movement',()=>{
  for(const sign of [-1,1])for(const diagonal of [false,true]){
    const a={x:-sign*1.7+(diagonal?-.05:0),y:.35+(diagonal?-.05:0),z:2},b={x:-sign*1.7+(diagonal?.05:0),y:.35+(diagonal?.05:0),z:-2};
    assert.equal(body.hit(a,b,h,120,CONFIG.step),false);assert.ok(query.hit(a,b,h,120,CONFIG.step));
  }
});
test('actual fixed-step model applies wing-only damage, one hit for body+wing overlap and normal immunity',()=>{
  for(const x of [-1.7,1.7,.6]){
    const m=new ReleaseModel();m.ready();m.start(42);m.field.update=()=>{};
    const hazard=m.field.hazards[0]!;Object.assign(hazard,{active:true,x,y:x===.6?-.1:-.35,z:.7,radius:x===.6?.9:.65,kind:0,phase:0,spin:0});
    m.step(CONFIG.step,{x:.25,y:.25});assert.equal(m.hull,2);assert.equal(m.hitSerial,1);assert.ok(m.invulnerability>1.5);
    hazard.active=true;m.step(CONFIG.step,{x:0,y:0});assert.equal(m.hull,2);assert.equal(m.hitSerial,1);m.dispose();
  }
});
test('calibrated mechanical/half-meteor and exact station solids participate in wing damage',()=>{
  for(const kind of [1,2])for(const phase of [0,Math.PI]){const hazard={...h,kind,phase,radius:1};const p={x:-1.5,y:.35,z:-.7};assert.ok(query.hit(p,p,hazard,0,CONFIG.step));}
  const wall=wreckTransaction(42,4,'center','isolated').hazards[0]!;
  const hit={x:1.65,y:0,z:0};assert.equal(body.hit(hit,hit,wall,0,CONFIG.step),false);assert.ok(query.hit(hit,hit,wall,0,CONFIG.step));
  const clear={x:1.49,y:0,z:0};assert.equal(query.hit(clear,clear,wall,0,CONFIG.step),false);
});
test('enclosing broad phase has no false rejection versus every individual part, including rear wing axial contact',()=>{
  let seed=1701;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<12000;i++){
    const hazard={...h,kind:i%3,radius:.65+random()*.45,phase:random()*Math.PI*2,spin:random()*1.4-.7};
    const a={x:random()*8-4,y:random()*6-3,z:random()*8-4},b={x:a.x+random()-.5,y:a.y+random()-.5,z:a.z-random()*1.5};
    const expected=S.parts.some(part=>query.hitPart(a,b,hazard,120,CONFIG.step,part,.15));assert.equal(query.hit(a,b,hazard,120,CONFIG.step,.15),expected);
  }
  const hazard={passDistance:100,radius:.65};assert.equal(runtimeAxialDisjoint(hazard,101.4,101.5,.15),true);
  assert.equal(runtimeAxialDisjoint(hazard,101.4,101.5,.15,S.axialExtent),false);
  assert.ok(query.hit({x:-1.02,y:.35,z:-1.4},{x:-1.02,y:.35,z:-1.5},h,120,CONFIG.step,.15));
});
test('10000 body-only differentials preserve original zero/margin/rotating hazard volumes exactly',()=>{
  const old=new HazardCollision(),clear=new ClearanceHazardCollision();let seed=42;
  const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<10000;i++){const hazard={kind:i%3,radius:.65+r()*.45,phase:r()*Math.PI*2,spin:r()*1.4-.7};const a={x:r()*4-2,y:r()*4-2,z:r()*4-2},b={x:a.x+r()-.5,y:a.y+r()-.5,z:a.z-r()};
    assert.equal(body.hit(a,b,hazard,120,CONFIG.step),old.hit(a,b,hazard,120,CONFIG.step));
    assert.equal(body.hit(a,b,hazard,120,CONFIG.step,.15),clear.hit(a,b,hazard,120,CONFIG.step,.15));}
});
test('all station solids retain original body sweeps, margins and tangent numerical guards',()=>{
  const legacy=new WreckCollision();let seed=17;const r=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const aperture of APERTURE_NAMES){const wall=wreckTransaction(42,4,aperture,'isolated').hazards[0]!;
    for(let i=0;i<2000;i++){const a={x:r()*24-12,y:r()*16-8,z:r()*10-5},b={x:a.x+r()-.5,y:a.y+r()-.5,z:a.z-r()};for(const margin of [0,.15])assert.equal(body.hit(a,b,wall,0,CONFIG.step,margin),legacy.sweep(a,b,wall,margin));}
  }
  const wall=wreckTransaction(42,4,'center','isolated').hazards[0]!;
  for(const epsilon of [-1e-13,0,1e-13]){const p={x:2.8-CONFIG.ship.radius+epsilon,y:0,z:0};assert.equal(body.hit(p,p,wall,0,CONFIG.step),legacy.sweep(p,p,wall,0));}
});
test('independent replay rejects each wing-only neutral trace that the original body accepted; new search finds a safe bypass',()=>{
  for(const sign of [-1,1]){
    const c=context([obstacle('wing-only',sign*1.7,-.35,68,{radius:.65})]);
    assert.equal(complete(beginTrajectoryReplay(c,knownControls(c),fixtureOptions)).decision,'accept');
    const options={...fixtureOptions,geometry:RELEASE_GEOMETRY};const replay=complete(beginTrajectoryReplay(c,trace(c),options));
    assert.equal(replay.decision,'reject');if(replay.decision==='reject')assert.equal(replay.reason,'COLLISION_FOUND');
    const result=complete(beginKnownFieldValidation(c,options));assert.equal(result.decision,'accept');
    if(result.decision==='accept')assert.equal(complete(beginTrajectoryReplay(c,result.witness.controls,options)).decision,'accept');
  }
});
test('final publication rejects old body-only witnesses and release validation without the shared profile',()=>{
  const tx=new FieldGenerator(42).propose(4,3),c={...context(),elapsed:0,candidate:tx};
  const old=complete(beginKnownFieldValidation(c,{}));assert.equal(old.decision,'accept');
  if(old.decision==='accept')assert.equal(complete(beginRuntimePublicationCheck(old.witness,c,{geometry:{...RELEASE_GEOMETRY,inspect:(t,k)=>new FieldGenerator(42).inspect(t,k)}})).decision,'reject');
  assert.equal(complete(beginKnownFieldValidation({...c,release:true},{})).decision,'reject');
  const moving={...obstacle('moving',1,0,68),collisionProfile:'moving-mine-sphere-v1' as const,motion:{version:'linear-crossing-v1' as const,startTick:0,durationTicks:120,velocityX:1}};
  assert.equal(complete(beginKnownFieldValidation(context([moving]),{...fixtureOptions,geometry:{...RELEASE_GEOMETRY,validHazard:()=>true}})).decision,'reject');
});

function reward(run:FragmentRun,x:number,y:number,passDistance=10){Object.assign(run.slots[0]!,{state:'active',proposal:{id:'test',section:4,anchor:'test',situation:'debris',x,y,passDistance}});return run;}
test('pickup assist fixes the .90 visual near miss; both wings collect once and distant misses remain misses',()=>{
  const old=reward(new FragmentRun(),0,.9);old.step(0,0,9.9,0,0,10.1,1);assert.equal(old.count,0);
  const next=reward(new FragmentRun(S,FRAGMENT.pickupAssist),0,.9);next.step(0,0,9.9,0,0,10.1,1);assert.equal(next.count,1);
  for(const part of S.parts){const run=reward(new FragmentRun(S,FRAGMENT.pickupAssist),part.offsetX,part.offsetY);run.step(0,0,10+part.offsetZ-.1,0,0,10+part.offsetZ+.1,1);assert.equal(run.count,1);run.step(0,0,9,0,0,11,2);assert.equal(run.count,1);}
  const miss=reward(new FragmentRun(S,FRAGMENT.pickupAssist),3,0);miss.step(0,0,9,0,0,11,1);assert.equal(miss.count,0);
});
test('pickup line of sight blocks rewards through station walls or an asteroid',()=>{
  const wall=wreckTransaction(42,4,'center','isolated').hazards[0]!;
  const run=reward(new FragmentRun(S,FRAGMENT.pickupAssist),2.95,0,wall.passDistance);
  run.step(1.95,0,wall.passDistance-.01,1.95,0,wall.passDistance+.01,1,[wall]);assert.equal(run.count,0);assert.ok(run.stats.occluded>0);
  const rock=obstacle('occlusion',0,0,10,{radius:.65}),r=reward(new FragmentRun(S,FRAGMENT.pickupAssist),0,0);
  r.step(0,0,9.9,0,0,10.1,1,[rock]);assert.equal(r.count,0);
});
test('both wings collect during actual Phase 2 diagonal120Hz steps and retain one count',()=>{
  for(const part of S.parts.slice(1)){
    const m=new ReleaseModel();m.ready();m.start(42);m.distance=500;m.elapsed=120;m.ship.vx=4;m.ship.vy=3;m.field.update=()=>{};
    reward(m.fragments,part.offsetX+.018,part.offsetY+.014,500.15-part.offsetZ);
    m.step(CONFIG.step,{x:.5,y:.5});assert.equal(m.fragments.count,1);assert.equal(m.fragments.lastPickup.part,part.id);
    m.step(CONFIG.step,{x:.5,y:.5});assert.equal(m.fragments.count,1);m.dispose();
  }
});
test('sphere-only moving-hazard relative sweeps use the same wing union without endpoint tunneling',()=>{
  const mine={kind:3,radius:.42,phase:0,spin:0},a={x:-2,y:.35,z:-.7},b={x:-1.2,y:.35,z:-.7};
  assert.equal(body.hit(a,b,mine,120,CONFIG.step),false);assert.ok(query.hit(a,b,mine,120,CONFIG.step));assert.equal(query.lastPart,'right-wing');
});
test('compound known-field witnesses survive normal Mixed Flow and final publication, without extra planner budget',()=>{
  const m=new ReleaseModel();m.ready();m.start(42);let last,audits=0;
  while(m.distance<1500&&m.state==='PLAYING'){
    m.step(CONFIG.step,certifiedInput(m));assert.equal(m.field.fault,undefined);
    const o=m.field.lastOutcome;if(!o||o===last)continue;last=o;
    if(o.witness){assert.equal(o.witness.geometryVersion,RELEASE_GEOMETRY.version);assert.equal(complete(beginTrajectoryReplay(o.witness.context,o.witness.controls,{geometry:RELEASE_GEOMETRY})).decision,'accept');audits++;}
  }
  assert.equal(m.hull,3);assert.ok(audits>=8);for(const s of m.field.samples){assert.ok(s.propagations<=3072);assert.ok(s.queries<=6144);}m.dispose();
});
test('station replay with compound profile rejects wing contact that clears its original body',()=>{
  const tx=wreckTransaction(42,4,'center','isolated'),c={...context(),elapsed:0,player:{x:1.65,y:0,vx:0,vy:0},candidate:tx,reservedUntilDistance:tx.endDistance};
  const old={geometry:WRECK_GEOMETRY};const before=complete(beginKnownFieldValidation(c,old));assert.equal(before.decision,'accept');
  const replay=complete(beginTrajectoryReplay(c,trace(c),{geometry:{...RELEASE_GEOMETRY,inspect:WRECK_GEOMETRY.inspect}}));assert.equal(replay.decision,'reject');
});
