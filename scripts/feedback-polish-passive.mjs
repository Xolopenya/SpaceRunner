import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Run the ORIGINAL unchanged native-RAF audio smoke against both production builds.
const dir = resolve('.cache/review/FEEDBACK-001B1'), rows = [];
for (const source of ['baseline', 'final']) {
  const output = resolve(dir, `passive-${source}`); await mkdir(output, { recursive: true });
  const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5196', '--strictPort'],
    { cwd: source === 'baseline' ? resolve(dir, 'baseline-source') : process.cwd(), windowsHide: true, stdio: 'ignore' });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { ready = (await fetch('http://127.0.0.1:5196/')).ok; if (ready) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    assert.ok(ready);
    const html = await (await fetch('http://127.0.0.1:5196/')).text();
    const script = html.match(/src="([^"]+\.js)"/)[1];
    const bundle = Buffer.from(await (await fetch(new URL(script, 'http://127.0.0.1:5196/'))).arrayBuffer());
    const log = await open(resolve(output, 'browser.log'), 'w');
    const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--project=audio', '--grep', 'hotfix production', '--repeat-each=2'],
      { env: { ...process.env, HOTFIX_PUBLIC_URL: 'http://127.0.0.1:5196/', REVIEW_RESULT_DIR: output }, stdio: ['ignore', log.fd, log.fd], windowsHide: true });
    const exit = await new Promise(resolve => child.once('exit', code => resolve(code))); await log.close();
    const report = JSON.parse(await readFile(resolve(output, 'browser-results.json'), 'utf8'));
    rows.push({ source, bundle: script, sha256: createHash('sha256').update(bundle).digest('hex'), exit, stats: report.stats });
    console.log(JSON.stringify(rows.at(-1)));
  } finally { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
}
await writeFile(resolve(dir, 'passive-comparison.json'), JSON.stringify({ method: 'Original unmodified production audio smoke, seed11, natural RAF, no steering/model access, same Chrome/host, two repeats per exact built version. No timeout/assertion changes.', rows }, null, 2));
