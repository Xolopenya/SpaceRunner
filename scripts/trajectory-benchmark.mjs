import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { beginValidation, beginTrajectoryReplay, beginPublicationCheck } from '../src/core/field-validator.ts';
import { FlightPrediction } from '../src/core/field-prediction.ts';
import { APPROVED_SEEDS, POLICIES, generatorContext } from '../tests/fixtures/trajectory-corpus.ts';
import { barrier, context, obstacle, fixtureOptions } from '../tests/fixtures/trajectory-fixtures.ts';

const baseline = '90b2b103ff4fa8f64953894679142b6def938f82';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-001B-2/final');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const complete = job => { while (!job.getResult()) job.advance(); return job.getResult(); };
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, min: sorted[0] ?? null, p50: sorted[Math.floor((sorted.length - 1) * .5)] ?? null,
    p95: sorted[Math.floor((sorted.length - 1) * .95)] ?? null, max: sorted.at(-1) ?? null,
    mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null };
};
if (process.argv.includes('--memory-child')) {
  assert.equal(typeof global.gc, 'function');
  const c = generatorContext(42, 'neutral');
  for (let i = 0; i < 5; i++) complete(beginValidation(c));
  global.gc(); const baselineUsage = process.memoryUsage(), baselineHeap = baselineUsage.heapUsed, samples = [];
  const active = Array.from({ length: 5 }, () => beginValidation(c));
  for (const job of active) for (let i = 0; i < 12 && !job.getResult(); i++) job.advance();
  global.gc(); const activeUsage = process.memoryUsage();
  const fiveActiveJobDelta = activeUsage.heapUsed - baselineHeap;
  const fiveActiveArrayBufferDelta = activeUsage.arrayBuffers - baselineUsage.arrayBuffers;
  for (const job of active) complete(job);
  active.length = 0;
  for (let batch = 0; batch < 6; batch++) {
    for (let i = 0; i < 10; i++) assert.equal(complete(beginValidation(c)).decision, 'accept');
    global.gc(); samples.push({ completed: (batch + 1) * 10, ...process.memoryUsage() });
  }
  const retainedHeapGrowthBytes = samples.at(-1).heapUsed - baselineHeap;
  const retainedArrayBufferGrowthBytes = samples.at(-1).arrayBuffers - baselineUsage.arrayBuffers;
  const growth = retainedHeapGrowthBytes + retainedArrayBufferGrowthBytes;
  assert.ok(growth < 8 * 1024 * 1024, 'Retained-heap guard exceeded8MiB');
  console.log(JSON.stringify({ baselineUsage, activeUsage, baselineHeap, fiveActiveJobDelta, fiveActiveArrayBufferDelta,
    estimatedPerActiveJobBytes: (fiveActiveJobDelta + fiveActiveArrayBufferDelta) / 5, samples,
    retainedHeapGrowthBytes, retainedArrayBufferGrowthBytes, retainedGrowthBytes: growth,
    method: 'Fresh Node --expose-gc child;5 warmups,5 live jobs after12 advances,then release and60 jobs/GC every10. Estimate adds heapUsed and arrayBuffers deltas (not external again); RSS/external are also recorded. JIT noise remains;8MiB guard is not a512KiB proof.' }));
  process.exit(0);
}
await mkdir(output, { recursive: true });

// Preserve every old assertion. Only the isolated B-1 type contract is extended.
const paths = git('ls-tree', '-r', '--name-only', baseline, '--', 'src', 'public', 'tests', 'design', 'index.html',
  'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts').toString().trim().split('\n');
const protectedInputs = [];
for (const path of paths) {
  const before = git('show', `${baseline}:${path}`), after = await readFile(path);
  let expected = before.toString().replaceAll('\r\n', '\n');
  if (path === 'src/core/field-types.ts') expected = expected.replace('/** B-2 contract only. No implementation, scheduling or invocation in B-1. */', '/** Isolated planning input. Caller supplies all relevant known hazards. */')
    .replace('  readonly candidate: FieldTransaction;\n', '  readonly candidate: FieldTransaction;\n  /** Exclusive future-content reservation; omitted means the minimum inferred tail. */\n  readonly reservedUntilDistance?: number;\n');
  assert.ok(before.includes(0) ? before.equals(after) : expected === after.toString().replaceAll('\r\n', '\n'), `Protected input changed: ${path}`);
  protectedInputs.push({ path, baselineBlobSha256: digest(before), comparison: path === 'src/core/field-types.ts' ? 'exact allowed type-only extension' : 'identical after optional checkout-newline normalization' });
}
const frozen = git('show', `${baseline}:src/core/hazard-collision.ts`).toString().replaceAll('\r\n', '\n')
  .replaceAll("'../config.ts'", "'../../src/config.ts'").replaceAll("'./collision.ts'", "'../../src/core/collision.ts'")
  .replaceAll("'./hazard-profile.ts'", "'../../src/core/hazard-profile.ts'").replace('export class HazardCollision', 'export class ApprovedHazardCollision');
assert.equal((await readFile('tests/fixtures/approved-hazard-collision.ts', 'utf8')).replaceAll('\r\n', '\n').trimEnd(), frozen.trimEnd());
const isolated = /^field-(?:generator|settings|types|prediction|clearance|validator|validator-types)\.ts$/;
async function boundary(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory()) await boundary(`${path}/${item.name}`);
    else if (!isolated.test(item.name)) assert.ok(!/field-(?:generator|prediction|clearance|validator|settings|types)/.test(await readFile(`${path}/${item.name}`, 'utf8')), `Live import: ${path}/${item.name}`);
  }
}
await boundary('src');

// Reproduce historical B-1 tooling against its actual approved snapshot, without
// weakening its source-pinning/import-boundary checks for later experiments.
const approvedRoot = resolve('.cache/review/GAMEPLAY-001B-2/approved-b1');
for (const path of [...paths, 'scripts/field-foundation-benchmark.mjs']) {
  const destination = join(approvedRoot, path);
  assert.ok(destination.startsWith(approvedRoot + '\\') || destination.startsWith(approvedRoot + '/'));
  await mkdir(dirname(destination), { recursive: true });
  let bytes = git('show', `${baseline}:${path}`);
  if (path === 'index.html') {
    // Reproduce Git's current checkout newline convention, not a source change.
    const checkout = await readFile('index.html', 'utf8');
    bytes = Buffer.from(bytes.toString().replaceAll('\r\n', '\n').replaceAll('\n', checkout.includes('\r\n') ? '\r\n' : '\n'));
  }
  await writeFile(destination, bytes);
}
const baselineLogs = resolve('.cache/review/GAMEPLAY-001B-2/baseline'); await mkdir(baselineLogs, { recursive: true });
const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
for (const [name, args] of [['approved-build', [npmCli, 'run', 'build']], ['approved-generator', ['--experimental-strip-types', 'scripts/field-foundation-benchmark.mjs']]]) {
  const log = execFileSync(process.execPath, args, { cwd: approvedRoot,
    env: { ...process.env, REVIEW_RESULT_DIR: baselineLogs, GIT_DIR: join(root, '.git'), GIT_WORK_TREE: approvedRoot },
    maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  await writeFile(join(baselineLogs, `${name}.log`), log);
}
async function hashes(path, prefix = '') {
  const list = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory()) list.push(...await hashes(`${path}/${item.name}`, prefix + item.name + '/'));
    else { const bytes = await readFile(`${path}/${item.name}`); list.push({ path: prefix + item.name, bytes: bytes.length, sha256: digest(bytes) }); }
  }
  return list.sort((a, b) => a.path.localeCompare(b.path));
}
const approvedBuild = await hashes(`${approvedRoot}/dist`), currentBuild = await hashes('dist');
assert.deepEqual(currentBuild, approvedBuild, 'Production build bytes differ from fresh approved B-1 build');

const samples = [], chunks = [], examples = [];
function measure(seed, policy, regime, margin = .15) {
  const c = generatorContext(seed, policy, regime), start = performance.now();
  const job = beginValidation(c, { margin }), beginMs = performance.now() - start;
  const index = samples.length;
  while (!job.getResult()) {
    const before = job.metrics, tickStart = performance.now(); job.advance();
    const after = job.metrics;
    chunks.push({ sample: index, tick: after.planningTicks, ms: performance.now() - tickStart,
      propagations: after.propagations - before.propagations, narrowQueries: after.narrowQueries - before.narrowQueries });
  }
  const result = job.getResult();
  const row = { seed, policy, regime, margin, root: { player: c.player, input: c.input, elapsed: c.elapsed, distance: c.distance },
    firstCell: c.candidate.firstCell, cellCount: c.candidate.cellCount, beginMs, validationMs: performance.now() - start,
    decision: result.decision, ...(result.decision === 'reject' ? { reason: result.reason, detail: result.detail } : { witnessHash: result.witness.hash, witnessSha256: digest(JSON.stringify(result.witness)) }), metrics: job.metrics };
  assert.ok(job.metrics.peakFrontier <= 16 && job.metrics.peakExpansion <= 144 && job.metrics.planningTicks <= 144);
  assert.ok(job.metrics.searches <= 2 && job.metrics.replays <= 4);
  if (result.decision === 'accept') {
    const replay = beginTrajectoryReplay(result.witness.context, result.witness.controls, { margin });
    const replayStart = performance.now(), replayResult = complete(replay);
    assert.equal(replayResult.decision, 'accept'); assert.equal(replayResult.witness.hash, result.witness.hash);
    row.externalReplayMs = performance.now() - replayStart; row.externalReplayMetrics = replay.metrics;
    if (regime === 'normal' && seed === 42) {
      const laterState = { ...c.player, elapsed: c.elapsed, distance: c.distance }, predictor = new FlightPrediction();
      for (let tick = 0; tick < 24; tick++) predictor.step(laterState, c.input);
      const later = { ...c, player: { x: laterState.x, y: laterState.y, vx: laterState.vx, vy: laterState.vy }, elapsed: laterState.elapsed, distance: laterState.distance };
      const publicationStart = performance.now(), publication = beginPublicationCheck(result.witness, later);
      row.publication = { result: complete(publication), ms: performance.now() - publicationStart, metrics: publication.metrics };
    }
  }
  if (seed === 42 && (regime !== 'normal' || policy === 'neutral')) examples.push({ label: `${policy}/${regime}/margin${margin}`, context: c, result });
  samples.push(row);
}
for (let i = 0; i < 4; i++) complete(beginValidation(generatorContext(42, 'neutral')));
for (const seed of APPROVED_SEEDS) for (const policy of POLICIES) for (const regime of ['normal', 'late-existing', 'late-candidate']) measure(seed, policy, regime);
for (let seed = 0; seed < 64; seed++) measure(seed, 'neutral', 'normal');
for (const seed of APPROVED_SEEDS) measure(seed, 'neutral', 'normal', 0);
for (const seed of APPROVED_SEEDS) measure(seed, 'neutral', 'long-horizon');
for (const [name, c] of [['left-passage', context(barrier('x', 1, 68))], ['alternating', context([...barrier('x', 1, 68, 'a'), ...barrier('x', -1, 170, 'b')])],
  ['incompatible', context(barrier('x', -1, 71.4, 'b'), { committed: barrier('x', 1, 68, 'a') })], ['reaction', context([obstacle('near', 0, 0, 5)])]]) {
  examples.push({ label: name, context: c, result: complete(beginValidation(c, fixtureOptions)) });
}
const replaySeed42 = complete(beginValidation(generatorContext(42, 'neutral')));
assert.equal(replaySeed42.witness.hash, samples.find(s => s.seed === 42 && s.policy === 'neutral' && s.regime === 'normal').witnessHash);
const memory = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--experimental-strip-types', fileURLToPath(import.meta.url), '--memory-child'], { encoding: 'utf8', windowsHide: true }));

// Isolated browser harness imports only planning modules. No game entry/World.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
let browser;
let browserResult;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:5188/tests/browser/trajectory-harness.html')).ok) { ready = true; break; } } catch { /* bounded startup polling */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  assert.ok(ready, 'Diagnostic server did not start');
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const page = await browser.newPage(), errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
  await page.goto('http://127.0.0.1:5188/tests/browser/trajectory-harness.html');
  const contexts = APPROVED_SEEDS.flatMap(seed => POLICIES.map(policy => ({ seed, policy, context: generatorContext(seed, policy) })));
  browserResult = await page.evaluate(async inputs => {
    const { beginValidation, beginTrajectoryReplay } = await import('/src/core/field-validator.ts');
    const rows = [], chunks = [];
    for (let i = 0; i < 4; i++) { const job = beginValidation(inputs[0].context); while (!job.getResult()) job.advance(); }
    for (const input of inputs) {
      const start = performance.now(), job = beginValidation(input.context), beginMs = performance.now() - start;
      while (!job.getResult()) { const chunkStart = performance.now(); job.advance(); chunks.push(performance.now() - chunkStart); }
      const result = job.getResult();
      const row = { seed: input.seed, policy: input.policy, beginMs, ms: performance.now() - start, decision: result.decision,
        reason: result.reason, hash: result.witness?.hash, metrics: job.metrics };
      if (result.decision === 'accept') {
        const replay = beginTrajectoryReplay(result.witness.context, result.witness.controls);
        const replayStart = performance.now(); while (!replay.getResult()) replay.advance();
        if (replay.getResult().decision !== 'accept') throw new Error('Browser witness replay failed');
        row.replayMs = performance.now() - replayStart;
      }
      rows.push(row);
    }
    return { rows, chunks };
  }, contexts);
  assert.deepEqual(errors, []);
  assert.ok(!requests.some(url => url.includes('src/main') || url.includes('src/world') || url.endsWith('.glb')), 'Harness loaded live game or assets');
  for (const row of browserResult.rows) {
    const node = samples.find(s => s.seed === row.seed && s.policy === row.policy && s.regime === 'normal' && s.margin === .15);
    assert.equal(row.decision, node.decision); if (row.hash) assert.equal(row.hash, node.witnessHash);
  }
  browserResult = { browser: await browser.version(), ...browserResult, chunkMs: stats(browserResult.chunks), validationMs: stats(browserResult.rows.map(r => r.ms)),
    replayMs: stats(browserResult.rows.filter(r => r.replayMs !== undefined).map(r => r.replayMs)), errors, requests,
    note: 'Desktop installed Chrome, isolated harness without rendering/game. Wall time is uninterrupted diagnostic CPU, not human play or physical phone performance.' };
} finally { await browser?.close(); server.kill(); }

const groups = [];
for (const regime of ['normal', 'late-existing', 'late-candidate', 'long-horizon']) for (const policy of POLICIES) {
  if (regime === 'long-horizon' && policy !== 'neutral') continue;
  const rows = samples.filter(s => APPROVED_SEEDS.includes(s.seed) && s.policy === policy && s.regime === regime && s.margin === .15).slice(0, 16);
  const reasons = {};
  for (const row of rows) { const key = row.decision === 'accept' ? 'accept' : row.reason; reasons[key] = (reasons[key] ?? 0) + 1; }
  groups.push({ regime, policy, samples: rows.length, outcomes: reasons });
}
const body = { baseline, validator: 'trajectory-v1', generatedAt: new Date().toISOString(), seeds: APPROVED_SEEDS,
  method: '240 corpus jobs (16 seeds x5 policies x3 root regimes),64 neutral broad seeds,16 zero-margin jobs,16 time-zero six-cell long-horizon jobs;336 total. Normal roots use120 exact history ticks. Late roots deliberately align with a selected hazard at5 units, preserve policy velocity, and are not claimed as natural input histories.',
  protectedInputs, frozenCollisionReference: 'exact approved blob with import/class-name substitutions only', productionBuild: { approved: approvedBuild, current: currentBuild, byteIdentical: true },
  node: { version: process.version, platform: process.platform, architecture: process.arch, samples, chunks,
    validationMs: stats(samples.map(s => s.validationMs)), beginMs: stats(samples.map(s => s.beginMs)), chunkMs: stats(chunks.map(c => c.ms)),
    externalReplayMs: stats(samples.filter(s => s.externalReplayMs !== undefined).map(s => s.externalReplayMs)),
    propagations: stats(samples.map(s => s.metrics.propagations)), narrowQueries: stats(samples.map(s => s.metrics.narrowQueries)),
    planningTicks: stats(samples.map(s => s.metrics.planningTicks)), peakFrontier: Math.max(...samples.map(s => s.metrics.peakFrontier)),
    deadlineFailures: samples.filter(s => s.reason === 'COMPUTATION_BUDGET_EXCEEDED').length },
  groups, browser: browserResult, memory,
  limitations: ['Finite beam search is incomplete; failures do not prove impossibility.', 'All specified known hazards and reservation completeness are caller contracts, not a live publisher.',
    '0.45s held-input delay and0.15 margin are hypotheses, not universal reaction safety.', 'No director, encounter library, bootstrap, gameplay selection, live integration or worker.',
    'Broader256x1024 planning-policy suite and four24h runs are not claimed; no director exists. Completed336 Node plus80 browser jobs are explicit.',
    'Actual CPU timings and whole-process retained heap are finite measurements; phone/other browser/interactive rendering performance remain untested.'] };
await writeFile(`${output}/trajectory-metrics.json`, JSON.stringify(body, null, 2) + '\n');
await writeFile(`${output}/trajectory-examples.json`, JSON.stringify(examples, null, 2) + '\n');
console.log(JSON.stringify({ samples: samples.length, protectedFiles: protectedInputs.length, byteIdenticalProductionBuild: true,
  groups, node: { validationMs: body.node.validationMs, chunkMs: body.node.chunkMs, beginMs: body.node.beginMs, replayMs: body.node.externalReplayMs,
    propagations: body.node.propagations, narrowQueries: body.node.narrowQueries, planningTicks: body.node.planningTicks, deadlineFailures: body.node.deadlineFailures },
  browser: { version: browserResult.browser, validationMs: browserResult.validationMs, chunkMs: browserResult.chunkMs, replayMs: browserResult.replayMs }, memory }, null, 2));
