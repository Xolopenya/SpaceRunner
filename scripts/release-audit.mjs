import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {IntegratedModel,INTEGRATED_GEOMETRY} from '../src/integrated/model.ts';
import {beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {certifiedInput} from '../tests/fixtures/fragment-flight.ts';
const approved='a5906ef0baaeb5cfce6b59c29df6d378e1e141ad',directory=process.env.REVIEW_RESULT_DIR??'.cache/review/RELEASE-007/final',ci=process.argv.includes('--ci');
await mkdir(directory,{recursive:true});
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024}),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(git('diff',approved,'--','src','public','package.json','package-lock.json','vite.config.ts').toString().trim(),'','Approved runtime/assets/tuning must remain unchanged');
const names=git('ls-tree','-r','--name-only',approved,'src','public','index.html','package.json','vite.config.ts').toString().trim().split('\n'),frozen=resolve('.cache/review/RELEASE-007/approved');
const batch=execFileSync('git',['cat-file','--batch'],{input:names.map(p=>`${approved}:${p}`).join('\n')+'\n',maxBuffer:128*1024*1024});let cursor=0;
for(const p of names){const end=batch.indexOf(10,cursor),size=Number(batch.subarray(cursor,end).toString().split(' ')[2]);cursor=end+1;const dest=resolve(frozen,p);assert.ok(dest.startsWith(frozen));await mkdir(dirname(dest),{recursive:true});await writeFile(dest,batch.subarray(cursor,cursor+size));cursor+=size+1;}
const Old=await import(pathToFileURL(resolve(frozen,'src/integrated/model.ts'))),oldReplay=await import(pathToFileURL(resolve(frozen,'src/core/field-validator.ts')));
const stats=a=>{const s=[...a].sort((a,b)=>a-b),q=p=>s[Math.floor((s.length-1)*p)]??0;return{n:s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)??0}};
const state=m=>({state:m.state,distance:m.distance,elapsed:m.elapsed,ship:{...m.ship},hull:m.hull,phase:m.phase,hits:m.hitSerial,immunity:m.invulnerability,
 hazards:m.field.slots,events:m.field.events,ownership:m.field.ledger.snapshot(),mine:m.homing.current,fragments:m.fragments.slots,count:m.fragments.count});
const rows=[],references=new Map();let replays=0;
for(const variant of ci?['candidate']:['approved','candidate'])for(const seed of ci?[42]:[0,11,42,99])for(const cadence of [2,4,12,'catch-up']){
 const source=variant==='approved'?{Model:Old.IntegratedModel,geometry:Old.INTEGRATED_GEOMETRY,replay:oldReplay.beginTrajectoryReplay}:{Model:IntegratedModel,geometry:INTEGRATED_GEOMETRY,replay:beginTrajectoryReplay};
 const m=new source.Model();m.ready();m.start(seed);const key=`${seed}/${cadence}`,reference=references.get(key),inputs=[],decisions=[],frames=[],works=[],poses=[];let last,frame=0,peak=0,replayed=0,lastMineDistance=0,maxMineGap=0,omissionStart,maxOmissionDistance=0,maxOmissionSeconds=0;
 const proposals=[],candidate=m.field.experiment.candidate.bind(m.field.experiment);m.field.experiment.candidate=(...args)=>{proposals.push({index:args[0].index,family:args[0].encounter,distance:m.distance,elapsed:m.elapsed});return candidate(...args)};
 while(m.state==='PLAYING'&&m.distance<(ci?1800:2500)){
  const count=cadence==='catch-up'?(frame%60===30?12:2):cadence;m.beginPlanningFrame();
  for(let n=0;n<count&&m.state==='PLAYING'&&m.distance<(ci?1800:2500);n++){
   const input=reference?.inputs[inputs.length]??certifiedInput(m);inputs.push({...input});m.step(1/120,input);assert.equal(m.field.fault,undefined);
   const active=m.field.slots.filter(h=>h.active&&h.kind===9);peak=Math.max(peak,active.length);assert.ok(active.length<=1);
   if(m.homing.current&&seed===42&&cadence===2)poses.push({tick:inputs.length,ship:{...m.ship},mine:{...m.homing.current}});
   const o=m.field.lastOutcome;if(!o||o===last)continue;last=o;
   if(o.status==='committed')assert.ok(o.witness,'Publication without a witness');
   if(o.witness){
    assert.equal(o.witness.context.elapsed,m.elapsed);assert.equal(o.witness.context.distance,m.distance);assert.deepEqual(o.witness.context.player,{x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy});
    const job=source.replay(o.witness.context,o.witness.controls,{geometry:source.geometry});while(!job.getResult())job.advance();const r=job.getResult();assert.equal(r.decision,'accept');assert.equal(r.witness.hash,o.witness.hash);replays++;replayed++;
   }
   const mine=o.transaction?.hazards.find(h=>h.kind===9);
   if(mine){assert.equal(mine.motion.capture.tick,Math.round(m.elapsed*120));maxMineGap=Math.max(maxMineGap,m.distance-lastMineDistance);lastMineDistance=m.distance;}
   if(o.status!=='committed')omissionStart??={distance:m.distance,elapsed:m.elapsed};
   else if(omissionStart){maxOmissionDistance=Math.max(maxOmissionDistance,m.distance-omissionStart.distance);maxOmissionSeconds=Math.max(maxOmissionSeconds,m.elapsed-omissionStart.elapsed);omissionStart=undefined;}
   decisions.push({tick:inputs.length,distance:m.distance,elapsed:m.elapsed,index:o.section.index,selected:o.section.encounter,aperture:o.section.aperture,status:o.status,reason:o.reason,
    attempts:o.attempts.map(a=>({kind:a.kind,reason:a.reason})),checks:o.publicationChecks,work:o.metrics,witness:o.witness?.hash,ids:o.transaction?.hazards.map(h=>h.id),mine:mine?.id});
  }
  m.finishPlanningFrame(count/120);const s=m.homing.planningFrame.latest;assert.ok(s.propagations<=6144&&s.queries<=12288);frames.push(s.ms);works.push({propagations:s.propagations,queries:s.queries,deferred:s.deferred});frame++;
 }
 if(omissionStart){maxOmissionDistance=Math.max(maxOmissionDistance,m.distance-omissionStart.distance);maxOmissionSeconds=Math.max(maxOmissionSeconds,m.elapsed-omissionStart.elapsed);}
 assert.equal(m.hull,3);assert.equal(m.phase,2);const finalHash=hash(state(m));
 const row={variant,seed,cadence,inputs,decisions,replayed,frames:frames.length,planningMs:stats(frames),planningWork:works,peakMines:peak,proposedMines:proposals.filter(p=>p.family==='moving-mine').length,
  certifiedMines:decisions.filter(d=>d.mine).length,rejectedMines:decisions.filter(d=>d.selected==='moving-mine'&&!d.mine).length,deadlineFailures:decisions.filter(d=>/DEADLINE|MISSED_PUBLICATION/.test(d.reason??'')).length,
  actualGateRejections:decisions.flatMap(d=>d.checks??[]).filter(c=>c.result.decision==='reject').length,omitted:m.field.omitted,committed:m.field.committed,maxOmissionDistance,maxOmissionSeconds,
  maxMineGapIncludingTail:Math.max(maxMineGap,m.distance-lastMineDistance),pendingAtEnd:!!m.field.pending,proposals,final:{distance:m.distance,elapsed:m.elapsed,hull:m.hull,phase:m.phase,count:m.fragments.count},stateHash:finalHash};
 if(reference){assert.equal(finalHash,reference.stateHash,'Candidate differs from approved under same cadence/input');assert.deepEqual(decisions.map(d=>[d.status,d.reason,d.ids,d.witness]),reference.decisions.map(d=>[d.status,d.reason,d.ids,d.witness]));}
 else references.set(key,{inputs,stateHash:finalHash,decisions});
 rows.push(row);console.log(variant,seed,cadence,'mines',row.certifiedMines+'/'+row.proposedMines,'omitted',row.omitted,'replays',replayed);m.dispose();
}
// Same actual already-published mine: exact controller history grouped into
// 60/30/10Hz intervals. Each fixed-step target/pose comes from the actual run.
const reference=references.get('42/2'),publishedPhysics=[];
if(reference){
 const m=new IntegratedModel();m.ready();m.start(42);const tape=[];let first;
 for(let tick=0;tick<reference.inputs.length;tick++){if(tick%2===0)m.beginPlanningFrame();m.step(1/120,reference.inputs[tick]);if(tick%2===1)m.finishPlanningFrame(1/60);
  if(!first&&m.homing.current)first={tick:tick+1,id:m.homing.current.id};if(first&&m.homing.current?.id===first.id)tape.push({tick:tick+1,ship:{...m.ship},mine:{...m.homing.current}});else if(first&&tape.length)break;}
 assert.ok(first&&tape.length>120);
 const descriptor=m.homing.encounters.find(h=>h.id===first.id),{stepAdaptiveMine}=await import('../src/experiments/adaptive-homing/controller.ts');
 for(const cadence of [2,4,12]){let current=tape[0].mine;const history=[current];for(let at=1;at<tape.length;at+=cadence)for(let j=at;j<Math.min(at+cadence,tape.length);j++){current=stepAdaptiveMine(current,tape[j].ship,descriptor.motion);assert.deepEqual(current,tape[j].mine);history.push(current);}publishedPhysics.push({cadence,ticks:history.length,hash:hash(history),id:first.id});}
 assert.equal(new Set(publishedPhysics.map(p=>p.hash)).size,1);m.dispose();
}
const lifecycle=new IntegratedModel();lifecycle.ready();lifecycle.start(42);lifecycle.beginPlanningFrame();lifecycle.step(1/120,{x:0,y:0});const pending=lifecycle.field.pending;assert.ok(pending);
lifecycle.pause();const pausedHash=hash(state(lifecycle));for(let i=0;i<12;i++)lifecycle.step(1/120,{x:1,y:1});assert.equal(hash(state(lifecycle)),pausedHash);lifecycle.resume();
lifecycle.state='GAME_OVER';lifecycle.start(42);assert.equal(pending.getResult()?.reason,'CANCELLED');assert.equal(lifecycle.field.ledger.snapshot().length,0);assert.equal(lifecycle.homing.current,undefined);assert.equal(lifecycle.fragments.count,0);lifecycle.dispose();
const result={approved,node:process.version,ci,rows,replays,publishedPhysics,lifecycle:'pause frozen; active pending job cancelled; ownership/mine/rewards reset',
 notes:['Same-cadence candidate versus approved uses identical fixed inputs and full authoritative hashes. Different cadence runs follow their own admitted witnesses; their inputs/fields need not match.',
 'maxOmission is consecutive omitted-decision duration/distance, not empty-screen duration. maxMineGap includes initial and trailing interval; pendingAtEnd is not counted as a rejected proposal. CPU timings include independent replay overhead outside planning samples.']};
await writeFile(`${directory}/${ci?'release-safety-ci':'release-safety'}.json`,JSON.stringify(result,null,2));console.log('Release safety passed:',replays,'independent replays');
