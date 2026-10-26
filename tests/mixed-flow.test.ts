import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.ts';
import { Ship } from '../src/core/ship.ts';
import { DifficultyDirector } from '../src/core/field-director.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { OwnershipLedger } from '../src/core/field-ownership.ts';
import { RuntimePlanningSession } from '../src/core/field-runtime-session.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { beginValidation, beginKnownFieldValidation, beginTrajectoryReplay, beginRuntimeRootSearch } from '../src/core/field-validator.ts';
import type { ValidationJob } from '../src/core/field-validator.ts';
import type { ValidationWitness } from '../src/core/field-validator-types.ts';
import type { FieldValidationContext } from '../src/core/field-types.ts';
import { APERTURE_NAMES, isWreck } from '../src/experiments/structure-variants/profile.ts';
import { wreckTransaction } from '../src/experiments/structure-variants/encounter.ts';
import { mixedFlowSource, FLOW_GEOMETRY as geometry } from '../src/experiments/mixed-flow/source.ts';
import { MixedFlowGameModel } from '../src/experiments/mixed-flow/model.ts';

function complete(job: ValidationJob) { while (!job.getResult()) job.advance(); return job.getResult()!; }
function accept(job: ValidationJob): ValidationWitness { const r = complete(job); assert.equal(r.decision, 'accept', JSON.stringify(r)); if (r.decision !== 'accept') throw Error('reject'); return r.witness; }
const root = () => ({ player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0 });
function witnessInput(w: ValidationWitness | undefined, elapsed: number) { let tick = w ? Math.round((elapsed - w.context.elapsed) * 120) : 0;
  for (const r of w?.controls ?? []) { if (tick < r.ticks) return r.input; tick -= r.ticks; } return { x: 0, y: 0 }; }

test('mixed flow uses deterministic director history, variable spans and a seeded nonrepeating aperture bag', () => {
  const sequences: string[] = [];
  for (const seed of [0, 1, 11, 42, 0xffffffff]) {
    const source = mixedFlowSource(); let cursor = new DifficultyDirector(seed).initial(4); const selected = [], families = new Set<string>(), spacings = new Set<number>(); let last = 0;
    for (let i = 0; i < 140; i++) {
      const d = source.next(seed, cursor); assert.deepEqual(source.next(seed, cursor), d);
      assert.equal(d.section.startDistance, cursor.firstCell * 24); assert.equal(d.next.firstCell * 24, d.section.endDistance);
      if (d.section.aperture) { selected.push(d.section.aperture); spacings.add(d.section.firstCell - last); last = d.section.firstCell; }
      families.add(d.section.encounter!); cursor = d.next;
    }
    assert.ok(selected.length > 15); assert.equal(new Set(selected).size, 5); assert.ok(selected.every((a, i) => !i || a !== selected[i - 1]));
    for (let i = 0; i + 5 <= selected.length; i += 5) assert.equal(new Set(selected.slice(i, i + 5)).size, 5);
    assert.ok(spacings.size > 3); assert.deepEqual([...families].sort(), ['ambient', 'alternating', 'narrowing', 'scattered', 'station-wreck', 'vertical-weave'].sort()); sequences.push(selected.join('/'));
  }
  assert.equal(new Set(sequences).size, sequences.length);
});

test('forced aperture is a testing override; every ordinary payload has a whole owned empty tail and canonical membership', () => {
  for (const aperture of APERTURE_NAMES) {
    const source = mixedFlowSource(aperture); let cursor = new DifficultyDirector(42).initial(4), frames = 0;
    for (let i = 0; i < 24; i++) {
      const d = source.next(42, cursor), c = source.candidate(d.section); cursor = d.next;
      assert.equal(geometry.inspect(c.transaction, []).status, 'valid');
      assert.ok(Math.max(...c.transaction.hazards.map(h => h.passDistance)) + 16 < c.transaction.endDistance);
      if (c.transaction.hazards.some(isWreck)) { frames++; assert.equal(d.section.aperture, aperture); assert.equal(c.transaction.hazards[0]!.kind, 4 + APERTURE_NAMES.indexOf(aperture)); }
      else {
        assert.equal(c.transaction.provenance.pattern?.cellCount ?? c.transaction.cellCount - 1, c.transaction.cellCount - 1);
        assert.equal(geometry.inspect({ ...c.transaction, hazards: c.transaction.hazards.slice(1) }, []).status, 'invalid');
        const changed = { ...c.transaction, hazards: c.transaction.hazards.map((h, j) => j ? h : { ...h, x: h.x + .01 }) };
        assert.equal(geometry.inspect(changed, []).status, 'invalid');
      }
      const fallback = c.fallback!; assert.equal(fallback.cellCount, c.transaction.cellCount); assert.equal(geometry.inspect(fallback, []).status, 'valid');
      assert.deepEqual(fallback.hazards, new FieldGenerator(42).propose(fallback.firstCell, fallback.cellCount - 1).hazards);
    }
    assert.ok(frames >= 3);
  }
});

test('one union search preserves exact independent replay and old accepted route identities', () => {
  for (const seed of [0, 11, 42]) {
    const tx = new FieldGenerator(seed).propose(4, 3);
    const c: FieldValidationContext = { ...root(), candidate: tx, committed: [] };
    const old = accept(beginValidation(c)), job = beginKnownFieldValidation(c, {}), w = accept(job);
    assert.equal(w.hash, old.hash); assert.equal(job.metrics.searches, 1); assert.equal(job.metrics.replays, 1);
    assert.equal(accept(beginTrajectoryReplay(w.context, w.controls)).hash, w.hash);
  }
});

test('actual-root constructive search traverses all five exact solids within one unchanged publication budget', () => {
  for (const aperture of APERTURE_NAMES) {
    const candidate = wreckTransaction(42, 4, aperture, 'isolated'), c: FieldValidationContext = { ...root(), candidate, committed: [], reservedUntilDistance: candidate.endDistance };
    const prepared = accept(beginKnownFieldValidation(c, { geometry })), state = { ...c.player, elapsed: 0, distance: 0 }, p = new FlightPrediction();
    for (let i = 0; i < 47; i++) p.step(state, { x: .7, y: -.3 });
    const current = { ...c, player: state, input: { x: .7, y: -.3 }, elapsed: state.elapsed, distance: state.distance };
    const job = beginRuntimeRootSearch(prepared, current, { geometry }), r = job.advance(); assert.equal(r?.decision, 'accept', JSON.stringify(r));
    if (r?.decision !== 'accept') throw Error('not certified');
    assert.ok(job.metrics.propagations <= 3072 && job.metrics.narrowQueries <= 6144); assert.equal(job.metrics.searches, 1);
    assert.equal(accept(beginTrajectoryReplay(r.witness.context, r.witness.controls, { geometry })).hash, r.witness.hash);
    assert.equal(complete(beginRuntimeRootSearch(prepared, { ...current, candidate: { ...candidate, hazards: [] } }, { geometry })).decision, 'reject');
  }
});

test('actual-root search rejects an initially clear unavoidable held-prefix impact and unknown geometry', () => {
  const candidate = wreckTransaction(42, 4, 'right', 'isolated'), c: FieldValidationContext = { ...root(), elapsed: 120, player: { x: 3, y: 0, vx: 0, vy: 0 }, candidate, committed: [], reservedUntilDistance: candidate.endDistance };
  const w = accept(beginKnownFieldValidation(c, { geometry })), late = { ...c, distance: 140, player: { x: -5, y: 0, vx: 0, vy: 0 } };
  const r = complete(beginRuntimeRootSearch(w, late, { geometry })); assert.equal(r.decision, 'reject');
  assert.ok(r.decision === 'reject' && r.reason === 'INSUFFICIENT_REACTION_DISTANCE');
  assert.equal(complete(beginRuntimeRootSearch(w, c, {})).decision, 'reject');
  assert.equal(complete(beginRuntimeRootSearch(w, c, { geometry, structuralPolicy: 'synthetic-fixture' })).decision, 'reject');
});

test('unfinished actual-root work never publishes, total deadlines and reset epochs remain authoritative', () => {
  const source = mixedFlowSource(), d = source.next(42, new DifficultyDirector(42).initial(4)), ledger = new OwnershipLedger(); ledger.reset(4);
  const s = new RuntimePlanningSession(d.section, root(), [], ledger, 'culled', source.candidate(d.section));
  const p = new FlightPrediction(), state = { ...root().player, elapsed: 0, distance: 0 }; let zero = false;
  for (let tick = 1; tick <= 144 && !s.getResult(); tick++) {
    p.step(state, { x: 0, y: 0 }); zero ||= s.phase === 'ready';
    s.advance({ player: state, input: { x: 0, y: 0 }, elapsed: state.elapsed, distance: state.distance }, [], tick, zero ? { propagations: 0, narrowQueries: 0 } : undefined);
  }
  assert.ok(zero); assert.equal(s.getResult()!.status, 'omitted-uncertified'); assert.equal(s.getResult()!.witness, undefined);
  assert.ok(s.metrics.searches <= 2 && s.metrics.replays <= 4); assert.ok(ledger.snapshot().every(r => r.state === 'omitted'));
  const clean = new OwnershipLedger(); clean.reset(4);
  const next = new RuntimePlanningSession(d.section, root(), [], clean, 'culled', source.candidate(d.section));
  next.cancel(); assert.equal(next.getResult()!.reason, 'CANCELLED');
  const epoch = new RuntimePlanningSession(d.section, root(), [], clean, 'culled', source.candidate(d.section)); let tick = 0;
  while (epoch.phase !== 'ready' && tick < 143) epoch.advance(root(), [], ++tick);
  clean.reset(4); const stale = epoch.advance(root(), [], ++tick)!; assert.equal(stale.status, 'blocked'); assert.equal(stale.reason, 'STALE_OWNERSHIP');
});

test('seed42 ordinary steering reaches650m with real hull, full transactions and unchanged ship motion', () => {
  for (const history of ['horizontal', 'vertical', 'boundary', 'touch']) {
    const m = new MixedFlowGameModel(), ship = new Ship(); m.ready(); m.start(42);
    for (let tick = 0; tick < 6000 && m.distance < 650 && m.state === 'PLAYING'; tick++) {
      const axis = history === 'horizontal' ? { x: Math.floor(tick / 180) % 2 ? -1 : 1, y: 0 }
        : history === 'vertical' ? { x: 0, y: Math.floor(tick / 132) % 2 ? -1 : 1 } : history === 'boundary' ? { x: 1, y: 1 }
        : { x: Math.sin(tick / 93) * .85, y: Math.cos(tick / 147) * .7 };
      ship.update(CONFIG.step, axis); m.step(CONFIG.step, axis); assert.deepEqual(m.ship, ship); assert.equal(m.field.fault, undefined);
    }
    assert.ok(m.distance >= 650); assert.ok(m.field.committed >= 5); assert.ok(m.hull > 0 && m.hull <= 3); m.dispose();
  }
});

test('long actual-model mixed flow certifies full geometry and records bounded export/reset/pause diagnostics', () => {
  const m = new MixedFlowGameModel(); m.ready(); m.start(42); let last; const frames = new Set<number>(); let ordinary = 0, audits = 0;
  for (let tick = 0; tick < 18000 && m.distance < 3300; tick++) {
    m.step(CONFIG.step, witnessInput(m.field.certificate, m.elapsed)); assert.equal(m.field.fault, undefined);
    const o = m.field.lastOutcome; if (!o || o === last) continue; last = o;
    assert.ok(o.metrics.searches <= 2 && o.metrics.replays <= 4 && o.metrics.planningTicks <= 144);
    if (o.witness) {
      assert.deepEqual(o.witness.context.player, { ...m.ship }); assert.equal(o.witness.context.distance, m.distance);
      assert.equal(accept(beginTrajectoryReplay(o.witness.context, o.witness.controls, { geometry })).hash, o.witness.hash); audits++;
      for (const h of o.transaction!.hazards) if (isWreck(h)) frames.add(h.kind); else ordinary++;
    }
  }
  assert.ok(m.distance >= 3300); assert.equal(m.hitSerial, 0); assert.equal(frames.size, 5); assert.ok(ordinary > 90 && audits >= 25);
  for (const s of m.field.samples) assert.ok(s.propagations <= 3072 && s.queries <= 6144);
  assert.equal(m.field.publicationTrace.length, 16); assert.ok(m.field.inputTrace.length <= 128);
  const before = JSON.stringify(m.field.exportDiagnosticTrace()); m.pause(); for (let i = 0; i < 200; i++) m.step(CONFIG.step, { x: 1, y: 1 });
  assert.equal(JSON.stringify(m.field.exportDiagnosticTrace()), before); m.resume(); m.step(CONFIG.step, { x: 0, y: 0 });
  const slots = [...m.field.slots], pending = m.field.pending; m.state = 'GAME_OVER'; m.start(42);
  assert.equal(m.field.publicationTrace.length, 0); assert.equal(m.field.inputTrace.length, 0); assert.equal(m.field.ledger.snapshot().length, 0);
  assert.ok(slots.every((h, i) => h === m.field.slots[i])); if (pending) assert.equal(pending.getResult()!.reason, 'CANCELLED'); m.dispose();
});
