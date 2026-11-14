import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { openGame, advance, chromium } from './release-browser-lib.mjs';

const dir = resolve('.cache/review/FEEDBACK-001B1'), base = '2eb974199bfa58ae120dbf9f12e8bf53a6b5da2a';
const tapes = JSON.parse(await readFile('.cache/review/FEEDBACK-001B/scenarios.json', 'utf8')).scenarios;
const death = tapes.find(t => t.name === 'death');
const stat = a => { const sorted = [...a].sort((x, y) => x - y); return { n: a.length, p50: sorted[Math.floor(a.length * .5)], p95: sorted[Math.floor(a.length * .95)], max: sorted.at(-1) }; };
const frameStat = a => ({ ...stat(a), fps: 1000 * a.length / a.reduce((s, n) => s + n, 0) });
const rows = [], environment = { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model, logicalCPUs: os.cpus().length, totalRAM: os.totalmem() };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function idle(page) {
  return page.evaluate(() => new Promise(resolve => {
    const times = []; let previous = performance.now();
    const frame = () => { const now = performance.now(); times.push(now - previous); previous = now;
      if (times.length < 180) window.nativeRAF(frame); else resolve({ times, hidden: document.hidden, visibility: document.visibilityState }); };
    window.nativeRAF(frame);
  }));
}
try {
  for (const source of ['baseline', 'final']) {
    const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5197', '--strictPort'],
      { cwd: source === 'baseline' ? resolve(dir, 'baseline-source') : process.cwd(), stdio: 'ignore', windowsHide: true });
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) { try { ready = (await fetch('http://127.0.0.1:5197/')).ok; if (ready) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
      assert.ok(ready);
      for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        for (const scenario of ['flight', 'shield', 'mine', 'death', 'extended']) {
          const tape = tapes.find(t => t.name === (scenario === 'shield' ? 'rock' : scenario));
          const inputs = tape?.inputs, count = scenario === 'extended' ? 3600 : scenario === 'flight' ? 600 : scenario === 'death' ? 300 : 240;
          const r = await openGame(browser, 'http://127.0.0.1:5197/', { viewport, seed: 42 });
          const before = await idle(r.page);
          await advance(r.page, inputs, tape ? Math.max(0, tape.endTick - 60) : 480);
          const raw = await r.page.evaluate(({ inputs, count }) => new Promise(resolve => {
            const raf = [], cpu = [], calls = [], effects = []; let previous = performance.now();
            const frame = () => {
              const now = performance.now(); raf.push(now - previous); previous = now;
              const at = performance.now(); window.releaseStep(inputs?.[window.releaseTick]); window.releaseStep(inputs?.[window.releaseTick]); cpu.push(performance.now() - at);
              const g = window.releaseQA, m = g.model, d = g.world.destruction;
              calls.push(g.world.renderer.info.render.calls);
              effects.push({ bursts: g.world.collisionEffects.activeCount, identities: g.world.collisionEffects.activeIdentities,
                shader: g.world.renderer.info.programs.length, particles: g.world.collisionEffects.root.children.reduce((n, root) => n + (root.visible ? root.children.find(c => c.type === 'Points')?.geometry.drawRange.count ?? 0 : 0), 0),
                death: d.sequence.active, field: m.invulnerability > 0, fragments: d.sequence.broken && d.sequence.active ? 6 : 0 });
              if (raf.length < count) window.nativeRAF(frame);
              else {
                const gl = g.world.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
                resolve({ raf, cpu, calls, effects, resources: { ...g.world.renderer.info.memory }, programs: g.world.renderer.info.programs.length,
                  subscribers: m.events.subscriberCount, hidden: document.hidden, userAgent: navigator.userAgent,
                  gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                  state: { ship: m.ship, elapsed: m.elapsed, distance: m.distance, hull: m.hull, phase: m.phase,
                    hazards: m.field.slots, fragments: m.fragments.slots, count: m.fragments.count, publications: m.field.events, mine: m.homing.current } });
              }
            }; window.nativeRAF(frame);
          }), { inputs, count });
          const after = await idle(r.page);
          assert.deepEqual(r.errors, []); assert.deepEqual(r.failed, []);
          const row = { source, scenario, viewport, browser: browser.version(), ...raw, stateHash: createHash('sha256').update(JSON.stringify(raw.state)).digest('hex'),
            summary: { raf: frameStat(raw.raf), cpu: stat(raw.cpu), calls: stat(raw.calls) }, idle: { before: frameStat(before.times), after: frameStat(after.times), hidden: [before.hidden, after.hidden] } };
          if (scenario === 'death') {
            row.resets = [];
            for (let cycle = 0; cycle < 30; cycle++) {
              await r.page.evaluate(() => { for (let i = 0; i < 150; i++) window.releaseQA.loop.render(1 / 60); window.releaseQA.loop.render(0); });
              await r.page.locator('#replay').click(); await r.page.evaluate(() => { window.releaseTick = 0; }); await advance(r.page, death.inputs, death.endTick);
              await r.cdp.send('HeapProfiler.collectGarbage');
              row.resets.push({ heap: await r.cdp.send('Runtime.getHeapUsage'), ...await r.page.evaluate(() => ({ resources: { ...window.releaseQA.world.renderer.info.memory }, programs: window.releaseQA.world.renderer.info.programs.length, subscribers: window.releaseQA.model.events.subscriberCount })) });
            }
            assert.ok(row.resets.every(s => JSON.stringify(s.resources) === JSON.stringify(row.resets[0].resources) && s.programs === row.resets[0].programs && s.subscribers === 1));
            await r.page.evaluate(() => { for (let i = 0; i < 150; i++) window.releaseQA.loop.render(1 / 60); });
            await r.page.waitForTimeout(1600); await r.cdp.send('HeapProfiler.collectGarbage'); row.settledHeap = await r.cdp.send('Runtime.getHeapUsage');
          }
          rows.push(row); await r.context.close();
          console.log(source, scenario, viewport.width, JSON.stringify(row.summary.raf), 'CPU p95', row.summary.cpu.p95);
          await writeFile(resolve(dir, 'performance-progress.json'), JSON.stringify({ base, environment, rows }, null, 2));
        }
      }
    } finally { server.kill(); }
  }
  for (let i = 0; i < rows.length / 2; i++) assert.equal(rows[i].stateHash, rows[i + rows.length / 2].stateHash, 'Serialized gameplay endpoint differs');
  await writeFile(resolve(dir, 'performance.json'), JSON.stringify({ base, environment, method: 'Sequential production Chrome; identical tapes/seed/Hybrid/cadence. Idle RAF controls before/after each case perform no simulation/render. Extended=3600 native frames; death cases additionally30 input-only natural death/restart cycles with GC and delayed settled sample. No phone guarantee.', rows }, null, 2));
} finally { await browser.close(); }
