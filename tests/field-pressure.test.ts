import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { fieldPolicy } from '../src/core/field-policy.ts';
import { pressureSimulation } from './fixtures/pressure-simulation.ts';

test('policy selection is explicit, rejects typos and defaults to approved baseline', () => {
  assert.equal(fieldPolicy(null), 'baseline'); assert.equal(fieldPolicy('baseline'), 'baseline');
  assert.equal(fieldPolicy('pressure'), 'pressure'); assert.throws(() => fieldPolicy('Pressure'));
  assert.throws(() => new DifficultyDirector(42, 'invalid' as 'baseline'));
});

test('pressure uses existing families, compact legal spans, cooldowns and short high-to-recovery pacing', () => {
  const d = new DifficultyDirector(42, 'pressure'); let cursor = d.initial(4), previous = 'start';
  const families = new Set<string>();
  for (let i = 0; i < 128; i++) {
    const a = d.next(cursor), b = d.next(JSON.parse(JSON.stringify(cursor)));
    assert.deepEqual(a, b); const s = a.section;
    assert.equal(s.version, 'pressure-v1'); assert.ok(s.cellCount >= 2 && s.cellCount <= 4);
    if (previous === 'high') { assert.equal(s.pacing, 'recovery'); assert.equal(s.cellCount, 2); }
    if (s.family !== 'ambient') { assert.ok(!cursor.lastFamilies.includes(s.family)); families.add(s.family); }
    assert.equal(s.startDistance, cursor.firstCell * 24);
    previous = s.pacing; cursor = a.next;
  }
  assert.equal(families.size, 4);
});

test('pressure changes actual published geometry with independent replay and deterministic restart', () => {
  const run = (policy: 'baseline' | 'pressure') => pressureSimulation({ seed: 42, history: 'neutral', seconds: 16, policy, audit: true });
  const a = run('baseline'), b = run('pressure'), repeated = run('pressure');
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.notEqual(hash(a.geometry), hash(b.geometry)); assert.equal(hash(b.geometry), hash(repeated.geometry));
  assert.ok(b.geometry.length > a.geometry.length); assert.ok(b.audits > 0); assert.ok(b.peakKnown <= 32);
  assert.deepEqual(a.terminal, b.terminal); assert.deepEqual(a.inputRuns, b.inputRuns);
});
