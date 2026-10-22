import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });

export async function verify(taskId, extraChecks = []) {
  const directory = resolve(root, '.cache/review', taskId, 'final');
  await mkdir(directory, { recursive: true });
  const head = git('rev-parse', 'HEAD').toString().trim();
  const env = { ...process.env, NO_COLOR: '1', REVIEW_RESULT_DIR: directory };
  delete env.FORCE_COLOR;
  const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const commands = ['typecheck', 'test', 'build', 'test:browser'].map(name => ({ name, command: `npm run ${name}`, executable: process.execPath, args: [npmCli, 'run', name] }));
  commands.push({ name: 'diff-check', command: 'git diff --check', executable: 'git', args: ['diff', '--check'] });
  commands.push({ name: 'source-safety', command: 'node scripts/review-static.mjs', executable: process.execPath, args: ['scripts/review-static.mjs'] });
  commands.push({ name: 'build-analysis', command: 'node scripts/build-analysis.mjs', executable: process.execPath, args: ['scripts/build-analysis.mjs'] });
  for (const check of extraChecks) {
    if (!/^[a-z0-9-]+$/.test(check.name) || !/^scripts\/[a-z0-9-]+\.mjs$/.test(check.script) || commands.some(command => command.name === check.name)) throw new Error('Unsafe/duplicate review check');
    const args = check.stripTypes ? ['--experimental-strip-types', check.script] : [check.script];
    commands.push({ name: check.name, command: `node ${args.join(' ')}`, executable: process.execPath, args });
  }
  const checks = [];
  for (const command of commands) {
    const log = `${command.name.replaceAll(':', '-')}.log`;
    console.log(`\nRunning ${command.command}`);
    const stream = createWriteStream(join(directory, log));
    const exitCode = await new Promise((resolveCode, reject) => {
      const child = spawn(command.executable, command.args, { cwd: root, env, windowsHide: true });
      child.stdout.on('data', data => { stream.write(data); process.stdout.write(data); });
      child.stderr.on('data', data => { stream.write(data); process.stderr.write(data); });
      child.on('error', error => { stream.end(); reject(error); });
      child.on('close', code => stream.end(() => resolveCode(code ?? 1)));
    });
    checks.push({ command: command.command, exitCode, log });
    if (exitCode !== 0) break;
  }
  const files = [];
  async function measure(directoryPath, prefix = '') {
    for (const item of await readdir(directoryPath, { withFileTypes: true })) {
      const relative = prefix + item.name;
      if (item.isDirectory()) await measure(join(directoryPath, item.name), relative + '/');
      else {
        const bytes = await readFile(join(directoryPath, item.name));
        files.push({ path: relative, bytes: bytes.length, ...(relative.endsWith('.js') ? { gzipBytes: gzipSync(bytes).length } : {}) });
      }
    }
  }
  if (checks.find(check => check.command === 'npm run build')?.exitCode === 0) await measure(join(root, 'dist'));
  const result = { head, generatedAt: new Date().toISOString(), checks, productionBuild: { totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), gzipMethod: 'Node zlib.gzipSync, default options; Vite rounded estimate is preserved in build.log', files } };
  await writeFile(join(directory, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
  if (checks.length !== commands.length || checks.some(check => check.exitCode !== 0)) throw new Error(`Verification failed; actual outputs saved in ${directory}`);
  return { directory, result };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile(join(root, 'review.config.json'), 'utf8'));
  await verify(config.taskId, config.extraChecks);
}
