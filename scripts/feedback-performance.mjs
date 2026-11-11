import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { openGame, advance, chromium } from './release-browser-lib.mjs';

const dir = resolve('.cache/review/FEEDBACK-001A');
const base = '8edfec076ef3860eea33058ce6da2a678e31dbf4';
const frozen = resolve(dir, 'baseline-source'), mode = process.argv[2];
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
if (mode === 'freeze') {
  const paths = git('ls-tree', '-r', '--name-only', base, 'src', 'public', 'index.html', 'package.json', 'vite.config.ts').toString().trim().split('\n');
  for (const path of paths) { const target = resolve(frozen, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, git('show', `${base}:${path}`)); }
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--base', '/'], { cwd: frozen, stdio: 'inherit', windowsHide: true });
  process.exit(0);
}
assert.equal(mode, 'measure');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
const stats = array => { const a = [...array].sort((x, y) => x - y); return { n: a.length, p50: a[Math.floor(a.length * .5)], p95: a[Math.floor(a.length * .95)], max: a.at(-1) }; };
try {
  for (const source of ['baseline', 'candidate']) {
    const port = source === 'baseline' ? 5196 : 5197;
    const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { cwd: source === 'baseline' ? frozen : process.cwd(), stdio: 'ignore', windowsHide: true });
    try {
      const url = `http://127.0.0.1:${port}/`;
      let ready = false;
      for (let i = 0; i < 100; i++) { try { ready = (await fetch(url)).ok; if (ready) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
      assert.ok(ready, 'Local preview unavailable');
      for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        const r = await openGame(browser, url, { viewport, seed: 42 });
        await advance(r.page, undefined, 900);
        const raw = await r.page.evaluate(() => new Promise(resolve => {
          const raf = [], cpu = [], calls = []; let previous = performance.now();
          const frame = () => {
            const now = performance.now(); raf.push(now - previous); previous = now;
            const at = performance.now(); window.releaseStep(); window.releaseStep(); cpu.push(performance.now() - at);
            calls.push(window.releaseQA.world.renderer.info.render.calls);
            if (raf.length < 600) window.nativeRAF(frame);
            else {
              const g = window.releaseQA, m = g.model;
              resolve({ raf, cpu, calls, memory: { ...g.world.renderer.info.memory }, programs: g.world.renderer.info.programs.length,
                subscribers: m.events?.subscriberCount ?? 0, dropped: m.events?.dropped ?? 0,
                state: { ship: m.ship, elapsed: m.elapsed, distance: m.distance, hull: m.hull, phase: m.phase,
                  hazards: m.field.slots, fragments: m.fragments.slots, count: m.fragments.count, publications: m.field.events, mine: m.homing.current } });
            }
          }; window.nativeRAF(frame);
        }));
        assert.deepEqual(r.errors, []); assert.deepEqual(r.failed, []); assert.equal(raw.dropped, 0);
        const stateHash = createHash('sha256').update(JSON.stringify(raw.state)).digest('hex');
        const row = { source, viewport, browser: browser.version(), summary: { raf: stats(raw.raf), cpu: stats(raw.cpu), calls: stats(raw.calls) }, stateHash, ...raw };
        rows.push(row); await r.context.close(); console.log(source, viewport.width, JSON.stringify(row.summary));
      }
    } finally { server.kill(); }
  }
  for (let i = 0; i < 2; i++) assert.equal(rows[i].stateHash, rows[i + 2].stateHash, 'Matched fixed-cadence complete state changed');
  await writeFile(resolve(dir, 'performance.json'), JSON.stringify({ base, method: 'Sequential production Chrome; 900 warmup fixed ticks, 600 native RAF frames with 2 fixed steps per frame; existing certificate pilot; two viewports. Small sample, not a phone or general FPS guarantee.', rows }, null, 2));
} finally { await browser.close(); }
