import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readZip } from './zip.mjs';
import { reviewWorktree } from './review-worktree.mjs';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { WRECK_GEOMETRY } from '../src/experiments/structure-variants/encounter.ts';
import { FLOW_GEOMETRY } from '../src/experiments/mixed-flow/source.ts';
import { WreckPrediction } from '../src/experiments/structure-variants/profile.ts';
import { classifyFlowPublication } from '../tests/fixtures/mixed-flow-diagnostics.ts';

const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const head = git('rev-parse', 'HEAD').toString().trim(), baseline = 'a617f59044ba234de173cf28e56aad9a5ec8f2c5';
const path = resolve(process.argv[2] ?? `review-packages/GAMEPLAY-EXPERIMENT-003B3-review-${head.slice(0, 7)}.zip`);
const bytes = await readFile(path), entries = readZip(bytes), sha = b => createHash('sha256').update(b).digest('hex');
const json = name => { assert.ok(entries.has(name), name); return JSON.parse(entries.get(name)); };
const manifest = json('reports/manifest.json'), config = json('project_snapshot/review.config.json');
assert.equal(manifest.taskId, 'GAMEPLAY-EXPERIMENT-003B3'); assert.equal(manifest.finalCommit, head); assert.equal(manifest.baselineCommit, baseline);
assert.equal(manifest.branch, 'feature/gameplay-003b3-mixed-obstacle-flow'); assert.equal(manifest.checks.length, 13);
assert.ok(manifest.checks.every(c => c.exitCode === 0));
assert.equal(manifest.tests.filter(t => t.suite === 'unit').length, 187); assert.equal(manifest.tests.filter(t => t.suite === 'browser').length, 65);
assert.ok(manifest.tests.every(t => t.result === 'passed'));
const inventory = json('reports/content-inventory.json'); assert.equal(inventory.length, entries.size - 1);
assert.equal(new Set(inventory.map(r => r.path)).size, inventory.length);
for (const row of inventory) { const b = entries.get(row.path); assert.ok(b, row.path); assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256); }
let snapshotFiles = 0, legacySourceFiles = 0;
for (const [name, b] of entries) {
  assert.ok(!/(^|\/)(?:node_modules|dist|\.git|\.cache|review-packages)(\/|$)/.test(name), name);
  if (name.startsWith('project_snapshot/')) {
    const p = name.slice(17); assert.ok(b.equals(git('show', `${head}:${p}`)), name); snapshotFiles++;
    if (/^src\/experiments\/(?:large-structure|structure-variants)\//.test(p)) { assert.ok(b.equals(git('show', `${baseline}:${p}`))); legacySourceFiles++; }
  }
}
for (const prefix of config.preservedUntracked) assert.ok(![...entries.keys()].some(p => p.startsWith('project_snapshot/' + prefix)));
assert.deepEqual(await reviewWorktree(config, process.cwd(), git), json('changes/preserved-untracked-inventory.json'));
assert.ok(entries.has('project_snapshot/assets/experimental/station-wreck-v2/LICENSE.txt'));
const preservation = json('logs/flow-preservation.json'); assert.equal(preservation.productionByteIdentical, true);
assert.equal(preservation.comparisons.length, 64); assert.equal(preservation.build.length, 15); assert.equal(preservation.bytes, 931651);
const benchmark = json('logs/flow-benchmark.json'), evidence = json('logs/flow-witnesses.json');
assert.equal(benchmark.runs.length, 90); assert.equal(evidence.runs.length, 90); assert.equal(benchmark.pairedActualWindows.length, 42);
assert.deepEqual(benchmark.historicalOwnerObservation, { distance: 3272, scheduled: 23, committed: 5, omitted: 18, maxConsecutiveOmitted: 8,
  emptyFrom: 1585, emptyTo: 2598, inputTape: 'Not supplied; retained as owner observation, not fabricated exact replay.' });
const precommit = json('logs/baseline/precommit-flow-benchmark.json');
const identities = b => b.runs.map(r => ({ seed: r.seed, history: r.history, variant: r.variant, identity: r.identity }));
assert.deepEqual(identities(benchmark), identities(precommit), 'same seeded actual-input states/geometry/outcomes before and after commit');
assert.equal(evidence.repeat.identity, evidence.runs.find(r => r.seed === 42 && r.history === 'keyboard' && r.variant === 'B').identity);
for (const r of evidence.runs) {
  for (const o of r.outcomes) assert.ok(o.metrics.searches <= 2 && o.metrics.replays <= 4 && o.metrics.planningTicks <= 144 && o.attempts.length <= 2);
  for (const c of r.chunks) assert.ok(c.propagations <= 3072 && c.queries <= 6144);
  assert.ok(r.diagnostic.peakPrimitives <= 32 && r.diagnostic.peakRecords <= 16);
}
const a = benchmark.aggregates.A, b = benchmark.aggregates.B;
assert.equal(a.runs, 42); assert.equal(b.runs, 42); assert.ok(b.acceptance > a.acceptance);
assert.ok(b.actualCommonOrdinaryPer100 > a.actualCommonOrdinaryPer100 * 2);
assert.ok(b.minimumStructuresPerWindow >= 2); assert.ok(b.maximumConsecutiveOmissions <= 3); assert.ok(b.depthGaps.max < a.depthGaps.max);
let audits = 0;
function replay(w) {
  const geometry = w.geometryVersion === FLOW_GEOMETRY.version ? FLOW_GEOMETRY : WRECK_GEOMETRY;
  assert.equal(w.geometryVersion, geometry.version); const job = beginTrajectoryReplay(w.context, w.controls, { geometry });
  while (!job.getResult()) job.advance(); const r = job.getResult(); assert.equal(r.decision, 'accept'); assert.equal(r.witness.hash, w.hash); audits++;
}
for (const r of [...evidence.runs, evidence.repeat]) for (const w of r.witnesses) replay(w);
let verifiedPrefixContacts = 0;
for (const c of evidence.counterfactuals) {
  assert.equal(c.classification, classifyFlowPublication(c.old, c.fresh, !!c.prefixCollision));
  if (c.old.decision === 'accept') replay(c.old.witness); if (c.fresh.decision === 'accept') replay(c.fresh.witness);
  if (c.prefixCollision) {
    const state = { ...c.context.player, elapsed: c.context.elapsed, distance: c.context.distance }, p = new WreckPrediction(); let collision;
    for (let tick = 1; tick <= 54 && !collision; tick++) { const previous = { ...state }; p.step(state, c.context.input);
      for (const h of [...c.context.committed, ...c.context.candidate.hazards]) if (p.hit(previous, state, h, .15)) { collision = { id: h.id, profile: h.collisionProfile, tick, previous, next: { ...state } }; break; }
    }
    assert.deepEqual(collision, c.prefixCollision); assert.equal(c.classification, 'unsafe-required-held-prefix'); verifiedPrefixContacts++;
  }
}
assert.equal(audits, benchmark.audits); assert.equal(benchmark.violations, 0); const benchmarkReplays = audits;
const browser = json('logs/flow-browser.json'); assert.equal(browser.smoke, false); assert.equal(browser.results.length, 4);
assert.equal(browser.screenshots.length, 22); assert.deepEqual([...browser.screenshots].sort(), [...config.screenshots].sort());
for (const r of browser.results) {
  assert.equal(r.errors.length, 0); assert.equal(r.glbRequests, 6); assert.equal(r.restarts.samples.length, 10);
  for (const sample of r.restarts.samples) assert.deepEqual({ ...sample, heap: undefined }, { ...r.restarts.before, heap: undefined });
  assert.ok(r.distance > 650); assert.ok(entries.has(`logs/flow-${r.variant}-${r.viewport}-cpu.json`));
}
const videos = [...browser.results.filter(r => r.video).map(r => r.video), ...browser.guided.map(r => r.video)]; assert.equal(videos.length, 5);
for (const v of videos) { const data = entries.get('videos/' + v.filename); assert.equal(data?.length, v.bytes); assert.equal(data.readUInt32BE(0), 0x1a45dfa3);
  assert.equal(v.decoded.length, 2); assert.notEqual(v.decoded[0].hash, v.decoded[1].hash); assert.ok(v.decoded.every(f => f.width > 0 && f.height > 0)); }
for (const name of browser.screenshots) assert.ok(entries.get('screenshots/' + name)?.length > 1024, name);
assert.equal(browser.impact.hits, 1); assert.ok(browser.impact.damaged.kind >= 4);
assert.equal(new Set(browser.stages.filter(s => !s.screenshot.includes('portrait') && !s.screenshot.includes('landscape')).map(s => s.target.kind)).size, 5);
assert.ok(browser.stages.every(s => s.hits === 0));
const exported = json('logs/flow-browser-export.json'); assert.equal(exported.version, 'mixed-flow-v1'); assert.equal(exported.publications.length, 16); assert.ok(exported.inputRuns.length <= 128);
for (const o of exported.publications) if (o.witness) replay(o.witness);
const patch = entries.get('changes/baseline-to-head.patch'); assert.ok(patch.equals(git('diff', '--binary', '--full-index', baseline, head)));
execFileSync('git', ['apply', '--reverse', '--check', '--cached'], { input: patch, maxBuffer: 16 * 1024 * 1024 });
const result = { path, bytes: bytes.length, sha256: sha(bytes), entries: entries.size, inventoryVerified: inventory.length, snapshotFiles, legacySourceFiles, baseline, head,
  checks: 13, unitTests: 187, browserTests: 65, benchmarkWitnessReplays: benchmarkReplays, archiveBrowserWitnessReplays: audits - benchmarkReplays,
  verifiedRequiredPrefixContacts: verifiedPrefixContacts, pairedOrdinaryInputRuns: 84, supplementaryWitnessRuns: 6, deterministicRepeat: true,
  screenshots: 22, nativeDecodedVideos: 5, productionByteIdentical: true, approvedModelComparisons: 64,
  reversePatchCheck: true, preservedUserWorkVerified: true, A: { committed: a.committed, completed: a.completed }, B: { committed: b.committed, completed: b.completed } };
await writeFile(`${path}.verification.json`, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
