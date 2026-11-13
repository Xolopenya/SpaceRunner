import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

export const base = '5f5a4282d110187d7549e38366051ccfab139f6d';
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const allowed = new Set(['src/core/game-model.ts', 'src/events/game-events.ts', 'src/feedback/orchestrator.ts',
  'src/game.ts', 'src/world.ts', 'src/ui.ts', 'src/visuals/impact-vfx.ts', 'src/visuals/engine-vfx.ts', 'src/styles.css', 'index.html']);
const paths = git('ls-tree', '-r', '--name-only', base, 'src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts').toString().trim().split('\n');
const hashes = [], changed = [];
for (const path of paths) {
  const before = git('show', `${base}:${path}`).toString().replaceAll('\r\n', '\n');
  const data = await readFile(path), after = data.toString().replaceAll('\r\n', '\n');
  // Git's diff understands attributes/binary files; do not normalize binary assets.
  const diff = git('diff', base, '--', path);
  if (diff.length) { assert.ok(allowed.has(path), `Unexpected protected change: ${path}`); changed.push(path); }
  if (path === 'src/core/game-model.ts') assert.equal(after.replace(/^\s*obstaclePose: Object.freeze\(\{ radius: hazard.radius, phase: hazard.phase, spin: hazard.spin, distance: this.distance \}\),\n/m, ''), before, 'Only the copied observation payload may extend GameModel');
  hashes.push({ path, sha256: createHash('sha256').update(data).digest('hex'), changed: diff.length > 0 });
}
git('diff', '--check');
const report = { base, checked: paths.length, changed, unchanged: paths.length - changed.length,
  originalGameRules: 'Entire 001A GameModel matches after removing the one copied obstaclePose line',
  protected: 'Ship/input/fixed loop/FlightCamera, collider math/settings, generator/director/validators, rewards/assets/dependencies unchanged', files: hashes };
await mkdir('.cache/review/FEEDBACK-001B', { recursive: true });
await writeFile('.cache/review/FEEDBACK-001B/preservation.json', JSON.stringify(report, null, 2));
const inputPaths = git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src', 'tests', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'playwright.config.ts', 'tsconfig.json').toString().split('\0').filter(Boolean);
const inputs = [];
for (const path of inputPaths) {
  const text = ['.ts', '.mjs', '.json', '.html', '.css', '.py'].includes(extname(path));
  const data = await readFile(path);
  inputs.push({ path, text, sha256: createHash('sha256').update(text ? data.toString().replaceAll('\r\n', '\n') : data).digest('hex') });
}
await writeFile('.cache/review/FEEDBACK-001B/validated-inputs.json', JSON.stringify(inputs, null, 2));
console.log(JSON.stringify({ ...report, files: undefined }, null, 2));
