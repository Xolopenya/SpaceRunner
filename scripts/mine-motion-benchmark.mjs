import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/config.ts';
import { beginKnownFieldValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { MINE_GEOMETRY as geometry, mineTransaction, passTick } from '../src/experiments/moving-mine/source.ts';
import { MovingMineGameModel } from '../src/experiments/moving-mine/model.ts';
import { ALL_MINE_CONFIGURATIONS, MOTION_POLICIES, configurations, motionVector } from '../src/experiments/moving-mine/settings.ts';
import { mineX, mineY, isMine } from '../src/experiments/moving-mine/motion.ts';
import { movingMineHit } from '../src/experiments/moving-mine/collision.ts';
import { stats } from './director-fields.mjs';

const output=resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-EXPERIMENT-003C2/final');await mkdir(output,{recursive:true});
const fixtures=[],witnesses=[],runs=[],grids=[],responses=[];let audits=0;
const root=()=>({player:{x:0,y:0,vx:0,vy:0},input:{x:0,y:0},elapsed:0,distance:0});
function finish(j){const chunks=[];while(!j.getResult()){const t=performance.now();j.advance();chunks.push(performance.now()-t);}return {result:j.getResult(),metrics:j.metrics,chunksMs:stats(chunks)};}
function audit(w){const r=finish(beginTrajectoryReplay(w.context,w.controls,{geometry}));assert.equal(r.result.decision,'accept');assert.equal(r.result.witness.hash,w.hash);audits++;witnesses.push(w);return r;}
function witnessInput(w,elapsed){let t=w?Math.round((elapsed-w.context.elapsed)*120):0;for(const r of w?.controls??[]){if(t<r.ticks)return r.input;t-=r.ticks;}return{x:0,y:0};}
const descriptors=[['center',{}],['upper-clear',{y:3.2}],['boundary',{x:5.8}],['incoming-left',{x:3,vx:-8}],['incoming-right',{x:-3,vx:8}],['incoming-xy',{vx:4,vy:-4}],['max-forward',{},120],['incoming-same',{vx:3,vy:1.5}]];
for(const seed of [0,11,42])for(const config of ALL_MINE_CONFIGURATIONS)for(const [name,player,elapsed=0]of descriptors){
 const r={...root(),elapsed,player:{...root().player,...player}},v=motionVector(config),tick=passTick(r,180),tx=mineTransaction(seed,4,tick-Math.round(6/Math.abs(v.x)*120),config);
 const context={...r,candidate:tx,committed:[],reservedUntilDistance:tx.endDistance},checked=finish(beginKnownFieldValidation(context,{geometry}));
 assert.equal(checked.result.decision,'accept',`${seed}/${config}/${name}`);audit(checked.result.witness);fixtures.push({seed,config,name,...checked});
 if(seed===42&&name==='center'){const p=new FlightPrediction(),state={...root().player,elapsed,distance:0};for(let n=0;n<tick-Math.round(elapsed*120)-2;n++)p.step(state,{x:0,y:0});
  const late={...context,player:state,elapsed:state.elapsed,distance:state.distance},negative=finish(beginKnownFieldValidation(late,{geometry}));assert.equal(negative.result.decision,'reject');assert.equal(negative.result.reason,'INSUFFICIENT_REACTION_DISTANCE');fixtures.push({seed,config,name:'late-reaction',context:late,...negative});}
}
// Isolated geometry experiment: common exact clock and stationary XY grid, not a published-world survival claim.
function probe(h,player,inputAt){const p=new FlightPrediction(),state={...root().player,...player,elapsed:0,distance:0};let hit=false,min=Infinity,inBoundsTicks=0,movingInBoundsTicks=0,xDemand=0,yDemand=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;const trace=[];
 for(let tick=0;tick<1300&&state.distance<h.passDistance+3;tick++){const before={...state},axis=inputAt(tick,state);p.step(state,axis);hit ||= movingMineHit(before,state,h);xDemand+=Math.abs(state.x-before.x);yDemand+=Math.abs(state.y-before.y);
  const x=mineX(h,state.elapsed),y=mineY(h,state.elapsed);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(Math.abs(x)<=6&&Math.abs(y)<=3.6){inBoundsTicks++;if(tick+1>h.motion.startTick&&tick+1<=h.motion.startTick+h.motion.durationTicks)movingInBoundsTicks++;}
  min=Math.min(min,Math.hypot(state.x-x,state.y-y,h.passDistance-state.distance)-1.77);if(tick%12===0)trace.push({tick:tick+1,...state,mineX:x,mineY:y});}
 return{hit,minSampledClearance:min,inBoundsSeconds:inBoundsTicks/120,movingInBoundsSeconds:movingInBoundsTicks/120,mineRange:{minX,maxX,minY,maxY},xDemand,yDemand,trace};}
for(const config of ALL_MINE_CONFIGURATIONS){const v=motionVector(config),tick=passTick(root(),180),h=mineTransaction(42,4,tick-Math.round(6/Math.abs(v.x)*120),config).hazards.find(isMine);
 const cells=[];for(const x of [-6,-3,0,3,6])for(const y of [-3.2,-1.6,0,1.6,3.2]){const r=probe(h,{x,y},()=>({x:0,y:0}));cells.push({x,y,...r});}
 grids.push({config,kind:'25 fixed XY locations; mine-only counterfactual',cells,contacts:cells.filter(c=>c.hit).length,center:cells.find(c=>c.x===0&&c.y===0),boundaryContacts:cells.filter(c=>(Math.abs(c.x)===6||Math.abs(c.y)===3.2)&&c.hit).length});
 for(const axis of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}]){const rows=[];for(const lead of [0,.1,.2,.3,.45,.6,.8,1]){const depart=tick-Math.round(lead*120),r=probe(h,{},n=>n>=depart?axis:{x:0,y:0});rows.push({lead,depart,...r});}assert.equal(rows[0].hit,true);assert.equal(rows.at(-1).hit,false);responses.push({config,axis,rows});}
}
function counterfactual(w,h){const state={...w.context.player,elapsed:w.context.elapsed,distance:w.context.distance},p=geometry.prediction();let neutralHit=false,near=false,firstContact;
 const end=passTick(w.context,h.passDistance)+12;for(let n=Math.round(state.elapsed*120);n<end;n++){const a={...state};p.step(state,{x:0,y:0});if(p.hitGameplay(a,state,h)){neutralHit=true;firstContact??=state.elapsed;}if(Math.hypot(state.x-mineX(h,state.elapsed),state.y-mineY(h,state.elapsed),h.passDistance-state.distance)<3.77)near=true;}
 return{neutralHit,near,firstContact,meaning:'Release steering at actual publication root; checks mine only. Conditional witness is separate.'};}
for(const policy of MOTION_POLICIES)for(const seed of [0,11,42])for(const history of ['witness','neutral','horizontal','boundary','touch']){
 const m=new MovingMineGameModel(undefined,false,policy);m.ready();m.start(seed);const publications=[],poses=[],threats=[],samples=[];let previous,xDemand=0,yDemand=0;
 for(let tick=0;tick<17000&&m.distance<(history==='witness'?3000:1200)&&m.state==='PLAYING';tick++){
  const axis=history==='witness'?witnessInput(m.field.certificate,m.elapsed):history==='horizontal'?{x:Math.floor(tick/180)%2?-1:1,y:0}:history==='boundary'?{x:1,y:1}:history==='touch'?{x:Math.sin(tick/93)*.85,y:Math.cos(tick/147)*.7}:{x:0,y:0};
  const before={...m.ship};m.step(CONFIG.step,axis);xDemand+=Math.abs(m.ship.x-before.x);yDemand+=Math.abs(m.ship.y-before.y);assert.equal(m.field.fault,undefined);assert.ok(m.field.slots.filter(h=>h.active&&isMine(h)).length<=1);
  if(tick%12===0)for(const h of m.field.slots.filter(h=>h.active&&isMine(h)))poses.push({tick:Math.round(m.elapsed*120),distance:m.distance,id:h.planned.id,x:h.x,y:h.y,z:h.z});
  const o=m.field.lastOutcome;if(o&&o!==previous){previous=o;publications.push(o);assert.ok(o.metrics.searches<=2&&o.metrics.replays<=4&&o.metrics.planningTicks<=144&&o.attempts.length<=2);
   if(o.witness){audit(o.witness);const h=o.transaction.hazards.find(isMine);if(h){const pt=passTick(o.witness.context,h.passDistance),plane=pt/120;threats.push({id:h.id,config:h.id.split('/')[4],publicationElapsed:m.elapsed,startElapsed:h.motion.startTick/120,passTick:pt,passElapsed:plane,warningSeconds:plane-m.elapsed,poseAtPublication:{x:h.x,y:h.y,actualX:mineX(h,m.elapsed),actualY:mineY(h,m.elapsed)},poseAtPlane:{x:mineX(h,plane),y:mineY(h,plane)},...counterfactual(o.witness,h)});}}}
 }
 for(const s of m.field.samples)assert.ok(s.propagations<=3072&&s.queries<=6144);
 const mines=publications.filter(o=>o.section.encounter==='moving-mine'),published=mines.filter(o=>o.transaction?.hazards.some(isMine));
 if(history==='witness'){assert.equal(m.hull,3);assert.ok(published.length>=4);}
 runs.push({policy,seed,history,distance:m.distance,elapsed:m.elapsed,hull:m.hull,state:m.state,hits:m.hitSerial,scheduled:m.field.scheduled,committed:m.field.committed,omitted:m.field.omitted,mineProposals:mines.length,minePublications:published.length,mineOmissions:mines.length-published.length,xDemand,yDemand,neutralThreats:threats.filter(t=>t.neutralHit).length,nearMines:threats.filter(t=>t.near).length,threats,publications,poses,plannerMs:stats(m.field.samples.filter(s=>s.propagations||s.queries).map(s=>s.ms)),gateMs:stats(m.field.samples.filter(s=>s.phase==='actual-gate').map(s=>s.ms))});m.dispose();console.log(`${policy}/${seed}/${history}: ${published.length}/${mines.length} mines, ${threats.filter(t=>t.neutralHit).length} release-input threats, hull ${m.hull}`);
}
const micro=[];for(const policy of MOTION_POLICIES){const config=configurations(policy)[0],h=mineTransaction(42,4,0,config).hazards.find(isMine),a={...root().player,elapsed:1,distance:180},b={...a,elapsed:1+CONFIG.step,distance:180+34/120};let sum=0,t=performance.now();
 for(let n=0;n<1000000;n++){const time=(n%h.motion.durationTicks)/120;sum+=mineX(h,time)+mineY(h,time);}const poseMs=performance.now()-t;t=performance.now();for(let n=0;n<100000;n++){a.x=(n%240)/20-6;b.x=a.x+.05;sum+=+movingMineHit(a,b,h,.15);}micro.push({policy,poseEvaluations:1000000,poseMs,collisionQueries:100000,collisionMs:performance.now()-t,sum});}
const summary={fixtures:fixtures.length,accepted:fixtures.filter(f=>f.result.decision==='accept').length,negative:fixtures.filter(f=>f.result.decision==='reject').length,audits,micro,policies:MOTION_POLICIES.map(policy=>{const r=runs.filter(r=>r.policy===policy);return{policy,runs:r.length,proposed:r.reduce((n,r)=>n+r.mineProposals,0),published:r.reduce((n,r)=>n+r.minePublications,0),omitted:r.reduce((n,r)=>n+r.mineOmissions,0),releaseThreats:r.reduce((n,r)=>n+r.neutralThreats,0),near:r.reduce((n,r)=>n+r.nearMines,0),xDemand:r.reduce((n,r)=>n+r.xDemand,0),yDemand:r.reduce((n,r)=>n+r.yDemand,0)};}),grids:grids.map(({cells,center,...g})=>({...g,centerHit:center.hit,inBoundsSeconds:center.inBoundsSeconds,movingInBoundsSeconds:center.movingInBoundsSeconds,mineRange:center.mineRange})),responses:responses.map(r=>({...r,rows:r.rows.map(({trace,...s})=>s)})),runs:runs.map(({publications,poses,...r})=>r),note:'Actual hull/death in 45 runs. Identical seeded input tapes can produce different certified worlds. Release-input threats are conditional on publication root, not human decisions. Fixed-location geometry probes are isolated from native asteroids and are not survival or publication certificates.'};
await writeFile(join(output,'mine-motion-benchmark.json'),JSON.stringify(summary,null,2)+'\n');await writeFile(join(output,'mine-motion-witnesses.json'),JSON.stringify({fixtures,witnesses,runs,grids,responses})+'\n');console.log(JSON.stringify({fixtures:summary.fixtures,accepted:summary.accepted,negative:summary.negative,audits,policies:summary.policies}));
