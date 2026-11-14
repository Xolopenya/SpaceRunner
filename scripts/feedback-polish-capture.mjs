import { spawn, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { openGame, advance, chromium } from './release-browser-lib.mjs';

export const base = '2eb974199bfa58ae120dbf9f12e8bf53a6b5da2a';
export const dir = resolve('.cache/review/FEEDBACK-001B1');
export const frozen = resolve(dir, 'baseline-source');
const mode = process.argv[2];
if (mode === 'freeze') {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', base, 'src', 'public', 'index.html', 'package.json', 'vite.config.ts']).toString().trim().split('\n');
  const blobs = execFileSync('git', ['cat-file', '--batch'], { input: paths.map(p => `${base}:${p}\n`).join(''), maxBuffer: 64 * 1024 * 1024 });
  let cursor = 0;
  for (const path of paths) {
    const end = blobs.indexOf(10, cursor), size = Number(blobs.subarray(cursor, end).toString().split(' ')[2]); cursor = end + 1;
    const target = resolve(frozen, path); await mkdir(dirname(target), { recursive: true });
    await writeFile(target, blobs.subarray(cursor, cursor + size)); cursor += size + 1;
  }
  execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--base', '/'], { cwd: frozen, stdio: 'inherit', windowsHide: true });
  process.exit(0);
}
assert.ok(mode === 'baseline' || mode === 'final');
const output = resolve(dir, mode); await mkdir(output, { recursive: true });
const tapes = JSON.parse(await readFile('.cache/review/FEEDBACK-001B/scenarios.json', 'utf8')).scenarios;
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5198', '--strictPort'],
  { cwd: mode === 'baseline' ? frozen : process.cwd(), stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const receipts = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch('http://127.0.0.1:5198/')).ok; if (ready) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready);
  for (const mobile of [false, true]) for (const name of ['shield', 'mine', 'death']) {
    const tape = tapes.find(t => t.name === (name === 'shield' ? 'rock' : name));
    const prefix = `${mobile ? 'mobile' : 'desktop'}-${name}`;
    const r = await openGame(browser, 'http://127.0.0.1:5198/', { seed: tape.seed, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, videoDir: resolve(output, 'raw-video') });
    await r.page.evaluate(() => {
      window.polishFacts = []; window.releaseQA.model.events.on('obstacle.collision', e => window.polishFacts.push(e));
      window.polishFrames = n => new Promise(resolve => {
        const frame = () => { window.releaseStep(); window.releaseStep(); if (--n > 0) window.nativeRAF(frame); else { window.releaseQA.loop.render(0); resolve(); } }; window.nativeRAF(frame);
      });
    });
    const shot = async label => {
      const path = `${prefix}-${label}.png`; await r.page.screenshot({ path: resolve(output, path) });
      receipts.push(await r.page.evaluate(({ path, label }) => {
        const g = window.releaseQA, m = g.model;
        return { path, label, tick: window.releaseTick, elapsed: m.elapsed, hull: m.hull, immunity: m.invulnerability,
          position: { ...m.ship }, distance: m.distance, cinematic: g.world.destruction.sequence.elapsed,
          collisions: window.polishFacts, camera: g.world.flightCamera.mode, memory: { ...g.world.renderer.info.memory },
          calls: g.world.renderer.info.render.calls, fault: m.field.fault ?? null };
      }, { path, label }));
    };
    await advance(r.page, tape.inputs, tape.endTick); await shot('contact');
    let elapsed = 0;
    const moments = name === 'shield' ? [['activation', .10], ['protection', .65], ['dissipation', 1.65], ['ended', 2.10]]
      : name === 'mine' ? [['core', .05], ['expansion', .18], ['shockwave', .40], ['residual', .85], ['ended', 1.30]]
        : [['failure', .25], ['primary', .56], ['secondary', .73], ['breakup', .90], ['aftermath', 1.45], ['results', 2.12]];
    for (const [label, at] of moments) { const frames = Math.round((at - elapsed) * 60); await r.page.evaluate(n => window.polishFrames(n), frames); elapsed += frames / 60; await shot(label); }
    if (name === 'death') { await r.page.locator('#replay').click(); await r.page.evaluate(() => window.releaseQA.loop.render(0)); await shot('restarted'); }
    assert.deepEqual(r.errors, []); assert.deepEqual(r.failed, []);
    const video = r.page.video(); await r.context.close(); await copyFile(await video.path(), resolve(output, `${prefix}.webm`));
    console.log(mode, prefix, 'captured');
  }
  await writeFile(resolve(output, 'captures.json'), JSON.stringify({ base, mode, browser: browser.version(), method: 'Original production IntegratedModel, same input tapes/seed/Hybrid, no hazard/HP/cooldown edits. Accelerated prefixes, held screenshots; post-contact advancement uses native RAF. Silent native browser recordings.', receipts }, null, 2));
} finally { await browser.close(); server.kill(); }
