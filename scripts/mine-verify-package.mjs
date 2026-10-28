import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readZip } from './zip.mjs';
import { reviewWorktree } from './review-worktree.mjs';
import { beginTrajectoryReplay, beginKnownFieldValidation } from '../src/core/field-validator.ts';
import { MINE_GEOMETRY as geometry, mineTransaction } from '../src/experiments/moving-mine/source.ts';
import { mineX, isMine } from '../src/experiments/moving-mine/motion.ts';

const git = (...args) => execFileSync('git', args, { maxBuffer: 128 * 1024 * 1024 });
const head = git('rev-parse', 'HEAD').toString().trim(), baseline = '41812b61f23aaeca5295b4112ed75b60c1e78897';
const path = resolve(process.argv[2] ?? `review-packages/GAMEPLAY-EXPERIMENT-003C-review-${head.slice(0,7)}.zip`);
const bytes = await readFile(path), entries = readZip(bytes), sha = b => createHash('sha256').update(b).digest('hex');
function json(name) { assert.ok(entries.has(name), name); return JSON.parse(entries.get(name)); }
const manifest = json('reports/manifest.json'), config = json('project_snapshot/review.config.json');
assert.equal(manifest.finalCommit, head); assert.equal(manifest.baselineCommit, baseline); assert.equal(manifest.taskId, 'GAMEPLAY-EXPERIMENT-003C');
assert.equal(manifest.branch, 'feature/gameplay-003c-moving-space-mine'); assert.equal(manifest.checks.length, 13); assert.ok(manifest.checks.every(c => c.exitCode === 0));
assert.equal(manifest.tests.filter(t => t.suite === 'unit').length, 197);
assert.equal(manifest.tests.filter(t => t.suite === 'browser').length, 69);
assert.ok(manifest.tests.every(t => t.result === 'passed'));
const inventory = json('reports/content-inventory.json'); assert.equal(inventory.length, entries.size - 1);
for (const r of inventory) { assert.equal(entries.get(r.path)?.length, r.bytes); assert.equal(sha(entries.get(r.path)), r.sha256); }
let snapshotFiles = 0; for (const [name, b] of entries) if (name.startsWith('project_snapshot/')) {
  const p = name.slice(17); assert.ok(b.equals(git('show', `${head}:${p}`)), name); snapshotFiles++;
}
for (const prefix of config.preservedUntracked) assert.ok(![...entries.keys()].some(p => p.startsWith('project_snapshot/' + prefix)));
assert.deepEqual(await reviewWorktree(config, process.cwd(), git), json('changes/preserved-untracked-inventory.json'));
const asset = manifest.integratedAssets.find(a => a.id === 'space-mine'); assert.equal(asset.bytes, 56912); assert.equal(asset.license, 'CC0 1.0 Universal');
assert.equal(sha(entries.get('project_snapshot/' + asset.file)), 'c64b8bfa0146ffc7d819f46ab74887326828b2b8266604b516a3cdc570189c77');
const preservation = json('logs/mine-preservation.json'); assert.equal(preservation.productionByteIdentical, true); assert.equal(preservation.comparisons.length, 76);
assert.equal(preservation.bytes, 931651); assert.equal(preservation.build.length, 15);
const evidence = json('logs/mine-witnesses.json'), benchmark = json('logs/mine-benchmark.json');
assert.equal(evidence.runs.length, 30); assert.equal(benchmark.fixtures, 100); assert.equal(benchmark.accepted, 96);
let audits = 0;
function finish(job) { while (!job.getResult()) job.advance(); return job.getResult(); }
for (const w of evidence.witnesses) { const r = finish(beginTrajectoryReplay(w.context, w.controls, { geometry })); assert.equal(r.decision, 'accept'); assert.equal(r.witness.hash, w.hash); audits++; }
for (const f of evidence.fixtures.filter(f => f.name === 'insufficient-reaction')) { const r = finish(beginKnownFieldValidation(f.context, { geometry })); assert.equal(r.decision, 'reject'); assert.equal(r.reason, 'INSUFFICIENT_REACTION_DISTANCE'); }
assert.equal(audits, benchmark.audits);
for (const run of evidence.runs) for (const o of run.publications) assert.ok(o.metrics.searches <= 2 && o.metrics.replays <= 4 && o.metrics.planningTicks <= 144 && o.attempts.length <= 2);
const browser = json('logs/mine-browser.json'); assert.equal(browser.smoke, false); assert.equal(browser.results.length, 4); assert.equal(browser.videos.length, 4);
assert.deepEqual([...browser.screenshots].sort(), [...config.screenshots].sort());
for (const r of browser.results) {
  assert.equal(r.errors.length, 0); assert.equal(r.restarts.samples.length, 10);
  for (const s of r.restarts.samples) assert.deepEqual({ ...s, heap: undefined }, { ...r.restarts.before, heap: undefined });
  assert.equal(r.requests.length, r.variant === 'mine' ? 7 : 6);
  const raw = json(`logs/mine-${r.variant}-${r.viewport}-raw.json`);
  for (const s of raw.steps.filter(s => s.chunk)) assert.ok(s.chunk.propagations <= 3072 && s.chunk.queries <= 6144);
  if (r.variant === 'mine') {
    assert.ok(raw.poses.some(p => Math.abs(p.x) < 1)); assert.ok(new Set(raw.poses.map(p => p.x)).size > 30);
    assert.ok(Number.isFinite(r.video.startedAt));
    for (const p of raw.poses) {
      const id = p.id.split('/'), h = mineTransaction(Number(id[1]), Number(id[2]), Number(id[3]), id[4]).hazards.find(isMine);
      assert.equal(p.x, mineX(h, p.tick / 120)); assert.equal(p.y, h.y); assert.equal(p.z, p.distance - h.passDistance);
      assert.equal(p.renderedX, p.x); assert.equal(p.renderedY, p.y); assert.equal(p.renderedZ, p.z);
    }
  }
}
for (const v of browser.videos) { assert.equal(entries.get('videos/' + v.filename)?.length, v.bytes); assert.notEqual(v.decoded[0].hash, v.decoded[1].hash); }
const patch = entries.get('changes/baseline-to-head.patch');
assert.ok(patch.equals(git('diff', '--binary', '--full-index', baseline, head)));
execFileSync('git', ['apply', '--reverse', '--check', '--binary', '-'], { input: patch, maxBuffer: 8 * 1024 * 1024 });
const result = { path, head, baseline, bytes: bytes.length, sha256: sha(bytes), entries: entries.size, snapshotFiles, inventory: inventory.length,
  independentMovingReplays: audits, negativeReplays: 4, reversePatchApplicable: true, readable: true, productionByteIdentical: true };
await writeFile(path + '.verification.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
