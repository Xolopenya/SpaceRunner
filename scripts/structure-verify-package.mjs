import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readZip } from './zip.mjs';
import { reviewWorktree } from './review-worktree.mjs';
import { beginTrajectoryReplay } from '../src/core/field-validator.ts';
import { BULKHEAD_GEOMETRY as geometry } from '../src/experiments/large-structure/encounter.ts';

const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const head = git('rev-parse', 'HEAD').toString().trim(), baseline = '56824ad60b0f2583589d6b21de4dfce8db43c07d';
const path = resolve(process.argv[2] ?? `review-packages/GAMEPLAY-EXPERIMENT-003B-review-${head.slice(0, 7)}.zip`);
const bytes = await readFile(path), entries = readZip(bytes), sha = b => createHash('sha256').update(b).digest('hex');
const json = name => { assert.ok(entries.has(name), name); return JSON.parse(entries.get(name)); };
const manifest = json('reports/manifest.json'), config = json('project_snapshot/review.config.json');
assert.equal(manifest.finalCommit, head); assert.equal(manifest.baselineCommit, baseline); assert.equal(manifest.branch, 'feature/gameplay-003b-large-structure');
assert.equal(manifest.checks.length, 7 + config.extraChecks.length); assert.ok(manifest.checks.every(c => c.exitCode === 0));
assert.equal(manifest.tests.filter(t => t.suite === 'unit').length, 170); assert.equal(manifest.tests.filter(t => t.suite === 'browser').length, 47);
const inventory = json('reports/content-inventory.json'); assert.equal(inventory.length, entries.size - 1);
for (const row of inventory) { const b = entries.get(row.path); assert.ok(b); assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256); }
for (const name of entries.keys()) assert.ok(!/(^|\/)(?:node_modules|dist|\.git|\.cache|review-packages)(\/|$)/.test(name), name);
for (const prefix of config.preservedUntracked) assert.ok(![...entries.keys()].some(p => p.startsWith('project_snapshot/' + prefix)));
assert.deepEqual(await reviewWorktree(config, process.cwd(), git), json('changes/preserved-untracked-inventory.json'));
assert.ok(entries.has('project_snapshot/assets/experimental/bulkhead/LICENSE.txt'));
const preservation = json('logs/structure-preservation.json'); assert.equal(preservation.productionByteIdentical, true); assert.equal(preservation.differentials.length, 24);
const benchmark = json('logs/structure-benchmark.json'), evidence = json('logs/structure-witnesses.json');
assert.equal(benchmark.directAccepted, 240); assert.equal(benchmark.directRejected, 4); assert.equal(benchmark.runtime.length, 36);
const precommit = json('logs/baseline/precommit-structure-benchmark.json');
assert.deepEqual(benchmark.runtime.map(({ ms, ...r }) => r), precommit.runtime.map(({ ms, ...r }) => r), 'deterministic final/precommit runtime identity');
let audits = 0;
function replay(witness) {
  const job = beginTrajectoryReplay(witness.context, witness.controls, witness.geometryVersion ? { geometry } : {});
  while (!job.getResult()) job.advance(); const r = job.getResult(); assert.equal(r.decision, 'accept'); assert.equal(r.witness.hash, witness.hash); audits++;
}
for (const witness of evidence.witnesses) replay(witness);
for (const run of evidence.runtime) for (const witness of run.witnesses) replay(witness);
const browser = json('logs/structure-browser.json'); assert.equal(browser.results.length, 5); assert.equal(browser.variants.length, 10);
for (const c of browser.results) { assert.equal(c.errors.length, 0); assert.equal(c.glbRequests, 6); assert.equal(c.restarts.samples.length, 10); }
const videos = browser.results.filter(c => c.videoBytes); assert.equal(videos.length, 3);
for (const video of videos) { assert.notEqual(video.decodedVideo[0].hash, video.decodedVideo[1].hash); assert.ok(entries.get('videos/' + video.videoFile)?.length > 1024); }
for (const shot of browser.screenshots) assert.ok(entries.get('screenshots/' + shot)?.length > 1024, shot);
assert.ok(entries.get('videos/structure-passage-canvas.webm')?.length > 1024);
const patch = entries.get('changes/baseline-to-head.patch'); assert.ok(patch.equals(git('diff', '--binary', '--full-index', baseline, head)));
execFileSync('git', ['apply', '--reverse', '--check', '--cached'], { input: patch, maxBuffer: 16 * 1024 * 1024 });
const result = { path, bytes: bytes.length, sha256: sha(bytes), entries: entries.size, inventoryVerified: inventory.length, baseline, head,
  checks: manifest.checks.length, unitTests: 170, browserTests: 47, independentArchiveWitnessReplays: audits,
  directAccepted: 240, directRejected: 4, runtimeRuns: 36, screenshots: browser.screenshots.length,
  productionByteIdentical: true, unchangedBaselinePressureDifferentials: 24, reversePatchCheck: true, preservedUserWorkVerified: true };
await writeFile(`${path}.verification.json`, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
