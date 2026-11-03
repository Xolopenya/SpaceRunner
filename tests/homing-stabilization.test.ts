import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG} from '../src/config.ts';
import {HomingPlanningFrame} from '../src/experiments/adaptive-homing/planning-frame.ts';
import {AdaptiveHomingGameModel} from '../src/experiments/adaptive-homing/model.ts';
import {ADAPTIVE_GEOMETRY as geometry} from '../src/experiments/adaptive-homing/transaction.ts';
import {beginTrajectoryReplay} from '../src/core/field-validator.ts';

test('render interval shares work and reserves a complete actual-root allowance',()=>{
 const f=new HomingPlanningFrame();f.begin();
 f.spent(3000,6144,4);assert.deepEqual(f.budget(true),{propagations:3072,narrowQueries:6144});
 f.spent(100,10,1);assert.deepEqual(f.budget(true),{propagations:0,narrowQueries:0});
 assert.equal(f.budget(false).propagations,3044);f.finish(.08);assert.equal(f.latest.propagations,3100);assert.equal(f.latest.chunks,2);assert.equal(f.spikes,1);
 f.begin();assert.deepEqual(f.budget(true),{propagations:3072,narrowQueries:6144});
});

function flight(stress:boolean){
 const m=new AdaptiveHomingGameModel(true);m.ready();m.start(42);m.finishPlanningFrame(1/60);
 const outcomes=[];let last,frames=0,audits=0;
 for(let tick=0;tick<10000&&m.state==='PLAYING';){
  const count=stress&&frames%60===30?12:2;
  m.beginPlanningFrame();
  for(let step=0;step<count&&tick<10000&&m.state==='PLAYING';step++,tick++){
   const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0,input={x:0,y:0};
   for(const run of w?.controls??[]){if(at<run.ticks){input=run.input;break;}at-=run.ticks;}
   m.step(CONFIG.step,input);assert.equal(m.field.fault,undefined);
   const o=m.field.lastOutcome;if(o&&o!==last){last=o;outcomes.push({status:o.status,reason:o.reason,hash:o.witness?.hash,metrics:o.metrics});
    if(o.witness){const j=beginTrajectoryReplay(o.witness.context,o.witness.controls,{geometry});while(!j.getResult())j.advance();const r=j.getResult()!;assert.equal(r.decision,'accept');if(r.decision==='accept')assert.equal(r.witness.hash,o.witness.hash);audits++;}
   }
  }
  m.finishPlanningFrame(count/120);const f=m.homing.planningFrame.latest;assert.ok(f.propagations<=6144);assert.ok(f.queries<=12288);frames++;
 }
 assert.ok(audits>8);assert.equal(m.hull,3);const result={outcomes,ship:{...m.ship},distance:m.distance};m.dispose();return result;
}
test('normal and transient catch-up frames remain bounded, deterministic and independently replayable',()=>{
 assert.deepEqual(flight(false),flight(false));assert.deepEqual(flight(true),flight(true));
});

test('withheld render allowance cannot extend the simulation deadline or commit stale work',()=>{
 const m=new AdaptiveHomingGameModel(true);m.ready();m.start(42);m.beginPlanningFrame();
 // Exhaust this frame without advancing the simulation. Keep the frame open.
 m.homing.planningFrame.spent(6144,12288,0);
 for(let n=0;n<144;n++)m.step(CONFIG.step,{x:1,y:0});
 const o=m.field.lastOutcome!;assert.ok(o);assert.equal(o.status,'omitted-uncertified');assert.ok(o.reason==='ACTUAL_REPLAY_BUDGET'||o.reason==='PLANNING_DEADLINE');
 assert.equal(o.metrics.planningTicks,144);assert.equal(o.witness,undefined);assert.equal(m.field.committed,0);assert.equal(m.field.slots.filter(s=>s.active).length,0);
 m.dispose();
});
