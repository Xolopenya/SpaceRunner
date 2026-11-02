import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {CONFIG} from '../src/config.ts';
import {FlightPrediction} from '../src/core/field-prediction.ts';
import {beginResolvedRuntimeSearch,beginKnownFieldValidation,beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {MovingMineGameModel} from '../src/experiments/moving-mine/model.ts';
import {targetLockTransaction,TARGET_GEOMETRY} from '../src/experiments/moving-mine/target-lock-source.ts';
import {mineX,mineY,simulationTick,isMine} from '../src/experiments/moving-mine/motion.ts';
import {movingMineHit} from '../src/experiments/moving-mine/collision.ts';
import {AdaptiveHomingGameModel} from '../src/experiments/adaptive-homing/model.ts';
import {adaptiveTransaction,ADAPTIVE_GEOMETRY,isAdaptive} from '../src/experiments/adaptive-homing/transaction.ts';
import {initialAdaptiveState,stepAdaptiveMine} from '../src/experiments/adaptive-homing/controller.ts';
import {adaptiveHit} from '../src/experiments/adaptive-homing/prediction.ts';
import {HOMING_PRESETS} from '../src/experiments/adaptive-homing/settings.ts';
import {stats} from './director-fields.mjs';
const output=resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-EXPERIMENT-003C4/final');await mkdir(output,{recursive:true});
const root=(elapsed=1,x=0,y=0,vx=0,vy=0)=>({player:{x,y,vx,vy},input:{x:0,y:0},elapsed,distance:20});
const finish=job=>{while(!job.getResult())job.advance();return job.getResult();};
const policies=['target-lock','soft','balanced','aggressive'],fixtures=[],witnesses=[],grids=[],probes=[],runs=[],negative=[],forks=[];let audits=0;
const geometryFor=w=>w.geometryVersion===ADAPTIVE_GEOMETRY.version?ADAPTIVE_GEOMETRY:TARGET_GEOMETRY;
function audit(w){const r=finish(beginTrajectoryReplay(w.context,w.controls,{geometry:geometryFor(w)}));assert.equal(r.decision,'accept');assert.equal(r.witness.hash,w.hash);witnesses.push(w);audits++;}
function transaction(policy,seed,r){return policy==='target-lock'?targetLockTransaction(seed,4,r,simulationTick(r.elapsed)-96):adaptiveTransaction(seed,4,r,policy);}
function bounded(c){const j=beginResolvedRuntimeSearch(c,{geometry:ADAPTIVE_GEOMETRY}),start=performance.now();j.advance({propagations:3072,narrowQueries:6144},1);return{result:j.getResult()??{decision:'unfinished',reason:'ACTUAL_REPLAY_BUDGET'},metrics:j.metrics,ms:performance.now()-start};}
const positions=[['center',0,0],['left',-6,0],['right',6,0],['bottom',0,-3.6],['top',0,3.6],['bottom-left',-6,-3.6],['top-left',-6,3.6],['bottom-right',6,-3.6],['top-right',6,3.6]];
const velocities=[['neutral',0,0],['left',-8,0],['right',8,0],['up',0,8],['down',0,-8],['diagonal',4,-4]];
for(const preset of Object.keys(HOMING_PRESETS))for(const seed of [0,11,42])for(const elapsed of [1,121])for(const[name,x,y]of positions)for(const[velocity,vx,vy]of velocities){
 const r=root(elapsed,x,y,vx,vy),start=performance.now(),candidate=adaptiveTransaction(seed,4,r,preset),resolutionMs=performance.now()-start,c={...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance},checked=bounded(c);
 assert.ok(checked.metrics.propagations<=3072&&checked.metrics.narrowQueries<=6144&&(checked.metrics.mineUpdates??0)<=checked.metrics.propagations);
 if(checked.result.decision==='accept')audit(checked.result.witness);fixtures.push({preset,seed,elapsed,name,velocity,resolutionMs,...checked});
}
function closest(a,b){const d=b.map((v,i)=>v-a[i]),n=d.reduce((s,v)=>s+v*v,0),t=n?Math.max(0,Math.min(1,-a.reduce((s,v,i)=>s+v*d[i],0)/n)):0;return Math.sqrt(a.reduce((s,v,i)=>s+(v+t*d[i])**2,0));}
function probe(r,h,actor){
 const adaptive=isAdaptive(h),p=new FlightPrediction(),s={...r.player,elapsed:r.elapsed,distance:r.distance,...(adaptive?{homing:initialAdaptiveState(h)}:{})},trace=[];let hit=false,near=0,clearance=Infinity,xTravel=0,yTravel=0,headingChanges=0,turnAngle=0,lastSign=0,lastV,reverse,peak=-Infinity,correctionDelay;
 const plane=h.motion.passTick,reverseTick=plane-actor.lead;let planePose,depthIntersection,pursuitTicks=0,lastTick=simulationTick(r.elapsed);
 for(let n=0;n<1800&&s.distance<h.passDistance+h.radius+CONFIG.hazards.despawnZ;n++){
  const tick=simulationTick(s.elapsed),input=actor.input(tick,h),a={...s};p.step(s,input);if(adaptive)s.homing=stepAdaptiveMine(s.homing,s,h.motion);
  const liveTick=simulationTick(s.elapsed),linearActive=liveTick>h.motion.startTick&&liveTick<=h.motion.startTick+h.motion.durationTicks;
  const mine=adaptive?s.homing:{id:h.id,tick:liveTick,x:mineX(h,s.elapsed),y:mineY(h,s.elapsed),vx:linearActive?h.motion.velocityX:0,vy:linearActive?h.motion.velocityY:0,ax:0,ay:0,phase:liveTick<h.motion.startTick?'warning':linearActive?'locked-path':'hold'};
  const prevMine=adaptive?a.homing:{x:mineX(h,a.elapsed),y:mineY(h,a.elapsed)};lastTick=liveTick;if(mine.phase==='pursuit'||mine.phase==='locked-path')pursuitTicks++;if(liveTick===plane)planePose={tick:liveTick,distance:s.distance,mine:{x:mine.x,y:mine.y,vx:mine.vx,vy:mine.vy},ship:{x:s.x,y:s.y,vx:s.vx,vy:s.vy}};
  if(a.distance<=h.passDistance&&s.distance>=h.passDistance){const alpha=(h.passDistance-a.distance)/(s.distance-a.distance);depthIntersection={endTick:liveTick,alpha,mine:{x:prevMine.x+(mine.x-prevMine.x)*alpha,y:prevMine.y+(mine.y-prevMine.y)*alpha},ship:{x:a.x+(s.x-a.x)*alpha,y:a.y+(s.y-a.y)*alpha}};}
  hit||=adaptive?adaptiveHit(a,s,h):movingMineHit(a,s,h);const from=[a.x-prevMine.x,a.y-prevMine.y,h.passDistance-a.distance],to=[s.x-mine.x,s.y-mine.y,h.passDistance-s.distance],d=closest(from,to);
  clearance=Math.min(clearance,d-1.77);if(d<=3.77)near++;xTravel+=Math.abs(s.x-a.x);yTravel+=Math.abs(s.y-a.y);
  const speed=Math.hypot(mine.vx,mine.vy);if(lastV&&speed>.3&&Math.hypot(lastV.vx,lastV.vy)>.3)turnAngle+=Math.acos(Math.max(-1,Math.min(1,(mine.vx*lastV.vx+mine.vy*lastV.vy)/(speed*Math.hypot(lastV.vx,lastV.vy)))));
  const sign=Math.abs(mine.vx)>.05?Math.sign(mine.vx):0;if(sign&&lastSign&&sign!==lastSign)headingChanges++;if(sign)lastSign=sign;lastV=mine;
  if(tick===reverseTick)reverse={tick,shipX:a.x,shipVx:a.vx,mineX:prevMine.x,mineVx:a.homing?.vx??mine.vx};
  if(reverse&&tick>=reverseTick){peak=Math.max(peak,mine.x);if(correctionDelay===undefined&&mine.vx<0)correctionDelay=(tick-reverseTick)/120;}
  if(n%4===0||tick===reverseTick)trace.push({tick:simulationTick(s.elapsed),elapsed:s.elapsed,distance:s.distance,ship:{x:s.x,y:s.y,vx:s.vx,vy:s.vy},input,mine});
 }
 return{hit,clearance,nearSeconds:near/120,pursuitSeconds:pursuitTicks/120,warningSeconds:adaptive?(h.motion.startTick-h.motion.warningTick)/120:(h.motion.startTick-h.motion.capture.tick)/120,encounterSeconds:(lastTick-(h.motion.warningTick??h.motion.capture.tick))/120,planePose,depthIntersection,xTravel,yTravel,headingChanges,turnAngle,reverse,overshoot:reverse?peak-reverse.mineX:null,correctionDelay,trace};
}
const neutral={name:'neutral',lead:0,input:()=>({x:0,y:0})};
for(const policy of policies)for(const seed of [0,11,42])for(const x of [-6,-3,0,3,6])for(const y of [-3.2,-1.6,0,1.6,3.2]){
 const r=root(1,x,y),candidate=transaction(policy,seed,r),c={...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance},result=policy==='target-lock'?finish(beginKnownFieldValidation(c,{geometry:TARGET_GEOMETRY})):bounded(c).result;
 if(result.decision!=='accept'){grids.push({policy,seed,x,y,published:false,reason:result.reason});continue;}audit(result.witness);const mine=candidate.hazards.find(isMine),p=probe(r,mine,neutral);grids.push({policy,seed,x,y,published:true,boundary:Math.abs(x)===6||Math.abs(y)===3.2,mine,...p});
}
const actors=[neutral,...[360,240,180,132,90,60,30,0].map(lead=>({name:'early-away-'+lead,lead,input:(tick,h)=>({x:tick>=h.motion.passTick-lead?1:0,y:0})})),
 ...[200,180,160,132,90,30].map(lead=>({name:'bait-'+lead,lead,input:(tick,h)=>({x:tick<h.motion.passTick-lead-72?0:tick<h.motion.passTick-lead?1:-1,y:0})})),
 {name:'long-bait-late',lead:30,input:(tick,h)=>({x:tick<h.motion.startTick?0:tick<h.motion.passTick-30?1:-1,y:0})},
 {name:'repeated',lead:0,input:(tick,h)=>({x:tick<h.motion.startTick?0:Math.floor((tick-h.motion.startTick)/72)%2?1:-1,y:0})},
 {name:'irregular',lead:0,input:tick=>({x:Math.sin(tick/55),y:Math.cos(tick/93)*.7})},
 ...[{x:-1,y:0},{x:1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1}].map((axis,i)=>({name:'held-'+i,lead:0,input:()=>axis}))];
for(const policy of policies)for(const seed of [42,43])for(const actor of actors){const r=root(),h=transaction(policy,seed,r).hazards.find(isMine),p=probe(r,h,actor);probes.push({policy,seed,name:actor.name,mine:h,...p});}
for(const policy of policies){const r=root(),h=transaction(policy,43,r).hazards.find(isMine),a=probe(r,h,neutral),b=probe(r,h,actors.find(a=>a.name==='bait-160'));
 const other=new Map(b.trace.map(p=>[p.tick,p.mine]));const divergence=Math.max(...a.trace.filter(p=>other.has(p.tick)).map(p=>Math.hypot(p.mine.x-other.get(p.tick).x,p.mine.y-other.get(p.tick).y)));forks.push({policy,seed:43,divergence});if(policy==='target-lock')assert.equal(divergence,0);else assert.ok(divergence>2);}
for(const preset of Object.keys(HOMING_PRESETS)){
 const r=root(),candidate=adaptiveTransaction(42,4,r,preset),c={...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance},accepted=bounded(c).result;assert.equal(accepted.decision,'accept');const h=candidate.hazards.find(isMine),total=accepted.witness.controls.reduce((n,r)=>n+r.ticks,0),runs=[];
 for(let n=0;n<total;n++){const tick=simulationTick(r.elapsed)+n,input=n>=total-39?{x:0,y:0}:{x:tick<h.motion.startTick?0:tick<h.motion.passTick-30?1:-1,y:0},last=runs.at(-1);if(last&&last.input.x===input.x&&last.input.y===input.y)last.ticks++;else runs.push({ticks:1,input});}
 const rejected=finish(beginTrajectoryReplay(c,runs,{geometry:ADAPTIVE_GEOMETRY}));assert.equal(rejected.decision,'reject');assert.equal(rejected.reason,'COLLISION_FOUND');assert.ok(rejected.detail.includes(h.id));negative.push({preset,context:c,controls:runs,result:rejected});
}
function witnessInput(w,elapsed){let t=w?Math.round((elapsed-w.context.elapsed)*120):0;for(const r of w?.controls??[]){if(t<r.ticks)return r.input;t-=r.ticks;}return{x:0,y:0};}
for(const policy of policies)for(const seed of [0,11,42])for(const history of ['witness','neutral','horizontal','boundary','touch','early-reversal','late-reversal']){
 const m=policy==='target-lock'?new MovingMineGameModel(undefined,false,'target-lock'):new AdaptiveHomingGameModel(false,policy);m.ready();m.start(seed);
 const publications=[],poses=[],work=[];let previous,lastPlanning=0,xTravel=0,yTravel=0,inputChanges=0,steeringReversals=0,lastInput,lastX=0,lastY=0,mineHeadingAngle=0,mineHeadingReversals=0,lastMine;const mineSigns=new Map();
 for(let tick=0;tick<17000&&m.distance<(history==='witness'?3000:1200)&&m.state==='PLAYING';tick++){
  const mine=m.field.slots.find(h=>h.active&&h.kind===9)?.planned,plane=mine?.motion.passTick,lead=history==='early-reversal'?160:30;
  const input=history==='witness'?witnessInput(m.field.certificate,m.elapsed):history==='neutral'?{x:0,y:0}:history==='horizontal'?{x:Math.floor(tick/180)%2?-1:1,y:0}:history==='boundary'?{x:1,y:1}:history==='touch'?{x:Math.sin(tick/93)*.85,y:Math.cos(tick/147)*.7}
   :{x:!plane||simulationTick(m.elapsed)<plane-lead-72?0:simulationTick(m.elapsed)<plane-lead?1:-1,y:0};
  if(lastInput&&(Math.abs(lastInput.x-input.x)>1e-12||Math.abs(lastInput.y-input.y)>1e-12))inputChanges++;lastInput=input;const sx=Math.abs(input.x)>.05?Math.sign(input.x):0,sy=Math.abs(input.y)>.05?Math.sign(input.y):0;if(sx&&lastX&&sx!==lastX)steeringReversals++;if(sy&&lastY&&sy!==lastY)steeringReversals++;if(sx)lastX=sx;if(sy)lastY=sy;
  const before={...m.ship};m.step(CONFIG.step,input);assert.equal(m.field.fault,undefined);xTravel+=Math.abs(m.ship.x-before.x);yTravel+=Math.abs(m.ship.y-before.y);
  assert.ok(m.field.slots.filter(h=>h.active&&h.kind===9).length<=1);
  const current=m.homing?.current;if(current&&m.field.slots.some(h=>h.active&&h.planned?.id===current.id)){if(lastMine?.id===current.id&&Math.hypot(lastMine.vx,lastMine.vy)>.3&&Math.hypot(current.vx,current.vy)>.3)mineHeadingAngle+=Math.acos(Math.max(-1,Math.min(1,(current.vx*lastMine.vx+current.vy*lastMine.vy)/(Math.hypot(current.vx,current.vy)*Math.hypot(lastMine.vx,lastMine.vy)))));const sign=Math.abs(current.vx)>.05?Math.sign(current.vx):0,prior=mineSigns.get(current.id);if(sign&&prior&&sign!==prior)mineHeadingReversals++;if(sign)mineSigns.set(current.id,sign);lastMine=current;}
  if(m.field.planningTicks!==lastPlanning){lastPlanning=m.field.planningTicks;const s=m.field.samples.at(-1);assert.ok(s.propagations<=3072&&s.queries<=6144);work.push(s);}
  if(tick%12===0)for(const h of m.field.slots.filter(h=>h.active&&h.kind===9))poses.push({tick:simulationTick(m.elapsed),distance:m.distance,id:h.planned.id,x:h.x,y:h.y,z:h.z,homing:m.homing?.current,input,ship:{x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy}});
  const o=m.field.lastOutcome;if(o&&o!==previous){previous=o;publications.push(o);assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.metrics.planningTicks<=144&&o.attempts.length<=2);if(o.witness)audit(o.witness);}
 }
 if(history==='witness'){assert.equal(m.hull,3);assert.ok(m.distance>=3000);}
 const proposed=publications.filter(o=>o.section.encounter==='moving-mine'),published=proposed.filter(o=>o.transaction?.hazards.some(isMine)),row={policy,seed,history,distance:m.distance,elapsed:m.elapsed,hull:m.hull,hits:m.hitSerial,state:m.state,xTravel,yTravel,inputChanges,steeringReversals,mineHeadingAngle,mineHeadingReversals,proposed:proposed.length,published:published.length,omitted:proposed.length-published.length,
  publications,poses,work,planningMs:stats(work.filter(s=>s.propagations||s.queries).map(s=>s.ms)),feedback:policy==='target-lock'?undefined:m.homing.trace()};runs.push(row);m.dispose();console.log(`${policy}/${seed}/${history}: ${row.published}/${row.proposed}, hull${row.hull}, distance${row.distance.toFixed(0)}`);
}
const summary={fixtures:fixtures.length,accepted:fixtures.filter(f=>f.result.decision==='accept').length,rejected:fixtures.filter(f=>f.result.decision==='reject').map(f=>({preset:f.preset,seed:f.seed,elapsed:f.elapsed,name:f.name,velocity:f.velocity,reason:f.result.reason,detail:f.result.detail})),unfinished:fixtures.filter(f=>f.result.decision==='unfinished').length,audits,negative:negative.length,forks,
 presets:HOMING_PRESETS,fixtureResolutionMs:stats(fixtures.map(f=>f.resolutionMs)),fixtureGateMs:stats(fixtures.map(f=>f.ms)),
 policies:policies.map(policy=>{const rs=runs.filter(r=>r.policy===policy),gs=grids.filter(g=>g.policy===policy&&g.published);return{policy,proposed:rs.reduce((n,r)=>n+r.proposed,0),published:rs.reduce((n,r)=>n+r.published,0),omitted:rs.reduce((n,r)=>n+r.omitted,0),xTravel:rs.reduce((n,r)=>n+r.xTravel,0),yTravel:rs.reduce((n,r)=>n+r.yTravel,0),inputChanges:rs.reduce((n,r)=>n+r.inputChanges,0),steeringReversals:rs.reduce((n,r)=>n+r.steeringReversals,0),mineHeadingAngle:rs.reduce((n,r)=>n+r.mineHeadingAngle,0),mineHeadingReversals:rs.reduce((n,r)=>n+r.mineHeadingReversals,0),gridPublished:gs.length,gridContacts:gs.filter(g=>g.hit).length,boundaryPublished:gs.filter(g=>g.boundary).length,boundaryContacts:gs.filter(g=>g.boundary&&g.hit).length};}),
 probes:probes.map(({trace,...r})=>r),runs:runs.map(({publications,poses,work,feedback,...r})=>r),
 note:'84 real three-hull games; no post-death continuation or invulnerability credit. Engineered matrix, mine-only fixed-position/response probes and paired-input divergence are separate from whole-field survival. Controller uses only current end-step ship position; every accepted witness has an extra full unpruned coupled replay. No human feedback.'};
summary.publicationFailures=policies.map(policy=>({policy,omissions:runs.filter(r=>r.policy===policy).flatMap(r=>r.publications).filter(o=>o.section.encounter==='moving-mine'&&!o.transaction?.hazards.some(isMine)).map(o=>({section:o.section.id,status:o.status,reason:o.reason??'certified fallback without mine',attempts:o.attempts.map(a=>({kind:a.kind,reason:a.reason})),metrics:o.metrics}))}));
summary.maximumWork=policies.map(policy=>({policy,metrics:runs.filter(r=>r.policy===policy).flatMap(r=>r.publications).reduce((m,o)=>{for(const[k,v]of Object.entries(o.metrics))m[k]=Math.max(m[k]??0,v);return m;},{})}));
await writeFile(join(output,'adaptive-homing-benchmark.json'),JSON.stringify(summary,null,2)+'\n');await writeFile(join(output,'adaptive-homing-witnesses.json'),JSON.stringify({fixtures,witnesses,grids,probes,runs,negative,forks})+'\n');
console.log(JSON.stringify({fixtures:summary.fixtures,accepted:summary.accepted,rejected:summary.rejected.length,unfinished:summary.unfinished,audits,policies:summary.policies}));
