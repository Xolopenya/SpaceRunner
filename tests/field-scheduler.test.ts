import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { OwnershipLedger } from '../src/core/field-ownership.ts';
import { PlanningSession, forecastPublication, visibleAt } from '../src/core/field-scheduler.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { simulateSchedule } from './fixtures/director-simulation.ts';
import type { SchedulerRoot } from '../src/core/field-scheduler.ts';
import type { PlannedHazard } from '../src/core/field-types.ts';
import type { ValidationBudget } from '../src/core/field-validator-types.ts';
import type { ValidationWitness } from '../src/core/field-validator-types.ts';

const origin = (): SchedulerRoot => ({ player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0 });
function drive(session: PlanningSession, root: SchedulerRoot, committed: readonly PlannedHazard[] = [],
  budget?: ValidationBudget, ticks = 144, changeAt = Infinity) {
  const state = { ...root.player, elapsed: root.elapsed, distance: root.distance }, prediction = new FlightPrediction();
  let current = root;
  for (let tick = 1; tick <= ticks; tick++) {
    const input = tick >= changeAt ? { x: 1, y: 0 } : root.input;
    prediction.step(state, input); current = { player: state, input, elapsed: state.elapsed, distance: state.distance };
    const before = session.metrics; session.advance(current, visibleAt(committed, state.distance), tick, budget); const after = session.metrics;
    assert.ok(after.propagations - before.propagations <= (budget?.propagations ?? 3072));
    assert.ok(after.narrowQueries - before.narrowQueries <= (budget?.narrowQueries ?? 6144));
    if (tick < 144) assert.equal(session.getResult(), undefined);
  }
  return current;
}
function first(seed = 42, cell = 6) { const d = new DifficultyDirector(seed); return d.next(d.initial(cell)); }

test('normal admission, independent replay and exact publication root precede atomic commit', () => {
  const ledger = new OwnershipLedger(), root = origin(), section = first().section;
  const session = new PlanningSession(section, root, [], ledger);
  assert.equal(ledger.snapshot()[0]!.state, 'pending'); assert.equal(ledger.knownHazards(0).length, 0);
  const current = drive(session, root), result = session.getResult()!;
  assert.equal(result.status, 'committed'); assert.equal(result.witness!.structuralPolicy, 'generator');
  assert.equal(result.metrics.searches, 2); assert.equal(result.metrics.replays, 4);
  assert.deepEqual(result.witness!.context.player, { x: current.player.x, y: current.player.y, vx: current.player.vx, vy: current.player.vy });
  assert.equal(result.witness!.context.elapsed, current.elapsed); assert.equal(result.witness!.context.distance, current.distance);
  const replay = beginTrajectoryReplay(result.witness!.context, result.witness!.controls);
  while (!replay.getResult()) replay.advance(); assert.equal(replay.getResult()!.decision, 'accept');
  assert.equal(ledger.snapshot()[0]!.state, 'committed');
  assert.ok(result.witness!.terminal.distance + 1.67 <= result.witness!.reservedUntilDistance);
});
test('different bounded chunk sizes retain the same fixed-tick publication and witness', () => {
  const root = origin(), s = first().section;
  const a = new PlanningSession(s, root, [], new OwnershipLedger()), b = new PlanningSession(s, root, [], new OwnershipLedger());
  drive(a, root); drive(b, root, [], { propagations: 2048, narrowQueries: 4096 });
  assert.equal(a.getResult()!.status, 'committed'); assert.equal(b.getResult()!.status, 'committed');
  assert.deepEqual(a.getResult()!.witness, b.getResult()!.witness);
});
test('changed actual input invalidates a prepared publication instead of accepting a stale captured root', () => {
  const root = origin(), ledger = new OwnershipLedger(), session = new PlanningSession(first().section, root, [], ledger);
  drive(session, root, [], undefined, 144, 144);
  const result = session.getResult()!;
  assert.equal(result.status, 'omitted-uncertified'); assert.equal(result.reason, 'PUBLICATION_ROOT_CHANGED');
  assert.equal(result.witness, undefined); assert.equal(result.transaction, undefined); assert.equal(ledger.knownHazards(0).length, 0);
  assert.equal(ledger.snapshot()[0]!.state, 'omitted');
});
test('one shared deadline includes validation, replay, publication and waiting; no budget increase', () => {
  const root = origin(), session = new PlanningSession(first().section, root, [], new OwnershipLedger());
  assert.throws(() => session.advance(root, [], 1, { propagations: 4096, narrowQueries: 8192 }), RangeError);
  drive(session, root, [], { propagations: 0, narrowQueries: 0 });
  assert.equal(session.getResult()!.status, 'omitted-uncertified');
  assert.match(session.getResult()!.reason!, /COMPUTATION_BUDGET_EXCEEDED|PLANNING_DEADLINE/);
  const late = new PlanningSession(first().section, root, [], new OwnershipLedger());
  const current = drive(late, root, [], undefined, 143);
  assert.equal(late.advance(current, [], 145)!.reason, 'MISSED_PUBLICATION_TICK');
});
test('a generation span rejection requests a separate, deterministic ambient fallback with normal validation', () => {
  const base = first().section, root = origin();
  const section = { ...base, id: base.id + '/negative-span', family: 'vertical-weave' as const, cellCount: 2, endDistance: base.startDistance + 48 };
  const run = () => { const p = new PlanningSession(section, root, [], new OwnershipLedger()); drive(p, root); return p.getResult()!; };
  const result = run(); assert.equal(result.status, 'committed');
  assert.equal(result.attempts.length, 2); assert.match(result.attempts[0]!.reason!, /INSUFFICIENT_SPAN/);
  assert.equal(result.attempts[1]!.kind, 'ambient-fallback'); assert.equal(result.transaction!.provenance.version, 'ambient-v1');
  assert.deepEqual(run().witness, result.witness);
});
test('late candidate rejection can certify an explicitly empty recovery without counting it as a dense encounter', () => {
  const section = first().section, candidate = new FieldGenerator(section.seed).propose(section.firstCell, section.cellCount), h = candidate.hazards[0]!;
  const root: SchedulerRoot = { player: { x: h.x, y: h.y, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 120, distance: h.passDistance - 2 };
  const session = new PlanningSession(section, root, [], new OwnershipLedger()); drive(session, root);
  const result = session.getResult()!; assert.equal(result.status, 'omitted-certified');
  assert.equal(result.transaction!.hazards.length, 0); assert.equal(result.attempts[1]!.kind, 'empty-fallback');
  assert.match(result.attempts[0]!.reason!, /INSUFFICIENT_REACTION_DISTANCE/);
  assert.ok(result.metrics.searches <= 2 && result.metrics.replays <= 4);
});
test('capacity pressure never truncates obstacles and empty fallback is independently checked', () => {
  const generator = new FieldGenerator(42), committed = Array.from({ length: 8 }, (_, i) => generator.propose(i * 6, 6).hazards).flat().slice(0, 32);
  const section = first(42, 60).section, ledger = new OwnershipLedger(); ledger.reset(60);
  const root = { ...origin(), elapsed: 120, distance: section.startDistance - 128 };
  const before = JSON.stringify(committed), session = new PlanningSession(section, root, committed, ledger); drive(session, root, committed);
  const result = session.getResult()!; assert.equal(result.status, 'omitted-certified');
  assert.equal(JSON.stringify(committed), before); assert.match(result.attempts[0]!.reason!, /capacity/);
  assert.ok(result.attempts[0]!.transaction!.hazards.length > 0); assert.equal(result.transaction!.hazards.length, 0);
});
test('early hazard disappearance cannot erase known geometry or reuse its ownership', () => {
  const ledger = new OwnershipLedger(), root = origin(), decision = first(), session = new PlanningSession(decision.section, root, [], ledger);
  const current = drive(session, root), director = new DifficultyDirector(42);
  const next = new PlanningSession(director.next(decision.next).section, current, [], ledger);
  assert.equal(next.getResult()!.status, 'blocked'); assert.equal(next.getResult()!.reason, 'INCOMPLETE_KNOWN_FIELD');
  assert.equal(ledger.snapshot().length, 1);
  const hazards = session.getResult()!.transaction!.hazards;
  for (const change of [{ x: hazards[0]!.x + .001 }, { radius: .66 }, { phase: .123 },
    { provenance: { ...hazards[0]!.provenance, settingsKey: 'changed' } }]) {
    const modified = [{ ...hazards[0]!, ...change }, ...hazards.slice(1)];
    const rejected = new PlanningSession(director.next(decision.next).section, current, modified, ledger);
    assert.equal(rejected.getResult()!.reason, 'INCOMPLETE_KNOWN_FIELD');
  }
});
test('restart during pending work prevents an old job from finalizing a new run reservation', () => {
  const ledger = new OwnershipLedger(), root = origin(), session = new PlanningSession(first().section, root, [], ledger);
  const current = drive(session, root, [], undefined, 143);
  ledger.reset(); const r = ledger.reserve('new-run', 6, 2, []); assert.equal(r.status, 'reserved');
  const final = { ...current.player, elapsed: current.elapsed, distance: current.distance }; new FlightPrediction().step(final, current.input);
  session.advance({ player: final, input: current.input, elapsed: final.elapsed, distance: final.distance }, [], 144);
  assert.equal(session.getResult()!.status, 'blocked'); assert.equal(session.getResult()!.reason, 'STALE_OWNERSHIP');
  assert.equal(ledger.snapshot()[0]!.writer, 'new-run'); assert.equal(ledger.snapshot()[0]!.state, 'pending');
});
test('eight real consecutive sections preserve residual velocity, joint proofs and retirement across a rejected publication', () => {
  const run = simulateSchedule({ seed: 42, sections: 8 });
  assert.equal(run.hash, 'b0e9764b'); assert.equal(run.contacts, 0); assert.equal(run.remainingRecords, 0);
  assert.ok(run.distance > 800 && run.sections.some(s => s.status === 'omitted-uncertified'));
  assert.ok(run.sections.some(s => s.attempts.some(a => a.context && (a.context.player.vx !== 0 || a.context.player.vy !== 0))));
  assert.ok(run.sections.some(s => s.witness && s.witness.context.committed.length > 0));
  assert.equal(new Set(run.hazards.map(h => h.id)).size, run.hazards.length);
  for (const o of run.sections) assert.ok(o.metrics.searches <= 2 && o.metrics.replays <= 4);
  let previous: ValidationWitness | undefined, replacements = 0;
  for (const o of run.sections) if (o.status === 'committed' && o.witness) {
    if (previous) {
      const exit = Math.max(...[...previous.context.committed, ...previous.context.candidate.hazards].map(h => h.passDistance + h.radius + .57));
      if (o.transaction!.hazards.some(h => h.passDistance - h.radius - .57 < previous!.reservedUntilDistance
        && h.passDistance + h.radius + .57 > exit)) replacements++;
    }
    previous = o.witness;
  }
  assert.ok(replacements > 0, 'An old empty tail is replaced only by a fresh whole-union publication witness');
  assert.ok(run.peakRecords <= 16 && run.peakHazards <= 32);
});
test('forecast is bounded data and never mutates the supplied player', () => {
  const root = origin(), before = JSON.stringify(root), prediction = forecastPublication(root, [{ ticks: 144, input: { x: 1, y: 0 } }]);
  assert.equal(JSON.stringify(root), before); assert.ok(prediction.player.x > 0);
  assert.throws(() => forecastPublication(root, [{ ticks: 0, input: { x: 0, y: 0 } }]), RangeError);
});
test('oversized external context rejects before copying it into planning state', () => {
  const h = new FieldGenerator(42).propose(0, 6).hazards[0]!;
  const ledger = new OwnershipLedger(), session = new PlanningSession(first().section, origin(), Array(33).fill(h), ledger);
  assert.equal(session.getResult()!.status, 'blocked'); assert.equal(session.getResult()!.reason, 'CAPACITY');
  assert.equal(ledger.snapshot().length, 0);
});
test('explicit cancellation releases only unpublished ownership and does not advance the frontier', () => {
  const ledger = new OwnershipLedger(), root = origin(), section = first().section;
  const session = new PlanningSession(section, root, [], ledger);
  assert.equal(session.cancel().reason, 'CANCELLED'); assert.equal(ledger.frontier, section.firstCell);
  assert.equal(ledger.snapshot().length, 0);
  const next = new PlanningSession(section, root, [], ledger); drive(next, root);
  assert.equal(next.getResult()!.status, 'committed');
  assert.equal(session.advance(root, [], 1)!.reason, 'CANCELLED');
});
