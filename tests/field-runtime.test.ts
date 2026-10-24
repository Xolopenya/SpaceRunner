import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { OwnershipLedger } from '../src/core/field-ownership.ts';
import { RuntimePlanningSession } from '../src/core/field-runtime-session.ts';
import { PlanningSession } from '../src/core/field-scheduler.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { beginValidation, beginPublicationCheck, beginRuntimePublicationCheck, runtimeAxialDisjoint } from '../src/core/field-validator.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { INPUT_HISTORIES, simulateRuntime } from './fixtures/runtime-simulation.ts';
import { libraryCase } from './fixtures/pattern-corpus.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { SchedulerRoot } from '../src/core/field-scheduler.ts';

function complete(job: ValidationJob) {
  for (let i = 1; !job.getResult() && i <= 144; i++) job.advance(undefined, i);
  return job.getResult()!;
}
const origin = (): SchedulerRoot => ({ player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0 });
function make(ledger = new OwnershipLedger()) {
  const d = new DifficultyDirector(42), section = d.next(d.initial()).section;
  return new RuntimePlanningSession(section, origin(), [], ledger);
}
function drive(s: RuntimePlanningSession | PlanningSession, until = 144, changeAt = 144) {
  const p = new FlightPrediction(), state = { ...origin().player, elapsed: 0, distance: 0 };
  let root = origin();
  for (let tick = 1; tick <= until; tick++) {
    const input = tick >= changeAt ? { x: 1, y: 0 } : { x: 0, y: 0 };
    p.step(state, input); root = { player: { x: state.x, y: state.y, vx: state.vx, vy: state.vy }, input, elapsed: state.elapsed, distance: state.distance };
    const before = s.metrics; s.advance(root, [], tick); const after = s.metrics;
    assert.ok(after.propagations - before.propagations <= 3072 && after.narrowQueries - before.narrowQueries <= 6144);
    if (tick < 144) assert.equal(s.getResult(), undefined);
  }
  return root;
}

test('runtime publication uses actual changed input without any future-root argument', () => {
  const runtime = make(), current = drive(runtime), result = runtime.getResult()!;
  assert.equal(result.status, 'committed'); assert.deepEqual(result.witness!.context.player, current.player);
  assert.deepEqual(result.witness!.context.input, current.input); assert.equal(result.witness!.context.distance, current.distance);
  assert.equal(result.metrics.searches, 2); assert.equal(result.metrics.replays, 4);
  const old = new PlanningSession(result.section, origin(), [], new OwnershipLedger()); drive(old);
  assert.equal(old.getResult()!.reason, 'PUBLICATION_ROOT_CHANGED');
});

test('axial runtime gate matches unpruned publication certificates across real families and changed roots', () => {
  for (const seed of [0, 1, 42, 0xffffffff]) for (const family of ['scattered', 'narrowing', 'alternating', 'vertical-weave'] as const) {
    const c = libraryCase(seed, family, .8, 0, 'neutral').context, base = complete(beginValidation(c));
    assert.equal(base.decision, 'accept'); if (base.decision !== 'accept') continue;
    for (const input of [{ x: 0, y: 0 }, { x: -1, y: 1 }, { x: .37, y: -.82 }]) {
      const state = { ...c.player, elapsed: c.elapsed, distance: c.distance }, p = new FlightPrediction();
      for (let i = 0; i < 93; i++) p.step(state, input);
      const current = { ...c, player: state, input, elapsed: state.elapsed, distance: state.distance };
      const plain = complete(beginPublicationCheck(base.witness, current)), fastJob = beginRuntimePublicationCheck(base.witness, current);
      const fast = fastJob.advance(); assert.ok(fast, 'Full actual-state proof must finish in one approved tick');
      assert.deepEqual(fast, plain); assert.ok(fastJob.metrics.propagations <= 1800 && fastJob.metrics.narrowQueries <= 6144);
      assert.ok(fastJob.metrics.broadPhaseSkips > 0);
    }
  }
});

test('twelve prerecorded unknown-input histories keep all accepted certificates independently replayable', () => {
  for (const history of INPUT_HISTORIES) {
    const a = simulateRuntime({ seed: 42, sections: 4, history, audit: true });
    const b = simulateRuntime({ seed: 42, sections: 4, history });
    assert.equal(a.hash, b.hash); assert.equal(a.remainingRecords, 0); assert.ok(a.audits > 0);
    assert.equal(new Set(a.hazards.map(h => h.id)).size, a.hazards.length);
    assert.ok(a.peakHazards <= 32 && a.peakRecords <= 16);
    for (const o of a.outcomes) assert.ok(o.metrics.searches <= 2 && o.metrics.replays <= 4 && o.attempts.length <= 2);
  }
});

test('actual-state replay cannot carry incomplete proof to a later tick', () => {
  const s = make(), current = drive(s, 143), p = new FlightPrediction();
  const state = { ...current.player, elapsed: current.elapsed, distance: current.distance }; p.step(state, current.input);
  const r = s.advance({ ...current, player: state, elapsed: state.elapsed, distance: state.distance }, [], 144, { propagations: 0, narrowQueries: 0 })!;
  assert.equal(r.status, 'omitted-uncertified'); assert.equal(r.reason, 'ACTUAL_REPLAY_BUDGET'); assert.equal(r.witness, undefined);
  assert.equal(s.advance(current, [], 145), r);
});

test('reset epoch or cancellation prevents a ready runtime witness from being published', () => {
  const ledger = new OwnershipLedger(), s = make(ledger); drive(s, 143);
  ledger.reset(); assert.equal(ledger.reserve('new-epoch', 6, 2, []).status, 'reserved');
  const root = origin(); root.elapsed = 1.2; root.distance = 24;
  const r = s.advance(root, [], 144)!; assert.equal(r.status, 'blocked'); assert.equal(r.reason, 'STALE_OWNERSHIP');
  assert.equal(ledger.snapshot()[0]!.writer, 'new-epoch');
  const clean = new OwnershipLedger(), cancelled = make(clean); drive(cancelled, 10); cancelled.cancel();
  assert.equal(clean.snapshot().length, 0); assert.equal(cancelled.advance(origin(), [], 11)!.reason, 'CANCELLED');
});

test('complete known geometry is independent of render objects and cannot be tampered before final replay', () => {
  const ledger = new OwnershipLedger(), first = make(ledger), root = drive(first, 144, Infinity), previous = first.getResult()!;
  const d = new DifficultyDirector(42), next = d.next(d.next(d.initial()).next).section;
  const missing = new RuntimePlanningSession(next, root, [], ledger);
  assert.equal(missing.getResult()!.reason, 'INCOMPLETE_KNOWN_FIELD');
  const hazards = previous.transaction!.hazards, tampered = [{ ...hazards[0]!, spin: .123 }, ...hazards.slice(1)];
  assert.equal(new RuntimePlanningSession(next, root, tampered, ledger).getResult()!.reason, 'INCOMPLETE_KNOWN_FIELD');
  assert.equal(ledger.knownHazards(root.distance).length, hazards.length);
});

test('bootstrap at cell4 has explicit full validation and retains a conservative first-contact lead', () => {
  const r = simulateRuntime({ seed: 42, sections: 4, history: 'neutral', audit: true });
  const first = r.outcomes[0]!; assert.equal(first.section.firstCell, 4); assert.equal(first.status, 'committed');
  const firstOpportunity = Math.min(...first.transaction!.hazards.map(h => h.passDistance - h.radius - CONFIG.ship.radius - .15));
  assert.ok(firstOpportunity - first.witness!.context.distance > 60);
  assert.equal(first.witness!.controls[0]!.ticks >= 54, true);
});

test('runtime axial culling stays conservative at contact boundaries and large world coordinates', () => {
  const prediction = new FlightPrediction(); let skipped = 0;
  for (const cell of [4, 1_000_000, 1_000_000_000]) for (let seed=0;seed<32;seed++) {
    for (const h of new FieldGenerator(seed).propose(cell,6).hazards) for (const side of [-1,1]) for (const offset of [-1e-6,0,1e-6,3]) {
      const distance=h.passDistance+side*(h.radius+.57+offset),previous={x:h.x,y:h.y,vx:0,vy:0,elapsed:120,distance},next={...previous};prediction.step(next,{x:0,y:0});
      if(runtimeAxialDisjoint(h,distance,next.distance,.15)) {skipped++;assert.equal(prediction.hit(previous,next,h,.15),false);assert.equal(prediction.hitGameplay(previous,next,h),false);}
    }
  }
  assert.ok(skipped>1000);
});

test('proposals stay seed-only while actual-input vetoes change admitted geometry',()=>{
 const a=simulateRuntime({seed:42,sections:8,history:'neutral'}),b=simulateRuntime({seed:42,sections:8,history:'boundary'});
 assert.deepEqual(a.outcomes.map(o=>o.section),b.outcomes.map(o=>o.section));
 assert.notDeepEqual(a.hazards.map(h=>h.id),b.hazards.map(h=>h.id));assert.notEqual(a.hash,b.hash);
});
