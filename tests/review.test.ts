import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createZip, readZip } from '../scripts/zip.mjs';
import { containsSecret, excludedPath } from '../scripts/review-safety.mjs';
import { verificationReport } from '../scripts/review-reports.mjs';

test('review ZIP preserves binary models and UTF-8 documentation', () => {
  const entries = [{ name: 'project_snapshot/model.glb', data: Buffer.from([0, 255, 128, 12, 0]) }, { name: 'reports/ASSETS.md', data: Buffer.from('Kenney · CC0') }];
  const archive = createZip(entries);
  const reopened = readZip(archive);
  assert.equal(reopened.size, entries.length);
  for (const entry of entries) assert.deepEqual(reopened.get(entry.name), entry.data);
});

test('review ZIP rejects traversal, absolute paths, duplicates and corruption', () => {
  for (const name of ['../secret', '/absolute', 'C:/absolute', 'a/../b', 'a\\b', 'a//b']) assert.throws(() => createZip([{ name, data: Buffer.alloc(0) }]));
  assert.throws(() => createZip([{ name: 'same', data: Buffer.alloc(0) }, { name: 'same', data: Buffer.alloc(0) }]));
  const archive = createZip([{ name: 'file', data: Buffer.from('data') }]);
  archive[35] = archive[35]! ^ 255;
  assert.throws(() => readZip(archive));
});

test('review safety excludes caches, secrets and credentials while retaining source assets', () => {
  for (const name of ['.env', '.env.local', 'public/.env', 'key.pem', 'node_modules/x', '.git/HEAD', 'dist/index.html', 'review-packages/out.zip', '.aws/credentials']) assert.equal(excludedPath(name), true, name);
  for (const name of ['src/main.ts', 'public/assets/kenney-space/meteor.glb', 'package-lock.json', 'AGENTS.md']) assert.equal(excludedPath(name), false, name);
  assert.equal(containsSecret(Buffer.from('ghp_' + 'a'.repeat(36))), true);
  assert.equal(containsSecret(Buffer.from('Space Runner public source')), false);
});

test('review evidence text comes from the current task configuration, not Phase 2 fixtures', () => {
  const report = verificationReport({ taskId: 'EXAMPLE-TASK', evidenceNotes: ['Current collision screenshot'], limitations: ['Current limitation'] }, { checks: [{ command: 'npm run test', exitCode: 0, log: 'test.log' }], productionBuild: { totalBytes: 123, files: [], gzipMethod: 'test method' } }, { unit: 4, browser: 2 }, 'current-head', 'now', []);
  assert.match(report, /EXAMPLE-TASK/);
  assert.match(report, /Current collision screenshot/);
  assert.match(report, /Current limitation/);
  assert.match(report, /4 unit tests and 2 browser tests passed/);
  assert.doesNotMatch(report, /desktop-models\.png|Phase 2|30→31/);
});
