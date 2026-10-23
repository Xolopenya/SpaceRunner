// Calls real isolated B-1 code and the unchanged shipped generator. No live integration.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { FieldGenerator } from '../src/core/field-generator.ts';
import { FIELD_LIMITS } from '../src/core/field-settings.ts';
import { ObstacleField } from '../src/core/obstacles.ts';
import { CONFIG, difficulty } from '../src/config.ts';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, min: sorted[0] ?? null, p50: sorted[Math.floor((sorted.length - 1) * .5)] ?? null,
    p95: sorted[Math.floor((sorted.length - 1) * .95)] ?? null, max: sorted.at(-1) ?? null,
    mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null };
};

if (process.argv.includes('--memory-child')) {
  assert.equal(typeof global.gc, 'function');
  const generator = new FieldGenerator(42);
  let last;
  for (let i = 0; i < 1000; i++) last = generator.propose(i * 6, 6);
  global.gc();
  const samples = [{ transactions: 1000, heapUsed: process.memoryUsage().heapUsed }];
  let peakCandidates = 0;
  for (let batch = 0; batch < 8; batch++) {
    for (let i = 0; i < 10000; i++) {
      last = generator.propose((batch * 10000 + i + 1000) * 6, 6);
      peakCandidates = Math.max(peakCandidates, last.hazards.length);
    }
    generator.reset(42);
    global.gc();
    samples.push({ transactions: 1000 + (batch + 1) * 10000, heapUsed: process.memoryUsage().heapUsed });
  }
  const growth = samples.at(-1).heapUsed - samples[0].heapUsed;
  assert.ok(growth < 4 * 1024 * 1024, 'Retained heap grew more than the diagnostic 4MiB guard');
  console.log(JSON.stringify({ samples, retainedGrowthBytes: growth, peakCandidates, retainedLastSnapshotCandidates: last.hazards.length,
    method: 'Fresh Node --expose-gc child; 1000 warmup +80000 six-cell transactions, GC after each10000/reset. Caller retains only last snapshot. Whole-process heap includes runtime noise; this is not browser or validator memory.' }));
  process.exit(0);
}

const baseline = 'c447ee52d3fcc891c6c9e633eb604905c5a99443';
const output = process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-001B-1/final';
await mkdir(output, { recursive: true }); await mkdir('test-results', { recursive: true });
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const protectedPaths = git('ls-tree', '-r', '--name-only', baseline, '--', 'src', 'public', 'tests', 'design',
  'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts').toString().trim().split('\n');
const protectedInputs = [];
for (const path of protectedPaths) {
  const before = git('show', `${baseline}:${path}`), after = await readFile(path);
  assert.ok(before.equals(after) || (!before.includes(0) && before.toString().replaceAll('\r\n', '\n') === after.toString().replaceAll('\r\n', '\n')), `Protected source changed: ${path}`);
  protectedInputs.push({ path, baselineBlobSha256: sha(before), comparison: before.equals(after) ? 'byte-identical' : 'checkout-newline-only' });
}
// Also guard the import boundary: only these new files may reference the experiment.
const experimentFiles = new Set(['field-generator.ts', 'field-settings.ts', 'field-types.ts']);
async function inspectSources(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const next = `${path}/${entry.name}`;
    if (entry.isDirectory()) await inspectSources(next);
    else if (!experimentFiles.has(entry.name)) assert.ok(!/field-(?:generator|settings|types)/.test(await readFile(next, 'utf8')), `Runtime import of isolated experiment: ${next}`);
  }
}
await inspectSources('src');
const buildFiles = [];
async function inspectBuild(path, prefix = '') {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const next = `${path}/${entry.name}`, name = prefix + entry.name;
    if (entry.isDirectory()) await inspectBuild(next, name + '/');
    else {
      const bytes = await readFile(next);
      if (name.endsWith('.js')) assert.ok(!/ambient-v1|TEST_DOUBLE_ONLY|Candidate count exceeds|Invalid experimental field/.test(bytes.toString()), 'Experiment leaked into bundle');
      buildFiles.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
}
await inspectBuild('dist');
// The approved baseline's prior measured build is optional evidence, never silently fabricated.
let approvedBuildComparison = { status: 'no prior local manifest; protected sources/import checks still required' };
try {
  const prior = JSON.parse(await readFile('.cache/review/GAMEPLAY-001A/final/verification.json', 'utf8'));
  assert.equal(prior.head, baseline);
  const shapes = files => files.map(({ path, bytes }) => ({ path, bytes })).sort((a, b) => a.path.localeCompare(b.path));
  assert.deepEqual(shapes(buildFiles), shapes(prior.productionBuild.files));
  approvedBuildComparison = { status: 'all output filenames/sizes match approved baseline local manifest', head: prior.head,
    manifestSha256: sha(await readFile('.cache/review/GAMEPLAY-001A/final/verification.json')), totalBytes: prior.productionBuild.totalBytes };
} catch (error) { if (error.code !== 'ENOENT') throw error; }

const seeds = [0, 1, 2, 3, 7, 11, 23, 42, 64, 127, 255, 1024, 4096, 65535, 2147483647, 4294967295];
const fromDistance = 0, toDistance = 19200, cells = toDistance / 24;
const currentRuns = [], candidateRuns = [], transactionCounts = [], ownershipHistogram = [0, 0, 0];
let separationFailures = 0, maxContextCount = 0;
for (const seed of seeds) {
  const field = new ObstacleField(); field.reset(seed);
  const old = [];
  let distance = 0, elapsed = 0;
  for (let tick = 0; tick < 600 * 120; tick++) {
    elapsed += CONFIG.step;
    const speed = difficulty(elapsed).speed;
    distance += speed * CONFIG.step;
    const count = field.spawnedWaves;
    field.update(CONFIG.step, speed, distance, elapsed);
    if (field.spawnedWaves === count) continue;
    const passDistance = distance - CONFIG.hazards.spawnZ;
    if (passDistance < fromDistance || passDistance >= toDistance) continue;
    for (const h of field.hazards) if (h.active && h.z === CONFIG.hazards.spawnZ) old.push({ x: h.x, y: h.y, radius: h.radius, passDistance });
  }
  currentRuns.push({ seed, hazards: old });
  const generator = new FieldGenerator(seed), hazards = [];
  let previous = [];
  for (let cell = 0; cell < cells; cell += 2) {
    const transaction = generator.propose(cell, 2);
    assert.equal(generator.inspect(transaction, previous).status, 'valid');
    maxContextCount = Math.max(maxContextCount, previous.length + transaction.hazards.length);
    hazards.push(...transaction.hazards); previous = transaction.hazards;
  }
  for (let cell = 0; cell < cells; cell++) ownershipHistogram[hazards.filter(h => h.ownerCell === cell).length]++;
  for (let count = 2; count <= 6; count++) for (let cell = 0; cell <= cells - count; cell += count) {
    const transaction = generator.propose(cell, count);
    assert.equal(generator.inspect(transaction).status, 'valid');
    transactionCounts.push({ cellCount: count, candidates: transaction.hazards.length });
  }
  for (let i = 1; i < hazards.length; i++) {
    const a = hazards[i - 1], b = hazards[i];
    // Depth alone is already >12; any non-adjacent pair is farther still in Z.
    if (Math.hypot(a.x - b.x, a.y - b.y, a.passDistance - b.passDistance) < a.radius + b.radius + .3) separationFailures++;
  }
  const replay = [];
  for (let cell = cells - 2; cell >= 0; cell -= 2) replay.unshift(...generator.propose(cell, 2).hazards);
  assert.deepEqual(replay, hazards);
  generator.reset(seed);
  assert.deepEqual(generator.propose(0, 6).hazards, hazards.filter(h => h.ownerCell < 6));
  candidateRuns.push({ seed, hazards, streamSha256: sha(JSON.stringify(hazards)) });
}
assert.equal(separationFailures, 0);
const histogram = (values, low, high, bins) => {
  const counts = Array(bins).fill(0);
  for (const value of values) counts[Math.max(0, Math.min(bins - 1, Math.floor((value - low) / (high - low) * bins)))]++;
  return { low, high, bins, counts };
};
function summarize(runs, low = fromDistance, high = toDistance) {
  const filtered = runs.map(run => run.hazards.filter(h => h.passDistance >= low && h.passDistance < high));
  const hazards = filtered.flat(), gaps = filtered.flatMap(list => list.slice(1).map((h, i) => h.passDistance - list[i].passDistance));
  return { hazards: hazards.length, totalWorldUnits: (high - low) * seeds.length, hazardsPer100Units: 100 * hazards.length / ((high - low) * seeds.length),
    x: stats(hazards.map(h => h.x)), y: stats(hazards.map(h => h.y)), radius: stats(hazards.map(h => h.radius)),
    xHistogram: histogram(hazards.map(h => h.x), -5.4, 5.4, 12), yHistogram: histogram(hazards.map(h => h.y), -3.15, 3.15, 12),
    depthGaps: stats(gaps), depthHistogram: histogram(gaps, 0, 72, 24), sameDepthNeighborFraction: gaps.filter(g => Math.abs(g) < 1e-9).length / gaps.length };
}
function separationSurvey(runs) {
  let checkedNearDepthPairs = 0, violations = 0;
  for (const { hazards } of runs) for (let i = 0; i < hazards.length; i++) {
    const a = hazards[i];
    for (let j = i + 1; j < hazards.length; j++) {
      const b = hazards[j], gap = b.passDistance - a.passDistance;
      if (gap > 2 * FIELD_LIMITS.maxRadius + .3) break;
      checkedNearDepthPairs++;
      if (Math.hypot(a.x - b.x, a.y - b.y, gap) < a.radius + b.radius + .3) violations++;
    }
  }
  return { checkedNearDepthPairs, violations,
    method: 'All pairs potentially within r1+r2+0.3; sorted-depth broad phase skips provably separated pairs. Applying this new screen to the old field does not invalidate its player-corridor contract.' };
}
// Generation-only timing is deliberately separate from old 120Hz simulation and validation.
const timer = new FieldGenerator(42), timings = [], inspectTimings = [];
for (let i = 0; i < 1000; i++) timer.propose(i * 6, 6);
for (let i = 0; i < 10000; i++) {
  let start = performance.now(); const proposal = timer.propose(i * 6, 6); timings.push(performance.now() - start);
  start = performance.now(); assert.equal(timer.inspect(proposal).status, 'valid'); inspectTimings.push(performance.now() - start);
}
const memory = JSON.parse(execFileSync(process.execPath, ['--expose-gc', '--experimental-strip-types', fileURLToPath(import.meta.url), '--memory-child'], { encoding: 'utf8' }));
const summary = { baseline, seeds, version: FIELD_LIMITS.version, window: { fromDistance, toDistance, unitsPerSeed: toDistance - fromDistance },
  method: 'Matched center-pass-distance windows. Old: actual field at120Hz, end-step speed for600s per seed. New: isolated random-access proposals; no bootstrap, director, runtime or acceptance. Rates describe ambient density, not human decisions or danger.',
  current: summarize(currentRuns), candidate: summarize(candidateRuns), steadyDistanceWindow: { from: 4200, to: 19200, current: summarize(currentRuns, 4200, 19200), candidate: summarize(candidateRuns, 4200, 19200) },
  ownershipHistogram, transactionCountByCells: [2, 3, 4, 5, 6].map(cellCount => ({ cellCount, ...stats(transactionCounts.filter(t => t.cellCount === cellCount).map(t => t.candidates)) })),
  separationFailures, objectSeparationSurvey: { current: separationSurvey(currentRuns), candidate: separationSurvey(candidateRuns) },
  maxContextCount, reproducibility: { all16SeedsReverseTransactionReplay: 'passed', reset: 'passed', perSeed: candidateRuns.map(({ seed, streamSha256, hazards }) => ({ seed, streamSha256, hazards: hazards.length })) },
  timing: { node: process.version, platform: process.platform, architecture: process.arch, warmupTransactions: 1000, sixCellGenerationMs: stats(timings), structuralInspectMs: stats(inspectTimings), note: '10000 local Node calls, measured individually; includes timer overhead/GC. Not browser FPS, a validator benchmark or a phone result.' },
  memory, protectedInputs, buildFiles, approvedBuildComparison,
  bypassAnalysis: { source: 'Full XY support includes X±2 and center positions within0.6 of side bounds±6; round-sphere variants have positive weight. Thus lane-based universal X stripe clearance does not follow. Y boundary centers are within0.45 of±3.6. Radius0.65+ship0.42 already exceeds either residual. Depth stratification creates temporal gaps, not a permanently reserved XY tube.',
    probes: [-6, -2, 0, 2, 6].map(x => ({ x, y: 0, roundSphereCenterPassIntersections: candidateRuns.flatMap(r => r.hazards).filter(h => h.visualVariant <= 1 && Math.hypot(h.x - x, h.y) <= h.radius + CONFIG.ship.radius).length })),
    caveat: 'Center-pass geometry is only a structural probe, not a full rotating-collider replay or proof every seed eventually hits every stationary line. No trajectory validation or fun/safety improvement is claimed.' },
  limitations: ['No B-2 validator, witness, current-state replay, live publication or fairness certificate.', 'Fixed ambient cadence averages1/24 with bounded anchor displacement; 0–2 per ownership cell, no director or encounters.', 'Outward boundary protrusion is allowed; planned data does not establish a usable escape route.', 'Memory caller must release snapshots; random-access builder retains only settings and provenance.', 'Approved build comparison uses source equivalence plus output name/size checks when prior local manifest exists; fresh output hashes are recorded, not claimed as historical hashes.'] };
await writeFile(`${output}/field-foundation-metrics.json`, JSON.stringify(summary, null, 2) + '\n');
await writeFile(`${output}/field-seed42-candidates.json`, JSON.stringify(candidateRuns.find(r => r.seed === 42), null, 2) + '\n');
await writeFile(`${output}/field-seed42-current.json`, JSON.stringify(currentRuns.find(r => r.seed === 42), null, 2) + '\n');

// Every mark is derived from the arrays above. These are static research plots, not game screenshots.
const text = (x, y, value, size = 16) => `<text x="${x}" y="${y}" font-size="${size}">${value}</text>`;
const header = (title, subtitle) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="740"><style>text{font-family:Arial,sans-serif;fill:#e4edf5}.axis{stroke:#53667e;fill:none}</style><rect width="1280" height="740" fill="#0b1523"/>${text(40, 45, title, 26)}${text(40, 76, subtitle)}`;
const circle = (x, y, r, color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity=".72"/>`;
const old42 = currentRuns.find(r => r.seed === 42).hazards, new42 = candidateRuns.find(r => r.seed === 42).hazards;
let depthSvg = header('Actual center-pass depth vs X / seed 42', 'Matched world window [0,720). Old production waves above; isolated B-1 candidates below. Y/rotation omitted.');
for (const [row, list, label, color] of [[0, old42, 'Current production', '#ffbc82'], [1, new42, 'B-1 proposals / structurally checked only', '#80dbd8']]) {
  const middle = 230 + row * 300;
  depthSvg += text(60, middle - 110, label, 20) + `<path class="axis" d="M80 ${middle-90}V${middle+90}H1220"/>`;
  for (const x of [-5, 0, 5]) depthSvg += text(40, middle - x * 15 + 5, x);
  for (const d of [0, 120, 240, 360, 480, 600, 720]) depthSvg += text(80 + d * 1.55, middle + 115, d);
  depthSvg += list.filter(h => h.passDistance < 720).map(h => circle(80 + h.passDistance * 1.55, middle - h.x * 15, h.radius * 6, color)).join('');
}
depthSvg += text(60, 714, 'World distance →   No live integration; these plots establish distribution, not reachability.') + '</svg>';
let xySvg = header('Actual XY support / 16 fixed seeds ×19200 world units', 'First 2000 measured objects from each dataset, in pass order; full-corpus histograms are in raw JSON.');
for (const [column, runs, label, color] of [[0, currentRuns, 'Production / lane bands', '#ffbc82'], [1, candidateRuns, 'B-1 / continuous XY', '#80dbd8']]) {
  const left = 85 + column * 620;
  xySvg += text(left, 130, label, 22) + `<path class="axis" d="M${left} 170V620H${left+490}"/>`;
  for (const x of [-5.4, 0, 5.4]) xySvg += text(left + (x + 5.4) / 10.8 * 490 - 10, 650, x);
  for (const y of [-3.15, 0, 3.15]) xySvg += text(left - 50, 395 - y / 3.15 * 225 + 5, y);
  xySvg += runs.flatMap(r => r.hazards).slice(0, 2000).map(h => circle(left + (h.x + 5.4) / 10.8 * 490, 395 - h.y / 3.15 * 225, 2.2, color)).join('');
}
xySvg += text(60, 710, 'X horizontal / Y vertical. Unchanged radii 0.65–1.1. No lane exclusion or player-aware veto.') + '</svg>';
let histSvg = header('Actual adjacent-depth gaps / full fixed-seed corpus', 'Normalized per dataset; 3-unit bins, final bin ≥69. Pairs never cross seed boundaries.');
for (const [row, data, label, color] of [[0, summary.current, 'Current production', '#ffbc82'], [1, summary.candidate, 'B-1 candidates', '#80dbd8']]) {
  const base = 340 + row * 300, left = 90, barWidth = 44;
  histSvg += text(left, base - 200, `${label}: same depth ${(data.sameDepthNeighborFraction * 100).toFixed(2)}%`, 21);
  for (let i = 0; i < 24; i++) {
    const fraction = data.depthHistogram.counts[i] / data.depthGaps.count;
    histSvg += `<rect x="${left+i*barWidth}" y="${base-fraction*190}" width="40" height="${fraction*190}" fill="${color}"/>`;
    if (i % 4 === 0) histSvg += text(left+i*barWidth, base+25, i*3);
  }
  histSvg += `<path class="axis" d="M${left} ${base-190}V${base}H1190"/>` + text(42, base-185, '100%') + text(left + 23 * barWidth, base+25, '69+');
}
histSvg += text(90, 711, 'Gap / world units →   Ambient rate is deliberately sparse; no pacing or safety conclusions.') + '</svg>';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 740 } });
  for (const [name, svg] of [['field-actual-depth.png', depthSvg], ['field-actual-xy.png', xySvg], ['field-actual-gaps.png', histSvg]]) {
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.screenshot({ path: `test-results/${name}` });
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ baseline, protectedFiles: protectedInputs.length, current: summary.current, candidate: summary.candidate,
  ownershipHistogram, transactionCountByCells: summary.transactionCountByCells, separationFailures, timing: summary.timing, memory,
  bypassAnalysis: summary.bypassAnalysis, approvedBuildComparison }, null, 2));
