import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { StructureVariantsGameModel } from '../src/experiments/structure-variants/model.ts';
import { WRECK_GEOMETRY } from '../src/experiments/structure-variants/encounter.ts';
import { WreckPrediction, isWreck, APERTURE_NAMES } from '../src/experiments/structure-variants/profile.ts';
import { MixedFlowGameModel } from '../src/experiments/mixed-flow/model.ts';
import { FLOW_GEOMETRY } from '../src/experiments/mixed-flow/source.ts';
import { RuntimePlanningSession } from '../src/core/field-runtime-session.ts';
import { beginValidation, beginKnownFieldValidation, beginTrajectoryReplay, beginRuntimePublicationCheck } from '../src/core/field-validator.ts';
import { flowInputs, FLOW_HISTORIES } from '../tests/fixtures/mixed-flow-inputs.ts';
import { classifyFlowPublication } from '../tests/fixtures/mixed-flow-diagnostics.ts';
import { stats } from './director-fields.mjs';

const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003B3/final'); await mkdir(output, { recursive: true });
const observations = new WeakMap(), original = RuntimePlanningSession.prototype.advance;
// Offline instrumentation only. The playable modules retain their normal API.
RuntimePlanningSession.prototype.advance = function (root, known, tick, ...rest) {
  const w = this.preparedWitness, result = original.call(this, root, known, tick, ...rest);
  if (result) {
    const transaction = result.attempts.at(-1)?.transaction;
    observations.set(result, { context: transaction ? { player: { ...root.player }, input: { ...root.input }, elapsed: root.elapsed, distance: root.distance,
      committed: known, candidate: transaction, reservedUntilDistance: transaction.endDistance } : undefined, witness: w });
  }
  return result;
};
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function finish(job) { while (!job.getResult()) job.advance(); return job.getResult(); }
function control(w, elapsed) { let tick = w ? Math.round((elapsed - w.context.elapsed) * 120) : 0;
  for (const r of w?.controls ?? []) { if (tick < r.ticks) return r.input; tick -= r.ticks; } return { x: 0, y: 0 }; }
const make = variant => variant === 'A' ? new StructureVariantsGameModel('right', 'mixed') : new MixedFlowGameModel();
const geometryFor = variant => variant === 'A' ? WRECK_GEOMETRY : FLOW_GEOMETRY;
function reactionCollision(c) {
  const state = { ...c.player, elapsed: c.elapsed, distance: c.distance }, prediction = new WreckPrediction();
  for (let tick = 1; tick <= 54; tick++) { const previous = { ...state }; prediction.step(state, c.input);
    for (const h of [...c.committed, ...c.candidate.hazards]) if (prediction.hit(previous, state, h, .15)) return { id: h.id, profile: h.collisionProfile, tick, previous, next: { ...state } }; }
  return undefined;
}
const results = [], evidence = [], counterfactuals = []; let auditCount = 0, auditQueries = 0;
function audit(w, geometry) { const job = beginTrajectoryReplay(w.context, w.controls, { geometry }), r = finish(job);
  assert.equal(r.decision, 'accept'); assert.equal(r.witness.hash, w.hash); auditCount++; auditQueries += job.metrics.narrowQueries; }

function run(seed, history, variant, witnessDriver = false) {
  const m = make(variant), actual = make(variant), geometry = geometryFor(variant), tape = witnessDriver ? [] : flowInputs(seed, history, 24000);
  m.ready(); actual.ready(); m.start(seed); actual.start(seed); m.hull = 1e9;
  const outcomes = [], publications = [], witnesses = [], trace = [], chunks = [], threats = new Set();
  let last, lastTicks = 0, peakActive = 0, peakKnown = 0, peakRecords = 0, peakPrimitives = 0, firstDeath, actualResult;
  let emptyTicks = 0, emptyStart, longestEmpty = 0, longestEmptyDistance = 0, xTravel = 0, yTravel = 0, inputChanges = 0, previousInput = { x: 0, y: 0 };
  const predictor = new WreckPrediction();
  for (let tick = 0; tick < 24000 && m.distance < 3300; tick++) {
    const input = witnessDriver ? control(m.field.certificate, m.elapsed) : tape[tick], before = { ...m.ship };
    if (input.x !== previousInput.x || input.y !== previousInput.y) inputChanges++; previousInput = input;
    m.step(1 / 120, input); if (actual.state === 'PLAYING') {
      actual.step(1 / 120, input);
      if (tick % 120 === 0 || actual.state === 'GAME_OVER') {
        assert.deepEqual(actual.ship, m.ship); assert.equal(actual.hitSerial, m.hitSerial); assert.equal(actual.distance, m.distance);
        assert.deepEqual(actual.field.events, m.field.events); assert.equal(actual.field.certificate?.hash, m.field.certificate?.hash);
      }
      if (actual.state === 'GAME_OVER') { firstDeath = m.distance; actualResult = snapshot(actual); }
    }
    xTravel += Math.abs(m.ship.x - before.x); yTravel += Math.abs(m.ship.y - before.y);
    assert.equal(m.field.fault, undefined);
    const known = m.field.ledger.knownHazards(m.distance), pending = m.field.ledger.snapshot().filter(r => r.state === 'pending').flatMap(r => r.hazards);
    const active = m.field.slots.filter(h => h.active), primitives = [...known, ...pending].reduce((n, h) => n + (isWreck(h) ? 4 : 1), 0);
    assert.ok(primitives <= 32); peakPrimitives = Math.max(peakPrimitives, primitives); peakKnown = Math.max(peakKnown, known.length);
    peakActive = Math.max(peakActive, active.length); peakRecords = Math.max(peakRecords, m.field.ledger.snapshot().length);
    const nearby = active.some(h => { const q = h.planned.passDistance - m.distance; return q >= -8 && q <= 10 + h.radius && Math.hypot(h.x - m.ship.x, h.y - m.ship.y, q) <= 10 + h.radius; });
    if (!nearby) { emptyTicks++; emptyStart ??= { elapsed: m.elapsed, distance: m.distance }; }
    else if (emptyStart) { longestEmpty = Math.max(longestEmpty, m.elapsed - emptyStart.elapsed); longestEmptyDistance = Math.max(longestEmptyDistance, m.distance - emptyStart.distance); emptyStart = undefined; }
    if (tick % 120 === 0) {
      const state = { ...m.ship, elapsed: m.elapsed, distance: m.distance }, hazards = active.map(h => h.planned);
      for (let k = 0; k < 120; k++) { const previous = { ...state }; predictor.step(state, { x: 0, y: 0 });
        for (const h of hazards) if (predictor.hitGameplay(previous, state, h)) threats.add(h.id); }
    }
    if (tick % 24 === 0) trace.push({ tick, elapsed: m.elapsed, distance: m.distance, ...m.ship, input, active: active.length, ordinary: active.filter(h => !isWreck(h)).length,
      structures: active.filter(isWreck).length, known: known.length, pending: pending.length, primitives, hullHits: m.hitSerial, scheduled: m.field.scheduled, committed: m.field.committed, omitted: m.field.omitted });
    if (m.field.planningTicks !== lastTicks) { lastTicks = m.field.planningTicks; const s = { ...m.field.samples.at(-1), tick }; chunks.push(s); assert.ok(s.propagations <= 3072 && s.queries <= 6144); }
    const o = m.field.lastOutcome;
    if (o && o !== last) {
      last = o; assert.ok(o.metrics.searches <= 2 && o.metrics.replays <= 4 && o.metrics.planningTicks <= 144 && o.attempts.length <= 2);
      const observation = observations.get(o); outcomes.push({ ...o, actualDecision: observation });
      if (o.witness) { audit(o.witness, geometry); witnesses.push(o.witness); for (const h of o.transaction.hazards) publications.push({ ...h, birthDistance: m.distance, birthElapsed: m.elapsed }); }
    }
  }
  if (emptyStart) { longestEmpty = Math.max(longestEmpty, m.elapsed - emptyStart.elapsed); longestEmptyDistance = Math.max(longestEmptyDistance, m.distance - emptyStart.distance); }
  actualResult ??= snapshot(actual);
  if (witnessDriver) { assert.equal(m.hitSerial, 0); assert.equal(actualResult.state, 'PLAYING'); }
  const inside = publications.filter(h => h.passDistance < 3300), ordinary = inside.filter(h => !isWreck(h)), structures = inside.filter(isWreck);
  const positions = [0, ...inside.map(h => h.passDistance).sort((a, b) => a - b), 3300], gaps = positions.slice(1).map((x, i) => x - positions[i]);
  let streak = 0, maximumStreak = 0; for (const o of outcomes) { streak = o.status === 'committed' ? 0 : streak + 1; maximumStreak = Math.max(maximumStreak, streak); }
  const reasons = {}, families = {}, apertures = {}; for (const o of outcomes) {
    if (o.reason) reasons[o.reason] = (reasons[o.reason] ?? 0) + 1;
    if (o.status === 'committed' && o.transaction) { const frame = o.transaction.hazards.find(isWreck), family = frame ? 'station-wreck' : o.transaction.provenance.pattern?.family ?? 'ambient'; families[family] = (families[family] ?? 0) + 1;
      if (frame) { const aperture = APERTURE_NAMES[frame.kind - 4]; apertures[aperture] = (apertures[aperture] ?? 0) + 1; } }
  }
  const identity = hash({ outcomes: outcomes.map(o => ({ status: o.status, reason: o.reason, section: o.section, transaction: o.transaction, hash: o.witness?.hash })), actual: actualResult, publications, trace });
  const row = { seed, history: witnessDriver ? 'witness-supplement' : history, variant, actual: actualResult,
    diagnostic: { label: 'Immortal offline continuation to3300m; normal actual-model prefix checked until three-hit death', distance: m.distance, elapsed: m.elapsed, hits: m.hitSerial,
      completed: outcomes.length, scheduled: m.field.scheduled, committed: m.field.committed, omitted: m.field.omitted, acceptance: m.field.committed / outcomes.length,
      objects: inside.length, ordinary: ordinary.length, structures: structures.length, ordinaryPer100: ordinary.length / 33, structuresPer1000: structures.length / 3.3,
      depthGaps: stats(gaps), maxConsecutiveOmissions: maximumStreak, nearbyFreeSeconds: emptyTicks / 120, nearbyFreeFraction: emptyTicks / 120 / m.elapsed,
      longestNearbyFreeSeconds: longestEmpty, longestNearbyFreeDistance: longestEmptyDistance, neutralContinuationThreats: threats.size, inputChanges, xTravel, yTravel,
      families, apertures, reasons, peakActive, peakKnown, peakRecords, peakPrimitives,
      validatorPropagations: outcomes.reduce((n, o) => n + o.metrics.propagations, 0), validatorQueries: outcomes.reduce((n, o) => n + o.metrics.narrowQueries, 0), gameplayProfileUnits: m.collisionQueries },
    timing: stats(chunks.filter(c => c.phase !== 'ready').map(c => c.ms)), identity };
  console.log(`${variant}/${seed}/${row.history}: actual ${actualResult.distance.toFixed(1)}m/${actualResult.hits}hits; diagnostic ${m.field.committed}/${outcomes.length}, ${ordinary.length} ordinary/${structures.length} wrecks, max omission streak ${maximumStreak}`);
  const detail = { ...row, outcomes, publications, witnesses, trace, chunks, inputs: witnessDriver ? 'Causal published-certificate follower; supplement only' : tape.slice(0, Math.ceil(m.elapsed * 120)) };
  m.dispose(); actual.dispose(); return detail;
}
function snapshot(m) { return { state: m.state, distance: m.distance, elapsed: m.elapsed, hits: m.hitSerial, hull: m.hull,
  scheduled: m.field.scheduled, committed: m.field.committed, omitted: m.field.omitted, events: [...m.field.events] }; }

function aggregate(variant) {
  const rs = evidence.filter(r => r.variant === variant && r.history !== 'witness-supplement'), sum = key => rs.reduce((n, r) => n + r.diagnostic[key], 0);
  const gaps = rs.flatMap(r => { const q = [0, ...r.publications.filter(h => h.passDistance < 3300).map(h => h.passDistance).sort((a, b) => a - b), 3300]; return q.slice(1).map((v, i) => v - q[i]); });
  const families = {}, apertures = {}; for (const r of rs) { for (const [k, v] of Object.entries(r.diagnostic.families)) families[k] = (families[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.diagnostic.apertures)) apertures[k] = (apertures[k] ?? 0) + v; }
  const windows = paired.map(p => p[variant]), actualDistance = paired.reduce((n, p) => n + p.commonActualDistance, 0);
  return { runs: rs.length, diagnosticDistance: rs.length * 3300, completed: sum('completed'), committed: sum('committed'), omitted: sum('omitted'), acceptance: sum('committed') / sum('completed'),
    ordinary: sum('ordinary'), structures: sum('structures'), ordinaryPer100: sum('ordinary') * 100 / (rs.length * 3300), structuresPer1000: sum('structures') * 1000 / (rs.length * 3300),
    depthGaps: stats(gaps), maximumConsecutiveOmissions: Math.max(...rs.map(r => r.diagnostic.maxConsecutiveOmissions)),
    nearbyFreeFraction: sum('nearbyFreeSeconds') / rs.reduce((n, r) => n + r.diagnostic.elapsed, 0),
    meanNearbyFreeFraction: sum('nearbyFreeFraction') / rs.length, maximumNearbyFreeSeconds: Math.max(...rs.map(r => r.diagnostic.longestNearbyFreeSeconds)),
    minimumStructuresPerWindow: Math.min(...rs.map(r => r.diagnostic.structures)), families, apertures,
    actualCommonDistance: actualDistance, actualCommonOrdinaryPer100: windows.reduce((n, p) => n + p.ordinary, 0) * 100 / actualDistance,
    actualCommonObjectsPer100: windows.reduce((n, p) => n + p.objects, 0) * 100 / actualDistance,
    actualSurvivors3300m: rs.filter(r => r.actual.state === 'PLAYING').length, peakPrimitives: Math.max(...rs.map(r => r.diagnostic.peakPrimitives)) };
}

for (const seed of [0, 11, 42]) for (const history of FLOW_HISTORIES) for (const variant of ['A', 'B']) {
  const r = run(seed, history, variant); evidence.push(r); const { outcomes, publications, witnesses, trace, chunks, inputs, ...row } = r; results.push(row);
}
for (const seed of [0, 11, 42]) for (const variant of ['A', 'B']) { const r = run(seed, 'neutral', variant, true); evidence.push(r); const { outcomes, publications, witnesses, trace, chunks, inputs, ...row } = r; results.push(row); }
const repeated = run(42, 'keyboard', 'B'); assert.equal(repeated.identity, evidence.find(r => r.seed === 42 && r.history === 'keyboard' && r.variant === 'B').identity);

for (const run of evidence) for (const o of run.outcomes) {
  const candidates = o.publicationChecks?.filter(p => p.result.decision !== 'accept') ?? [];
  if (o.status !== 'committed' && o.actualDecision?.context && !candidates.length) candidates.push({ ...o.actualDecision });
  for (const p of candidates) {
    const geometry = geometryFor(run.variant), oldJob = p.witness ? beginRuntimePublicationCheck(p.witness, p.context, { geometry }) : undefined;
    const old = oldJob ? finish(oldJob) : { decision: 'unavailable', reason: 'NO_PREPARED_WITNESS' };
    if (old.decision === 'accept') audit(old.witness, geometry);
    const freshJob = (run.variant === 'A' ? beginValidation : beginKnownFieldValidation)(p.context, { geometry }), fresh = finish(freshJob);
    if (fresh.decision === 'accept') audit(fresh.witness, geometry);
    const prefixCollision = reactionCollision(p.context);
    const classification = classifyFlowPublication(old, fresh, !!prefixCollision);
    counterfactuals.push({ seed: run.seed, history: run.history, variant: run.variant, section: o.section, context: p.context, failedWitness: p.witness, old, fresh,
      metrics: { old: oldJob?.metrics, fresh: freshJob.metrics }, prefixCollision, classification });
  }
}
const paired = [];
for (const seed of [0, 11, 42]) for (const history of FLOW_HISTORIES) {
  const a = evidence.find(r => r.seed === seed && r.history === history && r.variant === 'A'), b = evidence.find(r => r.seed === seed && r.history === history && r.variant === 'B');
  const distance = Math.min(a.actual.distance, b.actual.distance), counts = r => { const hs = r.publications.filter(h => h.passDistance < distance && h.birthDistance <= distance); return { objects: hs.length, ordinary: hs.filter(h => !isWreck(h)).length, structures: hs.filter(isWreck).length, objectsPer100: hs.length * 100 / distance }; };
  paired.push({ seed, history, commonActualDistance: distance, A: counts(a), B: counts(b) });
}
const summary = { generatedAt: new Date().toISOString(), baseline: 'a617f59044ba234de173cf28e56aad9a5ec8f2c5',
  historicalOwnerObservation: { distance: 3272, scheduled: 23, committed: 5, omitted: 18, maxConsecutiveOmitted: 8, emptyFrom: 1585, emptyTo: 2598, inputTape: 'Not supplied; retained as owner observation, not fabricated exact replay.' },
  seeds: [0, 11, 42], histories: FLOW_HISTORIES, runs: results, pairedActualWindows: paired, aggregates: { A: aggregate('A'), B: aggregate('B') }, audits: auditCount, auditQueries, violations: 0,
  counterfactuals: { total: counterfactuals.length, classifications: Object.fromEntries([...new Set(counterfactuals.map(r => r.classification))].map(c => [c, counterfactuals.filter(r => r.classification === c).length])) },
  reproducibilityRepeat: { seed: 42, history: 'keyboard', variant: 'B', identity: repeated.identity }, humanParticipants: 0, physicalDevices: 0,
  method: '84 prerecorded-input paired runs plus6 causal-witness supplements. Each immortal research model is differentially checked against a normal three-hull GameModel until actual death. Complete3300m windows are explicitly offline continuation, never claimed as actual survival. All accepted witnesses receive full independent unpruned replay. Threat proxy:1s neutral continuation sampled each1s over currently active known objects; not proved forced human maneuvers. Node timings include instrumentation and are not rendered performance.' };
await writeFile(join(output, 'flow-benchmark.json'), JSON.stringify(summary, null, 2) + '\n');
await writeFile(join(output, 'flow-witnesses.json'), JSON.stringify({ runs: evidence, counterfactuals, repeat: repeated }) + '\n');
console.log(JSON.stringify({ runs: results.length, audits: auditCount, auditQueries, counterfactuals: summary.counterfactuals }, null, 2));
