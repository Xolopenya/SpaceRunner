import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { APPROVED_SEEDS } from '../tests/fixtures/trajectory-corpus.ts';
import { PASSIVE_POLICIES, pressureInputs, pressureSimulation, checkActualModel } from '../tests/fixtures/pressure-simulation.ts';
import { stats } from './director-fields.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const smoke = process.argv.includes('--smoke');
const output = resolve(process.env.REVIEW_RESULT_DIR ?? `.cache/review/GAMEPLAY-EXPERIMENT-003A/${smoke ? 'smoke' : 'final'}`);
await mkdir(output, { recursive: true });
const rows = [], summaries = [];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const worker = process.argv.find(a => a.startsWith('--worker='));
const workers = 4, seconds = smoke ? 90 : 60;
if (!smoke && !worker) {
  // Independent benchmark processes only; CPU timing from this shared load is
  // labeled separately from isolated real-render performance samples.
  await Promise.all(Array.from({ length: workers }, (_, i) => new Promise((done, fail) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', fileURLToPath(import.meta.url), `--worker=${i}`], { env: process.env, windowsHide: true, stdio: 'inherit' });
    child.on('error', fail); child.on('exit', code => code === 0 ? done() : fail(new Error(`Pressure worker ${i} exit ${code}`)));
  })));
  for (let i = 0; i < workers; i++) { const shard = JSON.parse(await readFile(join(output, `pressure-shard-${i}.json`), 'utf8')); rows.push(...shard.rows); summaries.push(...shard.summaries); }
}
for (const late of smoke ? [false] : worker ? [false, true] : []) for (const seed of smoke ? [42] : (late ? [0, 42, 4294967295] : APPROVED_SEEDS).filter((_, i) => i % workers === Number(worker.split('=')[1]))) {
  for (const history of smoke ? ['neutral', 'top-right', 'irregular'] : PASSIVE_POLICIES) {
    const tape = pressureInputs(seed, history, seconds * 120), tapeHash = hash(tape);
    for (const policy of ['baseline', 'pressure']) {
      const r = pressureSimulation({ seed, history, policy, late, audit: true, tape, seconds });
      assert.ok(r.peakKnown <= 32 && r.peakOwnership <= 16);
      for (const d of r.decisions) {
        assert.ok(d.metrics.searches <= 2 && d.metrics.replays <= 4);
        assert.ok(d.metrics.planningTicks <= 144);
      }
      // Real GameModel validates damage/scoring/state ordering on all ordinary-start cases.
      if (!late) checkActualModel(r, tape);
      const row = { ...r, inputHash: tapeHash, geometryHash: hash(r.geometry), timings: undefined };
      const summary = { ...r, inputHash: tapeHash, geometryHash: row.geometryHash, inputRuns: undefined, trace: undefined,
        decisions: undefined, geometry: undefined, timings: undefined, depthGaps: undefined,
        scheduled: r.decisions.length, committed: r.decisions.filter(d => d.status === 'committed').length,
        proposed: r.decisions.reduce((n, d) => n + d.proposed.length, 0),
        proposedInWindow: r.decisions.flatMap(d => d.proposed).filter(h => h.passDistance >= r.initial.distance && h.passDistance < r.terminal.distance).length,
        units: r.decisions.reduce((n, d) => n + d.section.cellCount * 24, 0),
        work: stats(r.timings.filter(t => !['ready', 'failed', 'actual-gate'].includes(t.phase)).map(t => t.ms)),
        gate: stats(r.timings.filter(t => t.phase === 'actual-gate').map(t => t.ms)), gaps: stats(r.depthGaps) };
      rows.push({ policy: r.policy, band: r.band, decisions: r.decisions, depthGaps: r.depthGaps }); summaries.push(summary);
      await writeFile(join(output, `pressure-${late ? 'late' : 'early'}-${seed}-${history}-${policy}.json`), JSON.stringify({ ...row, timings: r.timings }) + '\n');
    }
  }
  console.log(`Paired ${late ? 'late' : 'early'} seed ${seed}: complete geometry/input clocks, independent audits, real-model early prefix.`);
}
if (worker) { await writeFile(join(output, `pressure-shard-${worker.split('=')[1]}.json`), JSON.stringify({ rows, summaries }) + '\n'); process.exit(0); }
const repeat = pressureSimulation({ seed: 42, history: 'irregular', policy: 'pressure', audit: true, seconds });
assert.equal(hash(repeat.geometry), summaries.find(r => r.seed === 42 && r.history === 'irregular' && r.policy.name === 'pressure' && r.band === 'early').geometryHash);
function aggregate(policy, band) {
  const selected = summaries.filter(r => r.policy.name === policy && (!band || r.band === band));
  const rs = rows.filter(r => r.policy.name === policy && (!band || r.band === band));
  const decisions = rs.flatMap(r => r.decisions), units = selected.reduce((n, r) => n + r.distance, 0);
  const reasons = {}, attemptReasons = {}, families = {};
  for (const d of decisions) {
    if (d.reason) reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
    for (const a of d.attempts) if (a.reason) attemptReasons[a.reason] = (attemptReasons[a.reason] ?? 0) + 1;
    const f = families[d.section.family] ??= { selected: 0, committed: 0, actualSources: {} }; f.selected++;
    if (d.status === 'committed') { f.committed++; const source = d.committed[0]?.provenance.pattern?.family ?? 'ambient'; f.actualSources[source] = (f.actualSources[source] ?? 0) + 1; }
  }
  const scheduledUnits = selected.reduce((n, r) => n + r.units, 0), seconds = selected.reduce((n, r) => n + r.seconds, 0);
  return { policy, band: band ?? 'both', runs: selected.length, units, scheduledUnits,
    proposedPer100: selected.reduce((n, r) => n + r.proposedInWindow, 0) * 100 / units,
    acceptedPer100: selected.reduce((n, r) => n + r.publishedInWindow, 0) * 100 / units,
    proposedPer100Scheduled: selected.reduce((n, r) => n + r.proposed, 0) * 100 / scheduledUnits,
    acceptedPer100Scheduled: decisions.reduce((n, d) => n + d.committed.length, 0) * 100 / scheduledUnits,
    scheduled: decisions.length, committed: selected.reduce((n, r) => n + r.committed, 0), reasons, attemptReasons, families,
    gaps: stats(rs.flatMap(r => r.depthGaps)), nearbyFreeFraction: selected.reduce((n, r) => n + r.nearbyFreeSeconds, 0) / seconds,
    axialFreeFraction: selected.reduce((n, r) => n + r.axialFreeSeconds, 0) / seconds,
    longestNearbyFreeSeconds: Math.max(...selected.map(r => r.maxNearbyFreeSeconds)),
    threats: selected.reduce((n, r) => n + r.threats, 0), contacts: selected.reduce((n, r) => n + r.uniqueContacts, 0),
    contactFree: selected.filter(r => r.firstContact === undefined).length, survivedWindow: selected.filter(r => !r.death).length,
    firstThreat: stats(selected.map(r => r.firstThreat).filter(Number.isFinite)), firstContact: stats(selected.map(r => r.firstContact).filter(Number.isFinite)),
    audits: selected.reduce((n, r) => n + r.audits, 0), auditQueries: selected.reduce((n, r) => n + r.auditQueries, 0),
    peakKnown: Math.max(...selected.map(r => r.peakKnown)), peakOwnership: Math.max(...selected.map(r => r.peakOwnership)),
    survivalSeconds: stats(selected.map(r => r.survival.seconds)), survivalDistance: stats(selected.map(r => r.survival.distance)) };
}
const aggregates = ['baseline', 'pressure'].flatMap(p => [undefined, 'early', 'late'].filter(b => !smoke || b !== 'late').map(b => aggregate(p, b)));
const result = { baseline: '928b88a2cc266f5086711da5b4e9f3424b01620d', generatedAt: new Date().toISOString(), node: process.version,
  seconds, workers: smoke ? 1 : workers,
  methodology: 'Matched fixed-duration 120Hz input tapes from identical XY/velocity/clocks. Full:60s,16 early seeds and3 late seeds. Smoke:90s/seed42. Late is an explicit 5280-unit/180s warm start. Actors continue after real three-hit death for publication research; survival ends at death. Early damage prefixes are differentially checked against real GameModel. Density uses actual committed centers in identical spatial windows, including empty/omitted spans. Gaps include window edges. A threat is a distinct published hazard hit by a 1.5s zero-steering continuation checked every 0.1s using actual dynamics and calibrated CCD; this proxy does not prove a human maneuver was necessary. Depth proximity and Euclidean proximity use 10+radius and actual publication times. Parallel logical CPU timings are contended; isolated real-render timing is separate.',
  seeds: smoke ? [42] : APPROVED_SEEDS, histories: smoke ? ['neutral', 'top-right', 'irregular'] : PASSIVE_POLICIES,
  aggregates, byHistory: PASSIVE_POLICIES.map(history => ({ history, results: summaries.filter(r => r.history === history) })),
  audits: aggregates.filter(r => r.band === 'both').reduce((n, r) => n + r.audits, 0), violations: 0,
  repeat: { seed: 42, history: 'irregular', policy: 'pressure-v1', geometryHash: hash(repeat.geometry), identical: true },
  humanParticipants: 0, summaries };
await writeFile(join(output, 'pressure-metrics.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ aggregates, audits: result.audits, violations: 0 }, null, 2));
