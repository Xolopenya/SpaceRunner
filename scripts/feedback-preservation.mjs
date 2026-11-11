import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { withoutFeedbackInstrumentation } from '../tests/fixtures/feedback-instrumentation.ts';

export const base = '8edfec076ef3860eea33058ce6da2a678e31dbf4';
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const allowed = new Set(['src/core/game-model.ts', 'src/debug/runtime-game-model.ts', 'src/release/model.ts',
  'src/collectibles/run.ts', 'src/collectibles/view.ts', 'src/audio/audio-manager.ts', 'src/audio/graph.ts',
  'src/game.ts', 'src/world.ts', 'src/ui.ts', 'src/visuals/impact-vfx.ts']);
const paths = git('ls-tree', '-r', '--name-only', base, 'src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts').toString().trim().split('\n');
const hashes = [], changed = [];
for (const path of paths) {
  const before = git('show', `${base}:${path}`).toString().replaceAll('\r\n', '\n');
  const data = await readFile(path), after = data.toString().replaceAll('\r\n', '\n');
  // Git's diff understands attributes/binary files; do not normalize binary assets.
  const diff = git('diff', base, '--', path);
  if (diff.length) { assert.ok(allowed.has(path), `Unexpected protected change: ${path}`); changed.push(path); }
  if (path === 'src/core/game-model.ts') assert.equal(withoutFeedbackInstrumentation(after), before, 'Original gameplay executable lines changed');
  hashes.push({ path, sha256: createHash('sha256').update(data).digest('hex'), changed: diff.length > 0 });
}
git('diff', '--check');
const report = { base, checked: paths.length, changed, unchanged: paths.length - changed.length,
  originalGameRules: 'Exact baseline after removing only labelled additive event hooks',
  protected: 'Ship/input/fixed loop/FlightCamera, collider math/settings, generator/director/validators, rewards/assets/dependencies unchanged', files: hashes };
await mkdir('.cache/review/FEEDBACK-001A', { recursive: true });
await writeFile('.cache/review/FEEDBACK-001A/preservation.json', JSON.stringify(report, null, 2));
const inputPaths = git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src', 'tests', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'playwright.config.ts', 'tsconfig.json').toString().split('\0').filter(Boolean);
const inputs = [];
for (const path of inputPaths) {
  const text = ['.ts', '.mjs', '.json', '.html', '.css', '.py'].includes(extname(path));
  const data = await readFile(path);
  inputs.push({ path, text, sha256: createHash('sha256').update(text ? data.toString().replaceAll('\r\n', '\n') : data).digest('hex') });
}
await writeFile('.cache/review/FEEDBACK-001A/validated-inputs.json', JSON.stringify(inputs, null, 2));
console.log(JSON.stringify({ ...report, files: undefined }, null, 2));
