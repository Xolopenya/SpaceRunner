import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { createZip, readZip } from './zip.mjs';
import { excludedPath, containsSecret } from './review-safety.mjs';
import { root, git, verify } from './review-verify.mjs';
import { MODEL_ASSETS } from '../src/assets/catalog.ts';
import { verificationReport } from './review-reports.mjs';
import { reviewWorktree } from './review-worktree.mjs';

const config = JSON.parse(await readFile(join(root, 'review.config.json'), 'utf8'));
const options = process.argv.slice(2);
for (let index = 0; index < options.length; index += 2) {
  const key = options[index], value = options[index + 1];
  if (!value || !['--task', '--baseline'].includes(key)) throw new Error('Usage: npm run review:pack -- [--task ID] [--baseline COMMIT]');
  config[key === '--task' ? 'taskId' : 'baseline'] = value;
}
if (!/^[A-Za-z0-9_-]+$/.test(config.taskId)) throw new Error('Unsafe task identifier');
const baseline = git('rev-parse', '--verify', `${config.baseline}^{commit}`).toString().trim();
const head = git('rev-parse', 'HEAD').toString().trim();
git('merge-base', '--is-ancestor', baseline, head);
const branch = git('branch', '--show-current').toString().trim();
const preservedUntracked = await reviewWorktree(config, root, git);
const preservedIdentity = JSON.stringify(preservedUntracked);

const entries = [], exclusions = [];
function add(name, data) {
  const bytes = Buffer.from(data);
  if (containsSecret(bytes)) throw new Error(`Potential credential detected in ${name}; package not written. Inspect locally without sharing the value.`);
  entries.push({ name, data: bytes });
}
const tree = git('ls-tree', '-rz', '--full-tree', head).toString().split('\0').filter(Boolean);
for (const record of tree) {
  const tab = record.indexOf('\t'), metadata = record.slice(0, tab), name = record.slice(tab + 1);
  if (!metadata.startsWith('100644 blob ') && !metadata.startsWith('100755 blob ')) {
    exclusions.push({ path: name, reason: 'Symlink/submodule/non-regular object' });
    continue;
  }
  if (excludedPath(name)) { exclusions.push({ path: name, reason: 'Unsafe/generated/sensitive path' }); continue; }
  const data = git('show', `${head}:${name}`);
  if (containsSecret(data)) { exclusions.push({ path: name, reason: 'Potential credential signature; contents withheld' }); continue; }
  add(`project_snapshot/${name}`, data);
}
for (const required of ['AGENTS.md', 'package.json', 'package-lock.json', 'src/main.ts', ...MODEL_ASSETS.map(model => `public/assets/kenney-space/${model.file}`)]) {
  if (!entries.some(entry => entry.name === `project_snapshot/${required}`)) throw new Error(`Required snapshot file missing/excluded: ${required}`);
}

const { directory, result } = await verify(config.taskId, config.extraChecks);
if (git('rev-parse', 'HEAD').toString().trim() !== head || JSON.stringify(await reviewWorktree(config, root, git)) !== preservedIdentity) throw new Error('Repository changed during verification; package not written.');
const generatedAt = new Date().toISOString();
const changedRaw = git('diff', '--name-status', '--find-renames', baseline, head).toString();
const changedFiles = changedRaw.trim().split('\n').filter(Boolean).map(line => {
  const [status, ...paths] = line.split('\t');
  return { status, paths };
});
const excludedNames = new Set(exclusions.map(entry => entry.path));
const safeChanges = changedFiles.flatMap(entry => entry.paths).filter(name => !excludedNames.has(name) && !excludedPath(name));
add('changes/baseline-to-head.patch', git('diff', '--binary', '--full-index', baseline, head, '--', ...safeChanges));
add('changes/changed-files.txt', changedRaw);
add('changes/commits.txt', git('log', '--reverse', '--format=%H%n%s%n', `${baseline}..${head}`));
add('changes/head.txt', head + '\n');
add('changes/branch.txt', branch + '\n');
add('changes/remotes.txt', git('remote', '-v'));
add('changes/working-tree-status.txt', git('status', '--porcelain=v1', '--untracked-files=all'));
add('changes/preserved-untracked-inventory.json', JSON.stringify(preservedUntracked, null, 2) + '\n');
add('changes/SUMMARY.md', `# ${config.taskId}\n\nBaseline: ${baseline}\nFinal HEAD: ${head}\nBranch: ${branch}\n\nSee reports/IMPLEMENTATION.md for significant changes. Snapshot blobs are read from HEAD; no working-directory source files are copied.\n\nExclusions: ${JSON.stringify(exclusions)}\n`);

for (const [name, source] of Object.entries(config.reports)) {
  if (excludedPath(source)) throw new Error('Unsafe report source');
  add(`reports/${name}`, git('show', `${head}:${source}`));
}
for (const file of await readdir(directory)) {
  if ((config.intermediateEvidence ?? []).includes(file)) {
    exclusions.push({ path: `logs/${file}`, reason: 'Duplicate worker aggregation cache; complete per-run evidence retained' }); continue;
  }
  if (/\.(?:log|json)$/.test(file)) add(`logs/${file}`, await readFile(join(directory, file)));
}
const baselineDirectory = join(root, '.cache/review', config.taskId, 'baseline');
try {
  for (const file of await readdir(baselineDirectory)) {
    if (/\.(?:log|json)$/.test(file)) add(`logs/baseline/${file}`, await readFile(join(baselineDirectory, file)));
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
// Retain actual diagnostic attempts, including failures, without rewriting them.
for (const name of await readdir(join(root, '.cache/review', config.taskId))) {
  if (name.endsWith('.log')) add(`logs/attempts/${name}`, await readFile(join(root, '.cache/review', config.taskId, name)));
}
for (const name of config.screenshots) {
  if (posix.basename(name) !== name || !name.endsWith('.png')) throw new Error('Unsafe screenshot name');
  add(`screenshots/${name}`, await readFile(join(root, 'test-results', name)));
}
const videoPreviews = [];
for (const name of config.videoPreviews ?? []) {
  if (posix.basename(name) !== name || !name.endsWith('.webm')) throw new Error('Unsafe video preview name');
  const bytes = await readFile(join(root, 'test-results', name));
  if (bytes.length < 4 || bytes.readUInt32BE(0) !== 0x1a45dfa3) throw new Error('Invalid WebM/EBML video preview');
  add(`videos/${name}`, bytes);
  videoPreviews.push({ file: `videos/${name}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), provenance: 'Actual browser canvas capture; see task performance report for capture/audio/HUD limitations.' });
}
const audioPreviews = [];
for (const name of config.audioPreviews ?? []) {
  if (posix.basename(name) !== name || !name.endsWith('.wav')) throw new Error('Unsafe audio preview name');
  const bytes = await readFile(join(root, 'test-results', name));
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Invalid audio preview WAV');
  add(`audio/${name}`, bytes);
  audioPreviews.push({ file: `audio/${name}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), provenance: 'Native OfflineAudioContext render of the actual synthesis/gain graph; not a microphone recording or subjective listening approval.' });
}

const unitOutput = await readFile(join(directory, 'test.log'), 'utf8');
const unitTests = [...unitOutput.matchAll(/^[✔√] (.+?) \([\d.]+ms\)/gm)].map(match => ({ name: match[1], result: 'passed', suite: 'unit' }));
const browserReport = JSON.parse(await readFile(join(directory, 'browser-results.json'), 'utf8'));
const browserTests = [];
function collect(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) browserTests.push({ name: spec.title, project: test.projectName, result: test.results.at(-1)?.status, suite: 'browser' });
    collect(suite.suites);
  }
}
collect(browserReport.suites);
if (!unitTests.length || !browserTests.length || browserTests.some(test => test.result !== 'passed')) throw new Error('Missing/failing machine-readable test evidence');
const assets = MODEL_ASSETS.map(model => {
  const path = `public/assets/kenney-space/${model.file}`;
  const bytes = entries.find(entry => entry.name === `project_snapshot/${path}`).data;
  return { name: model.label, id: model.id, file: path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), author: 'Kenney', source: 'https://kenney.nl/assets/space-kit', license: 'CC0 1.0', originalFormat: 'GLB', conversion: 'None; original file bytes unchanged', transform: 'width' in model ? `Center pivot, width ${model.width}, Y rotation ${model.rotationY}` : 'Center pivot, unit vertex radius; scale by logical hazard radius' };
});
const measurements = config.collisionMeasurements ? JSON.parse(await readFile(join(directory, 'collision-measurements.json'), 'utf8')) : undefined;
if (measurements) add('reports/COLLISION-MEASUREMENTS.json', JSON.stringify(measurements, null, 2) + '\n');
const performanceMeasurements = config.performanceMeasurements ? {
  baseline: JSON.parse(await readFile(join(baselineDirectory, 'vfx-performance.json'), 'utf8')),
  final: JSON.parse(await readFile(join(directory, 'vfx-performance.json'), 'utf8')),
} : undefined;
if (performanceMeasurements) {
  const before = performanceMeasurements.baseline, after = performanceMeasurements.final;
  if (before.browser !== after.browser || before.samples.length !== after.samples.length) throw new Error('Performance browser/fixture mismatch');
  for (let i = 0; i < before.samples.length; i++) {
    const a = before.samples[i], b = after.samples[i];
    for (const key of ['tier', 'viewport', 'seed', 'activeHazards', 'frames', 'renderPixelRatio', 'gpu']) {
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) throw new Error(`Performance fixture mismatch: ${key}`);
    }
  }
  add('reports/PERFORMANCE-MEASUREMENTS.json', JSON.stringify(performanceMeasurements, null, 2) + '\n');
}
const audioMeasurements = config.audioMeasurements ? {
  live: JSON.parse(await readFile(join(directory, 'audio-live.json'), 'utf8')),
  offline: JSON.parse(await readFile(join(directory, 'audio-browser.json'), 'utf8')),
  restarts: JSON.parse(await readFile(join(directory, 'audio-restarts.json'), 'utf8')),
} : undefined;
if (audioMeasurements) add('reports/AUDIO-DIAGNOSTICS.json', JSON.stringify(audioMeasurements, null, 2) + '\n');
const designMeasurements = config.designMeasurements ? JSON.parse(await readFile(join(directory, 'ui-concepts.json'), 'utf8')) : undefined;
if (designMeasurements) {
  if (designMeasurements.baseline !== baseline || designMeasurements.screenshots.length !== config.screenshots.length) throw new Error('Design baseline/screenshot count mismatch');
  for (const shot of designMeasurements.screenshots) {
    const entry = entries.find(entry => entry.name === `screenshots/${shot.name}`);
    if (!entry || createHash('sha256').update(entry.data).digest('hex') !== shot.sha256) throw new Error(`Design screenshot integrity mismatch: ${shot.name}`);
  }
  add('reports/UI-CONCEPT-DIAGNOSTICS.json', JSON.stringify(designMeasurements, null, 2) + '\n');
}
const uiProductionMeasurements = config.uiProductionMeasurements ? JSON.parse(await readFile(join(directory, 'ui-production.json'), 'utf8')) : undefined;
if (uiProductionMeasurements) {
  if (uiProductionMeasurements.baseline !== baseline || uiProductionMeasurements.screenshots.length !== config.screenshots.length) throw new Error('Production UI evidence identity mismatch');
  for (const shot of uiProductionMeasurements.screenshots) {
    const entry = entries.find(entry => entry.name === `screenshots/${shot.name}`);
    if (!entry || createHash('sha256').update(entry.data).digest('hex') !== shot.sha256) throw new Error(`Production UI screenshot mismatch: ${shot.name}`);
  }
  add('reports/UI-PRODUCTION-DIAGNOSTICS.json', JSON.stringify(uiProductionMeasurements, null, 2) + '\n');
}
const manifest = {
  project: 'Space Runner', taskId: config.taskId, repository: config.repository, baselineCommit: baseline, finalCommit: head, branch, generatedAt,
  changedFiles, checks: result.checks, tests: [...unitTests, ...browserTests], productionBuild: result.productionBuild,
  integratedAssets: assets, knownBlockers: config.knownBlockers ?? [], exclusions, collisionMeasurements: measurements, performanceMeasurements, audioMeasurements, audioPreviews, videoPreviews, designMeasurements, uiProductionMeasurements,
  limitations: config.limitations ?? [], evidenceNotes: config.evidenceNotes ?? [],
};
add('reports/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
add('reports/VERIFICATION.md', verificationReport(config, result, { unit: unitTests.length, browser: browserTests.length }, head, generatedAt, exclusions));
add('README-REVIEW.md', `# ${config.taskId} external architecture review\n\nReview branch ${branch} at ${head} against ${baseline}.\n\nStart with ${Object.keys(config.reports).map(name => `reports/${name}`).join(', ')}, reports/VERIFICATION.md and reports/manifest.json. Complete committed sources and GLBs are in project_snapshot/. changes/ contains a binary-capable patch and Git metadata; logs/ and screenshots/ contain actual current-task evidence.\n\nTo reconstruct: copy project_snapshot to a new directory, use Node 22.12+ and npm, then run npm ci --ignore-scripts, npm run typecheck, npm run test, npm run build. Installed Chrome is required for npm run test:browser. Review behavior changes, collision/fairness guarantees, ownership and evidence limitations before recommending a merge.\n`);
const contentInventory = entries.map(entry => ({ path: entry.name, bytes: entry.data.length, sha256: createHash('sha256').update(entry.data).digest('hex') }));
add('reports/content-inventory.json', JSON.stringify(contentInventory, null, 2) + '\n');
entries.sort((a, b) => a.name.localeCompare(b.name));
const archive = createZip(entries, new Date(generatedAt));
const outputDirectory = join(root, 'review-packages');
await mkdir(outputDirectory, { recursive: true });
const output = join(outputDirectory, `${config.taskId}-review-${head.slice(0, 7)}.zip`);
await writeFile(output, archive);
const reopened = readZip(await readFile(output));
if (reopened.size !== entries.length) throw new Error('ZIP inventory count mismatch');
for (const entry of entries) if (!reopened.get(entry.name)?.equals(entry.data)) throw new Error(`ZIP content mismatch: ${entry.name}`);
for (const entry of entries) console.log(`${entry.name}\t${entry.data.length} bytes`);
if (JSON.stringify(await reviewWorktree(config, root, git)) !== preservedIdentity) throw new Error('Packaging introduced unexpected project changes');
console.log(`\nVerified readable ZIP: ${resolve(output)}\nArchive size: ${archive.length} bytes\nEntries: ${entries.length}\nSHA256: ${createHash('sha256').update(archive).digest('hex')}`);
