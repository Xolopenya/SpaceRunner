import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePassivePressure } from '../src/release/placement.ts';
import { ReleaseModel, RELEASE_GEOMETRY } from '../src/release/model.ts';
import { mixedFlowSource, FLOW_GEOMETRY } from '../src/experiments/mixed-flow/source.ts';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { difficulty } from '../src/config.ts';

test('release pressure uses whole canonical pattern transforms and preserves ambient/stations', () => {
  for (const seed of [0, 11, 42]) {
    const source = mixedFlowSource(); let cursor = new DifficultyDirector(seed).initial(4), patterns = 0;
    for (let i = 0; i < 12; i++) {
      const d = source.next(seed, cursor), c = source.candidate(d.section); cursor = d.next;
      for (const x of [-6, 0, 3.5, 6]) {
        const root = { player: { x, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, distance: 0, elapsed: 0 };
        const tx = placePassivePressure(c.transaction, root);
        assert.equal(FLOW_GEOMETRY.inspect(tx, []).status, 'valid');
        assert.deepEqual(tx.hazards.map(h => [h.radius, h.passDistance, h.kind]), c.transaction.hazards.map(h => [h.radius, h.passDistance, h.kind]));
        assert.equal(tx.cellCount, c.transaction.cellCount); assert.equal(tx.endDistance, c.transaction.endDistance);
        if (!c.transaction.provenance.pattern) assert.equal(tx, c.transaction);
        else { patterns++; assert.equal(placePassivePressure(c.transaction, root, tx.hazards), c.transaction); }
      }
    }
    assert.ok(patterns > 0);
  }
});

test('release pressure retains causal safe witnesses and unchanged Phase 2 speed', () => {
  for (const seed of [0, 11, 42]) {
    const m = new ReleaseModel(); m.ready(); m.start(seed); let last, transitioned = false;
    while (m.elapsed < 45 && m.state === 'PLAYING') {
      const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, axis = { x: 0, y: 0 };
      for (const r of w?.controls ?? []) { if (tick < r.ticks) { axis = r.input; break; } tick -= r.ticks; }
      m.step(1 / 120, axis);
      assert.equal(m.field.fault, undefined);
      assert.equal(m.speed, difficulty(m.elapsed).speed * (m.distance >= 500 ? 1.08 : 1));
      if (m.phase === 2) transitioned = true;
      const outcome = m.field.lastOutcome;
      if (outcome && outcome !== last) {
        last = outcome;
        assert.ok(outcome.metrics.searches <= 2 && outcome.metrics.replays <= 4 && outcome.metrics.planningTicks <= 144);
        if (outcome.witness) {
          const job = beginTrajectoryReplay(outcome.witness.context, outcome.witness.controls, { geometry: RELEASE_GEOMETRY });
          while (!job.getResult()) job.advance();
          assert.equal(job.getResult()!.decision, 'accept');
        }
      }
    }
    assert.equal(m.hull, 3); assert.ok(transitioned); assert.ok(m.field.committed >= 5); m.dispose();
  }
});
