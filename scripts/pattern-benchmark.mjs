import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { PatternGenerator } from '../src/core/field-patterns.ts';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { PATTERN_FAMILIES } from '../src/core/field-pattern-source.ts';
import { beginValidation, beginTrajectoryReplay, beginPublicationCheck } from '../src/core/field-validator.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { APPROVED_SEEDS } from '../tests/fixtures/trajectory-corpus.ts';
import { libraryCase, jointCase, JOINT_CASES } from '../tests/fixtures/pattern-corpus.ts';
import { knownControls } from '../tests/fixtures/trajectory-fixtures.ts';
import { approvedResearch, APPROVED_B2 } from './pattern-baselines.mjs';
import { analyzeWitness, complete, existingFieldProbe, intendedManeuver } from './pattern-analysis.mjs';
import { patternPlots } from './pattern-plots.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-001B-3/final');
const sha = b => createHash('sha256').update(b).digest('hex');
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, min: sorted[0] ?? null, p50: sorted[Math.floor((sorted.length - 1) * .5)] ?? null,
    p95: sorted[Math.floor((sorted.length - 1) * .95)] ?? null, max: sorted.at(-1) ?? null,
    mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null };
};
if (process.argv.includes('--memory-child')) {
  assert.equal(typeof global.gc, 'function');
  const c = libraryCase(42, 'narrowing', .8, 0, 'neutral').context;
  for (let i = 0; i < 5; i++) complete(beginValidation(c));
  global.gc(); const baseline = process.memoryUsage(), generator = new PatternGenerator(42), snapshots = [];
  for (let i = 0; i < 10000; i++) { generator.reset(i); generator.propose({ family: PATTERN_FAMILIES[i % 4], firstCell: 4, intensity: .8 }); }
  global.gc(); const afterGeneration = process.memoryUsage();
  const active = Array.from({ length: 5 }, () => beginValidation(c));
  for (const job of active) for (let i = 0; i < 12 && !job.getResult(); i++) job.advance();
  global.gc(); const activeUsage = process.memoryUsage();
  for (const job of active) complete(job); active.length = 0;
  for (let batch = 0; batch < 4; batch++) {
    for (let i = 0; i < 10; i++) complete(beginValidation(c));
    global.gc(); snapshots.push({ jobs: (batch + 1) * 10, ...process.memoryUsage() });
  }
  const retained = snapshots.at(-1).heapUsed + snapshots.at(-1).arrayBuffers - baseline.heapUsed - baseline.arrayBuffers;
  assert.ok(retained < 8 * 1024 * 1024, 'Finite retained-memory guard8MiB exceeded');
  console.log(JSON.stringify({ baseline, afterGeneration, activeUsage, snapshots, retainedGrowthBytes: retained,
    estimatedActiveJobBytes: (activeUsage.heapUsed + activeUsage.arrayBuffers - afterGeneration.heapUsed - afterGeneration.arrayBuffers) / 5,
    method: 'Fresh --expose-gc child.5 warmups,10000 proposal/reset calls,5 active jobs,40 completed jobs with GC every10. Heap+ArrayBuffers estimate excludes double-counted external; JIT/GC noise means no exact512KiB or indefinite-leak proof.' }));
  process.exit(0);
}
await mkdir(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const protectedInputs = [];
const allowed = new Set(['src/core/field-generator.ts', 'src/core/field-types.ts', 'src/core/field-validator.ts']);
const paths = git('ls-tree', '-r', '--name-only', APPROVED_B2, '--', 'src', 'public', 'tests', 'design', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts').toString().trim().split('\n');
for (const path of paths) {
  const before = git('show', `${APPROVED_B2}:${path}`), after = await readFile(path);
  if (!allowed.has(path)) assert.ok(before.includes(0) ? before.equals(after) : before.toString().replaceAll('\r\n', '\n') === after.toString().replaceAll('\r\n', '\n'), `Protected input changed: ${path}`);
  protectedInputs.push({ path, approvedSha256: sha(before), policy: allowed.has(path) ? 'explicit isolated schema adaptation; tests and section guards apply' : 'unchanged after optional checkout newline normalization' });
}
for (const [path, from, to] of [['src/core/field-generator.ts', '  propose(', '  /** Structural admission'],
  ['src/core/field-validator.ts', 'function prepare(', 'function* validation('], ['src/core/field-validator.ts', 'export class ValidationJob', null]]) {
  const before = git('show', `${APPROVED_B2}:${path}`).toString().replaceAll('\r\n', '\n'), after = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
  const section = source => source.slice(source.indexOf(from), to ? source.indexOf(to) : undefined);
  assert.equal(section(after), section(before), `Approved algorithm section changed: ${path}/${from}`);
}
async function boundary(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory()) await boundary(join(path, item.name));
    else if (!/^field-/.test(item.name)) assert.ok(!/field-(?:patterns|pattern-source|generator|validator|prediction|clearance|types|settings)/.test(await readFile(join(path, item.name), 'utf8')), `Live integration: ${path}/${item.name}`);
  }
}
await boundary('src');
const samples = [], chunks = [], examples = {}, failures = {}, knownMisses = [], proposals = new Map();
function record(input, labels) {
  const index = samples.length, prep = performance.now(), value = input(), prepareMs = performance.now() - prep;
  const c = value.context, tx = c?.candidate ?? value.proposal.transaction;
  const row = { index, ...labels, prepareMs, generationStatus: value.proposal.status, generationReason: value.proposal.reason,
    candidateCount: tx?.hazards.length ?? 0, transactionUnits: tx ? tx.endDistance - tx.startDistance : 0 };
  if (tx) { row.candidateHash = sha(JSON.stringify(tx)); proposals.set(row.candidateHash, tx); }
  if (!c || value.proposal.status !== 'proposed') { row.decision = 'not-run'; row.structuralReason = value.proposal.structure?.reason ?? value.proposal.reason; samples.push(row); return; }
  row.context = c;
  const inspector = new FieldGenerator(tx.provenance.seed), structure = inspector.inspect(tx, c.committed);
  row.structure = structure;
  if (structure.status !== 'valid') { row.decision = 'not-run'; row.structuralReason = structure.reason; samples.push(row); return; }
  const beginStart = performance.now(), job = beginValidation(c); row.beginMs = performance.now() - beginStart;
  while (!job.getResult()) {
    const before = job.metrics, start = performance.now(); job.advance(); const after = job.metrics;
    chunks.push({ sample: index, tick: after.planningTicks, ms: performance.now() - start,
      propagations: after.propagations - before.propagations, narrowQueries: after.narrowQueries - before.narrowQueries });
  }
  row.validationMs = performance.now() - beginStart; row.metrics = job.metrics;
  const result = job.getResult(); row.decision = result.decision; row.reason = result.reason; row.detail = result.detail;
  assert.ok(job.metrics.planningTicks <= 144 && job.metrics.peakFrontier <= 16 && job.metrics.peakExpansion <= 144);
  if (result.decision === 'accept') {
    assert.equal(result.witness.structuralPolicy, 'generator');
    const replayStart = performance.now(), replayResult = complete(beginTrajectoryReplay(result.witness.context, result.witness.controls));
    row.replayMs = performance.now() - replayStart; assert.equal(replayResult.decision, 'accept');
    assert.equal(replayResult.witness.hash, result.witness.hash); row.witnessHash = result.witness.hash;
    const analysis = analyzeWitness(result.witness); row.motion = analysis.stats;
    assert.ok(analysis.stats.extraRadiusClearance >= .15, 'Accepted trace violates margin');
    if (labels.phase === 'library' && labels.root === 'neutral') {
      const previous = examples[labels.family];
      const quality = labels.family === 'vertical-weave' ? (analysis.stats.noYDecision === 'reject' ? 100 : 0) + analysis.stats.yTravel
        : labels.family === 'alternating' ? analysis.stats.xReversals * 100 + analysis.stats.xTravel : analysis.stats.path;
      if (!previous || quality > previous.quality) examples[labels.family] = { ...labels, context: c, result, trace: analysis.points, motion: analysis.stats, quality };
    }
    if (labels.seed === 42 && labels.phase === 'library' && labels.root === 'neutral' && labels.variation === 0 && labels.intensity === .8) {
      const laterState = { ...c.player, elapsed: c.elapsed, distance: c.distance }, predictor = new FlightPrediction();
      for (let i = 0; i < 24; i++) predictor.step(laterState, c.input);
      row.publication = complete(beginPublicationCheck(result.witness, { ...c, elapsed: laterState.elapsed, distance: laterState.distance,
        player: { x: laterState.x, y: laterState.y, vx: laterState.vx, vy: laterState.vy } }));
    }
  } else {
    if (result.reason === 'EXISTING_FIELD_UNCERTIFIED') row.existingFieldProbe = existingFieldProbe(c);
    if (!failures[labels.family ?? labels.phase]) failures[labels.family ?? labels.phase] = { ...labels, context: c, result };
    if (result.reason === 'NO_WITNESS_FOUND') {
      for (const input of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
        const controls = knownControls(c, [{ ticks: 120, input }]);
        const checked = complete(beginTrajectoryReplay(c, controls));
        if (checked.decision === 'accept') { row.knownSafeTraceMissed = true; knownMisses.push({ ...labels, context: c, search: result, replay: checked }); break; }
      }
    }
  }
  samples.push(row);
}
for (const family of PATTERN_FAMILIES) {
  for (const seed of APPROVED_SEEDS) for (const intensity of [.2, .8]) for (const variation of [0, 1]) for (const kind of ['neutral', 'horizontal', 'vertical']) {
    record(() => libraryCase(seed, family, intensity, variation, kind), { phase: 'library', family, seed, intensity, variation, root: kind });
  }
  console.log(`Measured ${family}: ${samples.filter(s => s.family === family).length} library attempts`);
}
for (const family of PATTERN_FAMILIES) for (const seed of APPROVED_SEEDS) {
  for (const intensity of [.2, .8]) record(() => libraryCase(seed, family, intensity, 0, 'global-neutral'), { phase: 'global-neutral', family, seed, intensity, variation: 0, root: 'global-neutral' });
  record(() => libraryCase(seed, family, .8, 0, 'late'), { phase: 'late', family, seed, intensity: .8, variation: 0, root: 'late' });
}
for (const type of JOINT_CASES) for (const seed of APPROVED_SEEDS) for (const intensity of [.2, .8]) {
  record(() => jointCase(seed, type, intensity), { phase: 'joint', transition: type, seed, intensity, variation: 0 });
}
for (const family of PATTERN_FAMILIES) for (const intensity of [-.1, 1.1]) {
  record(() => ({ proposal: new PatternGenerator(42).propose({ family, firstCell: 4, intensity }) }), { phase: 'invalid-request', family, seed: 42, intensity, variation: 0 });
}
// Repeating an actual request after the complete corpus must preserve proposal identity.
for (const family of PATTERN_FAMILIES) {
  const p = new PatternGenerator(42), a = p.propose({ family, firstCell: 4, intensity: .8 });
  p.propose({ family: 'scattered', firstCell: 1000, intensity: .2 }); p.reset(42);
  assert.deepEqual(p.propose({ family, firstCell: 4, intensity: .8 }), a);
}
// Supplemental intended maneuvers are deliberately authored diagnostics, NOT
// search successes and NOT replacements for any rejected corpus attempt.
const intendedExamples = {};
for (const family of ['alternating', 'vertical-weave']) {
  const proposal = new PatternGenerator(42).propose({ family, firstCell: 4, intensity: .8, variation: 0,
    mirrorX: false, mirrorY: false, offsetX: 0, offsetY: 0 });
  assert.equal(proposal.status, 'proposed');
  const context = { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 120, distance: 32,
    candidate: proposal.transaction, committed: [] };
  const maneuver = intendedManeuver(context);
  assert.equal(maneuver.result.decision, 'accept'); assert.equal(maneuver.result.witness.structuralPolicy, 'generator');
  assert.equal(complete(beginTrajectoryReplay(context, maneuver.result.witness.controls)).decision, 'accept');
  assert.ok(maneuver.stats[family === 'alternating' ? 'xReversals' : 'yReversals'] >= 2);
  if (family === 'vertical-weave') assert.equal(maneuver.stats.noYReason, 'COLLISION_FOUND');
  intendedExamples[family] = { family, seed: 42, intensity: .8, variation: 0, context, result: maneuver.result,
    trace: maneuver.points, motion: maneuver.stats, origin: 'Authored diagnostic steering; normal independent replay, not beam search' };
}
const memory = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--experimental-strip-types', fileURLToPath(import.meta.url), '--memory-child'], { encoding: 'utf8', windowsHide: true }));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
let browser, browserResult, plotFiles;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:5189/tests/browser/trajectory-harness.html')).ok) { ready = true; break; } } catch { /* bounded local startup */ }
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(ready, 'Pattern harness server did not start'); browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const page = await browser.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
  await page.goto('http://127.0.0.1:5189/tests/browser/trajectory-harness.html');
  const inputs = samples.filter(s => s.phase === 'library' && s.root === 'neutral' && s.variation === 0 && s.intensity === .8);
  browserResult = await page.evaluate(async inputs => {
    const { beginValidation, beginTrajectoryReplay } = await import('/src/core/field-validator.ts');
    const rows = [], chunks = [];
    for (const input of inputs) {
      const start = performance.now(), job = beginValidation(input.context);
      while (!job.getResult()) { const before = performance.now(); job.advance(); chunks.push(performance.now() - before); }
      const result = job.getResult(), row = { seed: input.seed, family: input.family, ms: performance.now() - start,
        decision: result.decision, reason: result.reason, hash: result.witness?.hash, metrics: job.metrics };
      if (result.decision === 'accept') { const replay = beginTrajectoryReplay(result.witness.context, result.witness.controls); while (!replay.getResult()) replay.advance(); if (replay.getResult().decision !== 'accept') throw new Error('Browser pattern witness replay failed'); }
      rows.push(row);
    }
    return { rows, chunks };
  }, inputs);
  assert.deepEqual(errors, []); assert.ok(!requests.some(url => /src\/(main|world)/.test(url) || url.endsWith('.glb')));
  for (const row of browserResult.rows) {
    const node = inputs.find(s => s.seed === row.seed && s.family === row.family);
    assert.equal(row.decision, node.decision); if (row.hash) assert.equal(row.hash, node.witnessHash);
  }
  browserResult = { browser: await browser.version(), ...browserResult, jobMs: stats(browserResult.rows.map(r => r.ms)), chunkMs: stats(browserResult.chunks), errors, requests };
  await page.close(); plotFiles = await patternPlots(browser, { ...examples, ...intendedExamples });
} finally { await browser?.close(); server.kill(); }

const group = rows => {
  const outcomes = {}; for (const r of rows) { const key = r.decision === 'accept' ? 'accept' : r.structuralReason ?? r.reason ?? 'not-run'; outcomes[key] = (outcomes[key] ?? 0) + 1; }
  return { attempted: rows.length, structuralRejected: rows.filter(r => r.decision === 'not-run').length, accepted: rows.filter(r => r.decision === 'accept').length, outcomes };
};
const geometries = [...proposals.values()], distributions = PATTERN_FAMILIES.map(family => {
  const list = geometries.filter(tx => tx.provenance.pattern?.family === family), hazards = list.flatMap(tx => tx.hazards);
  const gaps = list.flatMap(tx => tx.hazards.slice(1).map((h, i) => h.passDistance - tx.hazards[i].passDistance));
  const witnesses = samples.filter(s => s.family === family && s.motion);
  return { family, transactions: list.length, hazards: hazards.length, objectsPer100: hazards.length * 100 / list.reduce((s, t) => s + t.endDistance - t.startDistance, 0),
    counts: stats(list.map(t => t.hazards.length)), depthGaps: stats(gaps), sameDepthFraction: gaps.filter(g => Math.abs(g) < 1e-9).length / gaps.length,
    x: stats(hazards.map(h => h.x)), y: stats(hazards.map(h => h.y)),
    transactionUtilization: stats(list.map(t => (t.hazards.at(-1).passDistance - t.hazards[0].passDistance) / (t.endDistance - t.startDistance))),
    extraRadiusClearance: stats(witnesses.map(s => s.motion.extraRadiusClearance)), yBeneficialTraceCount: witnesses.filter(s => s.motion.yTravel > .1 && s.motion.noYReason === 'COLLISION_FOUND').length,
    xReversals: stats(witnesses.map(s => s.motion.xReversals)), yReversals: stats(witnesses.map(s => s.motion.yReversals)),
    library: group(samples.filter(s => s.family === family && s.phase === 'library')),
    byIntensity: [.2, .8].map(intensity => ({ intensity, ...group(samples.filter(s => s.family === family && s.phase === 'library' && s.intensity === intensity)) })),
    late: group(samples.filter(s => s.family === family && s.phase === 'late')) };
});
const production = await approvedResearch();
const metrics = { baseline: APPROVED_B2, schema: 'encounter-v1', seeds: APPROVED_SEEDS, protectedInputs, production,
  method: '768 library attempts =4 families x16 seeds x2 intensities x2 variations x3 roots;128 global-neutral,64 engineered late,128 joint and8 invalid-request probes. No samples filtered from acceptance denominators. Only geometry distributions deduplicate repeated contexts by full transaction hash.',
  overall: group(samples), phases: [...new Set(samples.map(s => s.phase))].map(phase => ({ phase, ...group(samples.filter(s => s.phase === phase)) })), distributions,
  transitions: JOINT_CASES.map(type => ({ type, ...group(samples.filter(s => s.transition === type)) })),
  timing: { node: process.version, platform: process.platform, preparationMs: stats(samples.map(s => s.prepareMs)), jobMs: stats(samples.filter(s => s.validationMs !== undefined).map(s => s.validationMs)),
    chunkMs: stats(chunks.map(c => c.ms)), replayMs: stats(samples.filter(s => s.replayMs !== undefined).map(s => s.replayMs)) },
  work: { propagations: stats(samples.filter(s => s.metrics).map(s => s.metrics.propagations)), narrowQueries: stats(samples.filter(s => s.metrics).map(s => s.metrics.narrowQueries)),
    planningTicks: stats(samples.filter(s => s.metrics).map(s => s.metrics.planningTicks)), peakFrontier: Math.max(...samples.filter(s => s.metrics).map(s => s.metrics.peakFrontier)),
    peakExpansion: Math.max(...samples.filter(s => s.metrics).map(s => s.metrics.peakExpansion)), deadlines: samples.filter(s => s.reason === 'COMPUTATION_BUDGET_EXCEEDED').length,
    horizonFailures: samples.filter(s => s.reason === 'HORIZON_EXCEEDED').length, knownSafeTraceMisses: knownMisses.length },
  browser: browserResult, memory, plotFiles,
  supplementalManeuvers: Object.values(intendedExamples).map(e => ({ family: e.family, seed: e.seed, intensity: e.intensity,
    variation: e.variation, origin: e.origin, hash: e.result.witness.hash, motion: e.motion })),
  limitations: ['No live field, director, publication, worker, new model or control tuning.', 'Acceptance proves its checked trace only. Four fixed hand-control probes on search failures are evidence of incompleteness, not a new planner or acceptance override.',
    'Clearance is a binary swept-proxy padding estimate capped at2; no visible-mesh or robust-state tube claim.', 'Removing Y assesses one trace; horizontal routes can remain. Human readability/fun and physical phone/rendered performance are untested.'] };
await writeFile(join(output, 'pattern-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
await writeFile(join(output, 'pattern-samples.json'), JSON.stringify({ samples, chunks, geometries }, null, 2) + '\n');
await writeFile(join(output, 'pattern-examples.json'), JSON.stringify({ examples, intendedExamples, failures, knownMisses }, null, 2) + '\n');
console.log(JSON.stringify({ overall: metrics.overall, phases: metrics.phases, distributions, transitions: metrics.transitions, work: metrics.work,
  timing: metrics.timing, browser: { version: browserResult.browser, jobMs: browserResult.jobMs, chunkMs: browserResult.chunkMs }, memory, plotFiles }, null, 2));
