import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreStorage } from '../src/services/storage.ts';

test('best score persists and never decreases', () => {
  const data = new Map<string, string>();
  const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const scores = new ScoreStorage(() => store);
  assert.equal(scores.best, 0);
  assert.equal(scores.record(123.8), 123);
  assert.equal(scores.record(42), 123);
  assert.equal(scores.record(NaN), 123);
  assert.equal(new ScoreStorage(() => store).best, 123);
});

test('denied reads and writes retain an in-memory best', () => {
  const unavailable = new ScoreStorage(() => { throw new Error('denied'); });
  assert.equal(unavailable.record(99), 99);
  const quota = new ScoreStorage(() => ({ getItem: () => '40', setItem: () => { throw new Error('quota'); } }));
  assert.equal(quota.record(50), 50);
});

test('corrupt stored scores fall back safely', () => {
  for (const value of ['not-a-number', 'Infinity', '-200', '', 'null']) {
    assert.equal(new ScoreStorage(() => ({ getItem: () => value, setItem: () => {} })).best, 0);
  }
});
