import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readZip } from './zip.mjs';
import { reviewWorktree } from './review-worktree.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const head = git('rev-parse', 'HEAD').toString().trim(), baseline = '928b88a2cc266f5086711da5b4e9f3424b01620d';
const path = resolve(process.argv[2] ?? `review-packages/GAMEPLAY-EXPERIMENT-003A-review-${head.slice(0, 7)}.zip`);
const bytes = await readFile(path), entries = readZip(bytes);
const sha = b => createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(entries.get('reports/manifest.json').toString());
assert.equal(manifest.finalCommit, head); assert.equal(manifest.baselineCommit, baseline);
assert.equal(manifest.branch, 'feature/gameplay-003a-pressure-experiment');
assert.equal(manifest.checks.length, 13); assert.ok(manifest.checks.every(c => c.exitCode === 0));
const inventory = JSON.parse(entries.get('reports/content-inventory.json').toString());
assert.equal(inventory.length, entries.size - 1);
for (const file of inventory) { const b = entries.get(file.path); assert.ok(b); assert.equal(b.length, file.bytes); assert.equal(sha(b), file.sha256); }
for (const name of entries.keys()) assert.ok(!/(^|\/)(?:node_modules|dist|\.git|\.cache|review-packages)(\/|$)/.test(name), name);
const config = JSON.parse(entries.get('project_snapshot/review.config.json'));
for (const prefix of config.preservedUntracked) assert.ok(![...entries.keys()].some(p => p.startsWith('project_snapshot/' + prefix)));
assert.deepEqual(await reviewWorktree(config, process.cwd(), git), JSON.parse(entries.get('changes/preserved-untracked-inventory.json')));
const pressure = JSON.parse(entries.get('logs/pressure-metrics.json'));
assert.equal(pressure.baseline, baseline); assert.equal(pressure.violations, 0); assert.equal(pressure.humanParticipants, 0);
assert.equal(pressure.summaries.length, 456); assert.equal(pressure.repeat.identical, true);
const before = JSON.parse(entries.get('logs/baseline/precommit-pressure-metrics.json'));
const identity = s => JSON.stringify([s.seed, s.history, s.band, s.policy]);
for (const row of pressure.summaries) {
  const old = before.summaries.find(s => identity(s) === identity(row)); assert.ok(old);
  for (const key of ['inputHash', 'geometryHash', 'threats', 'uniqueContacts', 'scheduled', 'committed', 'death']) assert.deepEqual(row[key], old[key]);
}
assert.equal(JSON.parse(entries.get('logs/pressure-preservation.json')).productionByteIdentical, true);
const browser = JSON.parse(entries.get('logs/pressure-browser.json'));
assert.equal(browser.cases.length, 4); assert.ok(browser.cases.every(c => c.errors.length === 0));
for (const c of browser.cases.filter(c => c.video)) assert.notEqual(c.video.decodedFrames[0].hash, c.video.decodedFrames[1].hash);
const patch = entries.get('changes/baseline-to-head.patch');
assert.ok(patch.equals(git('diff', '--binary', '--full-index', baseline, head)));
// --check is read-only; --cached tests the exact committed/index LF bytes.
execFileSync('git', ['apply', '--reverse', '--check', '--cached'], { input: patch, maxBuffer: 16 * 1024 * 1024 });
const result = { path, bytes: bytes.length, sha256: sha(bytes), entries: entries.size, inventoryVerified: inventory.length,
  baseline, head, checks: manifest.checks.length, comparisonRuns: pressure.summaries.length,
  independentAudits: pressure.audits, violations: pressure.violations, productionByteIdentical: true, reversePatchCheck: true };
await writeFile(`${path}.verification.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
