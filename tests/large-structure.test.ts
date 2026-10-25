import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Mesh, Box3, Vector3 } from 'three';
import { CONFIG } from '../src/config.ts';
import { Ship } from '../src/core/ship.ts';
import { beginValidation, beginTrajectoryReplay, beginRuntimePublicationCheck, beginPublicationCheck, runtimeAxialDisjoint } from '../src/core/field-validator.ts';
import { sweptSphereBoxHit } from '../src/core/collision.ts';
import { Random } from '../src/core/random.ts';
import { VALIDATION_LIMITS as L } from '../src/core/field-validator-types.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { ValidationWitness, TrajectoryResult } from '../src/core/field-validator-types.ts';
import type { FieldValidationContext } from '../src/core/field-types.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { BULKHEAD as B, BULKHEAD_BOXES, BulkheadCollision, BulkheadPrediction } from '../src/experiments/large-structure/profile.ts';
import { APERTURES, APERTURE_NAMES, BULKHEAD_GEOMETRY as geometry, structureTransaction, apertureSelector } from '../src/experiments/large-structure/encounter.ts';
import type { Aperture } from '../src/experiments/large-structure/encounter.ts';
import { LargeStructureGameModel } from '../src/experiments/large-structure/model.ts';
import { bulkheadModel } from '../src/experiments/large-structure/view.ts';

function complete(job: ValidationJob): TrajectoryResult { while (!job.getResult()) job.advance(); return job.getResult()!; }
function accepted(r: TrajectoryResult): ValidationWitness { assert.equal(r.decision, 'accept', JSON.stringify(r)); if (r.decision !== 'accept') throw Error('reject'); return r.witness; }
function context(aperture: Aperture = 'center', extra: Partial<FieldValidationContext> = {}): FieldValidationContext {
  const candidate = structureTransaction(42, 4, aperture);
  return { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, distance: 0, elapsed: 0,
    committed: [], candidate, reservedUntilDistance: candidate.endDistance, ...extra };
}
export function witnessInput(w: ValidationWitness | undefined, elapsed: number) {
  let tick = w ? Math.round((elapsed - w.context.elapsed) / CONFIG.step) : 0;
  for (const run of w?.controls ?? []) { if (tick < run.ticks) return run.input; tick -= run.ticks; } return { x: 0, y: 0 };
}

test('bulkhead model solids and exact collision boxes share vertices, extents and an empty aperture', () => {
  const model = bulkheadModel(); model.updateMatrixWorld(true);
  for (const box of BULKHEAD_BOXES) {
    const mesh = model.getObjectByName(box.name) as Mesh; assert.ok(mesh instanceof Mesh);
    const bounds = new Box3().setFromObject(mesh), center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
    for (const axis of ['x', 'y', 'z'] as const) { assert.ok(Math.abs(center[axis] - box.center[axis]) < 1e-6); assert.ok(Math.abs(size[axis] / 2 - box.half[axis]) < 1e-6); }
    assert.ok(new Vector3(bounds.max.x, bounds.max.y, bounds.max.z).length() < B.radius);
  }
  assert.ok(B.apertureX * 2 > 2.8 + 2 * L.margin); assert.ok(B.apertureY * 2 > 1.12 + 2 * L.margin);
  const q = new BulkheadCollision(); assert.equal(q.hitCompound({ x: 0, y: 0, z: -100 }, { x: 0, y: 0, z: 100 }, L.margin), false);
  assert.equal(q.primitiveQueries, 4);
});

test('all four solids collide continuously at normal and extreme forward sweeps; entry and exit clear', () => {
  const q = new BulkheadCollision();
  for (const box of BULKHEAD_BOXES) for (const depth of [34 / 120, 200]) {
    const a = { x: box.center.x, y: box.center.y, z: -3 - depth / 2 }, b = { ...a, z: -3 + depth / 2 };
    assert.equal(q.hitCompound(a, b), true, box.name);
  }
  for (const sign of [-1, 1]) {
    const z = sign * (B.halfZ + CONFIG.ship.radius + 1e-6), p = { x: 6.4, y: 0, z };
    assert.equal(q.hitCompound(p, p), false);
    const inside = { ...p, z: sign * (B.halfZ + CONFIG.ship.radius - 1e-6) }; assert.equal(q.hitCompound(inside, inside), true);
  }
});

test('rounded box tangencies, grazing and conservative safety margin remain effective', () => {
  const q = new BulkheadCollision();
  for (const axis of ['x', 'y'] as const) for (const sign of [-1, 1]) {
    const half = axis === 'x' ? B.apertureX : B.apertureY;
    for (const margin of [0, .15]) for (const epsilon of [-1e-6, 0, 1e-6]) {
      const a = { x: 0, y: 0, z: -30 }; a[axis] = sign * (half - CONFIG.ship.radius - margin + epsilon);
      assert.equal(q.hitCompound(a, { ...a, z: 30 }, margin), epsilon >= 0, `${axis}/${sign}/${margin}/${epsilon}`);
    }
  }
  const a = { x: -4, y: 0, z: -20 }, b = { x: 4, y: 0, z: 20 }; assert.equal(q.hitCompound(a, b), false);
  assert.throws(() => q.hitCompound(a, b, -1));
});

test('10000 optimized compound sweeps equal the independent unpruned four-kernel oracle', () => {
  const q = new BulkheadCollision(), random = new Random(0x003b), times = new Float64Array(8);
  for (let i = 0; i < 10000; i++) {
    const a = { x: random.between(-15, 15), y: random.between(-10, 10), z: random.between(-100, 100) };
    const b = { x: random.between(-15, 15), y: random.between(-10, 10), z: random.between(-100, 100) }, margin = i % 2 ? .15 : 0;
    const expected = BULKHEAD_BOXES.some(box => sweptSphereBoxHit({ x: a.x - box.center.x, y: a.y - box.center.y, z: a.z },
      { x: b.x - box.center.x, y: b.y - box.center.y, z: b.z }, box.half, CONFIG.ship.radius + margin, 0, 1, times));
    assert.equal(q.hitCompound(a, b, margin), expected);
    if (runtimeAxialDisjoint({ passDistance: 0, radius: B.halfZ }, Math.min(-a.z, -b.z), Math.max(-a.z, -b.z), margin)) assert.equal(expected, false);
  }
  assert.equal(q.primitiveQueries, 40000);
});

test('five deterministic aperture variants require matching metadata and reject scale, spin, translation or missing sections', () => {
  for (const name of APERTURE_NAMES) {
    const tx = structureTransaction(42, 4, name), h = tx.hazards[0]!;
    assert.deepEqual(structureTransaction(42, 4, name), JSON.parse(JSON.stringify(tx)));
    assert.equal(geometry.inspect(tx, []).status, 'valid'); assert.equal(geometry.queryCost(h), 4);
    assert.equal(new FieldGenerator(42).inspect(tx).status, 'invalid');
    for (const change of [{ radius: 14 }, { spin: .1 }, { phase: 1 }, { x: h.x + .01 }, { visualVariant: 0 }]) {
      const bad = { ...tx, hazards: [{ ...h, ...change }] }; assert.equal(geometry.inspect(bad, []).status, 'invalid');
      assert.equal(complete(beginValidation({ ...context(name), candidate: bad }, { geometry })).decision, 'reject');
    }
    assert.equal(geometry.inspect({ ...tx, hazards: [] }, []).status, 'invalid');
  }
  assert.equal(apertureSelector(null), undefined); assert.throws(() => apertureSelector('unknown'));
});

test('normal validation and independent full replay certify every offset and opposite incoming velocities', () => {
  for (const name of APERTURE_NAMES) for (const sign of [-1, 1]) {
    const c = context(name, { player: { x: -sign * 4, y: sign * 2, vx: sign * 5, vy: -sign * 3 } });
    const job = beginValidation(c, { geometry }), w = accepted(complete(job));
    assert.equal(w.geometryVersion, geometry.version); assert.equal(w.structuralPolicy, 'generator'); assert.equal(w.margin, .15);
    assert.equal(accepted(complete(beginTrajectoryReplay(c, w.controls, { geometry }))).hash, w.hash);
    assert.ok(job.metrics.planningTicks <= 144); assert.ok(job.metrics.narrowQueries > job.metrics.replayQueries);
    assert.equal(complete(beginValidation(c)).decision, 'reject', 'no implicit large-profile opt in');
  }
});

test('actual replay checks aperture translation at speed34 and rejects physically unreachable late openings', () => {
  const c = context('right', { elapsed: 120, distance: 132, player: { x: -6, y: 0, vx: -8, vy: 0 } });
  const r = complete(beginValidation(c, { geometry })); assert.equal(r.decision, 'reject');
  assert.ok(r.decision === 'reject' && ['INSUFFICIENT_REACTION_DISTANCE', 'NO_WITNESS_FOUND'].includes(r.reason));
  const prediction = new BulkheadPrediction(), h = c.candidate.hazards[0]!;
  const a = { x: APERTURES.right.x, y: 0, vx: 0, vy: 0, elapsed: 120, distance: h.passDistance - 30 }, b = { ...a, distance: h.passDistance + 30 };
  assert.equal(prediction.hit(a, b, h, .15), false); assert.equal(prediction.hitGameplay(a, b, h), false);
  assert.equal(prediction.hit({ ...a, x: 0 }, { ...b, x: 0 }, h, .15), true);
});

test('neighboring ambient geometry, ownership overlap, source identity and primitive capacity are mandatory', () => {
  const tx = structureTransaction(42), ambient = new FieldGenerator(42).propose(0, 4).hazards;
  assert.equal(geometry.inspect(tx, ambient).status, 'valid');
  const c = context('center', { committed: ambient }); const w = accepted(complete(beginValidation(c, { geometry })));
  accepted(complete(beginTrajectoryReplay(c, w.controls, { geometry })));
  assert.equal(geometry.inspect(tx, new FieldGenerator(42).propose(4, 4).hazards).status, 'invalid');
  const h = tx.hazards[0]!;
  assert.equal(geometry.inspect(tx, Array.from({ length: 29 }, (_, i) => ({ ...ambient[0]!, id: `capacity-${i}` }))).status, 'invalid');
  assert.equal(geometry.inspect(tx, [h]).status, 'invalid');
  const near = { ...ambient[0]!, passDistance: h.passDistance, ownerCell: h.ownerCell };
  assert.equal(geometry.inspect(tx, [near]).status, 'invalid');
});

test('publication retains version, exact actual state, reaction input and complete atomic mapping', () => {
  const m = new LargeStructureGameModel('left'); m.ready(); m.start(42);
  for (let i = 0; i < 144; i++) m.step(CONFIG.step, { x: 0, y: 0 });
  const o = m.field.lastOutcome!; assert.equal(o.status, 'committed'); assert.equal(o.transaction!.hazards.length, 1);
  assert.equal(o.witness!.context.elapsed, m.elapsed); assert.deepEqual(o.witness!.context.player, { x: m.ship.x, y: m.ship.y, vx: m.ship.vx, vy: m.ship.vy });
  assert.equal(m.field.slots.filter(s => s.planned).length, 1); assert.equal(m.field.fault, undefined);
  assert.equal(o.witness!.geometryVersion, geometry.version); assert.equal(o.metrics.replays, 4);
  accepted(complete(beginTrajectoryReplay(o.witness!.context, o.witness!.controls, { geometry })));
  const full = beginPublicationCheck(o.witness!, o.witness!.context, { geometry }), culled = beginRuntimePublicationCheck(o.witness!, o.witness!.context, { geometry });
  assert.equal(accepted(complete(full)).hash, accepted(complete(culled)).hash);
  assert.ok(culled.metrics.narrowQueries < full.metrics.narrowQueries);
  assert.equal(complete(beginRuntimePublicationCheck(o.witness!, o.witness!.context)).decision, 'reject');
  const changed = { ...o.witness!.context, player: { x: 6, y: 0, vx: 8, vy: 0 }, distance: 142, elapsed: o.witness!.context.elapsed + 1 };
  assert.equal(complete(beginRuntimePublicationCheck(o.witness!, changed, { geometry })).decision, 'reject');
});

test('a compound query cannot execute on a partial three-primitive budget', () => {
  const c = context(), w = accepted(complete(beginValidation(c, { geometry })));
  const replay = beginTrajectoryReplay(c, w.controls, { geometry });
  replay.advance({ propagations: 3072, narrowQueries: 3 });
  assert.equal(replay.metrics.narrowQueries, 0); assert.equal(replay.getResult(), undefined);
  accepted(complete(replay));
});

test('witness follower flies consecutive real-model passages with exact Ship movement and bounded per-tick work', () => {
  const m = new LargeStructureGameModel(); m.ready(); m.start(42); const ship = new Ship();
  for (let i = 0; i < 5400 && m.state === 'PLAYING'; i++) {
    const axis = witnessInput(m.field.certificate, m.elapsed); ship.update(CONFIG.step, axis); m.step(CONFIG.step, axis); assert.deepEqual(m.ship, ship);
  }
  assert.equal(m.hitSerial, 0); assert.equal(m.field.fault, undefined); assert.ok(m.field.committed >= 5);
  for (const s of m.field.samples) { assert.ok(s.propagations <= 3072); assert.ok(s.queries <= 6144); }
  assert.ok(m.field.slots.filter(s => s.planned).length * 4 <= 32); assert.ok(m.collisionQueries > 0);
});

test('boundary bypasses hit solid geometry; damage, pause, restart, cancellation and expiry use original rules', () => {
  for (const name of APERTURE_NAMES) {
    const q = new BulkheadCollision(), p = APERTURES[name];
    for (const x of [-6, 6]) for (const y of [-3.6, 3.6]) assert.equal(q.hitCompound({ x: x - p.x, y: y - p.y, z: -40 }, { x: x - p.x, y: y - p.y, z: 40 }), true);
  }
  const m = new LargeStructureGameModel('right'); m.ready(); m.start(42);
  for (let i = 0; i < 60; i++) m.step(CONFIG.step, { x: 0, y: 0 });
  m.pause(); const frozen = [m.distance, m.field.planningTicks]; for (let i = 0; i < 30; i++) m.step(CONFIG.step, { x: 1, y: 0 }); assert.deepEqual([m.distance, m.field.planningTicks], frozen); m.resume();
  for (let i = 0; i < 1400 && !m.hitSerial; i++) m.step(CONFIG.step, { x: 0, y: 0 });
  assert.equal(m.hitSerial, 1); assert.equal(m.hull, 2); assert.equal(m.invulnerability, CONFIG.ship.invulnerability);
  assert.ok(m.field.ledger.knownHazards(m.distance).length > 0, 'damage must retain committed geometry');
  m.state = 'GAME_OVER'; m.start(42); assert.equal(m.hull, 3); assert.equal(m.field.ledger.snapshot().length, 0);
  m.step(CONFIG.step, { x: 0, y: 0 }); const old = m.field.pending!; m.dispose(); assert.equal(old.getResult()!.reason, 'CANCELLED');
});

test('the production GameModel seam changes only TypeScript visibility, keeping approved executable source intact', () => {
  const source = readFileSync('src/core/game-model.ts', 'utf8').replaceAll('\r\n', '\n').replace('protected readonly collisions', 'private readonly collisions');
  assert.equal(createHash('sha256').update(source).digest('hex'), '9c1b10a43bd24685b0096f8822152ad006182e6ca6b6071ce3106ca1f81d24d7');
});
