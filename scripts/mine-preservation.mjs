import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, lstat, symlink, readdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { RuntimeGameModel } from '../src/debug/runtime-game-model.ts';
import { MixedFlowGameModel } from '../src/experiments/mixed-flow/model.ts';
import { LargeStructureGameModel } from '../src/experiments/large-structure/model.ts';
import { StructureVariantsGameModel } from '../src/experiments/structure-variants/model.ts';
import { pressureInputs } from '../tests/fixtures/pressure-simulation.ts';
const baseline = '41812b61f23aaeca5295b4112ed75b60c1e78897', root = process.cwd();
const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003C/final'), snapshot = resolve('.cache/review/GAMEPLAY-EXPERIMENT-003C/approved-b3');
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 }), sha = b => createHash('sha256').update(b).digest('hex');
await mkdir(output, { recursive: true }); await mkdir(snapshot, { recursive: true }); git('merge-base', '--is-ancestor', baseline, 'main');
const paths = git('ls-tree', '-r', '--name-only', baseline).toString().trim().split('\n');
const protectedSources = paths.filter(p => p.startsWith('public/') || p.startsWith('src/audio/') || p.startsWith('src/visuals/') || p.startsWith('src/assets/') || p.startsWith('src/experiments/'));
protectedSources.push('src/config.ts', 'src/core/ship.ts', 'src/core/game-model.ts', 'src/core/obstacles.ts', 'src/core/hazard-collision.ts', 'src/core/hazard-profile.ts',
  'src/core/collision.ts', 'src/core/field-generator.ts', 'src/core/field-patterns.ts', 'src/core/field-pattern-source.ts',
  'src/core/field-settings.ts', 'src/core/field-director-settings.ts', 'src/core/field-policy.ts', 'src/world.ts', 'src/game.ts', 'src/input.ts', 'src/styles.css', 'package.json', 'package-lock.json');
for (const p of protectedSources) {
  const normalize = b => p.startsWith('public/') ? b : Buffer.from(b.toString().replaceAll('\r\n', '\n'));
  assert.equal(sha(normalize(await readFile(p))), sha(normalize(git('show', `${baseline}:${p}`))), p);
}
for (const p of paths) { const target = resolve(snapshot, p); assert.ok(target.startsWith(snapshot + '\\') || target.startsWith(snapshot + '/'));
  await mkdir(dirname(target), { recursive: true }); await writeFile(target, p === 'index.html' ? await readFile(p) : git('show', `${baseline}:${p}`)); }
try { assert.ok((await lstat(join(snapshot, 'node_modules'))).isSymbolicLink()); } catch (e) { if (e.code !== 'ENOENT') throw e; await symlink(join(root, 'node_modules'), join(snapshot, 'node_modules'), 'junction'); }
const { RuntimeGameModel: ApprovedRuntime } = await import(pathToFileURL(join(snapshot, 'src/debug/runtime-game-model.ts')).href);
const { LargeStructureGameModel: ApprovedLarge } = await import(pathToFileURL(join(snapshot, 'src/experiments/large-structure/model.ts')).href);
const { StructureVariantsGameModel: ApprovedVariants } = await import(pathToFileURL(join(snapshot, 'src/experiments/structure-variants/model.ts')).href);
const { MixedFlowGameModel: ApprovedFlow } = await import(pathToFileURL(join(snapshot, 'src/experiments/mixed-flow/model.ts')).href);
function observation(m) { return { state: m.state, ship: { ...m.ship }, hull: m.hull, hits: m.hitSerial, distance: m.distance, elapsed: m.elapsed, score: m.score,
  geometry: m.field.ledger.knownHazards(m.distance), events: m.field.events, witness: m.field.certificate?.hash, committed: m.field.committed, omitted: m.field.omitted }; }
function input(m) { const w = m.field.certificate; let t = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0;
  for (const r of w?.controls ?? []) { if (t < r.ticks) return r.input; t -= r.ticks; } return { x: 0, y: 0 }; }
const comparisons = [];
function compare(a, b, seed, history, label) {
  a.ready(); b.ready(); a.start(seed); b.start(seed); const tape = pressureInputs(seed, history === 'witness' ? 'neutral' : history, 3600);
  for (let tick = 0; tick < 3600 && a.state === 'PLAYING'; tick++) { const axis = history === 'witness' ? input(a) : tape[tick]; a.step(1 / 120, axis); b.step(1 / 120, axis);
    if (tick % 120 === 0) assert.deepEqual(observation(b), observation(a)); }
  assert.deepEqual(observation(b), observation(a)); comparisons.push({ label, seed, history, hash: sha(JSON.stringify(observation(a))) }); a.dispose(); b.dispose();
}
for (const policy of ['baseline', 'pressure']) for (const seed of [0, 11, 42]) for (const history of ['neutral', 'top-right', 'horizontal', 'irregular']) compare(new ApprovedRuntime(policy), new RuntimeGameModel(policy), seed, history, policy);
for (const aperture of ['center', 'left', 'right', 'upper', 'lower']) for (const history of ['neutral', 'witness']) compare(new ApprovedLarge(aperture), new LargeStructureGameModel(aperture), 42, history, `v1/${aperture}`);
for (const aperture of ['center', 'left', 'right', 'upper', 'lower']) for (const mode of ['isolated', 'mixed']) for (const history of ['neutral', 'horizontal', 'witness']) compare(new ApprovedVariants(aperture, mode), new StructureVariantsGameModel(aperture, mode), 42, history, `v2/${mode}/${aperture}`);
const npm = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
for (const seed of [0,11,42]) for (const history of ['neutral','horizontal','irregular','witness']) compare(new ApprovedFlow(), new MixedFlowGameModel(), seed, history, 'mixed-flow');
await writeFile(join(output, 'mine-approved-build.log'), execFileSync(process.execPath, [npm, 'run', 'build'], { cwd: snapshot, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }));
async function inventory(dir, prefix = '') { const rows = []; for (const e of await readdir(dir, { withFileTypes: true })) {
  if (e.isDirectory()) rows.push(...await inventory(join(dir, e.name), prefix + e.name + '/')); else { const b = await readFile(join(dir, e.name)); rows.push({ path: prefix + e.name, bytes: b.length, sha256: sha(b) }); }
} return rows.sort((a, b) => a.path.localeCompare(b.path)); }
const approved = await inventory(join(snapshot, 'dist')), current = await inventory('dist'); assert.deepEqual(current, approved, 'Production byte identity');
const result = { baseline, protectedSources, comparisons, productionByteIdentical: true, build: current, bytes: current.reduce((n, f) => n + f.bytes, 0),
  note: '76 normal-model differential histories protect baseline/pressure, every v1/v2 aperture/mode and12 mixed-flow cases. Protected gameplay/render/audio/VFX/assets and legacy experiment bytes are unchanged. Only DEV motion hooks, identity and snapshots extend shared planning contracts.' };
await writeFile(join(output, 'mine-preservation.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ comparisons: comparisons.length, protectedSources: protectedSources.length, bytes: result.bytes, productionByteIdentical: true }, null, 2));
