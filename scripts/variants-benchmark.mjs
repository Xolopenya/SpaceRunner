import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { beginValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { CONFIG } from '../src/config.ts';
import { APERTURE_NAMES } from '../src/experiments/structure-variants/profile.ts';
import { wreckTransaction, WRECK_GEOMETRY as geometry } from '../src/experiments/structure-variants/encounter.ts';
import { StructureVariantsGameModel } from '../src/experiments/structure-variants/model.ts';
import { RuntimeGameModel } from '../src/debug/runtime-game-model.ts';
import { stats } from './director-fields.mjs';
const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003B2/final'); await mkdir(output, { recursive: true });
const rows = [], witnesses = [], rejections = [], chunks = [], runtime = [];
function finish(job) { const start = performance.now(); while (!job.getResult()) { const before = job.metrics, t = performance.now(); job.advance(); const after = job.metrics;
  const chunk = { ms: performance.now() - t, propagations: after.propagations - before.propagations, queries: after.narrowQueries - before.narrowQueries };
  assert.ok(chunk.propagations <= 3072 && chunk.queries <= 6144); chunks.push(chunk); }
  return { result: job.getResult(), metrics: job.metrics, ms: performance.now() - start }; }
for (const mode of ['isolated', 'mixed']) for (const elapsed of [0, 120]) for (let seed = 0; seed < 8; seed++) for (const aperture of APERTURE_NAMES) for (const sign of [-1, 0, 1]) {
  const first = elapsed ? 64 : 4, candidate = wreckTransaction(seed, first, aperture, mode);
  const context = { player: { x: sign * 4, y: -sign * 2, vx: -sign * 5, vy: sign * 3 }, input: { x: 0, y: 0 }, elapsed, distance: (first - 4) * 24,
    committed: [], candidate, reservedUntilDistance: candidate.endDistance };
  const r = finish(beginValidation(context, { geometry }));
  rows.push({ mode, elapsed, seed, aperture, sign, ms: r.ms, metrics: r.metrics, decision: r.result.decision,
    reason: r.result.reason, hash: r.result.witness?.hash });
  if (r.result.decision === 'accept') {
    const w = r.result.witness, audit = finish(beginTrajectoryReplay(context, w.controls, { geometry })); assert.equal(audit.result.decision, 'accept'); assert.equal(audit.result.witness.hash, w.hash); witnesses.push(w);
  }
}
for (const mode of ['isolated','mixed']) for (const aperture of APERTURE_NAMES) assert.ok(rows.some(r=>r.mode===mode&&r.aperture===aperture&&r.decision==='accept'));
for (const aperture of APERTURE_NAMES) {
  const candidate = wreckTransaction(42, 4, aperture, 'mixed'), h = candidate.hazards[1];
  assert.ok(4 > h.radius + CONFIG.ship.radius + .15, 'reaction fixture starts clear of the real ambient collider and margin');
  const context = { player: { x: h.x, y: h.y, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 120, distance: h.passDistance - 4,
    committed: [], candidate, reservedUntilDistance: candidate.endDistance };
  const r = finish(beginValidation(context, { geometry })); assert.equal(r.result.decision, 'reject'); assert.equal(r.result.reason, 'INSUFFICIENT_REACTION_DISTANCE'); rejections.push({ aperture, context, ...r });
}
function control(w, elapsed) { let tick = w ? Math.round((elapsed - w.context.elapsed) * 120) : 0;
  for (const run of w?.controls ?? []) { if (tick < run.ticks) return run.input; tick -= run.ticks; } return { x: 0, y: 0 }; }
for (const mode of ['baseline', 'isolated', 'mixed']) for (const history of ['neutral', 'top-right', 'horizontal', 'witness']) for (const seed of [0, 11, 42]) {
  const m = mode === 'baseline' ? new RuntimeGameModel() : new StructureVariantsGameModel('right', mode); m.ready(); m.start(seed);
  let events = 0; const audits = [], started = performance.now();
  for (let tick = 0; tick < 3600 && m.state === 'PLAYING'; tick++) {
    const axis = history === 'witness' ? control(m.field.certificate, m.elapsed) : history === 'top-right' ? { x: 1, y: 1 } : history === 'horizontal' ? { x: Math.floor(tick / 180) % 2 ? -1 : 1, y: 0 } : { x: 0, y: 0 };
    m.step(CONFIG.step, axis); assert.equal(m.field.fault, undefined);
    if (m.field.events.length !== events) { events = m.field.events.length; const w = m.field.lastOutcome?.witness;
      if (w) { const replay = finish(beginTrajectoryReplay(w.context, w.controls, mode === 'baseline' ? {} : { geometry })); assert.equal(replay.result.decision, 'accept'); assert.equal(replay.result.witness.hash, w.hash); audits.push(w); }
    }
  }
  if (history === 'witness') assert.equal(m.hitSerial, 0);
  for (const chunk of m.field.samples) assert.ok(chunk.propagations <= 3072 && chunk.queries <= 6144);
  runtime.push({ mode, history, seed, ms: performance.now() - started, elapsed: m.elapsed, distance: m.distance, hits: m.hitSerial, state: m.state,
    committed: m.field.committed, omitted: m.field.omitted, events: m.field.events, witnesses: audits, samples: m.field.samples, queries: m.collisionQueries ?? null });
  console.log(`${mode}/${history}/${seed}: ${m.field.committed} published, ${m.field.omitted} omitted, ${m.hitSerial} hits`); m.dispose();
}
const summary = { generatedAt: new Date().toISOString(), directAttempts: rows.length, directAccepted: witnesses.length,
  naturalRejections: rows.filter(r=>r.decision==='reject'), engineeredRejections: rejections.length, humanParticipants: 0,
  validationMs: stats(rows.map(r => r.ms)), chunks: stats(chunks.map(c => c.ms)), maxPropagations: Math.max(...rows.map(r => r.metrics.propagations)),
  maxQueries: Math.max(...rows.map(r => r.metrics.narrowQueries)), maxPlanningTicks: Math.max(...rows.map(r => r.metrics.planningTicks)),
  runtime: runtime.map(({ witnesses, samples, ...r }) => ({ ...r, witnessCount: witnesses.length })),
  method: '480 exact-root jobs: 2 modes ×2 speed bands ×8 seeds ×5 apertures ×3 incoming velocities. Five mixed ambient reaction negatives.36 actual-model30s histories with independent full replay of every accepted certificate. Omissions retained; no human preference inference.' };
await writeFile(join(output, 'variants-benchmark.json'), JSON.stringify(summary, null, 2) + '\n');
await writeFile(join(output, 'variants-witnesses.json'), JSON.stringify({ rows, witnesses, rejections, chunks, runtime }) + '\n');
console.log(JSON.stringify({ ...summary, runtime: summary.runtime.map(({ events, ...r }) => r) }, null, 2));
