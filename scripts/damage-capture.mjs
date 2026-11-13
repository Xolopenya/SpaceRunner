import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { openGame, advance, chromium } from './release-browser-lib.mjs';
const dir = resolve('.cache/review/FEEDBACK-001B'), output = resolve(dir, 'gameplay'); await mkdir(output, { recursive: true });
const tapes = JSON.parse(await readFile(resolve(dir, 'scenarios.json'), 'utf8')).scenarios;
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const receipts = [];
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5198/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  for (const name of ['rock', 'metal', 'mine', 'station', 'death', 'mobile']) {
    const tape = tapes.find(t => t.name === (name === 'mobile' ? 'death' : name));
    const r = await openGame(browser, 'http://127.0.0.1:5198/', { seed: tape.seed, ...(name === 'mobile' ? { viewport: { width: 390, height: 844 } } : {}),
      ...(name === 'death' ? { videoDir: resolve(output, 'raw-video') } : {}) });
    await r.page.evaluate(() => {
      const g = window.releaseQA; window.damageFacts = []; g.model.events.on('obstacle.collision', event => window.damageFacts.push(event));
      window.visualAdvance = (seconds, live = false) => new Promise(resolve => {
        let frames = Math.round(seconds * 60);
        const frame = () => { window.releaseStep(); window.releaseStep(); if (--frames > 0) { if (live) window.nativeRAF(frame); else frame(); } else { g.loop.render(0); resolve(); } };
        if (live) window.nativeRAF(frame); else frame();
      });
    });
    const shot = async label => {
      const path = `${name}-${label}.png`; await r.page.screenshot({ path: resolve(output, path) });
      receipts.push(await r.page.evaluate(({ path, name }) => {
        const g = window.releaseQA, m = g.model, d = g.world.destruction;
        return { path, name, tick: window.releaseTick, hull: m.hull, state: m.state, distance: m.distance,
          ship: { ...m.ship }, phase: d.sequence.phase, cinematicTime: d.sequence.elapsed,
          intactVisible: g.world.ship.visible, resultsVisible: !document.getElementById('game-over').hidden,
          damageStage: g.world.hullDamage.stage, collisions: window.damageFacts, activeBursts: g.world.collisionEffects.activeCount,
          memory: { ...g.world.renderer.info.memory }, programs: g.world.renderer.info.programs.length,
          drawCalls: g.world.renderer.info.render.calls, fault: m.field.fault ?? null };
      }, { path, name }));
    };
    if (name === 'death' || name === 'mobile') {
      await shot('intact');
      await advance(r.page, tape.inputs, Math.min(tape.hits[0].tick + 210, tape.hits[1].tick - 2)); await shot('damaged');
      await advance(r.page, tape.inputs, Math.min(tape.hits[1].tick + 210, tape.hits[2].tick - 2)); await shot('critical');
      await advance(r.page, tape.inputs, tape.endTick); await shot('fatal');
      for (const [label, seconds] of [['failure', .25], ['explosion', .35], ['breakup', .25], ['aftermath', .45], ['results', .95]]) {
        await r.page.evaluate(seconds => window.visualAdvance(seconds, true), seconds); await shot(label);
      }
      assert.equal(receipts.at(-1).resultsVisible, true); assert.equal(receipts.at(-1).intactVisible, false);
      await r.page.locator('#replay').click(); await r.page.evaluate(() => window.releaseQA.loop.render(0)); await shot('restarted');
    } else {
      await advance(r.page, tape.inputs, Math.max(0, tape.endTick - 24)); await shot('approach');
      await advance(r.page, tape.inputs, tape.endTick);
      await r.page.evaluate(() => window.visualAdvance(.08)); await shot('contact');
      await r.page.evaluate(() => window.visualAdvance(.2)); await shot('debris');
      assert.equal(receipts.at(-1).collisions.at(-1).obstacleId, tape.hits.at(-1).obstacleId);
      assert.equal(receipts.at(-1).collisions.at(-1).obstacleKind, tape.hits.at(-1).obstacleKind);
    }
    assert.deepEqual(r.errors, []); assert.deepEqual(r.failed, []);
    const video = r.page.video(); await r.context.close();
    if (video) await copyFile(await video.path(), resolve(output, 'natural-destruction.webm'));
    console.log('captured', name, receipts.filter(x => x.name === name).length, 'real production frames');
  }
  await writeFile(resolve(output, 'captures.json'), JSON.stringify({ method: 'Unmodified production app observed through CDP at Launch. Original IntegratedModel, natural certified published hazards, fixed input tapes. No entities/HP/cooldowns changed. Accelerated prefix, deliberate screenshot holds, then native RAF progression through death. Video records the actual browser framebuffer with these holds.', browser: browser.version(), receipts }, null, 2));
} finally { await browser.close(); server.kill(); }
