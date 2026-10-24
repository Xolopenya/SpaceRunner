import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DifficultyDirector, contentProgress } from '../src/core/field-director.ts';
import { DIRECTOR_SETTINGS as S } from '../src/core/field-director-settings.ts';
import { FIELD_LIMITS } from '../src/core/field-settings.ts';

test('director full decisions have a golden, independent calls and JSON cursor replay', () => {
  const d = new DifficultyDirector(42), decisions = []; let cursor = d.initial();
  for (let i = 0; i < 16; i++) { const value = d.next(cursor); decisions.push(value.section); cursor = value.next; }
  assert.equal(createHash('sha256').update(JSON.stringify(decisions)).digest('hex'), 'eb99d94855bc1ea60c8f9227649a31845ece464a5a19c94ebd28fd47b6969b71');
  const before = d.next(cursor); d.next(d.initial(1000000));
  assert.deepEqual(d.next(JSON.parse(JSON.stringify(cursor))), before);
  assert.deepEqual(new DifficultyDirector(42).next(d.initial()), { section: decisions[0], next: d.next(d.initial()).next });
  assert.notDeepEqual(new DifficultyDirector(7).next(d.initial()).section, decisions[0]);
  assert.ok(Object.isFrozen(before.section) && Object.isFrozen(before.next.lastFamilies));
});
test('seeded pacing covers all states and families without fixed cycles or immediate pattern repeats', () => {
  const states = new Set(), families = new Set(), recoveries = new Set(), fingerprints = new Set();
  for (let seed = 0; seed < 32; seed++) {
    const director = new DifficultyDirector(seed); let cursor = director.initial(); const sequence = [];
    for (let i = 0; i < 128; i++) {
      const { section: s, next } = director.next(cursor);
      states.add(s.pacing); families.add(s.family); sequence.push([s.pacing, s.family, s.cellCount]);
      if (cursor.previous === 'high') assert.equal(s.pacing, 'recovery');
      if (s.pacing === 'recovery') { assert.equal(s.family, 'ambient'); recoveries.add(s.cellCount); }
      if (s.family !== 'ambient') assert.ok(!cursor.lastFamilies.includes(s.family));
      assert.equal(s.firstCell, cursor.firstCell); assert.equal(next.firstCell * 24, s.endDistance);
      assert.ok(s.cellCount >= 2 && s.cellCount <= 6 && next.regularStreak <= 2);
      assert.ok(s.intensity >= S.minIntensity && s.intensity <= S.maxIntensity);
      assert.ok(s.densityTarget > 0 && s.densityTarget <= 12);
      cursor = next;
    }
    fingerprints.add(JSON.stringify(sequence));
  }
  assert.equal(states.size, 4); assert.equal(families.size, 5); assert.equal(recoveries.size, 3); assert.equal(fingerprints.size, 32);
});
test('endless progression saturates without a final stage or growing physical parameters', () => {
  assert.equal(contentProgress(0), 0); assert.equal(contentProgress(144), 0);
  assert.equal(contentProgress(6144), .632120558829); // explicit policy precision, not physics rounding
  let previous = 0;
  for (const distance of [145, 1000, 6000, 24000, 1e6, 1e11, Number.MAX_VALUE]) {
    const p = contentProgress(distance); assert.ok(p >= previous && p <= 1); previous = p;
  }
  assert.equal(contentProgress(1e11), 1);
  const d = new DifficultyDirector(42);
  const large = { ...d.initial(1000000000), index: Number.MAX_SAFE_INTEGER - 1, previous: 'regular' as const };
  const result = d.next(large);
  assert.ok(Number.isSafeInteger(result.section.startDistance)); assert.equal(result.section.progress, 1);
  assert.ok(result.section.variation >= 0 && result.section.variation <= 65535);
  assert.throws(() => d.next(result.next), RangeError); // explicit numeric-domain boundary, never wrap keys
  assert.throws(() => d.initial(FIELD_LIMITS.maxCell), RangeError);
});
test('invalid seeds, cursor domains and progression inputs fail explicitly', () => {
  for (const seed of [-1, .5, NaN, 0x100000000]) assert.throws(() => new DifficultyDirector(seed), RangeError);
  for (const distance of [-1, NaN, Infinity]) assert.throws(() => contentProgress(distance), RangeError);
  const d = new DifficultyDirector(0);
  assert.throws(() => d.next({ ...d.initial(), regularStreak: 3 }), RangeError);
  assert.throws(() => d.next({ ...d.initial(), lastFamilies: ['scattered', 'narrowing', 'alternating'] }), RangeError);
});
