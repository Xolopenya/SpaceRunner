import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {beginResolvedRuntimeSearch,beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {ADAPTIVE_GEOMETRY as geometry} from '../src/experiments/adaptive-homing/transaction.ts';
import {homingEscapeGoal} from '../src/experiments/adaptive-homing/route-policy.ts';
import {ORIGINAL_HOMING_GEOMETRY} from './fixtures/original-homing-route.ts';
import {AdaptiveHomingGameModel} from '../src/experiments/adaptive-homing/model.ts';
import type {FieldValidationContext} from '../src/core/field-types.ts';
import type {ControlHint,TrajectoryResult} from '../src/core/field-validator-types.ts';
const {cases}=JSON.parse(readFileSync(new URL('./fixtures/homing-route-counterexamples.json',import.meta.url),'utf8')) as {cases:{id:number;context:FieldValidationContext;hint:ControlHint;original:TrajectoryResult;fullBeamRecovered:boolean}[]};

test('frozen actual roots reproduce all fifteen proposal and three held-prefix failures exactly',()=>{
 for(const c of cases){const j=beginResolvedRuntimeSearch(c.context,{geometry:ORIGINAL_HOMING_GEOMETRY},c.hint);j.advance({propagations:3072,narrowQueries:6144},1);assert.deepEqual(j.getResult(),c.original,`fixture${c.id}`);}
});

test('current coupled goals recover all fifteen counterexamples within one original allowance',()=>{
 let recovered=0,reaction=0;
 for(const c of cases){const before=JSON.stringify(c.context),j=beginResolvedRuntimeSearch(c.context,{geometry});
  j.advance({propagations:3072,narrowQueries:6144},1);const result=j.getResult()!;assert.ok(result,`unfinished${c.id}`);
  assert.ok(j.metrics.propagations<=3072&&j.metrics.narrowQueries<=6144);assert.ok(j.metrics.searches<=1&&j.metrics.replays<=1);
  if(result.decision==='accept'){recovered++;const w=result.witness;assert.equal(w.margin,.15);assert.ok(w.controls[0]!.ticks>=54);assert.deepEqual(w.controls[0]!.input,c.context.input);
   const replay=beginTrajectoryReplay(w.context,w.controls,{geometry});while(!replay.getResult())replay.advance();const independent=replay.getResult()!;assert.equal(independent.decision,'accept');if(independent.decision==='accept')assert.equal(independent.witness.hash,w.hash);
  }else if(c.original.decision==='reject'&&c.original.reason==='INSUFFICIENT_REACTION_DISTANCE'){reaction++;assert.deepEqual(result,c.original);}
  assert.equal(JSON.stringify(c.context),before);
 }
 assert.equal(recovered,15);assert.equal(reaction,3);
});

test('escape goals use current inertia, preserve static priority and never mutate branch state',()=>{
 const c=cases[0]!,hazards=[...c.context.committed,...c.context.candidate.hazards],h=hazards.find(h=>h.motion)!;
 const s={x:0,y:0,vx:0,vy:0,elapsed:c.context.elapsed,distance:c.context.distance};assert.equal(homingEscapeGoal(hazards,s),undefined);
 const root={...s,distance:h.passDistance-4,homing:{id:h.id,tick:1,x:0,y:0,vx:4,vy:0,ax:0,ay:0,targetX:0,targetY:0,phase:'pursuit' as const}},before=JSON.stringify(root);
 const a=homingEscapeGoal(hazards,root),b=homingEscapeGoal(hazards,{...root,homing:{...root.homing,vx:-4}});assert.ok(a&&b);assert.ok(a.x<0&&b.x>0);assert.equal(JSON.stringify(root),before);assert.equal(homingEscapeGoal([h],{...root,distance:h.passDistance+8}),undefined);
 const isolated=homingEscapeGoal([h],root)!;assert.equal(Math.abs(isolated.x),4.8);assert.equal(isolated.y,0);
});

test('pause freezes active preparation and restart cancels its ownership before another proposal',()=>{
 const m=new AdaptiveHomingGameModel();m.ready();m.start(0);m.beginPlanningFrame();m.step(1/120,{x:0,y:0});const pending=m.field.pending!;assert.ok(pending);
 const before=JSON.stringify(pending.metrics),elapsed=m.elapsed;m.pause();for(let n=0;n<120;n++)m.step(1/120,{x:1,y:0});assert.equal(m.elapsed,elapsed);assert.equal(JSON.stringify(pending.metrics),before);
 m.resume();m.state='GAME_OVER';m.start(0);assert.equal(pending.getResult()?.reason,'CANCELLED');assert.equal(m.field.pending,undefined);assert.equal(m.field.ledger.snapshot().length,0);assert.equal(m.homing.samples.length,0);
 m.beginPlanningFrame();m.step(1/120,{x:0,y:0});assert.notEqual(m.field.pending,pending);assert.equal(m.field.fault,undefined);m.dispose();
});
