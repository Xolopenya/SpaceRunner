import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { openGame, advance, chromium } from './release-browser-lib.mjs';

const dir = resolve('.cache/review/FEEDBACK-001B');
const base = '5f5a4282d110187d7549e38366051ccfab139f6d';
const frozen = resolve(dir, 'baseline-source'), mode = process.argv[2];
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
if (mode === 'freeze') {
  const paths = git('ls-tree', '-r', '--name-only', base, 'src', 'public', 'index.html', 'package.json', 'vite.config.ts').toString().trim().split('\n');
  for (const path of paths) { const target = resolve(frozen, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, git('show', `${base}:${path}`)); }
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--base', '/'], { cwd: frozen, stdio: 'inherit', windowsHide: true });
  process.exit(0);
}
assert.ok(mode === 'measure' || mode === 'measure-heavy' || mode === 'measure-memory');
const heavy = mode === 'measure-heavy';
const memoryOnly = mode === 'measure-memory';
const tapes = JSON.parse(await readFile(resolve(dir, 'scenarios.json'), 'utf8')).scenarios;
const deathTape = tapes.find(s => s.name === 'death');
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
      for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) for (const scenario of heavy ? ['mine', 'station'] : memoryOnly ? ['collision'] : ['flight', 'collision']) {
        const r = await openGame(browser, url, { viewport, seed: 42 });
        const tape = heavy ? tapes.find(t => t.name === scenario) : deathTape;
        const inputs = heavy || scenario === 'collision' ? tape.inputs : undefined;
        await advance(r.page, inputs, heavy ? Math.max(0, tape.endTick - 180) : 480);
        const raw = await r.page.evaluate(({inputs, frames}) => new Promise(resolve => {
          const raf = [], cpu = [], calls = [], active = []; let previous = performance.now();
          const frame = () => {
            const now = performance.now(); raf.push(now - previous); previous = now;
            const at = performance.now(); window.releaseStep(inputs?.[window.releaseTick]); window.releaseStep(inputs?.[window.releaseTick]); cpu.push(performance.now() - at);
            calls.push(window.releaseQA.world.renderer.info.render.calls);
            active.push(window.releaseQA.world.collisionEffects?.activeCount ?? 0);
            if (raf.length < frames) window.nativeRAF(frame);
            else {
              const g = window.releaseQA, m = g.model;
              resolve({ raf, cpu, calls, active, memory: { ...g.world.renderer.info.memory }, programs: g.world.renderer.info.programs.length,
                subscribers: m.events?.subscriberCount ?? 0, dropped: m.events?.dropped ?? 0,
                state: { ship: m.ship, elapsed: m.elapsed, distance: m.distance, hull: m.hull, phase: m.phase,
                  hazards: m.field.slots, fragments: m.fragments.slots, count: m.fragments.count, publications: m.field.events, mine: m.homing.current } });
            }
          }; window.nativeRAF(frame);
        }), { inputs, frames: heavy ? 240 : 600 });
        assert.deepEqual(r.errors, []); assert.deepEqual(r.failed, []); assert.equal(raw.dropped, 0);
        const stateHash = createHash('sha256').update(JSON.stringify(raw.state)).digest('hex');
        const row = { source, scenario, viewport, browser: browser.version(), summary: { raf: stats(raw.raf), cpu: stats(raw.cpu), calls: stats(raw.calls) }, stateHash, ...raw };
        if (scenario === 'collision') {
          row.resets = [];
          for (let i = 0; i < 10; i++) {
            await r.page.evaluate(() => { const g = window.releaseQA; for(let j=0;j<150;j++) g.loop.render(1/60); g.loop.render(0); });
            await r.page.locator('#replay').click(); await r.page.evaluate(() => { window.releaseTick = 0; });
            await advance(r.page, deathTape.inputs, deathTape.endTick);
            await r.cdp.send('HeapProfiler.collectGarbage');
            row.resets.push({ heap: await r.cdp.send('Runtime.getHeapUsage'), ...await r.page.evaluate(() => ({memory:{...window.releaseQA.world.renderer.info.memory},programs:window.releaseQA.world.renderer.info.programs.length,subscribers:window.releaseQA.model.events.subscriberCount})) });
          }
          assert.ok(row.resets.every(s => JSON.stringify(s.memory) === JSON.stringify(row.resets[0].memory) && s.subscribers === 1));
          await r.page.evaluate(() => { const g=window.releaseQA; for(let i=0;i<150;i++)g.loop.render(1/60);g.loop.render(0); });
          await r.page.waitForTimeout(1600); await r.cdp.send('HeapProfiler.collectGarbage');
          row.settledHeap = await r.cdp.send('Runtime.getHeapUsage');
        }
        rows.push(row); await r.context.close(); console.log(source, scenario, viewport.width, JSON.stringify(row.summary));
      }
    } finally { server.kill(); }
  }
  for (let i = 0; i < rows.length/2; i++) assert.equal(rows[i].stateHash, rows[i + rows.length/2].stateHash, 'Matched fixed-cadence complete state changed');
  await writeFile(resolve(dir, heavy ? 'heavy-performance.json' : memoryOnly ? 'memory-performance.json' : 'performance.json'), JSON.stringify({ base, method: heavy
    ? 'Sequential production Chrome. Two viewports, naturally published mine/station contact tapes. Start180 fixed ticks before contact, measure240 native RAF frames/case. No entity, HP or cooldown edits.'
    : 'Sequential production Chrome, 480 warmup fixed ticks plus 600 native RAF frames/case. Two viewports, certificate flight and/or natural three-collision/death tape. Collision cases replay ten natural deaths/resets and collect GC heap/resource samples, followed by1600ms audio settling and GC. No phone guarantee.', rows }, null, 2));
} finally { await browser.close(); }
