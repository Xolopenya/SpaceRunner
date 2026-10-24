import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { buildSection } from '../src/core/field-section.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { PatternGenerator } from '../src/core/field-patterns.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { beginValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';

test('seeded coverage bags visit all four corners without changing frame or player-dependent state', () => {
  for (let seed = 0; seed < 16; seed++) {
    const d = new DifficultyDirector(seed); let cursor = d.initial(), bag: number[] = [], previous = -1;
    for (let i = 0; i < 128; i++) {
      const { section: s, next } = d.next(cursor); cursor = next;
      if (s.placement !== 'corner-pressure-v1') continue;
      assert.notEqual(s.corner, previous); previous = s.corner!; bag.push(s.corner!);
      if (bag.length === 4) { assert.equal(new Set(bag).size, 4); bag = []; }
    }
  }
});
test('pressure placement preserves complete B-3 depths, radius/pose draws and normal structural admission', () => {
  const d = new DifficultyDirector(42), base = d.next(d.initial(8)).section;
  for (const family of ['narrowing', 'alternating', 'vertical-weave'] as const) for (let corner = 0; corner < 4; corner++) {
    const section = { ...base, family, cellCount: 4, intensity: .8, variation: 0, placement: 'corner-pressure-v1' as const, corner };
    const result = buildSection(section), tx = result.transaction!;
    assert.equal(result.templatePasses, 1); assert.equal(new FieldGenerator(42).inspect(tx).status, 'valid');
    const free = new PatternGenerator(42).propose({ family, firstCell: 8, cellCount: 4, intensity: .8, variation: 0 });
    assert.equal(free.status, 'proposed'); if (free.status !== 'proposed') continue;
    assert.equal(tx.hazards.length, free.transaction.hazards.length);
    for (const [i, h] of tx.hazards.entries()) {
      const f = free.transaction.hazards[i]!;
      assert.deepEqual([h.passDistance, h.radius, h.kind, h.phase, h.spin, h.visualVariant], [f.passDistance, f.radius, f.kind, f.phase, f.spin, f.visualVariant]);
      assert.ok(Math.abs(h.x) <= 5.4 && Math.abs(h.y) <= 3.15);
    }
    assert.equal(new Set(tx.hazards.map(h => h.id)).size, tx.hazards.length);
  }
});
test('parked corner traces collide while the real normal validator finds replayable open alternatives', () => {
  const d = new DifficultyDirector(42), base = d.next(d.initial(8)).section;
  for (const family of ['narrowing', 'alternating', 'vertical-weave'] as const) for (let corner = 0; corner < 4; corner++) {
    const tx = buildSection({ ...base, family, cellCount: 4, intensity: .8, variation: 0, placement: 'corner-pressure-v1', corner }).transaction!;
    const c = { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 120, distance: tx.startDistance - 128, committed: [], candidate: tx };
    const job = beginValidation(c); while (!job.getResult()) job.advance(); const result = job.getResult()!;
    assert.equal(result.decision, 'accept'); if (result.decision !== 'accept') continue;
    assert.equal(result.witness.structuralPolicy, 'generator');
    const replay = beginTrajectoryReplay(c, result.witness.controls); while (!replay.getResult()) replay.advance(); assert.equal(replay.getResult()!.decision, 'accept');
    const prediction = new FlightPrediction(), state = { x: corner < 2 ? -6 : 6, y: corner % 2 ? 3.6 : -3.6, vx: 0, vy: 0, elapsed: 120, distance: c.distance };
    let hit = false;
    while (state.distance < tx.endDistance + 16) {
      const previous = { ...state }; prediction.step(state, { x: 0, y: 0 });
      for (const h of tx.hazards) if (prediction.hitGameplay(previous, state, h)) hit = true;
    }
    assert.equal(hit, true, family + '/' + corner + ' checks a specified parked trace, not whole-layout impossibility');
  }
});
