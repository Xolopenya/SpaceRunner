import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { stats } from './director-fields.mjs';

const output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003B/final');
await mkdir(output, { recursive: true }); await mkdir('test-results', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  let ready = false; for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5198')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready); browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [], screenshots = [];
  for (const [policy, viewportName] of [['baseline', 'desktop'], ['pressure', 'desktop'], ['large-structure', 'desktop'], ['large-structure', 'portrait'], ['large-structure', 'landscape']]) {
    const mobile = viewportName !== 'desktop', viewport = viewportName === 'portrait' ? { width: 390, height: 844 } : viewportName === 'landscape' ? { width: 844, height: 390 } : { width: 1280, height: 800 };
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url())); page.on('request', r => { if (r.url().endsWith('.glb')) requests.push(r.url()); });
    const url = policy === 'large-structure' ? '?debug=field&experiment=large-structure&aperture=right&seed=42' : `?debug=field&policy=${policy}&seed=42`;
    await page.goto('http://127.0.0.1:5198/' + url); await page.locator('#launch').waitFor({ state: 'visible' });
    const startup = await page.evaluate(() => {
      const g = window.spaceRunner;
      function owned(owner) {
        if (!owner) return null;
        const arrays = new Set(), buffers = new Set();
        for (const geometry of owner.geometries) for (const a of [...Object.values(geometry.attributes), geometry.index].filter(Boolean)) {
          const array = a.isInterleavedBufferAttribute ? a.data.array : a.array; arrays.add(array); buffers.add(array.buffer);
        }
        return { geometries: owner.geometries.size, materials: owner.materials.size, textures: owner.textures.size,
          uniqueAttributeBytes: [...arrays].reduce((n, a) => n + a.byteLength, 0), backingBufferBytes: [...buffers].reduce((n, b) => n + b.byteLength, 0) };
      }
      return { glbResources: owned(g.assets.resources), experimentResources: owned(g.world.collisionDebug?.resources),
        gpu: { ...g.world.renderer.info.memory }, scope: 'Owned CPU typed-array payload/backing buffers, resource counts; not a GPU-driver or whole-process heap measurement.' };
    });
    await page.evaluate(({ structure, record }) => {
      const g = window.spaceRunner, m = g.model, step = m.step.bind(m), profile = window.structureProfile = { frames: [], steps: [], longTasks: [], running: true, last: performance.now() };
      const collider = m.collisions, originalHit = collider.hit;
      profile.gameplayHazardQueries = 0; profile.gameplayProfileUnits = 0;
      collider.hit = function (...args) { profile.gameplayHazardQueries++; profile.gameplayProfileUnits += args[2].kind === 3 ? 4 : 1; return originalHit.apply(this, args); };
      const follower = () => {
        const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0;
        for (const run of w?.controls ?? []) { if (tick < run.ticks) return run.input; tick -= run.ticks; } return { x: 0, y: 0 };
      };
      // Same causal certificate follower for all three policies, never future inputs.
      Object.defineProperty(g.input, 'axis', { configurable: true, get: follower });
      m.step = (dt, axis) => { const t = performance.now(), before = m.field.planningTicks; step(dt, axis);
        if (profile.running) profile.steps.push({ ms: performance.now() - t, elapsed: m.elapsed, chunk: m.field.planningTicks > before ? { ...m.field.samples.at(-1) } : null }); };
      const observer = new PerformanceObserver(list => { if (profile.running) profile.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration }))); }); observer.observe({ type: 'longtask' });
      const frame = t => { if (!profile.running) return; profile.frames.push({ ms: t - profile.last, elapsed: m.elapsed, state: m.state }); profile.last = t; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      profile.stop = () => { profile.running = false; observer.disconnect(); m.step = step; collider.hit = originalHit; delete g.input.axis; };
      if (record) { const stream = document.querySelector('#flight').captureStream(30), chunks = [], recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1500000 });
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start(500); profile.video = { stream, chunks, recorder }; }
    }, { record: !mobile });
    await page.locator('#launch').click(); await page.waitForTimeout(14000);
    const raw = await page.evaluate(() => {
      const g = window.spaceRunner, m = g.model, p = window.structureProfile; p.stop();
      return { frames: p.frames, steps: p.steps, longTasks: p.longTasks, elapsed: m.elapsed, distance: m.distance, state: m.state, hull: m.hull, hits: m.hitSerial,
        committed: m.field.committed, omitted: m.field.omitted, fault: m.field.fault, events: m.field.events, primitiveQueries: m.collisionQueries ?? null,
        gameplayHazardQueries: p.gameplayHazardQueries, gameplayProfileUnits: p.gameplayProfileUnits,
        resources: { ...g.world.renderer.info.memory, calls: g.world.renderer.info.render.calls, triangles: g.world.renderer.info.render.triangles, programs: g.world.renderer.info.programs.length } };
    });
    assert.deepEqual(errors, []); assert.equal(raw.fault, undefined); assert.equal(raw.hits, 0); assert.equal(raw.state, 'PLAYING'); assert.equal(requests.length, 6);
    const name = `structure-${policy}-${viewportName}`;
    await page.screenshot({ path: `test-results/${name}-live.png` }); screenshots.push(`${name}-live.png`);
    const summary = { policy, viewportName, viewport, frameMs: stats(raw.frames.slice(1).map(f => f.ms)), steadyMs: stats(raw.frames.filter(f => f.elapsed >= 1).map(f => f.ms)),
      stepMs: stats(raw.steps.map(s => s.ms)), planningMs: stats(raw.steps.filter(s => s.chunk && !['ready', 'failed', 'actual-gate'].includes(s.chunk.phase)).map(s => s.chunk.ms)),
      publicationMs: stats(raw.steps.filter(s => s.chunk?.phase === 'actual-gate').map(s => s.chunk.ms)),
      elapsed: raw.elapsed, committed: raw.committed, omitted: raw.omitted, primitiveQueries: raw.primitiveQueries,
      gameplayHazardQueries: raw.gameplayHazardQueries, gameplayProfileUnits: raw.gameplayProfileUnits, resources: raw.resources, startup, glbRequests: requests.length, errors };
    if (policy === 'large-structure') assert.equal(raw.primitiveQueries, raw.gameplayProfileUnits);
    if (!mobile) {
      const data = await page.evaluate(() => new Promise(done => { const v = window.structureProfile.video; v.recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(v.chunks, { type: 'video/webm' }).arrayBuffer()); v.stream.getTracks().forEach(t => t.stop()); done(Array.from(bytes)); }; v.recorder.stop(); }));
      const videoFile = policy === 'large-structure' ? 'structure-passage-canvas.webm' : `structure-${policy}-canvas.webm`;
      await writeFile(`test-results/${videoFile}`, Buffer.from(data)); summary.videoBytes = data.length; summary.videoFile = videoFile;
      const videoPage = await context.newPage(); await videoPage.goto('http://127.0.0.1:5198/tests/browser/trajectory-harness.html');
      await videoPage.setContent(`<video muted src="/test-results/${videoFile}"></video>`); await videoPage.waitForFunction(() => document.querySelector('video').readyState >= 2);
      summary.decodedVideo = [];
      for (const time of [2, 6]) summary.decodedVideo.push(await videoPage.evaluate(time => new Promise(done => {
        const v = document.querySelector('video'); v.onseeked = () => { const c = document.createElement('canvas'); c.width = 160; c.height = 100;
          const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, 160, 100); let hash = 2166136261;
          for (const b of ctx.getImageData(0, 0, 160, 100).data) hash = Math.imul(hash ^ b, 16777619);
          done({ time: v.currentTime, width: v.videoWidth, height: v.videoHeight, hash: hash >>> 0 }); }; v.currentTime = time;
      }), time));
      assert.ok(summary.decodedVideo[0].width > 0); assert.notEqual(summary.decodedVideo[0].hash, summary.decodedVideo[1].hash);
      await videoPage.close(); await page.bringToFront();
    }
    await page.evaluate(() => window.spaceRunner.loop.stop());
    async function reset(ticks = 20) { return page.evaluate(ticks => {
      const g = window.spaceRunner, m = g.model; m.state = 'GAME_OVER'; m.start(42); g.world.reset(); for (let i = 0; i < ticks; i++) m.step(1 / 120, { x: 0, y: 0 }); g.loop.render(1 / 60);
      return { memory: { ...g.world.renderer.info.memory }, programs: g.world.renderer.info.programs.length, slots: m.field.hazards.length, records: m.field.ledger.snapshot().length };
    }, ticks); }
    for (let i = 0; i < 5; i++) await reset(144); const before = await reset(144), restarts = [];
    for (let i = 0; i < 10; i++) { const r = await reset(144); assert.deepEqual(r, before); restarts.push(r); } summary.restarts = { before, samples: restarts };
    if (policy === 'large-structure') {
      await reset(144);
      for (const [stage, lead] of [['first-visible', 132], ['approach', 45], ['entry', 8], ['passed', -10]]) {
        const state = await page.evaluate(lead => {
          const g = window.spaceRunner, m = g.model, center = 156;
          while (m.distance < center - lead) { const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, axis = { x: 0, y: 0 };
            for (const run of w?.controls ?? []) { if (tick < run.ticks) { axis = run.input; break; } tick -= run.ticks; } m.step(1 / 120, axis); }
          for (let i = 0; i < 20; i++) g.loop.render(1 / 60);
          return { elapsed: m.elapsed, distance: m.distance, ship: { ...m.ship }, hits: m.hitSerial, lead: center - m.distance };
        }, lead);
        assert.equal(state.hits, 0); const shot = `structure-${viewportName}-${stage}.png`; await page.screenshot({ path: `test-results/${shot}` }); screenshots.push(shot); (summary.stages ??= []).push({ stage, ...state, screenshot: shot });
      }
      await reset(144);
      const impact = await page.evaluate(() => { const g = window.spaceRunner, m = g.model; for (let i = 0; i < 1200 && m.hitSerial === 0; i++) m.step(1 / 120, { x: 0, y: 0 }); g.loop.render(1 / 60); return { hits: m.hitSerial, hull: m.hull, distance: m.distance }; });
      assert.equal(impact.hits, 1); assert.equal(impact.hull, 2); const shot = `structure-${viewportName}-solid-impact.png`; await page.screenshot({ path: `test-results/${shot}` }); screenshots.push(shot); summary.impact = impact;
      if (!mobile) { await page.goto('http://127.0.0.1:5198/' + url + '&colliders=1'); await page.locator('#launch').click(); await page.evaluate(() => { const g = window.spaceRunner; g.loop.stop(); while (g.model.distance < 110) g.model.step(1 / 120, { x: 0, y: 0 }); g.loop.render(1 / 60); }); const shot = 'structure-desktop-colliders.png'; await page.screenshot({ path: `test-results/${shot}` }); screenshots.push(shot); }
    }
    await writeFile(join(output, `${name}-raw.json`), JSON.stringify(raw) + '\n'); results.push(summary); await context.close();
    console.log(`${name}: frames p50/p95/p99/max ${summary.frameMs.p50}/${summary.frameMs.p95}/${summary.frameMs.p99}/${summary.frameMs.max}ms`);
  }
  const variants = [];
  const variantContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const variantPage = await variantContext.newPage();
  for (const aperture of ['center', 'left', 'right', 'upper', 'lower']) {
    await variantPage.goto(`http://127.0.0.1:5198/?debug=field&experiment=large-structure&aperture=${aperture}&seed=42`); await variantPage.locator('#launch').click();
    await variantPage.evaluate(() => { const g = window.spaceRunner; g.loop.stop(); g.model.state = 'GAME_OVER'; g.model.start(42); });
    for (const [stage, distance] of [['entry', 148], ['exit', 160.5]]) {
      const state = await variantPage.evaluate(distance => {
        const g = window.spaceRunner, m = g.model;
        while (m.distance < distance) { const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, axis = { x: 0, y: 0 };
          for (const run of w?.controls ?? []) { if (tick < run.ticks) { axis = run.input; break; } tick -= run.ticks; } m.step(1 / 120, axis); }
        for (let i = 0; i < 20; i++) g.loop.render(1 / 60); return { hits: m.hitSerial, distance: m.distance, ship: { ...m.ship } };
      }, distance);
      assert.equal(state.hits, 0); const screenshot = `structure-variant-${aperture}-${stage}.png`;
      await variantPage.screenshot({ path: `test-results/${screenshot}` }); screenshots.push(screenshot); variants.push({ aperture, stage, screenshot, ...state });
    }
  }
  await variantContext.close();
  await writeFile(join(output, 'structure-browser.json'), JSON.stringify({ generatedAt: new Date().toISOString(), browser: browser.version(), results, screenshots, variants,
    humanParticipants: 0, physicalDevices: 0,
    method: 'Five serial14s real RAF/120Hz/Three.js cases, causal witness follower for all policies, cold launch retained. All three desktop cases record silent native canvas video at identical settings. Stage/variant PNGs use accelerated exact-model steps with stopped RAF; no position/geometry teleports. Ten finite warmed same-phase restarts per case. Portrait/landscape are Chrome desktop viewport/touch emulation. CPU payload counts are owned typed arrays, not whole-process/GPU-driver memory.' }, null, 2) + '\n');
} finally { await browser?.close(); server.kill(); }
