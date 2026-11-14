import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { createHash } from 'node:crypto';
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const base = '2eb974199bfa58ae120dbf9f12e8bf53a6b5da2a', dir = '.cache/review/FEEDBACK-001B1';
const allowed = new Set(['src/world.ts', 'src/visuals/impact-vfx.ts', 'src/visuals/collision-vfx.ts', 'src/visuals/ship-destruction.ts']);
const text = path => ['.ts', '.mjs', '.json', '.html', '.css', '.py', '.md', '.txt'].includes(extname(path));
const normalize = (path, data) => text(path) ? Buffer.from(data.toString().replaceAll('\r\n', '\n')) : data;
const hash = data => createHash('sha256').update(data).digest('hex');
const paths = git('ls-tree', '-r', '--name-only', base, 'src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts').toString().trim().split('\n');
const blobs = execFileSync('git', ['cat-file', '--batch'], { input: paths.map(p => `${base}:${p}\n`).join(''), maxBuffer: 64 * 1024 * 1024 });
let cursor = 0; const files = [], changed = [];
for (const path of paths) {
  const end = blobs.indexOf(10, cursor), size = Number(blobs.subarray(cursor, end).toString().split(' ')[2]); cursor = end + 1;
  const before = normalize(path, blobs.subarray(cursor, cursor + size)), after = normalize(path, await readFile(path)); cursor += size + 1;
  const same = before.equals(after); if (!same) { assert.ok(allowed.has(path), `Protected baseline changed: ${path}`); changed.push(path); }
  files.push({ path, same, sha256: hash(after) });
}
assert.equal(cursor, blobs.length); assert.equal(changed.length, 4);
await writeFile(`${dir}/preservation.json`, JSON.stringify({ base, checked: paths.length, unchanged: paths.length - changed.length, changed, files,
  scope: 'Entire authoritative model, cooldown, input, camera, collision, generation, mines, scoring, UI, audio, assets and dependencies unchanged from001B. Four presentation adapters only.' }, null, 2));
const inputs = git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'src', 'tests', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'playwright.config.ts', 'tsconfig.json').toString().split('\0').filter(Boolean);
await writeFile(`${dir}/validated-inputs.json`, JSON.stringify(await Promise.all(inputs.map(async path => ({ path, text: text(path), sha256: hash(normalize(path, await readFile(path))) }))), null, 2));
git('diff', '--check');
console.log(JSON.stringify({ checked: paths.length, unchanged: paths.length - changed.length, changed, validatedInputs: inputs.length }));
