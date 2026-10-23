import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { DEFAULT_FIELD_SETTINGS, FIELD_LIMITS } from '../src/core/field-settings.ts';
import { hazardVariant } from '../src/core/hazard-profile.ts';
import { GameModel } from '../src/core/game-model.ts';
import type { FieldTransaction, PlannedHazard, FieldValidator } from '../src/core/field-types.ts';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const records = (generator: FieldGenerator, cells: number): PlannedHazard[] => {
  const result: PlannedHazard[] = [];
  for (let cell = 0; cell < cells; cell += 2) result.push(...generator.propose(cell, 2).hazards);
  return result;
};
const replaceFirst = (transaction: FieldTransaction, change: Partial<PlannedHazard>): FieldTransaction => ({
  ...transaction, hazards: [{ ...transaction.hazards[0]!, ...change }, ...transaction.hazards.slice(1)],
});

test('field proposal goldens pin complete unrounded uint32 seed/version/settings output', () => {
  const goldens = [
    [0, '19ec9e70b3d9ae5232a45775fd192a3fff38cf28d946b62b15b92676b046d743'],
    [42, 'dfd468f60203caad33238a5c0dba2e866cb424a480519429c3a0133e1f50a4b4'],
    [4294967295, 'ac5147da6b7a84890b81910109a5afd820f77bc5d8ad4f26db2e002abeb8630d'],
  ] as const;
  for (const [seed, expected] of goldens) {
    assert.equal(hash(new FieldGenerator(seed).propose(0, 6)), expected);
    assert.equal(hash(new FieldGenerator(seed).propose(0, 6)), expected);
  }
  const first = new FieldGenerator(42).propose(0, 6).hazards[0]!;
  assert.equal(first.id, 'ambient-v1/42/5.4:3.15:6:0.3:12/1/0');
  assert.equal(first.passDistance, 26.17463596444577);
  assert.equal(first.x, 2.786855003144593);
  assert.equal(first.y, -1.1820413740351796);
});

test('field ownership is invariant under transaction length, overlap, order and rejection/retry', () => {
  for (const seed of [0, 1, 42, 65535, 0xffffffff]) {
    const generator = new FieldGenerator(seed);
    const expected = records(generator, 60);
    assert.equal(new Set(expected.map(h => h.id)).size, expected.length);
    for (let count = 2; count <= 6; count++) {
      for (let first = 0; first <= 60 - count; first++) {
        const transaction = generator.propose(first, count);
        assert.deepEqual(transaction.hazards, expected.filter(h => h.ownerCell >= first && h.ownerCell < first + count));
      }
    }
    const future = generator.propose(200, 6);
    const rejected = generator.propose(0, 6);
    assert.equal(generator.inspect(rejected, rejected.hazards).status, 'invalid');
    assert.deepEqual(generator.propose(200, 6), future);
    generator.propose(5000, 6);
    assert.deepEqual(generator.propose(0, 6), rejected);
  }
});

test('field stream varies XY independently, covers the full range and has variable ownership counts', () => {
  const hazards = records(new FieldGenerator(42), 4096);
  const counts = new Map<number, number>();
  for (const h of hazards) counts.set(h.ownerCell, (counts.get(h.ownerCell) ?? 0) + 1);
  assert.ok(counts.size < 4096);
  assert.ok([...counts.values()].includes(1) && [...counts.values()].includes(2));
  for (const [axis, bound] of [['x', 5.4], ['y', 3.15]] as const) {
    const bins = new Set(hazards.map(h => Math.floor((h[axis] + bound) / (bound * 2) * 12)));
    assert.equal(bins.size, 12);
    assert.ok(Math.min(...hazards.map(h => h[axis])) < -bound * .99);
    assert.ok(Math.max(...hazards.map(h => h[axis])) > bound * .99);
    const residuals = hazards.map(h => h.passDistance - h.anchorCell * 24);
    const meanA = hazards.reduce((s, h) => s + h[axis], 0) / hazards.length;
    const meanB = residuals.reduce((s, d) => s + d, 0) / hazards.length;
    const covariance = hazards.reduce((s, h, i) => s + (h[axis] - meanA) * (residuals[i]! - meanB), 0);
    const varianceA = hazards.reduce((s, h) => s + (h[axis] - meanA) ** 2, 0);
    const varianceB = residuals.reduce((s, d) => s + (d - meanB) ** 2, 0);
    assert.ok(Math.abs(covariance / Math.sqrt(varianceA * varianceB)) < .08);
  }
  assert.equal(new Set(hazards.map(h => h.x)).size, hazards.length);
  assert.equal(new Set(hazards.map(h => h.y)).size, hazards.length);
  for (let i = 1; i < hazards.length; i++) {
    const gap = hazards[i]!.passDistance - hazards[i - 1]!.passDistance;
    assert.ok(gap >= 12 && gap <= 36);
  }
});

test('field 256 seeds ×1024 cells preserve metadata, counts and separation across adjacent transactions', () => {
  for (let seed = 0; seed < 256; seed++) {
    const generator = new FieldGenerator(seed);
    let previous: readonly PlannedHazard[] = [];
    let last: PlannedHazard | undefined;
    for (let cell = 0; cell < 1024; cell += 2) {
      const transaction = generator.propose(cell, 2);
      assert.equal(generator.inspect(transaction, previous).status, 'valid');
      assert.ok(transaction.hazards.length <= 3);
      for (const h of transaction.hazards) {
        assert.equal(h.visualVariant, hazardVariant(h.kind, h.phase));
        assert.ok(h.passDistance >= transaction.startDistance && h.passDistance < transaction.endDistance);
        assert.ok(Math.abs(h.x) <= 5.4 && Math.abs(h.y) <= 3.15);
        assert.ok(h.radius >= .65 && h.radius <= 1.1);
        if (last) {
          const gap = h.passDistance - last.passDistance;
          assert.ok(gap >= 12 && gap <= 36);
          assert.ok(Math.hypot(h.x - last.x, h.y - last.y, gap) >= h.radius + last.radius + .3);
        }
        last = h;
      }
      previous = transaction.hazards;
    }
  }
});

test('field half-open endpoints and large cell keys have exactly one owner', () => {
  const generator = new FieldGenerator(1);
  const transaction = generator.propose(0, 2);
  const h = transaction.hazards[0]!;
  const atStart = replaceFirst(transaction, { passDistance: h.ownerCell * 24 });
  assert.equal(generator.inspect(atStart).status, 'valid');
  assert.deepEqual(generator.inspect(replaceFirst(transaction, { passDistance: (h.ownerCell + 1) * 24 })), { status: 'invalid', reason: 'ownership' });
  const high = generator.propose(FIELD_LIMITS.maxCell - 5, 6);
  assert.equal(generator.inspect(high).status, 'valid');
  assert.deepEqual(high, generator.propose(FIELD_LIMITS.maxCell - 5, 6));
  assert.notEqual(hash(high.hazards), hash(transaction.hazards));
});

test('field invalid spans, nonfinite settings and invalid seeds fail before generation', () => {
  const generator = new FieldGenerator(1);
  for (const [first, count] of [[0, 1], [0, 7], [-1, 2], [.1, 2], [NaN, 2], [Infinity, 2], [0, 2.5], [FIELD_LIMITS.maxCell, 2]]) {
    assert.throws(() => generator.propose(first!, count!), RangeError);
  }
  for (const seed of [-1, .5, NaN, Infinity, 4294967296]) assert.throws(() => new FieldGenerator(seed), RangeError);
  for (const change of [{ halfX: NaN }, { halfY: Infinity }, { halfX: 5.5 }, { halfY: 0 },
    { depthJitter: 0 }, { depthJitter: 6.1 }, { separation: -.1 }, { separation: .31 }, { maxCandidates: 13 }, { maxCandidates: 1.1 }]) {
    assert.throws(() => new FieldGenerator(1, { ...DEFAULT_FIELD_SETTINGS, ...change }), RangeError);
  }
});

test('field structural inspection rejects corrupt data, identities and ownership', () => {
  const generator = new FieldGenerator(42);
  const t = generator.propose(0, 6);
  for (const change of [{ x: NaN }, { y: Infinity }, { passDistance: NaN }, { radius: NaN }, { spin: NaN },
    { phase: -1 }, { kind: 3 }, { kind: .5 }, { visualVariant: 4 }, { orientation: 'unknown' }, { collisionProfile: 'unknown' }]) {
    assert.equal(generator.inspect(replaceFirst(t, change as Partial<PlannedHazard>)).status, 'invalid');
  }
  for (const change of [{ x: 5.41 }, { y: -3.16 }, { radius: .64 }, { radius: 1.11 }]) {
    assert.deepEqual(generator.inspect(replaceFirst(t, change)), { status: 'invalid', reason: 'bounds' });
  }
  assert.deepEqual(generator.inspect(replaceFirst(t, { id: 'forged' })), { status: 'invalid', reason: 'metadata' });
  assert.deepEqual(generator.inspect(replaceFirst(t, { anchorCell: 123 })), { status: 'invalid', reason: 'ownership' });
  assert.deepEqual(generator.inspect({ ...t, endDistance: t.endDistance + 1 }), { status: 'invalid', reason: 'transaction' });
  assert.deepEqual(generator.inspect({ ...t, hazards: [t.hazards[0]!, t.hazards[0]!] }), { status: 'invalid', reason: 'duplicate' });
  assert.deepEqual(generator.inspect(t, [t.hazards[0]!]), { status: 'invalid', reason: 'ownership' });
  assert.deepEqual(new FieldGenerator(43).inspect(t), { status: 'invalid', reason: 'provenance' });
  const adjacent = generator.propose(1, 2), h = adjacent.hazards[0]!;
  const duplicateAnchor = { ...h, id: h.id.replace(/\/1\/0$/, '/0/1'), ownerCell: 0, localIndex: 1, passDistance: 23 };
  assert.deepEqual(generator.inspect(adjacent, [duplicateAnchor]), { status: 'invalid', reason: 'duplicate' });
});

test('field actual seam separation rejects conflicting neighbors without mutation or partial admission', () => {
  const generator = new FieldGenerator(42);
  const pool = records(generator, 30);
  const index = pool.findIndex((h, i) => i > 0 && h.ownerCell === pool[i - 1]!.ownerCell + 1);
  assert.ok(index > 0);
  const a = pool[index - 1]!, b = pool[index]!;
  const right = generator.propose(b.ownerCell, 2);
  const boundary = right.startDistance;
  const committed = [{ ...a, x: b.x, y: b.y, passDistance: boundary - .01 }];
  const conflicting = replaceFirst(right, { passDistance: boundary });
  const before = hash({ committed, conflicting });
  assert.deepEqual(generator.inspect(conflicting, committed), { status: 'invalid', reason: 'separation' });
  assert.equal(hash({ committed, conflicting }), before);
  assert.equal(generator.inspect(right, [a]).status, 'valid');
});

test('field soft24/hard32/allocated72 counts reject whole oversized proposals', () => {
  const generator = new FieldGenerator(42);
  const committed = records(generator, 40), transaction = generator.propose(100, 6);
  for (const total of [24, 25, 32]) {
    assert.deepEqual(generator.inspect(transaction, committed.slice(0, total - transaction.hazards.length)), {
      status: 'valid', candidateCount: transaction.hazards.length, totalCount: total, aboveSoftLimit: total > 24,
    });
  }
  assert.deepEqual(generator.inspect(transaction, committed.slice(0, 33 - transaction.hazards.length)), { status: 'invalid', reason: 'capacity' });
  assert.deepEqual(generator.inspect({ ...transaction, hazards: Array(13).fill(transaction.hazards[0]) }), { status: 'invalid', reason: 'capacity' });
  const constrained = new FieldGenerator(42, { ...DEFAULT_FIELD_SETTINGS, maxCandidates: 1 });
  assert.throws(() => constrained.propose(0, 6), /Candidate count/);
  assert.equal(FIELD_LIMITS.allocatedProduction, 72);
});

test('field reset, settings identity and immutable returned snapshots isolate callers', () => {
  const settings = { ...DEFAULT_FIELD_SETTINGS };
  const generator = new FieldGenerator(42, settings);
  const original = generator.propose(0, 6);
  settings.halfX = 1;
  assert.deepEqual(generator.propose(0, 6), original);
  assert.ok(Object.isFrozen(original) && Object.isFrozen(original.hazards)
    && original.hazards.every(h => Object.isFrozen(h) && Object.isFrozen(h.provenance)));
  generator.reset(11);
  assert.notEqual(hash(generator.propose(0, 6)), hash(original));
  assert.deepEqual(generator.inspect(original), { status: 'invalid', reason: 'provenance' });
  assert.throws(() => generator.reset(NaN), RangeError);
  generator.reset(42);
  assert.deepEqual(generator.propose(0, 6), original);
  const narrow = new FieldGenerator(42, { ...DEFAULT_FIELD_SETTINGS, halfX: 1 });
  assert.notEqual(narrow.propose(0, 6).hazards[0]!.id, original.hazards[0]!.id);
});

test('field future validator contract carries actual state and can reject structurally valid proposals', () => {
  const generator = new FieldGenerator(42), candidate = generator.propose(0, 6);
  assert.equal(generator.inspect(candidate).status, 'valid');
  const double: FieldValidator = { validate(context) {
    assert.deepEqual(context.player, { x: 1, y: 2, vx: -8, vy: 0 });
    assert.deepEqual(context.input, { x: -1, y: .5 });
    assert.equal(context.elapsed, 120); assert.equal(context.distance, 10);
    assert.equal(context.candidate, candidate); assert.deepEqual(context.committed, []);
    return { decision: 'reject', reason: 'TEST_DOUBLE_ONLY' };
  } };
  assert.deepEqual(double.validate({ player: { x: 1, y: 2, vx: -8, vy: 0 }, input: { x: -1, y: .5 },
    elapsed: 120, distance: 10, committed: [], candidate }), { decision: 'reject', reason: 'TEST_DOUBLE_ONLY' });
});

test('field experiment leaves an existing game and its production pool untouched', () => {
  const game = new GameModel(); game.ready(); game.start(42);
  const before = hash(game), pool = game.field.hazards;
  const generator = new FieldGenerator(42);
  for (let cell = 0; cell < 200; cell += 2) assert.equal(generator.inspect(generator.propose(cell, 2)).status, 'valid');
  generator.reset(7);
  assert.equal(hash(game), before); assert.equal(game.field.hazards, pool); assert.equal(pool.length, 72);
});
