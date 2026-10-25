import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readZip } from './zip.mjs';
import { reviewWorktree } from './review-worktree.mjs';
import { beginValidation, beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { CONFIG } from '../src/config.ts';
import { WRECK_GEOMETRY as geometry } from '../src/experiments/structure-variants/encounter.ts';

const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const head = git('rev-parse', 'HEAD').toString().trim(), baseline = '6ecae59074ce65a9a4fdf036583a7ba4c97485b4';
const path = resolve(process.argv[2] ?? `review-packages/GAMEPLAY-EXPERIMENT-003B2-review-${head.slice(0, 7)}.zip`);
const bytes = await readFile(path), entries = readZip(bytes), sha = b => createHash('sha256').update(b).digest('hex');
const json = name => { assert.ok(entries.has(name), name); return JSON.parse(entries.get(name)); };
const manifest = json('reports/manifest.json'), config = json('project_snapshot/review.config.json');
assert.equal(manifest.taskId, 'GAMEPLAY-EXPERIMENT-003B2');
assert.equal(manifest.finalCommit, head); assert.equal(manifest.baselineCommit, baseline);
assert.equal(manifest.branch, 'feature/gameplay-003b2-structure-variants');
assert.equal(manifest.checks.length, 12); assert.equal(manifest.checks.length, 7 + config.extraChecks.length);
assert.ok(manifest.checks.every(c => c.exitCode === 0));
assert.equal(manifest.tests.filter(t => t.suite === 'unit').length, 178);
assert.equal(manifest.tests.filter(t => t.suite === 'browser').length, 59);
assert.ok(manifest.tests.every(t => ['passed'].includes(t.result)));
const inventory = json('reports/content-inventory.json'); assert.equal(inventory.length, entries.size - 1);
assert.equal(new Set(inventory.map(r => r.path)).size, inventory.length);
for (const row of inventory) { const b = entries.get(row.path); assert.ok(b, row.path); assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256); }
let snapshotFiles = 0;
for (const [name, b] of entries) {
  assert.ok(!/(^|\/)(?:node_modules|dist|\.git|\.cache|review-packages)(\/|$)/.test(name), name);
  if (name.startsWith('project_snapshot/')) { assert.ok(b.equals(git('show', `${head}:${name.slice(17)}`)), name); snapshotFiles++; }
}
for (const prefix of config.preservedUntracked) assert.ok(![...entries.keys()].some(p => p.startsWith('project_snapshot/' + prefix)));
assert.deepEqual(await reviewWorktree(config, process.cwd(), git), json('changes/preserved-untracked-inventory.json'));
assert.ok(entries.has('project_snapshot/assets/experimental/station-wreck-v2/LICENSE.txt'));
assert.ok(entries.has('project_snapshot/assets/experimental/station-wreck-v2/PROVENANCE.md'));
const preservation = json('logs/variants-preservation.json');
assert.equal(preservation.productionByteIdentical, true); assert.equal(preservation.comparisons.length, 34);
assert.equal(preservation.build.length, 15); assert.equal(preservation.bytes, 931651);
const benchmark = json('logs/variants-benchmark.json'), evidence = json('logs/variants-witnesses.json');
assert.equal(benchmark.directAttempts, 480); assert.equal(benchmark.directAccepted, 476);
assert.equal(benchmark.naturalRejections.length, 4); assert.equal(benchmark.engineeredRejections, 5);
assert.equal(benchmark.runtime.length, 36); assert.equal(evidence.rows.length, 480);
assert.equal(evidence.witnesses.length, 476); assert.equal(evidence.rejections.length, 5);
assert.equal(evidence.rows.filter(r => r.decision === 'reject').length, 4);
assert.ok(benchmark.naturalRejections.every(r => r.reason === 'NO_WITNESS_FOUND'));
const precommit = json('logs/baseline/precommit-variants-benchmark.json');
assert.deepEqual(benchmark.runtime.map(({ ms, ...r }) => r), precommit.runtime.map(({ ms, ...r }) => r), 'deterministic final/precommit runtime identity');
function finish(job) { while (!job.getResult()) job.advance(); return job.getResult(); }
let audits = 0;
function replay(witness) {
  if (witness.geometryVersion) assert.equal(witness.geometryVersion, geometry.version);
  const r = finish(beginTrajectoryReplay(witness.context, witness.controls, witness.geometryVersion ? { geometry } : {}));
  assert.equal(r.decision, 'accept'); assert.equal(r.witness.hash, witness.hash); audits++;
}
for (const witness of evidence.witnesses) replay(witness);
for (const run of evidence.runtime) for (const witness of run.witnesses) replay(witness);
for (const negative of evidence.rejections) {
  const h = negative.context.candidate.hazards[1];
  assert.ok(h.passDistance - negative.context.distance > h.radius + CONFIG.ship.radius + .15);
  const r = finish(beginValidation(negative.context, { geometry }));
  assert.equal(r.decision, 'reject'); assert.equal(r.reason, 'INSUFFICIENT_REACTION_DISTANCE');
}
const browser = json('logs/variants-browser.json'); assert.equal(browser.results.length, 5); assert.equal(browser.variants.length, 15);
for (const c of browser.results) {
  assert.equal(c.errors.length, 0); assert.equal(c.glbRequests, 6); assert.equal(c.restarts.samples.length, 10);
  for (const sample of c.restarts.samples) assert.deepEqual(sample, c.restarts.before);
  if (c.policy !== 'baseline') assert.equal(c.primitiveQueries, c.gameplayProfileUnits);
}
const neutral = browser.variants.filter(v => v.stage === 'neutral-approach');
assert.equal(neutral.length, 5); assert.ok(neutral.every(v => v.ship.x === 0 && v.ship.y === 0));
const hole = a => neutral.find(v => v.aperture === a).holeScreen;
assert.ok(hole('left')[0] < hole('center')[0] - .05); assert.ok(hole('right')[0] > hole('center')[0] + .05);
assert.ok(hole('upper')[1] > hole('center')[1] + .04); assert.ok(hole('lower')[1] < hole('center')[1] - .04);
for (const v of browser.variants) { assert.equal(v.selected, v.aperture); assert.equal(v.mode, 'isolated'); assert.equal(v.hits, 0); }
const videos = browser.results.filter(c => c.videoBytes); assert.equal(videos.length, 3);
for (const video of videos) {
  assert.equal(video.decodedVideo.length, 2); assert.notEqual(video.decodedVideo[0].hash, video.decodedVideo[1].hash);
  assert.equal(entries.get('videos/' + video.videoFile)?.length, video.videoBytes);
}
assert.equal(browser.screenshots.length, 38); assert.deepEqual([...browser.screenshots].sort(), [...config.screenshots].sort());
for (const shot of browser.screenshots) assert.ok(entries.get('screenshots/' + shot)?.length > 1024, shot);
const patch = entries.get('changes/baseline-to-head.patch'); assert.ok(patch.equals(git('diff', '--binary', '--full-index', baseline, head)));
execFileSync('git', ['apply', '--reverse', '--check', '--cached'], { input: patch, maxBuffer: 16 * 1024 * 1024 });
const result = { path, bytes: bytes.length, sha256: sha(bytes), entries: entries.size, inventoryVerified: inventory.length, snapshotFiles, baseline, head,
  checks: manifest.checks.length, unitTests: 178, browserTests: 59, independentArchiveWitnessReplays: audits,
  directAttempts: 480, directAccepted: 476, naturalRejections: 4, initiallyClearReactionRejections: 5, runtimeRuns: 36,
  screenshots: browser.screenshots.length, decodedVideos: videos.length, distinctNeutralAperturesVerified: 5,
  productionByteIdentical: true, unchangedBaselinePressureLegacyDifferentials: 34, reversePatchCheck: true, preservedUserWorkVerified: true };
await writeFile(`${path}.verification.json`, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
