// Controlled visual iteration, not natural gameplay evidence. No production hooks.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { openGame, chromium } from './release-browser-lib.mjs';
const dir = resolve('.cache/review/FEEDBACK-001B/probe'); await mkdir(dir, { recursive: true });
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5198/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const r = await openGame(browser, 'http://127.0.0.1:5198/');
  await r.page.evaluate(() => {
    const g = window.releaseQA, m = g.model; m.field.update = () => {};
    window.probeStep = seconds => { for (let i = 0; i < Math.round(seconds * 60); i++) { g.loop.update(1 / 120); g.loop.update(1 / 120); g.loop.render(1 / 60); } g.loop.render(0); };
    window.probeHit = () => {
      m.field.hazards.forEach(h => { h.active = false; }); m.invulnerability = 0;
      Object.assign(m.field.hazards[0], { active: true, x: m.ship.x, y: m.ship.y, z: -.2, radius: 1, kind: 0, phase: 0, spin: 0 });
      g.loop.update(1 / 120); g.loop.render(0);
    };
  });
  const rows = [];
  const shot = async name => { await r.page.screenshot({ path: resolve(dir, `${name}.png`) }); rows.push(await r.page.evaluate(name => {
    const g = window.releaseQA; return { name, hull: g.model.hull, state: g.model.state, stage: g.world.hullDamage.stage,
      phase: g.world.destruction.sequence.phase, elapsed: g.world.destruction.sequence.elapsed, intact: g.world.ship.visible,
      results: !document.getElementById('game-over').hidden, memory: { ...g.world.renderer.info.memory } };
  }, name)); };
  await shot('intact'); await r.page.evaluate(() => { window.probeHit(); window.probeStep(1.7); }); await shot('damaged');
  await r.page.evaluate(() => { window.probeHit(); window.probeStep(1.7); }); await shot('critical');
  await r.page.evaluate(() => window.probeHit()); await shot('fatal');
  for (const [name, seconds] of [['failure', .25], ['breakup', .42], ['aftermath', .6], ['results', 1]]) {
    await r.page.evaluate(seconds => window.probeStep(seconds), seconds); await shot(name);
  }
  await writeFile(resolve(dir, 'receipt.json'), JSON.stringify({ fixture: 'Controlled accepted contacts, unmodified production application', rows, errors: r.errors, failed: r.failed }, null, 2));
  console.log(JSON.stringify({ rows, errors: r.errors, failed: r.failed }, null, 2)); assert.deepEqual(r.errors, []); assert.deepEqual(r.failed, []);
} finally { await browser.close(); server.kill(); }
