import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, lstat, symlink, readdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { RuntimeGameModel } from '../src/debug/runtime-game-model.ts';
import { pressureInputs } from '../tests/fixtures/pressure-simulation.ts';

const baseline = '928b88a2cc266f5086711da5b4e9f3424b01620d', root = process.cwd();
const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003A/final');
const snapshot = resolve('.cache/review/GAMEPLAY-EXPERIMENT-003A/approved-b5a');
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(output, { recursive: true }); await mkdir(snapshot, { recursive: true });
const preserved = ['src/config.ts', 'src/core/ship.ts', 'src/core/game-model.ts', 'src/core/obstacles.ts',
  'src/core/hazard-collision.ts', 'src/core/collision.ts', 'src/core/field-clearance.ts', 'src/core/field-validator.ts',
  'src/core/field-validator-types.ts', 'src/core/field-generator.ts', 'src/core/field-patterns.ts', 'src/core/field-pattern-source.ts',
  'src/core/field-runtime-session.ts', 'src/core/field-ownership.ts', 'src/core/field-section.ts', 'src/world.ts',
  'src/input.ts', 'src/game-loop.ts', 'src/game.ts', 'src/styles.css', 'index.html', 'package.json', 'package-lock.json'];
for (const path of preserved) assert.equal(sha(Buffer.from((await readFile(path, 'utf8')).replaceAll('\r\n', '\n'))), sha(git('show', `${baseline}:${path}`)), `Protected ${path}`);
for (const path of git('ls-tree', '-r', '--name-only', baseline).toString().trim().split('\n')) {
  const target = resolve(snapshot, path); assert.ok(target.startsWith(snapshot + '\\') || target.startsWith(snapshot + '/'));
  await mkdir(dirname(target), { recursive: true });
  const bytes = git('show', `${baseline}:${path}`);
  // Match the existing checkout's HTML line endings for a byte-level Vite comparison.
  await writeFile(target, path === 'index.html' ? await readFile(path) : bytes);
}
try { assert.ok((await lstat(join(snapshot, 'node_modules'))).isSymbolicLink()); }
catch (e) { if (e.code !== 'ENOENT') throw e; await symlink(join(root, 'node_modules'), join(snapshot, 'node_modules'), 'junction'); }
const { RuntimeGameModel: ApprovedModel } = await import(pathToFileURL(join(snapshot, 'src/debug/runtime-game-model.ts')).href);
const differentials = [];
for (const seed of [0, 11, 42]) for (const history of ['neutral', 'top-right', 'horizontal', 'irregular']) {
  const a = new ApprovedModel(), b = new RuntimeGameModel('baseline'), tape = pressureInputs(seed, history, 7200);
  a.ready(); b.ready(); a.start(seed); b.start(seed);
  let samples = 0;
  const observation = m => ({ state: m.state, ship: { ...m.ship }, elapsed: m.elapsed, distance: m.distance, hull: m.hull,
    hits: m.hitSerial, score: m.score, geometry: m.field.ledger.knownHazards(m.distance),
    section: m.field.lastOutcome?.section, status: m.field.lastOutcome?.status, reason: m.field.lastOutcome?.reason,
    witness: m.field.certificate?.hash, scheduled: m.field.scheduled, committed: m.field.committed, omitted: m.field.omitted });
  for (let t = 0; t < tape.length && a.state === 'PLAYING'; t++) {
    a.step(1 / 120, tape[t]); b.step(1 / 120, tape[t]);
    if (t % 120 === 0 || a.field.events.length !== samples) { assert.deepEqual(observation(b), observation(a)); samples = a.field.events.length; }
  }
  assert.deepEqual(observation(b), observation(a)); differentials.push({ seed, history, elapsed: a.elapsed, hash: sha(JSON.stringify(observation(a))) }); a.dispose(); b.dispose();
}
const npm = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const build = execFileSync(process.execPath, [npm, 'run', 'build'], { cwd: snapshot, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
await writeFile(join(output, 'pressure-approved-build.log'), build);
async function inventory(dir, prefix = '') {
  const rows = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) rows.push(...await inventory(join(dir, e.name), prefix + e.name + '/'));
    else { const b = await readFile(join(dir, e.name)); rows.push({ path: prefix + e.name, bytes: b.length, sha256: sha(b) }); }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
const approvedBuild = await inventory(join(snapshot, 'dist')), currentBuild = await inventory(join(root, 'dist'));
assert.deepEqual(currentBuild, approvedBuild, 'Production build changed');
const result = { baseline, protectedSources: preserved, differentials, productionByteIdentical: true,
  currentBuild, bytes: currentBuild.reduce((n, f) => n + f.bytes, 0), adaptation: 'Approved tracked Git blobs in ignored snapshot; installed dependency junction; index.html uses the same checkout line endings. No original assertion or golden changed.' };
await writeFile(join(output, 'pressure-preservation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ baseline, protectedSources: preserved.length, baselineModelDifferentials: differentials.length, productionByteIdentical: true, bytes: result.bytes }, null, 2));
