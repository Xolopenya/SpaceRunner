import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3 } from 'three';
import { CONFIG } from '../src/config.ts';
import { Random } from '../src/core/random.ts';
import { sweptSphereBoxHit } from '../src/core/collision.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { beginValidation, beginTrajectoryReplay, beginRuntimePublicationCheck } from '../src/core/field-validator.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { ValidationWitness, TrajectoryResult } from '../src/core/field-validator-types.ts';
import type { FieldValidationContext } from '../src/core/field-types.ts';
import { APERTURES, APERTURE_NAMES, PROFILES, WRECK as W, WreckCollision, apertureSelector, structureMode, isWreck } from '../src/experiments/structure-variants/profile.ts';
import type { Aperture, StructureMode } from '../src/experiments/structure-variants/profile.ts';
import { wreckTransaction, WRECK_GEOMETRY as geometry } from '../src/experiments/structure-variants/encounter.ts';
import { StructureVariantsGameModel } from '../src/experiments/structure-variants/model.ts';
import { wreckModel } from '../src/experiments/structure-variants/view.ts';
function complete(job: ValidationJob): TrajectoryResult { while (!job.getResult()) job.advance(); return job.getResult()!; }
function accept(r: TrajectoryResult): ValidationWitness { assert.equal(r.decision, 'accept', JSON.stringify(r)); if (r.decision !== 'accept') throw Error('Rejected'); return r.witness; }
function context(a: Aperture, mode: StructureMode, extra: Partial<FieldValidationContext> = {}): FieldValidationContext {
  const candidate = wreckTransaction(42, 4, a, mode);
  return { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0, committed: [], candidate, reservedUntilDistance: candidate.endDistance, ...extra };
}
function input(w: ValidationWitness | undefined, elapsed: number) { let tick = w ? Math.round((elapsed - w.context.elapsed) * 120) : 0;
  for (const run of w?.controls ?? []) { if (tick < run.ticks) return run.input; tick -= run.ticks; } return { x: 0, y: 0 }; }

test('v2 keeps the hull origin fixed and moves the actual aperture inside asymmetric solids', () => {
  for (const [i, name] of APERTURE_NAMES.entries()) {
    const tx = wreckTransaction(42, 4, name), h = tx.hazards[0]!, p = PROFILES[i]!, model = wreckModel(i); model.updateMatrixWorld(true);
    assert.equal(h.x, 0); assert.equal(h.y, 0); assert.equal(h.kind, i + 4); assert.deepEqual(geometry.goals(h), [APERTURES[name]]);
    for (const b of p.boxes) {
      const mesh = model.getObjectByName(b.name) as Mesh, actual = new Box3().setFromObject(mesh), c = actual.getCenter(new Vector3()), size = actual.getSize(new Vector3());
      for (const axis of ['x', 'y', 'z'] as const) { assert.ok(Math.abs(c[axis] - b.center[axis]) < 1e-6); assert.ok(Math.abs(size[axis] / 2 - b.half[axis]) < 1e-6); }
    }
    // Every painted vertex lies on a real solid. No details span the flight hole.
    for (const child of model.children) if (child instanceof Mesh && child.name.startsWith('surface-paint')) {
      const position = child.geometry.getAttribute('position');
      for (let v = 0; v < position.count; v++) { const point = new Vector3().fromBufferAttribute(position, v);
        assert.ok(p.boxes.some(b => ['x', 'y', 'z'].every(axis => Math.abs(point[axis as 'x' | 'y' | 'z'] - b.center[axis as 'x' | 'y' | 'z']) <= b.half[axis as 'x' | 'y' | 'z'] + 2e-6)), `${name}: paint outside collider`); }
    }
  }
});

test('all five true openings pass; every solid, both faces, grazing and long sweeps hit correctly', () => {
  const q = new WreckCollision();
  for (const [i, p] of PROFILES.entries()) {
    const h = { kind: i + 4 };
    assert.equal(q.sweep({ ...p.aperture, z: -100 }, { ...p.aperture, z: 100 }, h, .15), false);
    for (const box of p.boxes) assert.equal(q.sweep({ ...box.center, z: -100 }, { ...box.center, z: 100 }, h, 0), true);
    for (const axis of ['x', 'y'] as const) for (const sign of [-1, 1]) for (const epsilon of [-1e-6, 1e-6]) {
      const a = { ...p.aperture, z: -100 }; a[axis] += sign * ((axis === 'x' ? W.apertureX : W.apertureY) - .57 + epsilon);
      assert.equal(q.sweep(a, { ...a, z: 100 }, h, .15), epsilon > 0);
    }
  }
});

test('10000 compound queries agree with an unpruned independent four-box kernel oracle', () => {
  const random = new Random(0xb2003), q = new WreckCollision(), breaks = new Float64Array(8);
  for (let i = 0; i < 10000; i++) {
    const p = PROFILES[i % 5]!, a = { x: random.between(-15, 15), y: random.between(-10, 10), z: random.between(-50, 50) }, b = { x: random.between(-15, 15), y: random.between(-10, 10), z: random.between(-50, 50) }, margin = i % 2 ? .15 : 0;
    const expected = p.boxes.some(box => sweptSphereBoxHit({ x: a.x - box.center.x, y: a.y - box.center.y, z: a.z - box.center.z },
      { x: b.x - box.center.x, y: b.y - box.center.y, z: b.z - box.center.z }, box.half, CONFIG.ship.radius + margin, 0, 1, breaks));
    assert.equal(q.sweep(a, b, { kind: 4 + i % 5 }, margin), expected);
  }
  assert.equal(q.primitiveQueries, 40000);
});

test('mixed source reuses two original ambient anchors with full canonical geometry and six primitive capacity', () => {
  for (let seed = 0; seed < 32; seed++) for (const a of APERTURE_NAMES) {
    const tx = wreckTransaction(seed, 4, a, 'mixed'), ambient = new FieldGenerator(seed).propose(4, 6);
    assert.equal(tx.hazards.length, 3); assert.equal(geometry.inspect(tx, []).status, 'valid');
    const small = tx.hazards.filter(h => !isWreck(h)); for (const h of small) {
      assert.deepEqual(h, ambient.hazards.find(s => s.id === h.id)); assert.ok(Math.abs(h.passDistance - 156) >= 30);
    }
    assert.equal(tx.hazards.reduce((n, h) => n + geometry.queryCost(h), 0), 6);
    assert.equal(geometry.inspect({ ...tx, hazards: tx.hazards.slice(0, 2) }, []).status, 'invalid');
    assert.equal(geometry.inspect({ ...tx, hazards: [tx.hazards[0]!, { ...small[0]!, x: small[0]!.x + .1 }, small[1]!] }, []).status, 'invalid');
  }
});

test('five apertures, both source modes and opposite velocities certify and independently replay', () => {
  for (const a of APERTURE_NAMES) for (const mode of ['isolated', 'mixed'] as const) for (const sign of [-1, 1]) {
    const c = context(a, mode, { player: { x: sign * 4, y: -sign * 2, vx: -sign * 5, vy: sign * 3 } });
    const job = beginValidation(c, { geometry }), w = accept(complete(job)); assert.equal(w.geometryVersion, W.contract);
    assert.equal(accept(complete(beginTrajectoryReplay(c, w.controls, { geometry }))).hash, w.hash); assert.ok(job.metrics.planningTicks <= 144);
    assert.equal(complete(beginValidation(c)).decision, 'reject');
  }
});

test('late mixed approach into a real ambient body rejects, and changed/incomplete publication cannot pass', () => {
  for (const a of APERTURE_NAMES) {
    const c = context(a, 'mixed'), neighbor = c.candidate.hazards[1]!;
    assert.ok(4 > neighbor.radius + CONFIG.ship.radius + .15);
    const late = { ...c, elapsed: 120, distance: neighbor.passDistance - 4, player: { x: neighbor.x, y: neighbor.y, vx: 0, vy: 0 } };
    const r = complete(beginValidation(late, { geometry })); assert.equal(r.decision, 'reject');
    assert.ok(r.decision === 'reject' && r.reason === 'INSUFFICIENT_REACTION_DISTANCE');
    const w = accept(complete(beginValidation(c, { geometry })));
    assert.equal(complete(beginRuntimePublicationCheck(w, { ...c, candidate: { ...c.candidate, hazards: c.candidate.hazards.slice(0, 1) } }, { geometry })).decision, 'reject');
  }
});

test('actual-model mixed publication retains full ownership and all parts across consecutive safe passages', () => {
  for (const a of APERTURE_NAMES) {
    const m = new StructureVariantsGameModel(a, 'mixed'); m.ready(); m.start(42);
    for (let i = 0; i < 2700; i++) m.step(CONFIG.step, input(m.field.certificate, m.elapsed));
    assert.equal(m.hitSerial, 0); assert.equal(m.field.fault, undefined); assert.ok(m.field.committed >= 3);
    for (const e of m.field.events.filter(e => e.status === 'committed')) assert.equal(e.count, 3);
    for (const s of m.field.samples) { assert.ok(s.propagations <= 3072); assert.ok(s.queries <= 6144); }
    const retained = m.field.ledger.knownHazards(m.distance); assert.ok(retained.some(h => !isWreck(h)));
    const old = m.field.pending; m.state = 'GAME_OVER'; m.start(42); assert.equal(m.field.ledger.snapshot().length, 0); if (old) assert.equal(old.getResult()!.reason, 'CANCELLED'); m.dispose();
  }
});

test('selectors are explicit and reject misspellings; default is documented center/isolated', () => {
  assert.equal(apertureSelector(null), 'center'); assert.equal(structureMode(null), 'isolated');
  for (const name of APERTURE_NAMES) assert.equal(apertureSelector(name), name);
  assert.throws(() => apertureSelector('CENTER')); assert.throws(() => structureMode('random'));
});
