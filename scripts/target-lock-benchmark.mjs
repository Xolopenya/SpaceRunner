import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/config.ts';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { beginResolvedRuntimeSearch, beginKnownFieldValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { MovingMineGameModel } from '../src/experiments/moving-mine/model.ts';
import { movingMineSource, MINE_GEOMETRY } from '../src/experiments/moving-mine/source.ts';
import { TARGET_GEOMETRY, targetLockTransaction, targetCapture } from '../src/experiments/moving-mine/target-lock-source.ts';
import { TARGET_LOCK as T } from '../src/experiments/moving-mine/target-lock-settings.ts';
import { mineX, mineY, isMine, simulationTick } from '../src/experiments/moving-mine/motion.ts';
import { movingMineHit } from '../src/experiments/moving-mine/collision.ts';
import { stats } from './director-fields.mjs';

const output=resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-EXPERIMENT-003C3/final');
await mkdir(output,{recursive:true});
const fixtures=[],witnesses=[],grids=[],responses=[],runs=[],negative=[],guidance=[];let audits=0;
const root=()=>({player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:1,distance:20});
function complete(job){while(!job.getResult())job.advance();return job.getResult();}
function geometryFor(w){return w.geometryVersion===T.geometry?TARGET_GEOMETRY:MINE_GEOMETRY;}
function audit(w){const started=performance.now(),r=complete(beginTrajectoryReplay(w.context,w.controls,{geometry:geometryFor(w)}));
 assert.equal(r.decision,'accept');assert.equal(r.witness.hash,w.hash);audits++;witnesses.push(w);return performance.now()-started;}
function bounded(context){const job=beginResolvedRuntimeSearch(context,{geometry:TARGET_GEOMETRY}),started=performance.now();job.advance({propagations:3072,narrowQueries:6144},1);
 assert.ok(job.metrics.propagations<=3072&&job.metrics.narrowQueries<=6144);
 return{result:job.getResult()??{decision:'unfinished',reason:'ACTUAL_REPLAY_BUDGET'},metrics:job.metrics,ms:performance.now()-started};}
const positions=[['center',0,0],['left',-6,0],['right',6,0],['lower',0,-3.6],['upper',0,3.6],['lower-left',-6,-3.6],['upper-left',-6,3.6],['lower-right',6,-3.6],['upper-right',6,3.6]];
const velocities=[['stationary',0,0],['right',8,0],['left',-8,0],['up',0,8],['down',0,-8],['diagonal',4,-4]];
for(const seed of [0,11,42])for(const speed of T.speeds)for(const warning of T.warningTicks)for(const [name,x,y]of positions)for(const [velocity,vx,vy]of velocities){
 const r={...root(),player:{x,y,vx,vy}},started=performance.now();let candidate;
 try{candidate=targetLockTransaction(seed,4,r,24,{attackSpeed:speed,minimumWarningTicks:warning});}
 catch(error){fixtures.push({seed,speed,warning,name,velocity,root:r,result:{decision:'resolution-reject',reason:error.message},resolutionMs:performance.now()-started});continue;}
 const resolutionMs=performance.now()-started,context={...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance},checked=bounded(context);
 const row={seed,speed,warning,name,velocity,resolutionMs,...checked};
 if(checked.result.decision==='accept')row.replayMs=audit(checked.result.witness);
 else{const fresh=complete(beginKnownFieldValidation(context,{geometry:TARGET_GEOMETRY}));row.counterfactual=fresh;if(fresh.decision==='accept'){row.counterfactualReplayMs=audit(fresh.witness);}}
 fixtures.push(row);
}

function sourceTransaction(policy,seed,r){
 if(policy==='target-lock')return targetLockTransaction(seed,4,r,simulationTick(r.elapsed)-96);
 const source=movingMineSource(undefined,true,policy),d=source.next(seed,new DifficultyDirector(seed).initial(4));return source.candidate(d.section,[],r).transaction;
}
function inputFrom(w,elapsed){let tick=w?Math.round((elapsed-w.context.elapsed)*120):0;for(const r of w?.controls??[]){if(tick<r.ticks)return r.input;tick-=r.ticks;}return{x:0,y:0};}
function closest(a,b){const d=b.map((v,i)=>v-a[i]),length=d.reduce((s,v)=>s+v*v,0),t=length?Math.max(0,Math.min(1,-a.reduce((s,v,i)=>s+v*d[i],0)/length)):0;
 return Math.sqrt(a.reduce((s,v,i)=>s+(v+t*d[i])**2,0));}
/** Exact sphere clearance for this mine only; native full-field safety uses replay. */
function probe(r,h,inputAt){const p=new FlightPrediction(),s={...r.player,elapsed:r.elapsed,distance:r.distance};let hit=false,clearance=Infinity,xTravel=0,yTravel=0,nearTicks=0;const trace=[];
 for(let n=0;n<1800&&s.distance<h.passDistance+3;n++){
  const a={...s},input=inputAt(n,s);p.step(s,input);hit ||= movingMineHit(a,s,h);xTravel+=Math.abs(s.x-a.x);yTravel+=Math.abs(s.y-a.y);
  const from=[a.x-mineX(h,a.elapsed),a.y-mineY(h,a.elapsed),h.passDistance-a.distance],to=[s.x-mineX(h,s.elapsed),s.y-mineY(h,s.elapsed),h.passDistance-s.distance];
  const d=closest(from,to);clearance=Math.min(clearance,d-1.77);if(d<=3.77)nearTicks++;
  if(n%12===0)trace.push({tick:simulationTick(s.elapsed),...s,mineX:mineX(h,s.elapsed),mineY:mineY(h,s.elapsed),input});
 }
 return{hit,minimumMineClearance:clearance,xTravel,yTravel,nearSeconds:nearTicks/120,trace};
}
for(const policy of ['fast','diagonal','target-lock'])for(const seed of [0,11,42])for(const x of [-6,-3,0,3,6])for(const y of [-3.2,-1.6,0,1.6,3.2]){
 const r={...root(),player:{...root().player,x,y}};let tx;
 try{tx=sourceTransaction(policy,seed,r);}catch(error){grids.push({policy,seed,x,y,published:false,reason:error.message});continue;}
 const context={...r,committed:[],candidate:tx,reservedUntilDistance:tx.endDistance},checked=policy==='target-lock'?bounded(context).result:complete(beginKnownFieldValidation(context,{geometry:MINE_GEOMETRY}));
 if(checked.decision!=='accept'){grids.push({policy,seed,x,y,published:false,reason:checked.reason});continue;}
 audit(checked.witness);const h=tx.hazards.find(isMine),stationary=probe(r,h,()=>({x:0,y:0}));
 grids.push({policy,seed,x,y,published:true,mine:h,stationary,boundary:Math.abs(x)===6||Math.abs(y)===3.2,
  note:'Common observed root and complete candidate admission; stationary contact/clearance measures this mine only, not survival through all native geometry.'});
}
for(const policy of ['fast','diagonal','target-lock']){
 const r=root(),tx=sourceTransaction(policy,42,r),h=tx.hazards.find(isMine),m=h.motion,plane=m.version===T.version?m.passTick:simulationTick(r.elapsed)+Math.round((180-20)/20*120);
 // For linear policies derive the same true forward crossing from their centered phase.
 const pass=m.version===T.version?plane:m.startTick+Math.round(6/Math.abs(m.velocityX)*120);
 for(const axis of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1},{x:-1,y:-1}])for(const lead of [1.2,.8,.6,.45,.3,.1,0]){
  const departure=pass-Math.round(lead*120),p=probe(r,h,(_n,s)=>simulationTick(s.elapsed)>=departure?axis:{x:0,y:0});
  responses.push({policy,axis,lead,departure,...p});if(lead===1.2)assert.equal(p.hit,false);if(lead===0)assert.equal(p.hit,true);
 }
}
// A changed late input tape is replayed from the ORIGINAL frozen capture, never re-aimed.
for(const lead of [0,.1,.3]){
 const r=root(),candidate=sourceTransaction('target-lock',42,r),c={...r,committed:[],candidate,reservedUntilDistance:candidate.endDistance},checked=bounded(c);assert.equal(checked.result.decision,'accept');
 const w=checked.result.witness,m=candidate.hazards.find(isMine).motion,wait=m.passTick-simulationTick(r.elapsed)-Math.round(lead*120),total=w.controls.reduce((n,v)=>n+v.ticks,0);
 const controls=[{ticks:wait,input:{x:0,y:0}},{ticks:total-wait-39,input:{x:0,y:1}},{ticks:39,input:{x:0,y:0}}],result=complete(beginTrajectoryReplay(c,controls,{geometry:TARGET_GEOMETRY}));assert.equal(result.decision,'reject');assert.equal(result.reason,'COLLISION_FOUND');assert.ok(result.detail.includes(candidate.hazards.find(isMine).id));negative.push({name:'late-evasion',lead,context:c,controls,result});
}

for(const policy of ['fast','diagonal','target-lock'])for(const seed of [0,11,42])for(const history of ['witness','neutral','horizontal','boundary','touch']){
 const m=new MovingMineGameModel(undefined,false,policy);m.ready();m.start(seed);
 const publications=[],poses=[],threats=[],mineHits=[],work=[];let previous,xTravel=0,yTravel=0,lastPlanning=0;
 for(let tick=0;tick<17000&&m.distance<(history==='witness'?3000:1200)&&m.state==='PLAYING';tick++){
  const axis=history==='witness'?inputFrom(m.field.certificate,m.elapsed):history==='horizontal'?{x:Math.floor(tick/180)%2?-1:1,y:0}:history==='boundary'?{x:1,y:1}:history==='touch'?{x:Math.sin(tick/93)*.85,y:Math.cos(tick/147)*.7}:{x:0,y:0};
  const before={...m.ship},hitBefore=m.hitSerial,mineBefore=m.field.slots.find(h=>h.active&&isMine(h)),idBefore=mineBefore?.planned?.id;
  m.step(CONFIG.step,axis);assert.equal(m.field.fault,undefined);xTravel+=Math.abs(m.ship.x-before.x);yTravel+=Math.abs(m.ship.y-before.y);
  assert.ok(m.field.slots.filter(h=>h.active&&isMine(h)).length<=1);
  if(m.hitSerial>hitBefore&&mineBefore&&!mineBefore.active&&mineBefore.planned?.id===idBefore&&mineBefore.z<=8)mineHits.push({id:idBefore,tick:simulationTick(m.elapsed),hull:m.hull});
  if(m.field.planningTicks!==lastPlanning){lastPlanning=m.field.planningTicks;const s=m.field.samples.at(-1);assert.ok(s.propagations<=3072&&s.queries<=6144);work.push(s);}
  if(tick%12===0)for(const h of m.field.slots.filter(h=>h.active&&isMine(h)))poses.push({tick:simulationTick(m.elapsed),distance:m.distance,id:h.planned.id,x:h.x,y:h.y,z:h.z});
  const o=m.field.lastOutcome;
  if(o&&o!==previous){previous=o;publications.push(o);assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.metrics.planningTicks<=144&&o.attempts.length<=2);
   if(o.witness){audit(o.witness);const h=o.transaction.hazards.find(isMine);if(h){const c=o.witness.context,p=probe(c,h,()=>({x:0,y:0}));
     if(policy==='target-lock'){assert.deepEqual(h.motion.capture,targetCapture(c));assert.equal(o.publicationChecks[0].witness,undefined);assert.ok(o.resolution);
       assert.equal(o.resolution.previewPose.x,h.x);assert.equal(o.resolution.previewPose.y,h.y);
       if(o.resolution.hint){const noHint=bounded(c);if(noHint.result.decision==='accept')audit(noHint.result.witness);guidance.push({seed,history,context:c,noHint,actualHash:o.witness.hash,actualMetrics:o.publicationChecks[0].metrics});}}
     const plane=h.motion.version===T.version?h.motion.passTick:h.motion.startTick+Math.round(6/Math.abs(h.motion.velocityX)*120);
     threats.push({id:h.id,capture:h.motion.version===T.version?h.motion.capture:null,target:h.motion.version===T.version?{x:h.motion.targetX,y:h.motion.targetY}:null,
       warningSeconds:(h.motion.startTick-simulationTick(c.elapsed))/120,planeTick:plane,poseAtPlane:{x:mineX(h,plane/120),y:mineY(h,plane/120)},neutralContact:p.hit,
       minimumMineClearance:p.minimumMineClearance,nearSeconds:p.nearSeconds,resolutionMs:o.resolution?.ms});
   }}
  }
 }
 const proposed=publications.filter(o=>o.section.encounter==='moving-mine'),published=proposed.filter(o=>o.transaction?.hazards.some(isMine));
 if(history==='witness'){assert.equal(m.hull,3);assert.ok(published.length>=4);}
 const row={policy,seed,history,distance:m.distance,elapsed:m.elapsed,hull:m.hull,hits:m.hitSerial,state:m.state,mineHits,xTravel,yTravel,
  scheduled:m.field.scheduled,committed:m.field.committed,omitted:m.field.omitted,mineProposals:proposed.length,minePublications:published.length,mineOmissions:proposed.length-published.length,
  neutralThreats:threats.filter(t=>t.neutralContact).length,threats,publications,poses,work,plannerMs:stats(work.filter(s=>s.propagations||s.queries).map(s=>s.ms)),gateMs:stats(work.filter(s=>s.phase==='actual-gate').map(s=>s.ms))};
 runs.push(row);m.dispose();console.log(`${policy}/${seed}/${history}: ${published.length}/${proposed.length} mines, ${row.neutralThreats} release-input threats, ${mineHits.length} real mine hits, hull${row.hull}`);
}
const micro=[];
for(const policy of ['fast','diagonal','target-lock']){
 const h=sourceTransaction(policy,42,root()).hazards.find(isMine),a={...root().player,elapsed:1,distance:180},b={...a,elapsed:1+CONFIG.step,distance:180+34/120};let sum=0,started=performance.now();
 for(let n=0;n<1000000;n++){const time=(h.motion.startTick+(n%h.motion.durationTicks))/120;sum+=mineX(h,time)+mineY(h,time);}const poseMs=performance.now()-started;started=performance.now();
 for(let n=0;n<100000;n++){a.x=(n%240)/20-6;b.x=a.x+.05;sum+=+movingMineHit(a,b,h,.15);}micro.push({policy,poseEvaluations:1000000,poseMs,collisionQueries:100000,collisionMs:performance.now()-started,sum});
}
const summary={fixtures:fixtures.length,accepted:fixtures.filter(f=>f.result.decision==='accept').length,resolutionRejected:fixtures.filter(f=>f.result.decision==='resolution-reject').length,
 rejected:fixtures.filter(f=>f.result.decision==='reject').map(f=>({seed:f.seed,name:f.name,velocity:f.velocity,speed:f.speed,warning:f.warning,reason:f.result.reason,detail:f.result.detail,counterfactual:f.counterfactual?.decision})),
 unfinished:fixtures.filter(f=>f.result.decision==='unfinished').length,audits,negative:negative.length,micro,
 guidance:{cases:guidance.length,unhintedAccepted:guidance.filter(g=>g.noHint.result.decision==='accept').length,unhintedMisses:guidance.filter(g=>g.noHint.result.decision!=='accept').length,
   note:'Same actual root/frozen target/geometry/budget. All actual guided routes independently replay; earlier controls are proposals, not reused safety authority.'},
 policies:['fast','diagonal','target-lock'].map(policy=>{const rs=runs.filter(r=>r.policy===policy),gs=grids.filter(g=>g.policy===policy),accepted=gs.filter(g=>g.published);return{policy,
  proposed:rs.reduce((n,r)=>n+r.mineProposals,0),published:rs.reduce((n,r)=>n+r.minePublications,0),omitted:rs.reduce((n,r)=>n+r.mineOmissions,0),releaseThreats:rs.reduce((n,r)=>n+r.neutralThreats,0),realMineHits:rs.reduce((n,r)=>n+r.mineHits.length,0),
  xTravel:rs.reduce((n,r)=>n+r.xTravel,0),yTravel:rs.reduce((n,r)=>n+r.yTravel,0),gridProposed:gs.length,gridPublished:accepted.length,gridContacts:accepted.filter(g=>g.stationary.hit).length,boundaryPublished:accepted.filter(g=>g.boundary).length,boundaryContacts:accepted.filter(g=>g.boundary&&g.stationary.hit).length};}),
 grid:grids.map(({stationary,mine,...g})=>({...g,...(stationary?{hit:stationary.hit,minimumMineClearance:stationary.minimumMineClearance,nearSeconds:stationary.nearSeconds}:{}),...(mine?.motion?.version===T.version?{targetX:mine.motion.targetX,targetY:mine.motion.targetY}:{} )})),
 responses:responses.map(({trace,...r})=>r),runs:runs.map(({publications,poses,work,...r})=>r),
 note:'Engineered observed-state matrix and fixed-position probes are separate from45 actual three-hull games. Mine-only exposure/clearance is not whole-field survival or human enjoyment. Every accepted fixture/publication is independently replayed. Exhaustion/omission is not mathematical impossibility.'};
await writeFile(join(output,'target-lock-benchmark.json'),JSON.stringify(summary,null,2)+'\n');
await writeFile(join(output,'target-lock-witnesses.json'),JSON.stringify({fixtures,witnesses,grids,responses,runs,negative,guidance})+'\n');
console.log(JSON.stringify({fixtures:summary.fixtures,accepted:summary.accepted,resolutionRejected:summary.resolutionRejected,rejected:summary.rejected.length,unfinished:summary.unfinished,audits,policies:summary.policies}));
