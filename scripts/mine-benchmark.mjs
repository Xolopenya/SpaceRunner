import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/config.ts';
import { beginKnownFieldValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { MINE_GEOMETRY as geometry, mineTransaction, passTick } from '../src/experiments/moving-mine/source.ts';
import { MovingMineGameModel } from '../src/experiments/moving-mine/model.ts';
import { MixedFlowGameModel } from '../src/experiments/mixed-flow/model.ts';
import { MINE_CONFIGURATIONS } from '../src/experiments/moving-mine/settings.ts';
import { mineX, isMine } from '../src/experiments/moving-mine/motion.ts';
import { movingMineHit } from '../src/experiments/moving-mine/collision.ts';
import { stats } from './director-fields.mjs';

const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003C/final'); await mkdir(output, { recursive: true });
const witnesses = [], fixtures = [], runs = []; let audits = 0;
function finish(job) { const times = []; while (!job.getResult()) { const t = performance.now(); job.advance(); times.push(performance.now() - t); } return { result: job.getResult(), metrics: job.metrics, chunksMs: stats(times) }; }
function replay(w) { const start = performance.now(), r = finish(beginTrajectoryReplay(w.context, w.controls, { geometry }));
  assert.equal(r.result.decision, 'accept'); assert.equal(r.result.witness.hash, w.hash); audits++; return performance.now() - start; }
const baseRoot = () => ({ player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0 });
const descriptors = [
  ['straight-clear', { y: 3.2 }], ['lateral-avoidance', {}], ['near-boundary', { x: 5.8, y: 0 }],
  ['opposite-velocity', { x: 3, vx: -8 }], ['diagonal', { vx: 4, vy: 4 }], ['higher-speed', {}, 120],
  ['mine-before-ship', {}, 0, -240], ['mine-after-ship', {}, 0, 240],
];
for (const seed of [0,11,42]) for (const config of MINE_CONFIGURATIONS) for (const [name, player, elapsed = 0, phaseTicks = 0] of descriptors) {
  const root = { ...baseRoot(), elapsed, player: { ...baseRoot().player, ...player } };
  const speed = config.startsWith('slow') ? 1.5 : 2, crossingTick = passTick(root, 180), start = Math.max(0, crossingTick - Math.round(6 / speed * 120) + phaseTicks);
  const tx = mineTransaction(seed, 4, start, config), context = { ...root, candidate: tx, committed: [], reservedUntilDistance: tx.endDistance };
  const t = performance.now(), checked = finish(beginKnownFieldValidation(context, { geometry }));
  const row = { seed, config, name, ...checked, ms: performance.now() - t };
  if (checked.result.decision === 'accept') { row.replayMs = replay(checked.result.witness); witnesses.push(checked.result.witness); }
  fixtures.push(row);
  if (seed === 42 && name === 'lateral-avoidance') {
    const state = { ...root.player, elapsed: root.elapsed, distance: 0 }, p = new FlightPrediction();
    for (let tick = Math.round(elapsed * 120); tick < crossingTick - 2; tick++) p.step(state, { x: 0, y: 0 });
    const negative = { ...context, player: state, distance: state.distance, elapsed: state.elapsed };
    const checkedNegative = finish(beginKnownFieldValidation(negative, { geometry })); assert.equal(checkedNegative.result.decision, 'reject');
    assert.equal(checkedNegative.result.reason, 'INSUFFICIENT_REACTION_DISTANCE'); fixtures.push({ seed, config, name: 'insufficient-reaction', context: negative, ...checkedNegative });
  }
}
function input(m, history, tick) {
  if (history === 'witness') { let t = m.field.certificate ? Math.round((m.elapsed - m.field.certificate.context.elapsed) * 120) : 0;
    for (const r of m.field.certificate?.controls ?? []) { if (t < r.ticks) return r.input; t -= r.ticks; } return { x: 0, y: 0 }; }
  if (history === 'horizontal') return { x: Math.floor(tick / 180) % 2 ? -1 : 1, y: 0 };
  if (history === 'boundary') return { x: 1, y: 1 };
  if (history === 'touch') return { x: Math.sin(tick / 93) * .85, y: Math.cos(tick / 147) * .7 };
  return { x: 0, y: 0 };
}
for (const variant of ['baseline','mine']) for (const seed of [0,11,42]) for (const history of ['witness','neutral','horizontal','boundary','touch']) {
  const m = variant === 'mine' ? new MovingMineGameModel() : new MixedFlowGameModel(); m.ready(); m.start(seed);
  const publications = [], timings = [], poses = []; let previous, peakActive = 0;
  const start = performance.now();
  for (let tick = 0; tick < 16000 && m.distance < (history === 'witness' ? 3000 : 1200) && m.state === 'PLAYING'; tick++) {
    m.step(CONFIG.step, input(m, history, tick)); assert.equal(m.field.fault, undefined);
    const active = m.field.slots.filter(h => h.active); peakActive = Math.max(peakActive, active.length);
    assert.ok(active.filter(isMine).length <= 1);
    if (tick % 30 === 0) for (const h of active.filter(isMine)) poses.push({ tick: Math.round(m.elapsed * 120), distance: m.distance, id: h.planned.id, x: h.x, y: h.y, z: h.z });
    const o = m.field.lastOutcome;
    if (o && o !== previous) {
      previous = o; publications.push(o); assert.ok(o.metrics.searches <= 2 && o.metrics.replays <= 4 && o.metrics.planningTicks <= 144 && o.attempts.length <= 2);
      if (o.witness && variant === 'mine') { timings.push(replay(o.witness)); witnesses.push(o.witness); assert.equal(o.witness.context.distance, m.distance); }
    }
  }
  const mineProposals = publications.filter(o => o.section.encounter === 'moving-mine'), published = mineProposals.filter(o => o.transaction?.hazards.some(isMine));
  for (const s of m.field.samples) assert.ok(s.propagations <= 3072 && s.queries <= 6144);
  const row = { variant, seed, history, distance: m.distance, elapsed: m.elapsed, state: m.state, hull: m.hull, hits: m.hitSerial, peakActive, ms: performance.now() - start,
    scheduled: m.field.scheduled, committed: m.field.committed, omitted: m.field.omitted,
    mineProposals: mineProposals.length, minePublications: published.length, mineOmissions: mineProposals.length - published.length,
    firstMinePublicationDistance: published[0]?.witness.context.distance ?? null, firstMinePassDistance: published[0]?.transaction.hazards.find(isMine)?.passDistance ?? null,
    intervals: published.slice(1).map((o, i) => o.witness.context.elapsed - published[i].witness.context.elapsed),
    rejections: mineProposals.filter(o => !o.transaction?.hazards.some(isMine)).map(o => ({ reason: o.reason, attempts: o.attempts.map(a => a.reason) })),
    plannerMs: stats(m.field.samples.filter(s => s.propagations || s.queries).map(s => s.ms)), gateMs: stats(m.field.samples.filter(s => s.phase === 'actual-gate').map(s => s.ms)),
    replayMs: stats(timings), publications, poses };
  if (variant === 'mine' && history === 'witness') assert.ok(row.minePublications >= 4 && m.hull === 3);
  runs.push(row); m.dispose();
  console.log(`${variant}/${seed}/${history}: ${row.distance.toFixed(1)}m ${row.committed}/${row.scheduled} commits; mines ${row.minePublications}/${row.mineProposals}`);
}
const h = mineTransaction(42, 4, 0, 'slow-ltr').hazards.find(isMine), a = { x: 0, y: 0, vx: 0, vy: 0, elapsed: 3, distance: h.passDistance }, b = { ...a, elapsed: a.elapsed + CONFIG.step, distance: a.distance + 34 / 120 };
let accumulator = 0, start = performance.now(); for (let i = 0; i < 1000000; i++) accumulator += mineX(h, (i % h.motion.durationTicks) / 120);
const poseMs = performance.now() - start; start = performance.now(); for (let i = 0; i < 100000; i++) {
  a.x = (i % 240) / 20 - 6; b.x = a.x + .05; accumulator += +movingMineHit(a, b, h, .15);
}
const collisionMs = performance.now() - start;
const summary = { fixtures: fixtures.length, accepted: fixtures.filter(f => f.result.decision === 'accept').length,
  rejected: fixtures.filter(f => f.result.decision === 'reject').map(f => ({ name: f.name, seed: f.seed, config: f.config, reason: f.result.reason })), audits,
  micro: { evaluations: 1000000, poseTotalMs: poseMs, poseNs: poseMs * 1e6 / 1000000, queries: 100000, collisionTotalMs: collisionMs, collisionNs: collisionMs * 1e6 / 100000, accumulator },
  runs: runs.map(({ publications, poses, ...r }) => r), note: 'Normal hull/death preserved. Witness actors are conditional safety demonstrations; blind tapes measure availability without future inputs. No human acceptance.' };
await writeFile(join(output, 'mine-benchmark.json'), JSON.stringify(summary, null, 2) + '\n');
await writeFile(join(output, 'mine-witnesses.json'), JSON.stringify({ fixtures, runs, witnesses }) + '\n');
console.log(JSON.stringify({ fixtures: summary.fixtures, accepted: summary.accepted, audits, micro: summary.micro }));
