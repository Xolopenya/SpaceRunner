import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CONFIG } from '../src/config.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { GameModel } from '../src/core/game-model.ts';
import { beginValidation, beginTrajectoryReplay, beginPublicationCheck } from '../src/core/field-validator.ts';
import { VALIDATION_LIMITS as L } from '../src/core/field-validator-types.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { TrajectoryResult, ValidationWitness } from '../src/core/field-validator-types.ts';
import { barrier, context, fixtureOptions as options, knownControls, obstacle } from './fixtures/trajectory-fixtures.ts';

export function complete(job: ValidationJob): TrajectoryResult {
  while (!job.getResult()) job.advance();
  return job.getResult()!;
}
function accepted(result: TrajectoryResult): ValidationWitness {
  assert.equal(result.decision, 'accept', JSON.stringify(result));
  if (result.decision !== 'accept') throw new Error('Expected acceptance');
  return result.witness;
}
const left = [{ ticks: 96, input: { x: -1, y: 0 } }];
const right = [{ ticks: 96, input: { x: 1, y: 0 } }];

test('R01 empty field brakes residual velocity through real controls and reserved tail', () => {
  const c = context([], { player: { x: 0, y: 0, vx: 6, vy: -4 } });
  const witness = accepted(complete(beginValidation(c, options)));
  assert.equal(witness.terminal.vx, 0); assert.equal(witness.terminal.vy, 0);
  assert.ok(witness.terminal.x > 0 && witness.terminal.y < 0);
  assert.ok(witness.terminal.distance + 1.67 <= witness.reservedUntilDistance);
});
test('R02 safe straight trace is independently replayed and search finds a witness', () => {
  const c = context([obstacle('side', 3, 0, 68)]);
  accepted(complete(beginTrajectoryReplay(c, knownControls(c), options)));
  accepted(complete(beginValidation(c, options)));
});
test('R03 both mirrored horizontal passages: known traces AND beam search', () => {
  for (const sign of [-1, 1]) {
    const c = context(barrier('x', sign, 68));
    accepted(complete(beginTrajectoryReplay(c, knownControls(c, sign > 0 ? left : right), options)));
    const w = accepted(complete(beginValidation(c, options)));
    assert.ok(w.terminal.x * sign < 0);
  }
});
test('R04 both vertical passages: known traces AND beam search', () => {
  for (const sign of [-1, 1]) {
    const c = context(barrier('y', sign, 68));
    accepted(complete(beginTrajectoryReplay(c, knownControls(c, [{ ticks: 96, input: { x: 0, y: -sign } }]), options)));
    const w = accepted(complete(beginValidation(c, options)));
    assert.ok(w.terminal.y * sign < 0);
  }
});
test('R05 alternating barriers retain continuous velocity and discover a joint route', () => {
  const c = context([...barrier('x', 1, 68, 'first'), ...barrier('x', -1, 170, 'second')]);
  const moves = [...left, { ticks: 114, input: { x: 0, y: 0 } }, { ticks: 180, input: { x: 1, y: 0 } }];
  accepted(complete(beginTrajectoryReplay(c, knownControls(c, moves), options)));
  accepted(complete(beginValidation(c, options)));
});
test('R06 individually passable barriers at68/71.4 reject jointly; committed field preserved', () => {
  const a = barrier('x', 1, 68, 'a'), b = barrier('x', -1, 71.4, 'b');
  accepted(complete(beginValidation(context(a), options)));
  accepted(complete(beginValidation(context(b), options)));
  const c = context(b, { committed: a }), before = JSON.stringify(c);
  assert.deepEqual(complete(beginValidation(c, options)), { decision: 'reject', reason: 'NO_WITNESS_FOUND' });
  assert.equal(JSON.stringify(c), before);
});
test('R07 overlapping28-object full-plane fixture rejects without immunity or hull', () => {
  const grid = [];
  for (const x of [-6, -4, -2, 0, 2, 4, 6]) for (const y of [-3.6, -1.2, 1.2, 3.6]) grid.push(obstacle(`grid${grid.length}`, x, y, 68));
  const result = complete(beginValidation(context(grid), options));
  assert.equal(result.decision, 'reject');
  assert.equal(result.decision === 'reject' && result.reason, 'NO_WITNESS_FOUND');
});
test('R08 insufficient held-input reaction distance fails explicitly', () => {
  assert.deepEqual(complete(beginValidation(context([obstacle('near', 0, 0, 5)]), options)), {
    decision: 'reject', reason: 'INSUFFICIENT_REACTION_DISTANCE', detail: 'near',
  });
});
test('R09 delayed reversal with initial+8 is rejected while the rest root passes', () => {
  const c = context(barrier('x', 1, 34));
  accepted(complete(beginValidation(c, options)));
  const moving = { ...c, player: { x: 0, y: 0, vx: 8, vy: 0 }, input: { x: 1, y: 0 } };
  assert.equal(complete(beginValidation(moving, options)).decision, 'reject');
});
test('R10 narrow spherical gap accepts straight replay at margin0.15', () => {
  const c = context([obstacle('l', -1.8, 0, 68), obstacle('r', 1.8, 0, 68)]);
  accepted(complete(beginTrajectoryReplay(c, knownControls(c), options)));
  accepted(complete(beginValidation(c, options)));
});
test('R11 blocked straight witness rejects; open layout may have another safe path', () => {
  const c = context([obstacle('l', -1.5, 0, 68), obstacle('r', 1.5, 0, 68)]);
  const r = complete(beginTrajectoryReplay(c, knownControls(c), options));
  assert.equal(r.decision === 'reject' && r.reason, 'COLLISION_FOUND');
  accepted(complete(beginValidation(c, options)));
});
test('R12 near-boundary outward witness collides; actual inward reversal succeeds', () => {
  const c = context([obstacle('edge', 5.4, 0, 34)], { player: { x: 3, y: 0, vx: 8, vy: 0 } });
  const r = complete(beginTrajectoryReplay(c, knownControls(c, right), options));
  assert.equal(r.decision === 'reject' && r.reason, 'COLLISION_FOUND');
  accepted(complete(beginTrajectoryReplay(c, knownControls(c, left), options)));
});
test('R13 half-meteor calibrated profile accepts a straight Y1.1 pass', () => {
  const c = context([obstacle('half', 0, -1.1, 68, { kind: 1, phase: Math.PI, radius: 1 })]);
  accepted(complete(beginTrajectoryReplay(c, knownControls(c), options)));
  accepted(complete(beginValidation(c, options)));
});
test('R14 corresponding round meteor rejects that same straight witness', () => {
  const c = context([obstacle('round', 0, -1.1, 68, { radius: 1 })]);
  const r = complete(beginTrajectoryReplay(c, knownControls(c), options));
  assert.equal(r.decision === 'reject' && r.reason, 'COLLISION_FOUND');
});
test('R15 rotating barrel and generator reject colliding full-step witnesses', () => {
  for (const phase of [0, Math.PI]) {
    const c = context([obstacle('rotating', 0, 0, 68.13, { kind: 2, phase, spin: .7 })]);
    const r = complete(beginTrajectoryReplay(c, knownControls(c), options));
    assert.equal(r.decision === 'reject' && r.reason, 'COLLISION_FOUND');
  }
});
test('R16 opposite velocities at identical position are not merged into one root', () => {
  const hazards = barrier('x', 1, 34);
  const away = context(hazards, { player: { x: 0, y: 0, vx: -8, vy: 0 }, input: { x: -1, y: 0 } });
  accepted(complete(beginValidation(away, options)));
  const toward = { ...away, player: { ...away.player, vx: 8 }, input: { x: 1, y: 0 } };
  assert.equal(complete(beginValidation(toward, options)).decision, 'reject');
});
test('R17 publication replays later state/input and rejects stale unsafe roots', () => {
  const c = context([obstacle('future', 3, 0, 68)]), w = accepted(complete(beginValidation(c, options)));
  const later = { ...c, elapsed: 120.5, distance: 17 };
  const checked = accepted(complete(beginPublicationCheck(w, later, options)));
  assert.equal(checked.context.elapsed, later.elapsed);
  assert.equal(checked.context.distance, 17);
  const unsafe = { ...c, elapsed: 121.1, distance: 37.4, player: { x: 3, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 } };
  const result = complete(beginPublicationCheck(w, unsafe, options));
  assert.equal(result.decision === 'reject' && result.reason, 'STALE_PUBLICATION_STATE');
  assert.equal(w.context.distance, 0);
});
test('R18 extend beyond a short arbitrary horizon, reject beyond the real15s cap', () => {
  accepted(complete(beginValidation(context([obstacle('distant', 0, 0, 240)]), options)));
  const r = complete(beginValidation(context([obstacle('too-far', 0, 0, 520)]), options));
  assert.equal(r.decision === 'reject' && r.reason, 'HORIZON_EXCEEDED');
});
test('R19 exact Ship/GameModel ordering and ramp boundary agree for10000 steps', () => {
  const model = new GameModel(); model.ready(); model.start(42); model.elapsed = 119.7;
  const state = { x: 0, y: 0, vx: 0, vy: 0, elapsed: 119.7, distance: 0 }, prediction = new FlightPrediction();
  // Huge shield prevents fixture death only in the reference model; prediction never sees it.
  model.invulnerability = 1e6;
  for (let i = 0; i < 10000; i++) {
    const input = { x: Math.sin(i * .1), y: Math.cos(i * .07) };
    prediction.step(state, input); model.step(CONFIG.step, input);
    assert.deepEqual(state, { x: model.ship.x, y: model.ship.y, vx: model.ship.vx, vy: model.ship.vy, elapsed: model.elapsed, distance: model.distance });
  }
  const c = context([obstacle('barrel', 2, 1, 20, { kind: 2, spin: .7 }), obstacle('generator', -1, -1, 21, { kind: 2, phase: Math.PI, spin: -.7 })], { elapsed: 119.7 });
  accepted(complete(beginValidation(c, options)));
});
test('R20 unknown profiles, invalid roots and explicit work deadlines fail closed', () => {
  const h = obstacle('unknown', 0, 0, 68);
  const unknown = context([{ ...h, collisionProfile: 'future-unknown' as typeof h.collisionProfile }]);
  assert.equal((complete(beginValidation(unknown, options)) as { reason: string }).reason, 'UNKNOWN_PROFILE');
  assert.equal((complete(beginValidation(context([], { elapsed: NaN }), options)) as { reason: string }).reason, 'STRUCTURAL_INVALID');
  assert.equal((complete(beginValidation(context([], { player: { x: undefined as unknown as number, y: 0, vx: 0, vy: 0 } }), options)) as { reason: string }).reason, 'STRUCTURAL_INVALID');
  const job = beginValidation(context([obstacle('normal', 0, 0, 68)]), options);
  for (let tick = 1; tick <= 144; tick++) job.advance({ propagations: 0, narrowQueries: 0 }, tick);
  assert.equal((job.getResult() as { reason: string }).reason, 'COMPUTATION_BUDGET_EXCEEDED');
  assert.equal(job.metrics.propagations, 0);
});
test('committed field failure is distinct from a candidate-induced bounded search failure', () => {
  const committed = [obstacle('existing-near', 0, 0, 5)], c = context([obstacle('new', 3, 0, 68)], { committed });
  assert.deepEqual(complete(beginValidation(c, options)), { decision: 'reject', reason: 'EXISTING_FIELD_UNCERTIFIED', detail: 'INSUFFICIENT_REACTION_DISTANCE' });
});
test('real B-1 generated contexts pass through normal structural and trajectory validation', () => {
  for (const seed of [0, 1, 42, 0xffffffff]) {
    const generator = new FieldGenerator(seed), candidate = generator.propose(6, 4), committed = generator.propose(4, 2).hazards;
    const c = { ...context(), candidate, committed };
    const job = beginValidation(c), w = accepted(complete(job));
    accepted(complete(beginTrajectoryReplay(w.context, w.controls)));
    assert.equal(job.metrics.replays, 2); assert.ok(job.metrics.peakFrontier <= 16 && job.metrics.peakExpansion <= 144);
  }
});
test('incremental budgets can stop mid-step/query without affecting deterministic witness', () => {
  const c = context([obstacle('middle', 0, 0, 68)]), a = beginValidation(c, options), b = beginValidation(c, options);
  const wa = accepted(complete(a));
  let previous = b.metrics;
  while (!b.getResult()) {
    b.advance({ propagations: 2048, narrowQueries: 101 });
    const now = b.metrics;
    assert.ok(now.propagations - previous.propagations <= 2048);
    assert.ok(now.narrowQueries - previous.narrowQueries <= 101); previous = now;
  }
  const wb = accepted(b.getResult()!);
  assert.equal(wa.hash, wb.hash); assert.deepEqual(wa.controls, wb.controls);
});
test('snapshot ownership, terminal controls, and complete context prevent unchecked acceptance', () => {
  const c = context([obstacle('rock', 3, 0, 68)]), job = beginValidation(c, options);
  (c.player as { x: number }).x = 3;
  const witness = accepted(complete(job)); assert.equal(witness.context.player.x, 0);
  const bad = complete(beginTrajectoryReplay(witness.context, witness.controls.slice(1), options));
  assert.equal(bad.decision, 'reject');
  const insufficient = complete(beginValidation({ ...witness.context, reservedUntilDistance: 70 }, options));
  assert.equal(insufficient.decision === 'reject' && insufficient.reason, 'INVALID_TERMINAL_STATE');
  assert.equal(complete(beginValidation(context([obstacle('fixture', 0, 0, 68)]))).decision, 'reject');
});
test('deterministic full witness has a reproducible SHA256 and survives JSON replay', () => {
  const c = context([obstacle('golden', 0, 0, 68)]), a = accepted(complete(beginValidation(c, options)));
  const b = accepted(complete(beginValidation(c, options)));
  const hash = (w: unknown) => createHash('sha256').update(JSON.stringify(w)).digest('hex');
  assert.equal(hash(a), hash(b));
  assert.equal(a.hash, 'f6461916');
  assert.equal(hash(a), '7fe8998edb094d9d71b7ede9b94aa9c044ca80c094e85617c3665a7fc32c6f8c');
  const copy = JSON.parse(JSON.stringify(a)) as ValidationWitness;
  accepted(complete(beginTrajectoryReplay(copy.context, copy.controls, options)));
  assert.ok(Object.isFrozen(a.context) && Object.isFrozen(a.controls) && Object.isFrozen(a.terminal));
});
test('publication incorporates new committed geometry, held input and deadline without moving it', () => {
  const c = context([obstacle('candidate', 3, 0, 68)]), w = accepted(complete(beginValidation(c, options)));
  const later = { ...c, elapsed: 120.1, distance: 3.4, input: { x: .2, y: .5 } };
  const newWitness = accepted(complete(beginPublicationCheck(w, later, options)));
  assert.deepEqual(newWitness.controls[0]!.input, later.input);
  const blocked = { ...later, input: { x: 0, y: 0 }, committed: [obstacle('new-committed', 0, 0, 8.4)] };
  const before = JSON.stringify(blocked);
  const result = complete(beginPublicationCheck(w, blocked, options));
  assert.equal(result.decision === 'reject' && result.reason, 'STALE_PUBLICATION_STATE');
  assert.equal(JSON.stringify(blocked), before);
  assert.equal(complete(beginPublicationCheck(w, { ...c, elapsed: 121.21, distance: 41.14 }, options)).decision, 'reject');
});
test('past opportunities are clipped safely and budget API cannot extend its deadline', () => {
  const c = context([obstacle('past', 0, 0, 1)], { distance: 50 });
  accepted(complete(beginValidation(c, options)));
  const job = beginValidation(context([obstacle('future', 0, 0, 68)]), options);
  assert.throws(() => job.advance({ propagations: 4097, narrowQueries: 8192 }), RangeError);
  job.advance({ propagations: 1, narrowQueries: 0 }, 1);
  assert.throws(() => job.advance({ propagations: 1, narrowQueries: 0 }, 1), RangeError);
  const result = job.advance(undefined, 145)!;
  assert.equal(result.decision === 'reject' && result.reason, 'COMPUTATION_BUDGET_EXCEEDED');
  assert.equal(job.advance(), result);
});
test('terminal braking ends inside the16-unit reservation with future-object clearance', () => {
  const c = context([obstacle('last', 0, 0, 68)]), w = accepted(complete(beginValidation(c, options)));
  assert.ok(w.terminal.distance > 69.67);
  assert.ok(w.terminal.distance + 1.67 <= w.reservedUntilDistance);
  assert.equal(w.controls.at(-1)!.input.x, 0); assert.equal(w.controls.at(-1)!.input.y, 0);
  assert.ok(w.controls.at(-1)!.ticks >= L.brakingTicks);
  assert.equal(L.brakingTicks, Math.ceil(CONFIG.ship.maxSpeed / CONFIG.ship.braking / CONFIG.step));
});
