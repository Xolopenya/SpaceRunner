import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { beginValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { CONFIG } from '../src/config.ts';
import { APERTURE_NAMES, BULKHEAD_GEOMETRY as geometry, structureTransaction } from '../src/experiments/large-structure/encounter.ts';
import { LargeStructureGameModel } from '../src/experiments/large-structure/model.ts';
import { RuntimeGameModel } from '../src/debug/runtime-game-model.ts';
import { stats } from './director-fields.mjs';

const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003B/final');
await mkdir(output, { recursive: true });
const rows = [], chunks = [], witnesses = [], runtime = [];
function complete(job) {
  const started = performance.now();
  while (!job.getResult()) { const a = job.metrics, t = performance.now(); job.advance(); const b = job.metrics;
    chunks.push({ ms: performance.now() - t, propagations: b.propagations - a.propagations, queries: b.narrowQueries - a.narrowQueries }); }
  return { result: job.getResult(), metrics: job.metrics, ms: performance.now() - started };
}
for (const elapsed of [0, 120]) for (let seed = 0; seed < 8; seed++) for (const aperture of APERTURE_NAMES) for (const sign of [-1, 0, 1]) {
  const first = elapsed ? 64 : 4, candidate = structureTransaction(seed, first, aperture);
  const context = { player: { x: -sign * 4, y: sign * 2, vx: sign * 5, vy: -sign * 3 }, input: { x: 0, y: 0 },
    elapsed, distance: (first - 4) * 24, committed: [], candidate, reservedUntilDistance: candidate.endDistance };
  const r = complete(beginValidation(context, { geometry })); assert.equal(r.result.decision, 'accept', JSON.stringify({ seed, elapsed, aperture, sign, result: r.result }));
  const w = r.result.witness, audit = complete(beginTrajectoryReplay(context, w.controls, { geometry }));
  assert.equal(audit.result.decision, 'accept'); assert.equal(audit.result.witness.hash, w.hash);
  rows.push({ seed, elapsed, aperture, sign, ms: r.ms, metrics: r.metrics, hash: w.hash }); witnesses.push(w);
}
const late = [];
for (const aperture of ['left', 'right', 'upper', 'lower']) {
  const candidate = structureTransaction(42, 4, aperture), axis = ['left', 'right'].includes(aperture) ? 'x' : 'y', direction = ['left', 'lower'].includes(aperture) ? -1 : 1;
  const player = { x: 0, y: 0, vx: 0, vy: 0 }; player[axis] = -direction * (axis === 'x' ? 6 : 3.6); player[axis === 'x' ? 'vx' : 'vy'] = -direction * 8;
  const r = complete(beginValidation({ player, input: { x: 0, y: 0 }, elapsed: 120, distance: 132, committed: [], candidate, reservedUntilDistance: candidate.endDistance }, { geometry }));
  assert.equal(r.result.decision, 'reject'); late.push({ aperture, player, result: r.result, metrics: r.metrics });
}

function input(w, elapsed) {
  let tick = w ? Math.round((elapsed - w.context.elapsed) * 120) : 0;
  for (const r of w?.controls ?? []) { if (tick < r.ticks) return r.input; tick -= r.ticks; } return { x: 0, y: 0 };
}
for (const policy of ['baseline', 'pressure', 'large-structure']) for (const history of ['neutral', 'top-right', 'horizontal', 'witness']) for (const seed of [0, 11, 42]) {
  const m = policy === 'large-structure' ? new LargeStructureGameModel() : new RuntimeGameModel(policy);
  m.ready(); m.start(seed); const accepted = []; let events = 0;
  const started = performance.now();
  for (let tick = 0; tick < 3600 && m.state === 'PLAYING'; tick++) {
    const axis = history === 'witness' ? input(m.field.certificate, m.elapsed) : history === 'top-right' ? { x: 1, y: 1 }
      : history === 'horizontal' ? { x: Math.floor(tick / 180) % 2 ? -1 : 1, y: 0 } : { x: 0, y: 0 };
    m.step(CONFIG.step, axis);
    if (m.field.events.length !== events) {
      events = m.field.events.length; const w = m.field.lastOutcome?.witness;
      if (w) { const audit = complete(beginTrajectoryReplay(w.context, w.controls, policy === 'large-structure' ? { geometry } : {})); assert.equal(audit.result.decision, 'accept'); assert.equal(audit.result.witness.hash, w.hash); accepted.push(w); }
    }
    assert.equal(m.field.fault, undefined);
  }
  if (history === 'witness') assert.equal(m.hitSerial, 0);
  for (const sample of m.field.samples) { assert.ok(sample.propagations <= 3072); assert.ok(sample.queries <= 6144); }
  runtime.push({ policy, history, seed, ms: performance.now() - started, elapsed: m.elapsed, distance: m.distance, hits: m.hitSerial,
    state: m.state, committed: m.field.committed, omitted: m.field.omitted, events: m.field.events, samples: m.field.samples, witnesses: accepted,
    finalGeometry: m.field.ledger.knownHazards(m.distance), primitiveQueries: m.collisionQueries ?? null }); m.dispose();
  console.log(`${policy}/${history}/${seed}: ${runtime.at(-1).committed} committed / ${runtime.at(-1).omitted} omitted / ${m.hitSerial} hits`);
}
const summary = { generatedAt: new Date().toISOString(), node: process.version, humanParticipants: 0, physicalDevices: 0, directAccepted: rows.length, directRejected: late.length,
  validationMs: stats(rows.map(r => r.ms)), chunks: stats(chunks.map(r => r.ms)), maxPropagations: Math.max(...rows.map(r => r.metrics.propagations)),
  maxNarrowQueries: Math.max(...rows.map(r => r.metrics.narrowQueries)), maxPlanningTicks: Math.max(...rows.map(r => r.metrics.planningTicks)),
  maxChunkPropagations: Math.max(...chunks.map(r => r.propagations)), maxChunkQueries: Math.max(...chunks.map(r => r.queries)),
  runtime: runtime.map(({ witnesses, samples, finalGeometry, ...r }) => ({ ...r, witnessCount: witnesses.length, events: r.events })),
  queryContract: 'Four actual primitive box queries per compound test, charged separately before work; independent replay uses clearance AND gameplay sweeps.',
  limitations: '30s deterministic logical histories, finite corpus, no rendering in Node timings; human participants=0.' };
await writeFile(join(output, 'structure-benchmark.json'), JSON.stringify(summary, null, 2) + '\n');
await writeFile(join(output, 'structure-witnesses.json'), JSON.stringify({ rows, witnesses, late, chunks, runtime }) + '\n');
console.log(JSON.stringify({ ...summary, runtime: summary.runtime.map(({ events, ...r }) => r) }, null, 2));
