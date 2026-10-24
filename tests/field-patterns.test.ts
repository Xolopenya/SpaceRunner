import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { PatternGenerator } from '../src/core/field-patterns.ts';
import { PATTERN_FAMILIES, PATTERN_RULES, patternHazardId } from '../src/core/field-pattern-source.ts';
import { DEFAULT_FIELD_SETTINGS, FIELD_LIMITS } from '../src/core/field-settings.ts';
import { beginValidation, beginTrajectoryReplay, beginPublicationCheck } from '../src/core/field-validator.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { FieldTransaction, FieldValidationContext, PatternFamily } from '../src/core/field-types.ts';
import type { TrajectoryResult } from '../src/core/field-validator-types.ts';
import { hazardVariant } from '../src/core/hazard-profile.ts';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const complete = (job: ValidationJob): TrajectoryResult => { while (!job.getResult()) job.advance(); return job.getResult()!; };
function proposal(generator: PatternGenerator, family: PatternFamily, firstCell = 4, intensity = .8, variation = 0): FieldTransaction {
  const result = generator.propose({ family, firstCell, intensity, variation });
  assert.equal(result.status, 'proposed', JSON.stringify(result));
  if (result.status !== 'proposed') throw new Error('Expected structurally valid pattern');
  return result.transaction;
}
function root(candidate: FieldTransaction, extra: Partial<FieldValidationContext> = {}): FieldValidationContext {
  const p = candidate.provenance.pattern;
  return { player: { x: p?.offsetX ?? 0, y: p?.offsetY ?? 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 120, distance: 0,
    committed: [], candidate, ...extra };
}

test('four encounter families preserve deterministic request order, seed reset and full JSON data', () => {
  assert.equal(PATTERN_FAMILIES.length, 4);
  const generator = new PatternGenerator(42), first = PATTERN_FAMILIES.map(f => proposal(generator, f));
  for (const f of [...PATTERN_FAMILIES].reverse()) proposal(generator, f, 100, .2, 17);
  for (let i = 0; i < 4; i++) assert.deepEqual(proposal(generator, PATTERN_FAMILIES[i]!), first[i]);
  generator.reset(7); assert.notEqual(hash(proposal(generator, 'scattered')), hash(first[0]));
  generator.reset(42); assert.deepEqual(proposal(generator, 'scattered'), first[0]);
  assert.equal(new Set(first.map(hash)).size, 4);
  for (const tx of first) {
    assert.deepEqual(JSON.parse(JSON.stringify(tx)), tx);
    assert.ok(Object.isFrozen(tx) && Object.isFrozen(tx.provenance.pattern) && tx.hazards.every(Object.isFrozen));
  }
});
test('encounter goldens pin versioned source identity and exact geometry', () => {
  const generator = new PatternGenerator(42);
  const expected = [
    'd8645efc898695b2fd9c82d9cf4ebf9b939cb52b4068eaa7ea7b00268a42a63e',
    '638ef5f9b1ff9e40c0ac663e348f860921821d4f5702c7f62b38a0e24677faf1',
    'ce9f8456eced7de0e81c8951b2eb6a56ced5849aaa9a614466904aa0cc52bbd2',
    '0f3bc88f01afbd6766724c96617323585dc396975e7f9ce18da002eb9c5576da',
  ];
  for (const [i, family] of PATTERN_FAMILIES.entries()) {
    const tx = proposal(generator, family);
    assert.equal(tx.provenance.version, 'encounter-v1');
    assert.equal(hash(tx), expected[i]);
  }
});
test('multi-object cells admit3+ objects with unique ordinals while ambient anchors remain strict', () => {
  const generator = new PatternGenerator(42), result = generator.propose({ family: 'scattered', firstCell: 4, cellCount: 2, intensity: 1 });
  assert.equal(result.status, 'proposed'); if (result.status !== 'proposed') return;
  const counts = new Map<number, number>();
  for (const h of result.transaction.hazards) counts.set(h.ownerCell, (counts.get(h.ownerCell) ?? 0) + 1);
  assert.ok(Math.max(...counts.values()) >= 3);
  assert.equal(new Set(result.transaction.hazards.map(h => h.id)).size, 5);
  const inspector = new FieldGenerator(42), first = result.transaction.hazards[0]!;
  assert.deepEqual(inspector.inspect({ ...result.transaction, hazards: result.transaction.hazards.slice(1) }), { status: 'invalid', reason: 'incomplete' });
  const duplicate = { ...result.transaction, hazards: [first, first, ...result.transaction.hazards.slice(2)] };
  assert.deepEqual(inspector.inspect(duplicate), { status: 'invalid', reason: 'duplicate' });
  const ambient = inspector.propose(4, 2);
  assert.equal(inspector.inspect({ ...ambient, hazards: [{ ...ambient.hazards[0]!, localIndex: 4 }, ...ambient.hazards.slice(1)] }).status, 'invalid');
});
test('128 seeds ×4 families ×2 intensities preserve full structure, profiles and true3D separation', () => {
  const variants = new Set<number>();
  for (let seed = 0; seed < 128; seed++) for (const family of PATTERN_FAMILIES) for (const intensity of [.2, .8]) {
    const tx = proposal(new PatternGenerator(seed), family, 4, intensity, seed % 3), field = new FieldGenerator(seed);
    assert.equal(field.inspect(tx).status, 'valid');
    assert.equal(new Set(tx.hazards.map(h => h.passDistance)).size, tx.hazards.length);
    for (const [i, h] of tx.hazards.entries()) {
      assert.equal(h.ownerCell, Math.floor(h.passDistance / 24)); assert.equal(h.anchorCell, h.ownerCell);
      assert.equal(h.visualVariant, hazardVariant(h.kind, h.phase)); variants.add(h.visualVariant);
      assert.ok(Math.abs(h.x) <= 5.4 && Math.abs(h.y) <= 3.15 && h.radius >= .65 && h.radius <= 1.1);
      for (const other of tx.hazards.slice(0, i)) assert.ok(Math.hypot(h.x - other.x, h.y - other.y, h.passDistance - other.passDistance) >= h.radius + other.radius + .3);
    }
  }
  assert.equal(variants.size, 5);
});
test('spatial reflections and explicit translations retain real depths and new lossless IDs', () => {
  const generator = new PatternGenerator(42), common = { family: 'alternating' as const, firstCell: 4, intensity: .8, variation: 7, offsetX: 0, offsetY: 0 };
  const base = generator.propose({ ...common, mirrorX: false, mirrorY: false });
  const mirror = generator.propose({ ...common, mirrorX: true, mirrorY: true });
  const shifted = generator.propose({ ...common, mirrorX: false, mirrorY: false, offsetX: .5, offsetY: .25 });
  assert.equal(base.status, 'proposed'); assert.equal(mirror.status, 'proposed'); assert.equal(shifted.status, 'proposed');
  if (base.status !== 'proposed' || mirror.status !== 'proposed' || shifted.status !== 'proposed') return;
  for (const [i, h] of base.transaction.hazards.entries()) {
    const m = mirror.transaction.hazards[i]!, s = shifted.transaction.hazards[i]!;
    assert.equal(m.x, -h.x); assert.equal(m.y, -h.y); assert.equal(m.passDistance, h.passDistance);
    assert.equal(s.x, h.x + .5); assert.equal(s.y, h.y + .25); assert.notEqual(s.id, h.id);
  }
  assert.notEqual(hash(proposal(generator, 'alternating', 4, .8, 7)), hash(proposal(generator, 'alternating', 4, .8, 8)));
});
test('invalid intensity, span, transforms and capacity reject explicitly without partial output or RNG shifts', () => {
  const generator = new PatternGenerator(42), future = proposal(generator, 'vertical-weave', 100);
  for (const intensity of [-.01, 1.01, NaN, Infinity]) assert.deepEqual(generator.propose({ family: 'scattered', firstCell: 4, intensity }), { status: 'rejected', reason: 'INVALID_REQUEST' });
  assert.deepEqual(generator.propose({ family: 'vertical-weave', firstCell: 4, cellCount: 2, intensity: .8 }), { status: 'rejected', reason: 'INSUFFICIENT_SPAN' });
  assert.equal(generator.propose({ family: 'scattered', firstCell: 4, intensity: .8, offsetX: 99 }).status, 'rejected');
  const constrained = new PatternGenerator(42, { ...DEFAULT_FIELD_SETTINGS, maxCandidates: 1 });
  const result = constrained.propose({ family: 'narrowing', firstCell: 4, intensity: .8 });
  assert.equal(result.status, 'rejected'); if (result.status === 'rejected') {
    assert.equal(result.reason, 'STRUCTURAL_INVALID'); assert.equal(result.structure?.reason, 'capacity'); assert.equal(result.transaction?.hazards.length, 8);
  }
  assert.deepEqual(proposal(generator, 'vertical-weave', 100), future);
});
test('mixed schemas share exclusive cells, complete source spans and hard32 capacity', () => {
  const field = new FieldGenerator(42), generator = new PatternGenerator(42);
  const candidate = proposal(generator, 'narrowing', 8), ambient = field.propose(6, 2).hazards;
  assert.equal(field.inspect(candidate, ambient).status, 'valid');
  assert.equal(field.inspect(field.propose(12, 2), candidate.hazards).status, 'valid');
  const old = proposal(generator, 'scattered', 4), overlapping = field.propose(5, 2);
  assert.equal(field.inspect(overlapping, [old.hazards[0]!]).status, 'invalid'); // full source reservation, even where this record is outside
  assert.equal(new FieldGenerator(1).inspect(candidate).status, 'invalid');
  const enough = Array.from({ length: 15 }, (_, i) => field.propose(20 + i * 2, 2).hazards).flat();
  assert.equal(field.inspect(candidate, enough.slice(0, 32 - candidate.hazards.length)).status, 'valid');
  assert.deepEqual(field.inspect(candidate, enough.slice(0, 33 - candidate.hazards.length)), { status: 'invalid', reason: 'capacity' });
});
test('cross-schema seam collision, wrong provenance and half-open boundary forgery are rejected', () => {
  const field = new FieldGenerator(42), previous = field.propose(2, 2).hazards.at(-1)!;
  const tx = proposal(new PatternGenerator(42), 'scattered', previous.ownerCell + 1);
  const h = tx.hazards[0]!;
  const seam = { ...tx, hazards: [{ ...h, passDistance: tx.startDistance + .01 }, ...tx.hazards.slice(1)] };
  const committed = [{ ...previous, x: h.x, y: h.y, passDistance: tx.startDistance - .01 }];
  assert.deepEqual(field.inspect(seam, committed), { status: 'invalid', reason: 'separation' });
  const endpoint = { ...h, passDistance: (h.ownerCell + 1) * 24 };
  assert.deepEqual(field.inspect({ ...tx, hazards: [endpoint, ...tx.hazards.slice(1)] }), { status: 'invalid', reason: 'ownership' });
  const forged = { ...h, id: patternHazardId(h.provenance, h.ownerCell, h.localIndex + 1), localIndex: h.localIndex + 1 };
  assert.equal(field.inspect({ ...tx, hazards: [forged, ...tx.hazards.slice(1)] }).status, 'invalid');
  const unknown = { ...tx, provenance: { ...tx.provenance, version: 'encounter-v99' } };
  assert.deepEqual(field.inspect(unknown), { status: 'invalid', reason: 'provenance' });
});
test('all four families pass actual B-2 normal policy and fresh independent replay', () => {
  for (const family of PATTERN_FAMILIES) {
    const c = root(proposal(new PatternGenerator(42), family)), job = beginValidation(c), result = complete(job);
    assert.equal(result.decision, 'accept', family + ':' + JSON.stringify(result));
    if (result.decision !== 'accept') continue;
    assert.equal(result.witness.structuralPolicy, 'generator');
    assert.equal(complete(beginTrajectoryReplay(result.witness.context, result.witness.controls)).decision, 'accept');
    assert.equal(result.witness.terminal.vx, 0); assert.equal(result.witness.terminal.vy, 0);
  }
});
test('ambient-pattern, pattern-ambient and horizontal-vertical sequences are jointly checked', () => {
  const patterns = new PatternGenerator(42), field = new FieldGenerator(42);
  const a = proposal(patterns, 'alternating', 4), b = proposal(patterns, 'vertical-weave', 4 + a.cellCount);
  const cases = [root(a, { committed: field.propose(2, 2).hazards }), root(field.propose(4 + a.cellCount, 2), { player: { x: 0, y: 0, vx: 0, vy: 0 }, committed: a.hazards }), root(b, { committed: a.hazards })];
  for (const c of cases) {
    const result = complete(beginValidation(c));
    assert.equal(result.decision, 'accept', JSON.stringify(result));
    if (result.decision === 'accept') assert.equal(complete(beginTrajectoryReplay(result.witness.context, result.witness.controls)).decision, 'accept');
  }
});
test('opposite velocities, late roots, deadlines and stale publication retain B-2 failure semantics', () => {
  const tx = proposal(new PatternGenerator(42), 'vertical-weave');
  for (const vy of [-4, 4]) {
    const result = complete(beginValidation(root(tx, { player: { x: tx.provenance.pattern!.offsetX, y: tx.provenance.pattern!.offsetY, vx: 0, vy } })));
    assert.equal(result.decision, 'accept', JSON.stringify(result));
  }
  const h = tx.hazards[0]!;
  const late = root(tx, { player: { x: h.x, y: h.y, vx: 0, vy: 0 }, distance: h.passDistance - 2 });
  const failed = complete(beginValidation(late));
  assert.equal(failed.decision === 'reject' && failed.reason, 'INSUFFICIENT_REACTION_DISTANCE');
  const job = beginValidation(root(tx)); job.advance({ propagations: 0, narrowQueries: 0 }, 144);
  assert.equal(job.getResult()?.decision === 'reject' && job.getResult()?.reason, 'COMPUTATION_BUDGET_EXCEEDED');
  const result = complete(beginValidation(root(tx)));
  if (result.decision === 'accept') assert.equal(complete(beginPublicationCheck(result.witness, late)).decision, 'reject');
});
test('serialized pattern metadata is copied at begin and partial encounters never enter search', () => {
  const tx = JSON.parse(JSON.stringify(proposal(new PatternGenerator(42), 'scattered'))) as FieldTransaction;
  const c = root(tx), job = beginValidation(c);
  (tx.provenance.pattern as { intensity: number }).intensity = .1;
  const result = complete(job); assert.equal(result.decision, 'accept');
  if (result.decision === 'accept') assert.equal(result.witness.context.candidate.provenance.pattern!.intensity, .8);
  const partial = { ...tx, hazards: [] }, rejected = beginValidation(root(partial));
  assert.equal(complete(rejected).decision, 'reject'); assert.equal(rejected.metrics.searches, 0);
});
test('vertical steering demonstrably benefits a real weave witness without claiming all X routes blocked', () => {
  const c = root(proposal(new PatternGenerator(0), 'vertical-weave')), result = complete(beginValidation(c));
  assert.equal(result.decision, 'accept'); if (result.decision !== 'accept') return;
  assert.ok(result.witness.controls.some(run => run.input.y !== 0));
  const noY = result.witness.controls.map(run => ({ ...run, input: { x: run.input.x, y: 0 } }));
  const counterfactual = complete(beginTrajectoryReplay(c, noY));
  assert.equal(counterfactual.decision === 'reject' && counterfactual.reason, 'COLLISION_FOUND');
});
test('intensity changes geometry/counts while keeping radius draws independent of intensity', () => {
  const generator = new PatternGenerator(42);
  for (const family of PATTERN_FAMILIES) {
    const low = proposal(generator, family, 4, .2), high = proposal(generator, family, 4, .8);
    assert.ok(high.hazards.length > low.hazards.length);
    for (let i = 0; i < low.hazards.length; i++) assert.equal(low.hazards[i]!.radius, high.hazards[i]!.radius);
  }
  const narrow = proposal(generator, 'narrowing');
  const sparseA = proposal(generator, 'scattered', 4, .1), sparseB = proposal(generator, 'scattered', 4, .2);
  assert.equal(sparseA.hazards.length, sparseB.hazards.length);
  assert.notDeepEqual(sparseA.hazards.map(h => h.passDistance), sparseB.hazards.map(h => h.passDistance));
  assert.deepEqual(sparseA.hazards.map(h => h.radius), sparseB.hazards.map(h => h.radius));
  const firstWidth = Math.abs(narrow.hazards[0]!.x - narrow.hazards[1]!.x);
  const lastWidth = Math.abs(narrow.hazards.at(-2)!.x - narrow.hazards.at(-1)!.x);
  assert.ok(firstWidth > lastWidth + 1);
  for (const vx of [-4, 4]) assert.equal(complete(beginValidation(root(proposal(generator, 'alternating'), { player: { x: 0, y: 0, vx, vy: 0 } }))).decision, 'accept');
});
test('intensity endpoints, every legal family span and large ownership keys stay bounded', () => {
  const generator = new PatternGenerator(0), field = new FieldGenerator(0);
  for (const family of PATTERN_FAMILIES) for (const intensity of [0, 1]) for (let cells = PATTERN_RULES[family].minCells; cells <= 6; cells++) {
    for (const firstCell of [0, FIELD_LIMITS.maxCell - 5]) {
      const p = generator.propose({ family, firstCell, cellCount: cells, intensity });
      assert.equal(p.status, 'proposed'); if (p.status === 'proposed') assert.equal(field.inspect(p.transaction).status, 'valid');
    }
  }
  for (const cellCount of [1, 7, 2.5, NaN]) assert.equal(generator.propose({ family: 'scattered', firstCell: 0, cellCount, intensity: .5 }).status, 'rejected');
});
