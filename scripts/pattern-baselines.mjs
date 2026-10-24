// Reproduce historical contracts without weakening their source/import guards.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
export const APPROVED_B2 = '4c82ad2dc30f4d309f085cbf3a16a41ffde1c30f';
const sha = b => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });

async function hashes(path, prefix = '') {
  const files = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (item.isDirectory()) files.push(...await hashes(join(path, item.name), prefix + item.name + '/'));
    else { const bytes = await readFile(join(path, item.name)); files.push({ path: prefix + item.name, bytes: bytes.length, sha256: sha(bytes) }); }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function approvedResearch() {
  const snapshot = resolve(root, '.cache/review/GAMEPLAY-001B-3/approved-b2');
  const evidence = resolve(root, '.cache/review/GAMEPLAY-001B-3/baseline');
  await mkdir(evidence, { recursive: true });
  const paths = git('ls-tree', '-r', '--name-only', APPROVED_B2, '--', 'src', 'public', 'tests', 'design',
    'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts').toString().trim().split('\n');
  const adaptation = [];
  for (const path of [...paths, 'scripts/trajectory-benchmark.mjs', 'scripts/field-foundation-benchmark.mjs']) {
    const destination = resolve(snapshot, path);
    assert.ok(destination.startsWith(snapshot + '\\') || destination.startsWith(snapshot + '/'));
    await mkdir(dirname(destination), { recursive: true });
    let bytes = git('show', `${APPROVED_B2}:${path}`);
    if (path === 'index.html') {
      const newline = (await readFile(join(root, path), 'utf8')).includes('\r\n') ? '\r\n' : '\n';
      bytes = Buffer.from(bytes.toString().replaceAll('\r\n', '\n').replaceAll('\n', newline));
    }
    if (path === 'scripts/trajectory-benchmark.mjs') {
      const original = bytes;
      const from = "GIT_DIR: join(root, '.git')", to = "GIT_DIR: process.env.GIT_DIR || join(root, '.git')";
      assert.equal(bytes.toString().split(from).length, 2);
      const vite = "'node_modules/vite/bin/vite.js'";
      assert.equal(bytes.toString().split(vite).length, 2);
      bytes = Buffer.from(bytes.toString().replace(from, to).replace(vite, JSON.stringify(join(root, 'node_modules/vite/bin/vite.js'))));
      adaptation.push({ path, approvedSha256: sha(original), executedSha256: sha(bytes),
        change: 'Path-only bootstrap: nested read-only Git metadata uses inherited actual GIT_DIR; Vite CLI uses the installed absolute path. No physics, seed, guard, work limit, assertion or result logic changes.' });
    }
    await writeFile(destination, bytes);
  }
  const npm = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const env = { ...process.env, REVIEW_RESULT_DIR: evidence, GIT_DIR: git('rev-parse', '--absolute-git-dir').toString().trim(), GIT_WORK_TREE: snapshot };
  for (const [name, args] of [['approved-b2-build', [npm, 'run', 'build']], ['approved-b2-trajectory', ['--experimental-strip-types', 'scripts/trajectory-benchmark.mjs']]]) {
    const output = execFileSync(process.execPath, args, { cwd: snapshot, env, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    await writeFile(join(evidence, `${name}.log`), output);
  }
  // B-2 reproduces the original B-1 command too. Copy curated results out of its cache.
  const inner = join(snapshot, '.cache/review/GAMEPLAY-001B-2/baseline');
  for (const file of await readdir(inner)) if (/\.(json|log)$/.test(file)) await writeFile(join(evidence, `approved-b1-${file}`), await readFile(join(inner, file)));
  const current = await hashes(join(root, 'dist')), approved = await hashes(join(snapshot, 'dist'));
  assert.deepEqual(current, approved, 'Production build differs from approved B-2');
  const result = { baseline: APPROVED_B2, adaptation, approved, current, byteIdentical: true,
    historicalCommands: ['npm run build (approved B-2)', 'node --experimental-strip-types scripts/trajectory-benchmark.mjs (approved B-2)',
      'node --experimental-strip-types scripts/field-foundation-benchmark.mjs (nested approved B-1)'] };
  await writeFile(join(evidence, 'approved-reproduction.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await approvedResearch(), null, 2));
