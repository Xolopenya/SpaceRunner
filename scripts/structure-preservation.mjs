import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, lstat, symlink, readdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { RuntimeGameModel } from '../src/debug/runtime-game-model.ts';
import { pressureInputs } from '../tests/fixtures/pressure-simulation.ts';

const baseline = '56824ad60b0f2583589d6b21de4dfce8db43c07d', root = process.cwd();
const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003B/final');
const snapshot = resolve('.cache/review/GAMEPLAY-EXPERIMENT-003B/approved-003a');
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const sha = b => createHash('sha256').update(b).digest('hex');
await mkdir(output, { recursive: true }); await mkdir(snapshot, { recursive: true });
git('merge-base', '--is-ancestor', baseline, 'main');
const unchanged = ['src/config.ts', 'src/core/ship.ts', 'src/core/obstacles.ts', 'src/core/collision.ts', 'src/core/hazard-collision.ts',
  'src/core/hazard-profile.ts', 'src/core/field-clearance.ts', 'src/core/field-generator.ts', 'src/core/field-patterns.ts',
  'src/core/field-pattern-source.ts', 'src/core/field-policy.ts', 'src/core/field-settings.ts', 'src/core/field-director-settings.ts',
  'src/core/field-ownership.ts', 'src/assets/asset-manager.ts', 'src/assets/catalog.ts', 'src/game.ts', 'src/input.ts', 'src/game-loop.ts',
  'src/styles.css', 'index.html', 'package.json', 'package-lock.json'];
for (const path of unchanged) assert.equal(sha(Buffer.from((await readFile(path, 'utf8')).replaceAll('\r\n', '\n'))), sha(git('show', `${baseline}:${path}`)), path);
for (const path of git('ls-tree', '-r', '--name-only', baseline).toString().trim().split('\n')) {
  const target = resolve(snapshot, path); assert.ok(target.startsWith(snapshot + '\\') || target.startsWith(snapshot + '/'));
  await mkdir(dirname(target), { recursive: true }); await writeFile(target, path === 'index.html' ? await readFile(path) : git('show', `${baseline}:${path}`));
}
try { assert.ok((await lstat(join(snapshot, 'node_modules'))).isSymbolicLink()); }
catch (e) { if (e.code !== 'ENOENT') throw e; await symlink(join(root, 'node_modules'), join(snapshot, 'node_modules'), 'junction'); }
const { RuntimeGameModel: Approved } = await import(pathToFileURL(join(snapshot, 'src/debug/runtime-game-model.ts')).href);
const observation = m => ({ state: m.state, ship: { ...m.ship }, elapsed: m.elapsed, distance: m.distance, hull: m.hull, hits: m.hitSerial,
  score: m.score, geometry: m.field.ledger.knownHazards(m.distance), outcome: { section: m.field.lastOutcome?.section, status: m.field.lastOutcome?.status, reason: m.field.lastOutcome?.reason },
  witness: m.field.certificate?.hash, scheduled: m.field.scheduled, committed: m.field.committed, omitted: m.field.omitted });
const differentials = [];
for (const policy of ['baseline', 'pressure']) for (const seed of [0, 11, 42]) for (const history of ['neutral', 'top-right', 'horizontal', 'irregular']) {
  const a = new Approved(policy), b = new RuntimeGameModel(policy), tape = pressureInputs(seed, history, 3600); a.ready(); b.ready(); a.start(seed); b.start(seed);
  for (let tick = 0; tick < tape.length && a.state === 'PLAYING'; tick++) { a.step(1 / 120, tape[tick]); b.step(1 / 120, tape[tick]); if (tick % 120 === 0) assert.deepEqual(observation(b), observation(a)); }
  assert.deepEqual(observation(b), observation(a)); differentials.push({ policy, seed, history, hash: sha(JSON.stringify(observation(a))) }); a.dispose(); b.dispose();
}
const npm = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const build = execFileSync(process.execPath, [npm, 'run', 'build'], { cwd: snapshot, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
await writeFile(join(output, 'structure-approved-build.log'), build);
async function inventory(dir, prefix = '') {
  const rows = []; for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) rows.push(...await inventory(join(dir, e.name), prefix + e.name + '/'));
    else { const bytes = await readFile(join(dir, e.name)); rows.push({ path: prefix + e.name, bytes: bytes.length, sha256: sha(bytes) }); }
  } return rows.sort((a, b) => a.path.localeCompare(b.path));
}
const approvedBuild = await inventory(join(snapshot, 'dist')), currentBuild = await inventory('dist');
assert.deepEqual(currentBuild, approvedBuild, 'Production build must stay byte-identical');
for (const row of currentBuild.filter(r => r.path.endsWith('.js'))) {
  const js = await readFile(join('dist', row.path), 'utf8');
  for (const marker of ['bulkhead-compound-v1', 'bulkhead-size-contract-v1', 'large-structure-v1']) assert.ok(!js.includes(marker));
}
// The original source-pinned A/B audit remains executable at its original HEAD.
const history = join(output, 'historical-pressure'); await mkdir(history, { recursive: true });
const historicalLog = execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/pressure-preservation.mjs'], {
  cwd: snapshot, windowsHide: true, env: { ...process.env, REVIEW_RESULT_DIR: history,
    GIT_DIR: git('rev-parse', '--absolute-git-dir').toString().trim(), GIT_WORK_TREE: snapshot }, maxBuffer: 16 * 1024 * 1024 });
await writeFile(join(output, 'structure-historical-pressure.log'), historicalLog);
await writeFile(join(output, 'structure-historical-pressure.json'), await readFile(join(history, 'pressure-preservation.json')));
const result = { baseline, protectedSources: unchanged, differentials, productionByteIdentical: true, currentBuild,
  bytes: currentBuild.reduce((n, f) => n + f.bytes, 0), historicalPressureAudit: 'Original script and assertions run at approved56824ad snapshot; no guard/golden changes.',
  adaptation: 'Approved tracked blobs in ignored snapshot; local installed dependencies via junction; same index.html checkout line endings. Historical child inherits read-only Git metadata with its snapshot as GIT_WORK_TREE, as in the established runtime-history workflow. Runtime timing fields excluded from deterministic model comparisons.' };
await writeFile(join(output, 'structure-preservation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ baseline, differentials: differentials.length, productionByteIdentical: true, bytes: result.bytes }, null, 2));
