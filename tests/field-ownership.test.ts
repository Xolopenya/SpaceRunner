import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OwnershipLedger } from '../src/core/field-ownership.ts';
import { PatternGenerator } from '../src/core/field-patterns.ts';
import { DIRECTOR_SETTINGS } from '../src/core/field-director-settings.ts';

test('full source spans survive disappearing hazards and retire only past the complete span', () => {
  const ledger = new OwnershipLedger(), p = new PatternGenerator(42).propose({ family: 'vertical-weave', firstCell: 6, intensity: .8 });
  assert.equal(p.status, 'proposed'); if (p.status !== 'proposed') return;
  const tx = p.transaction, r = ledger.reserve('weave', 6, 6, tx.hazards.map(h => h.id), tx.hazards);
  assert.equal(r.status, 'reserved'); if (r.status !== 'reserved') return;
  assert.equal(ledger.knownHazards(0).length, 0); // pending is never published
  assert.equal(ledger.reserve('other', 12, 2, []).status, 'rejected');
  assert.equal(ledger.finalize(r.token, 'committed'), true);
  assert.equal(ledger.knownHazards(0).length, tx.hazards.length);
  assert.deepEqual(ledger.reserve('empty-cell-reuse', 8, 2, []), { status: 'rejected', reason: 'OWNERSHIP_CONFLICT' });
  assert.equal(ledger.retire(tx.endDistance + 9.1), 0);
  assert.equal(ledger.knownHazards(tx.endDistance + 9.1).length, 0);
  assert.equal(ledger.snapshot().length, 1); // ownership does not come from this now-empty hazard array
  assert.equal(ledger.retire(tx.endDistance + 9.11), 1); assert.equal(ledger.snapshot().length, 0);
  assert.equal(ledger.reserve('next', 12, 2, []).status, 'reserved');
});
test('reservation conflicts, duplicates, capacity and cancellation are atomic', () => {
  const ledger = new OwnershipLedger();
  assert.deepEqual(ledger.reserve('duplicate', 6, 2, ['same', 'same']), { status: 'rejected', reason: 'DUPLICATE_ID' });
  assert.equal(ledger.snapshot().length, 0);
  const pending = ledger.reserve('cancel', 6, 2, []); assert.equal(pending.status, 'reserved');
  if (pending.status === 'reserved') { assert.equal(ledger.cancel(pending.token), true); assert.equal(ledger.finalize(pending.token, 'committed'), false); }
  for (let i = 0; i < DIRECTOR_SETTINGS.maxOwnershipRecords; i++) {
    const r = ledger.reserve(`writer${i}`, 6 + i * 2, 2, [`id${i}`]);
    assert.equal(r.status, 'reserved'); if (r.status === 'reserved') ledger.finalize(r.token, 'omitted');
  }
  assert.deepEqual(ledger.reserve('overflow', ledger.frontier, 2, []), { status: 'rejected', reason: 'CAPACITY' });
  assert.throws(() => ledger.retire(-1), RangeError); ledger.retire(1e6);
  assert.equal(ledger.snapshot().length, 0);
  assert.deepEqual(ledger.reserve('past', 6, 2, []), { status: 'rejected', reason: 'FRONTIER' });
});
test('reset invalidates pending tokens without changing reproducible world identities', () => {
  const ledger = new OwnershipLedger(), before = ledger.reserve('run', 6, 2, []);
  assert.equal(before.status, 'reserved'); ledger.reset(); const after = ledger.reserve('run', 6, 2, []);
  assert.equal(after.status, 'reserved');
  if (before.status === 'reserved' && after.status === 'reserved') {
    assert.notEqual(before.token, after.token); assert.equal(ledger.finalize(before.token, 'committed'), false);
    assert.equal(ledger.snapshot()[0]!.state, 'pending'); assert.equal(ledger.finalize(after.token, 'committed'), true);
  }
  assert.ok(Object.isFrozen(ledger.snapshot()) && Object.isFrozen(ledger.snapshot()[0]!.ids));
});
