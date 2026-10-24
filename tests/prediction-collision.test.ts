import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClearanceHazardCollision as HazardCollision } from '../src/core/field-clearance.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { Random } from '../src/core/random.ts';
import { CONFIG } from '../src/config.ts';
import { ApprovedHazardCollision } from './fixtures/approved-hazard-collision.ts';
import { beginValidation } from '../src/core/field-validator.ts';
import { context, fixtureOptions, obstacle } from './fixtures/trajectory-fixtures.ts';

test('10000 frozen-baseline sweeps retain exact default/zero behavior; margins are monotone', () => {
  const random = new Random(0xc0111de), approved = new ApprovedHazardCollision(), actual = new HazardCollision();
  let hits = 0, misses = 0, enlarged = 0;
  for (let i = 0; i < 10000; i++) {
    const radius = random.between(.65, 1.1), kind = i % 3;
    const phase = i % 7 === 0 ? Math.PI + (i % 2 ? 1e-12 : -1e-12) : random.between(0, 2 * Math.PI);
    const hazard = { radius, kind, phase, spin: random.between(-.7, .7) };
    const from = { x: random.between(-2, 2), y: random.between(-2, 2), z: random.between(-10, 10) };
    const to = { x: from.x + random.between(-.4, .4), y: from.y + random.between(-.4, .4), z: from.z + random.between(-20, 20) };
    if (i % 10 === 0) { from.x = to.x = radius + CONFIG.ship.radius; from.y = to.y = 0; from.z = -5; to.z = 5; }
    const elapsed = random.between(0, 100000), expected = approved.hit(from, to, hazard, elapsed, CONFIG.step);
    assert.equal(actual.hit(from, to, hazard, elapsed, CONFIG.step), expected);
    assert.equal(actual.hit(from, to, hazard, elapsed, CONFIG.step, 0), expected);
    const padded = actual.hit(from, to, hazard, elapsed, CONFIG.step, .15);
    const larger = actual.hit(from, to, hazard, elapsed, CONFIG.step, .3);
    if (expected) { hits++; assert.equal(padded, true); } else { misses++; if (padded) enlarged++; }
    if (padded) assert.equal(larger, true);
  }
  assert.ok(hits > 100 && misses > 100 && enlarged > 10);
});

test('clearance margin includes thin/rotating continuous sweeps and rejects invalid values', () => {
  const query = new HazardCollision(), from = { x: 0, y: 0, z: -10 }, to = { x: 0, y: 0, z: 10 };
  for (const phase of [0, Math.PI, Math.PI - 1e-12, Math.PI + 1e-12]) {
    assert.equal(query.hit(from, to, { radius: .65, kind: 2, phase, spin: .7 }, 120.001, CONFIG.step, .15), true);
  }
  for (const margin of [-.1, NaN, Infinity]) assert.throws(() => query.hit(from, to, { radius: 1, kind: 0, phase: 0, spin: 0 }, 1, CONFIG.step, margin), RangeError);
});

test('independent replay disagreement fails closed even after a search found safe states', () => {
  const original = FlightPrediction.prototype.hit;
  let job: ReturnType<typeof beginValidation>;
  try {
    FlightPrediction.prototype.hit = function (a, b, hazard, margin) {
      if (job && job.metrics.replays >= 2) return true; // Fault injection ONLY into replay.
      return original.call(this, a, b, hazard, margin);
    };
    job = beginValidation(context([obstacle('off-path', 3, 0, 68)]), fixtureOptions);
    while (!job.getResult()) job.advance();
    const result = job.getResult()!;
    assert.equal(result.decision === 'reject' && result.reason, 'REPLAY_DISAGREEMENT');
  } finally { FlightPrediction.prototype.hit = original; }
});
