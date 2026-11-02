import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { sameHazard, OwnershipLedger } from '../src/core/field-ownership.ts';
import { RuntimePlanningSession } from '../src/core/field-runtime-session.ts';
import { beginResolvedRuntimeSearch, beginKnownFieldValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { FieldValidationContext, PlannedHazard, TargetLockMotion } from '../src/core/field-types.ts';
import { Random } from '../src/core/random.ts';
import { MovingMineGameModel } from '../src/experiments/moving-mine/model.ts';
import { targetLockSource, targetLockTransaction, targetLockInitial, targetCapture, TARGET_GEOMETRY as geometry } from '../src/experiments/moving-mine/target-lock-source.ts';
import { TARGET_LOCK as T } from '../src/experiments/moving-mine/target-lock-settings.ts';
import { mineX, mineY, isMine, simulationTick } from '../src/experiments/moving-mine/motion.ts';
import { movingMineHit, MineCollision } from '../src/experiments/moving-mine/collision.ts';

const root=()=>({player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:1,distance:20});
const complete=(j:ValidationJob)=>{while(!j.getResult())j.advance();return j.getResult()!;};
const context=(r=root(),seed=42,speed=4,warning=120):FieldValidationContext=>{
  const candidate=targetLockTransaction(seed,4,r,simulationTick(r.elapsed)-T.acquisitionTicks,{attackSpeed:speed,minimumWarningTicks:warning});
  return{...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance};
};
function controls(m:MovingMineGameModel){const w=m.field.certificate;let t=w?Math.round((m.elapsed-w.context.elapsed)*120):0;
 for(const r of w?.controls??[]){if(t<r.ticks)return r.input;t-=r.ticks;}return{x:0,y:0};}

test('target metadata captures the observed root, freezes once, and binds complete IDs to the capture',()=>{
 const r={...root(),player:{x:4,y:-2,vx:3,vy:-1},input:{x:.4,y:-.2}},c=context(r),h=c.candidate.hazards.find(isMine)!,m=h.motion as TargetLockMotion;
 assert.deepEqual(m.capture,targetCapture(r));assert.equal(m.targetX,4);assert.equal(m.targetY,-2);assert.ok(Object.isFrozen(m)&&Object.isFrozen(m.capture));
 assert.ok(geometry.resolvedAt!(c));assert.deepEqual(context(r).candidate,c.candidate);
 const changed=context({...r,player:{...r.player,x:4.01}});assert.notEqual(changed.candidate.hazards.at(-1)!.id,h.id);
 assert.equal(sameHazard(h,{...h,motion:{...m,capture:{...m.capture,inputX:.5}}}),false);
 assert.equal(geometry.validHazard({...h,motion:{...m,targetX:3.9}}),false);
 assert.equal(geometry.validHazard({...h,motion:{...m,startTick:m.startTick+.5}}),false);
 assert.equal(geometry.inspect({...c.candidate,hazards:c.candidate.hazards.slice(1)},[]).status,'invalid');
 assert.equal(complete(beginResolvedRuntimeSearch({...c,player:{...r.player,x:3}},{geometry})).decision,'reject');
 assert.equal(complete(beginResolvedRuntimeSearch(c,{})).decision,'reject');
});

test('bounded tuning and integer phases align attack with real forward plane and retain warning',()=>{
 for(const seed of [0,11,42])for(const speed of [3,4,5])for(const warning of [96,120,144])for(const elapsed of [1,121]){
  const c=context({...root(),elapsed},seed,speed,warning),h=c.candidate.hazards.find(isMine)!,m=h.motion as TargetLockMotion;
  assert.ok(m.startTick-m.capture.tick>=warning);assert.equal(m.startTick+m.durationTicks,m.passTick);
  assert.ok(Math.hypot(m.velocityX,m.velocityY)<=speed+1e-12);assert.ok(Math.hypot(m.velocityX,m.velocityY)>speed-.1);
  assert.equal(mineX(h,m.startTick/120),h.x);assert.equal(mineY(h,m.startTick/120),h.y);
  assert.ok(Math.abs(mineX(h,m.passTick/120)-m.targetX)<1e-12);assert.ok(Math.abs(mineY(h,m.passTick/120)-m.targetY)<1e-12);
  assert.equal(mineX(h,(m.passTick+300)/120),mineX(h,m.passTick/120));assert.equal(mineY(h,(m.passTick+300)/120),mineY(h,m.passTick/120));
 }
 assert.throws(()=>context(root(),42,6),/INVALID_TARGET_CAPTURE/);
 const origin=targetLockInitial(42,4),near={...root(),player:{...root().player,...origin}};
 assert.throws(()=>targetLockTransaction(42,4,near,24,undefined,0),/TARGET_TOO_CLOSE/);
 assert.equal((context(near).candidate.hazards.at(-1)!.motion as TargetLockMotion).originChoice,1);
 assert.throws(()=>context({...root(),distance:175}),/WARNING_EXPIRED/);
});

test('fresh publication proof accepts center, edges, corners and velocity states; every witness replays independently',()=>{
 let accepted=0,rejected=0;
 for(const [x,y]of [[0,0],[-6,0],[6,0],[0,-3.6],[0,3.6],[-6,-3.6],[-6,3.6],[6,-3.6],[6,3.6]])for(const [vx,vy]of [[0,0],[8,0],[-4,4]]){
  const r={...root(),player:{x:x!,y:y!,vx:vx!,vy:vy!}};let c:FieldValidationContext;
  try{c=context(r);}catch{rejected++;continue;}
  const checked=complete(beginResolvedRuntimeSearch(c,{geometry}));assert.equal(checked.decision,'accept',JSON.stringify({r,checked}));
  if(checked.decision!=='accept')continue;accepted++;const w=checked.witness;
  const replay=complete(beginTrajectoryReplay(w.context,w.controls,{geometry}));assert.equal(replay.decision,'accept');if(replay.decision==='accept')assert.equal(replay.witness.hash,w.hash);
  assert.ok(Object.isFrozen((w.context.candidate.hazards.at(-1)!.motion as TargetLockMotion).capture));
 }
 assert.equal(accepted,27);assert.equal(rejected,0);
});

test('preview has no live mine; delayed publication captures changed ACTUAL state with one bounded synchronous search/replay',()=>{
 const source=targetLockSource(true),initial=root(),d=source.next(42,new DifficultyDirector(42).initial(4)),ledger=new OwnershipLedger();ledger.reset(4);
 const candidate=source.candidate(d.section,[],initial);let resolutions=0;
 const session=new RuntimePlanningSession(d.section,initial,[],ledger,'culled',{...candidate,resolveAtPublication:r=>{resolutions++;return candidate.resolveAtPublication!(r);}});
 const state={...initial.player,elapsed:initial.elapsed,distance:initial.distance},p=new FlightPrediction();
 for(let age=1;age<97;age++){if(age>1)p.step(state,{x:1,y:0});session.advance({...initial,player:state,input:{x:1,y:0},elapsed:state.elapsed,distance:state.distance},[],age);assert.equal(resolutions,0);assert.equal(ledger.knownHazards(state.distance).length,0);}
 p.step(state,{x:0,y:1});const actual={player:state,input:{x:0,y:1},elapsed:state.elapsed,distance:state.distance};session.advance(actual,[],97);
 const o=session.getResult()!;assert.equal(o.status,'committed',JSON.stringify(o));assert.equal(resolutions,1);assert.equal(o.metrics.searches,1);assert.equal(o.metrics.replays,1);
 assert.ok(o.metrics.propagations<=3072&&o.metrics.narrowQueries<=6144);const h=o.transaction!.hazards.find(isMine)!;
 assert.deepEqual((h.motion as TargetLockMotion).capture,targetCapture(actual));assert.equal(o.witness!.context.elapsed,actual.elapsed);
 assert.equal(ledger.knownHazards(actual.distance).find(isMine)!.id,h.id);assert.equal(o.publicationChecks![0]!.witness,undefined);
 session.advance(actual,[],98);assert.equal(resolutions,1);
});

test('stale captured root, exhausted publication budget, fallback and cancellation never publish an uncertified target',()=>{
 for(const failure of ['stale','budget','cancel','span','deadline']){
  const s=targetLockSource(true),r=root(),d=s.next(42,new DifficultyDirector(42).initial(4)),ledger=new OwnershipLedger();ledger.reset(4);const candidate=s.candidate(d.section,[],r);
  const custom=failure==='stale'?{...candidate,resolveAtPublication:()=>targetLockTransaction(42,4,{...r,elapsed:1.8,distance:36},120)}
   :failure==='span'?{...candidate,resolveAtPublication:(current:typeof r)=>({...candidate.resolveAtPublication!(current),firstCell:3})}
   :failure==='deadline'?{...candidate,publicationDelayTicks:144,resolveAtPublication:()=>{throw Error('FORCED_TARGET_FAILURE');}}:candidate;
  const session=new RuntimePlanningSession(d.section,r,[],ledger,'culled',custom);
  if(failure==='cancel'){session.cancel();assert.equal(ledger.snapshot().length,0);continue;}
  const p=new FlightPrediction(),state={...r.player,elapsed:r.elapsed,distance:r.distance};
  for(let age=1;age<=144&&!session.getResult();age++){if(age>1)p.step(state,{x:0,y:0});session.advance({player:state,input:r.input,elapsed:state.elapsed,distance:state.distance},[],age,failure==='budget'?{propagations:0,narrowQueries:0}:undefined);}
  const o=session.getResult()!;assert.ok(o);assert.ok(!o.transaction?.hazards.some(isMine));assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.attempts.length<=2);
  assert.ok(o.metrics.planningTicks<=144);
  if(failure==='stale')assert.ok(o.publicationChecks?.some(p=>p.result.decision==='reject'));
  else if(failure==='budget'||failure==='deadline')assert.equal(o.status,'omitted-uncertified');
  else assert.ok(o.attempts.some(a=>a.reason?.startsWith('resolution:STRUCTURAL_INVALID')));
 }
});

test('target relative CCD matches analytical closest point over12000 random intervals including phase boundaries',()=>{
 const rng=new Random(8492),live=new MineCollision(),h=context().candidate.hazards.find(isMine)!,m=h.motion as TargetLockMotion;
 for(let n=0;n<12000;n++){
  const tick=n%3===0?m.startTick+(n%5)-2:n%3===1?m.passTick+(n%5)-2:m.capture.tick+Math.floor(rng.next()*(m.passTick-m.capture.tick));
  const a={x:rng.between(-6,6),y:rng.between(-3.6,3.6),vx:0,vy:0,elapsed:tick/120,distance:h.passDistance+rng.between(-2.5,2.5)};
  const b={...a,x:a.x+rng.between(-8,8)/120,y:a.y+rng.between(-8,8)/120,elapsed:(tick+1)/120,distance:a.distance+rng.between(20,34)/120};
  const v=[a.x-mineX(h,a.elapsed),a.y-mineY(h,a.elapsed),h.passDistance-a.distance],end=[b.x-mineX(h,b.elapsed),b.y-mineY(h,b.elapsed),h.passDistance-b.distance];
  const d=end.map((x,i)=>x-v[i]!),length=d.reduce((s,x)=>s+x*x,0),t=length?Math.max(0,Math.min(1,-v.reduce((s,x,i)=>s+x*d[i]!,0)/length)):0;
  const d2=v.reduce((s,x,i)=>s+(x+t*d[i]!)**2,0);
  for(const margin of [0,.15])assert.equal(movingMineHit(a,b,h,margin),d2<=(1.77+margin)**2);
  assert.equal(live.hit({x:a.x-mineX(h,b.elapsed),y:a.y-mineY(h,b.elapsed),z:v[2]!},{x:end[0]!,y:end[1]!,z:end[2]!},{...h,planned:h},b.elapsed,CONFIG.step),d2<=1.77**2);
 }
 const at={x:0,y:0,vx:0,vy:0,elapsed:m.passTick/120,distance:180};
 assert.ok(movingMineHit({...at,x:-4,y:1.77},{...at,x:4,y:1.77},h));assert.equal(movingMineHit({...at,x:-4,y:1.78},{...at,x:4,y:1.78},h),false);
 assert.ok(movingMineHit({...at,x:-10},{...at,x:10,elapsed:at.elapsed+CONFIG.step},h));
});

test('real neutral approach hits, deliberate post-lock evasion succeeds, and target never follows later input',()=>{
 for(const evade of [false,true]){
  const m=new MovingMineGameModel(undefined,true,'target-lock');m.ready();m.start(42);let captured:PlannedHazard|undefined,bytes:string|undefined;
  for(let n=0;n<1150;n++){
   m.step(CONFIG.step,evade&&captured?{x:0,y:1}:{x:0,y:0});assert.equal(m.field.fault,undefined);
   const h=m.field.slots.find(h=>h.planned?.motion?.version===T.version);if(h){captured??=h.planned;bytes??=JSON.stringify(captured);assert.equal(JSON.stringify(h.planned),bytes);}
  }
  assert.ok(captured);assert.equal(m.hull,evade?3:2);assert.equal(m.hitSerial,evade?0:1);m.dispose();
 }
});

test('real target model remains safe on causal witnesses, freezes on pause, and resets all capture clocks/resources',()=>{
 const m=new MovingMineGameModel(undefined,true,'target-lock');m.ready();m.start(42);const slots=[...m.field.slots];let target:PlannedHazard|undefined;
 for(let n=0;n<2500;n++){m.step(CONFIG.step,controls(m));assert.equal(m.field.fault,undefined);target??=m.field.slots.find(h=>h.planned?.motion?.version===T.version)?.planned;}
 assert.equal(m.hull,3);assert.ok(target);const before=JSON.stringify(m.field.exportDiagnosticTrace()),elapsed=m.elapsed;m.pause();for(let n=0;n<120;n++)m.step(CONFIG.step,{x:1,y:1});assert.equal(m.elapsed,elapsed);assert.equal(JSON.stringify(m.field.exportDiagnosticTrace()),before);
 m.resume();m.state='GAME_OVER';m.start(42);for(let n=0;n<97;n++)m.step(CONFIG.step,{x:0,y:0});
 const again=m.field.slots.find(h=>h.planned?.motion?.version===T.version)!.planned!;assert.deepEqual(again,target);assert.ok(m.field.slots.every((h,i)=>h===slots[i]));m.dispose();
});

test('normal mixed encounters and canonical known target geometry remain jointly validated',()=>{
 const m=new MovingMineGameModel(undefined,true,'target-lock');m.ready();m.start(42);const families=new Set<string>();let last,audits=0;
 for(let n=0;n<13000&&m.distance<2500;n++){
  m.step(CONFIG.step,controls(m));assert.equal(m.field.fault,undefined);assert.ok(m.field.slots.filter(h=>h.active&&isMine(h)).length<=1);
  const o=m.field.lastOutcome;if(o&&o!==last){last=o;families.add(o.section.encounter!);if(o.witness){const r=complete(beginTrajectoryReplay(o.witness.context,o.witness.controls,{geometry}));assert.equal(r.decision,'accept');if(r.decision==='accept')assert.equal(r.witness.hash,o.witness.hash);audits++;}}
 }
 assert.equal(m.hull,3);assert.ok(audits>10);for(const f of ['moving-mine','station-wreck','ambient','scattered','narrowing','alternating'])assert.ok(families.has(f),f);m.dispose();
 const c=context(),h=c.candidate.hazards.find(isMine)!,bad={...c,candidate:{...c.candidate,hazards:[...c.candidate.hazards,h]}};assert.equal(complete(beginKnownFieldValidation(bad,{geometry})).decision,'reject');
});
