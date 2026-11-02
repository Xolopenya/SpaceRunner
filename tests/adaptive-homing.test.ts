import { DifficultyDirector } from '../src/core/field-director.ts';
import { OwnershipLedger } from '../src/core/field-ownership.ts';
import { RuntimePlanningSession } from '../src/core/field-runtime-session.ts';
import { AdaptiveSource } from '../src/experiments/adaptive-homing/source.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import type { FlightState } from '../src/core/field-prediction.ts';
import type { AdaptiveHomingMotion } from '../src/core/field-types.ts';
import { beginKnownFieldValidation,beginResolvedRuntimeSearch,beginTrajectoryReplay,trajectoryStateKey } from '../src/core/field-validator.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import { Random } from '../src/core/random.ts';
import { initialAdaptiveState,stepAdaptiveMine } from '../src/experiments/adaptive-homing/controller.ts';
import { ADAPTIVE_GEOMETRY as geometry,adaptiveTransaction } from '../src/experiments/adaptive-homing/transaction.ts';
import { AdaptivePrediction,adaptiveHit } from '../src/experiments/adaptive-homing/prediction.ts';
import { AdaptiveHomingGameModel } from '../src/experiments/adaptive-homing/model.ts';
import type { HomingPreset } from '../src/experiments/adaptive-homing/settings.ts';
const root=()=>({player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:1,distance:20});
const context=(preset:HomingPreset='balanced')=>{const r=root(),candidate=adaptiveTransaction(42,4,r,preset);return{...r,candidate,committed:[],reservedUntilDistance:candidate.endDistance};};
const finish=(job:ValidationJob)=>{while(!job.getResult())job.advance();return job.getResult()!;};
function probe(preset:HomingPreset,lead?:number){const c=context(preset),h=c.candidate.hazards.at(-1)!,m=h.motion as AdaptiveHomingMotion,p=new FlightPrediction();
 const s:FlightState={...c.player,elapsed:c.elapsed,distance:c.distance,homing:initialAdaptiveState(h)};let hit=false,atReverse=0,overshoot=0,delay:number|undefined;const trace=[];
 for(let tick=m.capture.tick;tick<m.passTick+24;tick++){
  const reverse=m.passTick-(lead??0),axis=lead===undefined?{x:0,y:0}:{x:tick<m.startTick?0:tick<reverse?1:-1,y:0},a={...s};
  p.step(s,axis);s.homing=stepAdaptiveMine(s.homing!,s,m);hit||=adaptiveHit(a,s,h);
  assert.ok(Math.hypot(s.homing.vx,s.homing.vy)<=m.maxSpeed+1e-10);assert.ok(Math.hypot(s.homing.ax,s.homing.ay)<=m.maxAcceleration+1e-10);
  if(tick===reverse)atReverse=s.homing.x;if(tick>=reverse){overshoot=Math.max(overshoot,s.homing.x-atReverse);if(delay===undefined&&s.homing.vx<0)delay=(tick-reverse)/120;}
  trace.push({tick,ship:{x:s.x,y:s.y},mine:s.homing,input:axis});
 }return{hit,overshoot,delay,trace};}

test('adaptive pursuit is bounded, deterministic and genuinely follows changed current ship positions',()=>{
 const c=context(),h=c.candidate.hazards.at(-1)!,m=h.motion as AdaptiveHomingMotion;
 let a=initialAdaptiveState(h),b=a;for(let n=0;n<1300;n++){a=stepAdaptiveMine(a,{x:n<1000?6:-6,y:0},m);b=stepAdaptiveMine(b,{x:n<1000?6:-6,y:0},m);assert.deepEqual(a,b);}
 let left=initialAdaptiveState(h),right=left;for(let n=0;n<1100;n++){left=stepAdaptiveMine(left,{x:-6,y:0},m);right=stepAdaptiveMine(right,{x:6,y:0},m);}assert.ok(right.x-left.x>4);assert.notEqual(right.vx,left.vx);
 assert.ok(Object.isFrozen(a));assert.throws(()=>stepAdaptiveMine(a,{x:0,y:0},{...m,maxAcceleration:Infinity}),/Invalid/);
});
test('each research preset threatens neutral input, permits timed bait-reversal and punishes late reversal',()=>{
 for(const preset of ['soft','balanced','aggressive'] as const){assert.equal(probe(preset).hit,true);const escaped=probe(preset,132);assert.equal(escaped.hit,false);assert.ok(escaped.overshoot>.25);assert.ok(escaped.delay!>0.25);assert.equal(probe(preset,30).hit,true);}
});
test('bounded actual-root coupled proposal and independent replay fit existing publication ceilings',()=>{
 for(const preset of ['soft','balanced','aggressive'] as const){const c=context(preset),job=beginResolvedRuntimeSearch(c,{geometry});job.advance({propagations:3072,narrowQueries:6144},1);const r=job.getResult()!;
  assert.equal(r?.decision,'accept',JSON.stringify(r));assert.ok(job.metrics.propagations<=3072&&job.metrics.narrowQueries<=6144);assert.equal(job.metrics.searches,1);assert.equal(job.metrics.replays,1);assert.ok(job.metrics.mineUpdates!>0);
  if(r.decision==='accept'){const replay=finish(beginTrajectoryReplay(r.witness.context,r.witness.controls,{geometry}));assert.equal(replay.decision,'accept');if(replay.decision==='accept')assert.equal(replay.witness.hash,r.witness.hash);}
 }
});
test('branch copies retain independent mine dynamics and deduplication includes mine phase, pose and velocity',()=>{
 const c=context(),h=c.candidate.hazards.at(-1)!,m=h.motion as AdaptiveHomingMotion,p=new AdaptivePrediction(h);let s:FlightState={...c.player,elapsed:c.elapsed,distance:c.distance,homing:initialAdaptiveState(h)};
 while(Math.round(s.elapsed*120)<m.startTick+60)p.step(s,{x:0,y:0});const before=JSON.stringify(s),a={...s},b={...s};for(let n=0;n<120;n++){p.step(a,{x:1,y:0});p.step(b,{x:-1,y:0});}
 assert.equal(JSON.stringify(s),before);assert.notEqual(a.homing!.x,b.homing!.x);assert.notEqual(a.homing!.vx,b.homing!.vx);
 assert.notEqual(trajectoryStateKey({...s,homing:a.homing}),trajectoryStateKey({...s,homing:b.homing}));
});
test('fresh-root metadata and committed feedback state are required; late/invalid candidates fail closed',()=>{
 const c=context(),h=c.candidate.hazards.at(-1)!,m=h.motion as AdaptiveHomingMotion;
 assert.equal(finish(beginResolvedRuntimeSearch({...c,player:{...c.player,x:1}},{geometry})).decision,'reject');
 assert.equal(geometry.validHazard({...h,motion:{...m,maxSpeed:9}}),false);assert.throws(()=>adaptiveTransaction(42,4,{...root(),distance:175}),/WARNING/);
 const native={...c,candidate:{...c.candidate,provenance:{...c.candidate.provenance,version:'ambient-v1'},hazards:[]},committed:[h]};
 assert.equal(geometry.validRoot!(native),false);assert.equal(geometry.validRoot!({...native,homing:initialAdaptiveState(h)}),true);
 assert.equal(geometry.validRoot!({...native,homing:{...initialAdaptiveState(h),tick:999}}),false);
});
test('adaptive relative CCD matches12000 independent closest-point intervals, tangency and between-endpoint hits',()=>{
 const h=context().candidate.hazards.at(-1)!,random=new Random(2491),initial=initialAdaptiveState(h);
 for(let n=0;n<12000;n++){
  const a:FlightState={x:random.between(-6,6),y:random.between(-3.6,3.6),vx:0,vy:0,elapsed:1,distance:180+random.between(-2,2),homing:{...initial,x:random.between(-6,6),y:random.between(-3.6,3.6)}},
   b:FlightState={...a,x:a.x+random.between(-8,8)/120,y:a.y+random.between(-8,8)/120,elapsed:1+CONFIG.step,distance:a.distance+random.between(20,34)/120,homing:{...a.homing!,x:a.homing!.x+random.between(-6,6)/120,y:a.homing!.y+random.between(-6,6)/120}};
  const from=[a.x-a.homing!.x,a.y-a.homing!.y,180-a.distance],to=[b.x-b.homing!.x,b.y-b.homing!.y,180-b.distance],d=to.map((v,i)=>v-from[i]!),length=d.reduce((n,v)=>n+v*v,0),t=length?Math.max(0,Math.min(1,-from.reduce((n,v,i)=>n+v*d[i]!,0)/length)):0,closest=from.reduce((n,v,i)=>n+(v+t*d[i]!)**2,0);
  for(const margin of [0,.15])assert.equal(adaptiveHit(a,b,h,margin),closest<=(1.77+margin)**2);
 }
 const mine={...initial,x:0,y:0},a={...root().player,x:-10,y:1.77,elapsed:1,distance:180,homing:mine},b={...a,x:10,elapsed:1+CONFIG.step};assert.ok(adaptiveHit(a,b,h));assert.equal(adaptiveHit({...a,y:1.78},{...b,y:1.78},h),false);
});
test('actual model pursuit uses the same controller/CCD and real hull damage; bait reversal escapes',()=>{
 for(const lead of [undefined,132,30]){const m=new AdaptiveHomingGameModel(true);m.ready();m.start(42);let first;
  while(m.distance<184&&m.state==='PLAYING'){
   first??=m.homing.encounters[0];const motion=first?.motion as AdaptiveHomingMotion|undefined,tick=Math.round(m.elapsed*120),axis=lead===undefined||!motion?{x:0,y:0}:{x:tick<motion.startTick?0:tick<motion.passTick-lead?1:-1,y:0};m.step(CONFIG.step,axis);assert.equal(m.field.fault,undefined);
  }
  assert.ok(first);assert.equal(m.hull,lead===132?3:2);assert.equal(m.hitSerial,lead===132?0:1);assert.ok(m.homing.samples.some(s=>s.mine.phase==='pursuit'));m.dispose();
 }
 const m=new AdaptiveHomingGameModel(true);m.ready();m.start(43);let first,reversed=false;
 while(m.distance<186&&m.state==='PLAYING'){
  first??=m.homing.encounters[0];const motion=first?.motion as AdaptiveHomingMotion|undefined,tick=Math.round(m.elapsed*120);
  const x=!motion||tick<motion.passTick-232?0:tick<motion.passTick-160?1:-1;
  if(motion&&tick===motion.passTick-160){assert.ok(m.ship.vx>6&&m.homing.current!.vx>.3);reversed=true;}
  m.step(CONFIG.step,{x,y:0});
 }
 assert.ok(reversed);assert.equal(m.hull,3);assert.equal(m.hitSerial,0);assert.ok(m.homing.samples.filter(s=>s.ship.vx<-.3&&s.mine.vx>.3).length>15);m.dispose();
});
test('live feedback freezes on pause and resets deterministic state, trace and fixed slots on restart',()=>{
 const m=new AdaptiveHomingGameModel(true);m.ready();m.start(42);const slots=[...m.field.slots];for(let n=0;n<850;n++)m.step(CONFIG.step,{x:0,y:0});
 const before=JSON.stringify(m.homing.trace()),elapsed=m.elapsed;m.pause();for(let n=0;n<120;n++)m.step(CONFIG.step,{x:1,y:1});assert.equal(m.elapsed,elapsed);assert.equal(JSON.stringify(m.homing.trace()),before);
 m.resume();m.state='GAME_OVER';m.start(42);for(let n=0;n<850;n++)m.step(CONFIG.step,{x:0,y:0});assert.equal(JSON.stringify(m.homing.trace()),before);assert.ok(m.field.slots.every((s,i)=>s===slots[i]));m.dispose();
});
test('full coupled beam search/replay includes held reaction and future static geometry without changing budgets',()=>{
 const c=context(),r=finish(beginKnownFieldValidation(c,{geometry}));assert.equal(r.decision,'accept');if(r.decision!=='accept')return;
 const replay=finish(beginTrajectoryReplay(r.witness.context,r.witness.controls,{geometry}));assert.equal(replay.decision,'accept');assert.ok(r.witness.controls[0]!.ticks>=54);assert.ok(r.witness.terminal.homing===undefined||Object.isFrozen(r.witness.terminal.homing));
});

test('publication resolves actual changed Ship state and never publishes unfinished or cancelled coupled work',()=>{
 for(const mode of ['actual','budget','cancel']){
  const r=root(),source=new AdaptiveSource(true),section=source.next(42,new DifficultyDirector(42).initial(4)).section,ledger=new OwnershipLedger();ledger.reset(4);
  const candidate=source.candidate(section,[],r),session=new RuntimePlanningSession(section,r,[],ledger,'culled',candidate);
  if(mode==='cancel'){session.cancel();assert.equal(ledger.snapshot().length,0);continue;}
  const p=new FlightPrediction(),s={...r.player,elapsed:r.elapsed,distance:r.distance};
  for(let age=1;age<=144&&!session.getResult();age++){p.step(s,{x:1,y:0});session.advance({player:s,input:{x:1,y:0},elapsed:s.elapsed,distance:s.distance},[],age,mode==='budget'?{propagations:0,narrowQueries:0}:undefined);}
  const o=session.getResult()!;assert.ok(o);assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.metrics.planningTicks<=144&&o.attempts.length<=2);
  if(mode==='actual'){assert.equal(o.status,'committed');const h=o.transaction!.hazards.at(-1)!;assert.equal((h.motion as AdaptiveHomingMotion).capture.x,s.x);assert.equal(o.publicationChecks![0]!.witness,undefined);}
  else assert.ok(!o.transaction?.hazards.some(h=>h.motion?.version==='adaptive-homing-v1'));
 }
});
test('complete known Mixed Flow and actual feedback roots independently replay on a long causal flight',()=>{
 const m=new AdaptiveHomingGameModel(true);m.ready();m.start(42);let last,audits=0;const families=new Set<string>();
 for(let n=0;n<14000&&m.distance<2500&&m.state==='PLAYING';n++){
  const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0,input={x:0,y:0};for(const r of w?.controls??[]){if(at<r.ticks){input=r.input;break;}at-=r.ticks;}
  m.step(CONFIG.step,input);assert.equal(m.field.fault,undefined);assert.ok(m.field.slots.filter(h=>h.active&&h.kind===9).length<=1);
  const o=m.field.lastOutcome;if(o&&o!==last){last=o;families.add(o.section.encounter!);if(o.witness){const replay=finish(beginTrajectoryReplay(o.witness.context,o.witness.controls,{geometry}));assert.equal(replay.decision,'accept');if(replay.decision==='accept')assert.equal(replay.witness.hash,o.witness.hash);audits++;}}
 }
 assert.equal(m.hull,3);assert.ok(m.distance>=2500);assert.ok(audits>10);for(const name of ['moving-mine','station-wreck','ambient','scattered','narrowing','alternating'])assert.ok(families.has(name),name);m.dispose();assert.equal(m.homing.samples.length,0);
});
