import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { stats } from './director-fields.mjs';

const smoke = process.argv.includes('--smoke'), output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003C2/final');
await mkdir(output, { recursive: true }); await mkdir('test-results', { recursive: true });
const base = 'http://127.0.0.1:5199/', server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
const screenshots = [], stages = [], results = [], videos = [];
let browser;
const url = (variant = 'baseline', extra = '') => base + '?debug=field&experiment=moving-mine&seed=42&firstMine=1&motion=' + variant + extra;
async function contextFor(name) { return browser.newContext({ viewport: name === 'portrait' ? { width: 390, height: 844 } : name === 'landscape' ? { width: 844, height: 390 } : { width: 1280, height: 800 },
  deviceScaleFactor: name === 'desktop' ? 1 : 2, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' }); }
async function shot(page, name) { await page.screenshot({ path: `test-results/${name}` }); screenshots.push(name); }
async function record(page) { await page.evaluate(() => {
  const stream = document.querySelector('#flight').captureStream(30), chunks = [], recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1500000 });
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; const startedAt = performance.now(); recorder.start(500); window.mineVideo = { recorder, stream, chunks, startedAt };
}); }
async function stopVideo(page, filename) {
  const startedAt = await page.evaluate(() => window.mineVideo.startedAt);
  const data = await page.evaluate(() => new Promise(done => { const v = window.mineVideo; v.recorder.onstop = () => { const r = new FileReader(); r.onload = () => done(r.result.split(',')[1]);
    r.readAsDataURL(new Blob(v.chunks, { type: 'video/webm' })); v.stream.getTracks().forEach(t => t.stop()); }; v.recorder.stop(); }));
  const bytes = Buffer.from(data, 'base64'); await writeFile(`test-results/${filename}`, bytes);
  const decoder = await page.context().newPage(); await decoder.goto(base + 'tests/browser/trajectory-harness.html');
  await decoder.setContent(`<video muted src="/test-results/${filename}"></video>`); await decoder.waitForFunction(() => document.querySelector('video').readyState >= 2);
  const decoded = [];
  for (const time of [smoke ? 2 : 7, smoke ? 6 : 9]) decoded.push(await decoder.evaluate(time => new Promise(done => { const v = document.querySelector('video'); v.onseeked = () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 100; const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, 160, 100); let h = 2166136261;
    for (const b of ctx.getImageData(0, 0, 160, 100).data) h = Math.imul(h ^ b, 16777619);
    done({ time: v.currentTime, width: v.videoWidth, height: v.videoHeight, hash: h >>> 0 }); }; v.currentTime = time; }), time));
  assert.notEqual(decoded[0].hash, decoded[1].hash); await decoder.close(); await page.bringToFront(); return { filename, bytes: bytes.length, decoded, startedAt,
    poseTimeMapping: 'Approximate video seconds=(RAF pose.time-startedAt)/1000, within capture-frame scheduling; simulation tick is authoritative.', captureFps: 30 };
}
async function harness(page) { await page.evaluate(() => {
  const g = window.spaceRunner, m = g.model; g.loop.stop(); m.state = 'GAME_OVER'; m.start(42); g.world.reset();
  const h = window.mineHarness = { ticks: 0, first: undefined,
    input() { let t = m.field.certificate ? Math.round((m.elapsed - m.field.certificate.context.elapsed) * 120) : 0;
      for (const r of m.field.certificate?.controls ?? []) { if (t < r.ticks) return r.input; t -= r.ticks; } return { x: 0, y: 0 }; },
    step(axis) { if (m.state !== 'PLAYING') throw Error('actual death'); m.step(1 / 120, axis ?? h.input()); h.ticks++;
      h.first ??= m.field.slots.find(s => s.planned?.kind === 9)?.planned; if (h.ticks % 120 === 0) g.loop.render(1 / 60); },
    to(distance) { while (m.distance < distance && h.ticks < 18000) h.step(); if (m.distance < distance) throw Error('target missed'); },
    mine() { while (!h.first && h.ticks < 3000) h.step(); if (!h.first) throw Error('no mine'); return h.first; },
    snapshot() { for (let i = 0; i < 20; i++) g.loop.render(1 / 60); const mine = m.field.slots.find(s => s.planned?.kind === 9);
      return { elapsed: m.elapsed, distance: m.distance, hull: m.hull, hits: m.hitSerial, ship: { ...m.ship }, mine: mine ? { x: mine.x, y: mine.y, z: mine.z, active: mine.active, planned: mine.planned } : null,
        geometry: m.field.slots.filter(s => s.active).map(s => ({ kind: s.kind, x: s.x, y: s.y, z: s.z })), resources: { ...g.world.renderer.info.memory } }; }
  };
}); }
async function stage(page, name, lead) {
  const state = await page.evaluate(lead => { const h = window.mineHarness, mine = h.mine(); h.to(mine.passDistance - lead); return h.snapshot(); }, lead);
  await shot(page, name); stages.push({ screenshot: name, ...state }); return state;
}
try {
  let ready = false; for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); } assert.ok(ready);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [variant, name] of smoke ? [['diagonal','desktop']] : [['baseline','desktop'],['fast','desktop'],['diagonal','desktop'],['diagonal','portrait'],['diagonal','landscape']]) {
    const context = await contextFor(name), page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url())); page.on('request', r => { if (r.url().includes('.glb')) requests.push(r.url()); });
    await page.goto(url(variant)); await page.locator('#launch').waitFor({ state: 'visible' }); const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await page.evaluate(() => {
      const g = window.spaceRunner, m = g.model, step = m.step.bind(m);
      const p = window.mineProfile = { frames: [], steps: [], poses: [], longTasks: [], last: performance.now(), active: true };
      Object.defineProperty(g.input, 'axis', { configurable: true, get: () => ({ x: Math.floor(Math.round(m.elapsed * 120) / 180) % 2 ? -1 : 1, y: 0 }) });
      m.step = (dt, axis) => { const start = performance.now(), before = m.field.planningTicks; step(dt, axis); if (p.active) p.steps.push({ start, ms: performance.now() - start,
        elapsed: m.elapsed, chunk: m.field.planningTicks > before ? { ...m.field.samples.at(-1) } : null }); };
      const observer = new PerformanceObserver(list => { if (p.active) p.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration }))); }); observer.observe({ type: 'longtask' });
      const frame = time => { if (!p.active) return; p.frames.push({ time, ms: time - p.last, elapsed: m.elapsed, state: m.state,
        calls: g.world.renderer.info.render.calls, triangles: g.world.renderer.info.render.triangles, active: m.field.slots.filter(s => s.active).length }); p.last = time;
        const mine = m.field.slots.find(s => s.active && s.kind === 9); if (mine) {
          const mesh = g.world.collisionDebug.root.getObjectByName('moving-space-mine');
          const camera = g.world.camera, projected = mesh.position.clone().project(camera), cameraPoint = mesh.position.clone().applyMatrix4(camera.matrixWorldInverse);
          const pixels = 2 * mine.radius * g.world.renderer.domElement.clientHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * -cameraPoint.z);
          p.poses.push({ time, tick: Math.round(m.elapsed * 120), distance: m.distance, id: mine.planned.id, x: mine.x, y: mine.y, z: mine.z,
            planned: mine.planned, projectedX: projected.x, projectedY: projected.y, projectedDiameterPixels: pixels,
            inFrustum: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1,
            cameraDistance: mesh.position.distanceTo(camera.position),
            renderedX: mesh.position.x, renderedY: mesh.position.y, renderedZ: mesh.position.z });
        } requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      p.stop = () => { p.active = false; observer.disconnect(); m.step = step; delete g.input.axis; g.loop.stop(); };
    });
    await record(page); await page.locator('#launch').click(); await page.waitForTimeout(smoke ? 8000 : 45000);
    const raw = await page.evaluate(() => { const g = window.spaceRunner, m = g.model, p = window.mineProfile; p.stop();
      const arrays = new Set(); for (const geo of g.assets.resources.geometries) for (const a of [...Object.values(geo.attributes), geo.index].filter(Boolean)) arrays.add(a.isInterleavedBufferAttribute ? a.data.array : a.array);
      return { frames: p.frames, steps: p.steps, poses: p.poses, longTasks: p.longTasks, elapsed: m.elapsed, distance: m.distance, state: m.state, hull: m.hull, hits: m.hitSerial,
        committed: m.field.committed, omitted: m.field.omitted, events: m.field.events, fault: m.field.fault,
        assets: { geometries: g.assets.resources.geometries.size, materials: g.assets.resources.materials.size, textures: g.assets.resources.textures.size, typedArrayBytes: [...arrays].reduce((n, a) => n + a.byteLength, 0) },
        resources: { ...g.world.renderer.info.memory, calls: g.world.renderer.info.render.calls, triangles: g.world.renderer.info.render.triangles, programs: g.world.renderer.info.programs.length } }; });
    const { profile } = await cdp.send('Profiler.stop'); await cdp.send('Profiler.disable'); await writeFile(join(output, `mine-motion-${variant}-${name}-cpu.json`), JSON.stringify(profile));
    assert.deepEqual(errors, []); assert.equal(raw.fault, undefined); assert.equal(requests.length, 7);
    const chunks = raw.steps.filter(s => s.chunk).map(s => s.chunk); for (const c of chunks) assert.ok(c.propagations <= 3072 && c.queries <= 6144);
    const summary = { variant, viewport: name, frameMs: stats(raw.frames.slice(1).map(f => f.ms)), playingMs: stats(raw.frames.filter(f => f.state === 'PLAYING').map(f => f.ms)),
      warmMs: stats(raw.frames.filter(f => f.elapsed >= 2 && f.state === 'PLAYING').map(f => f.ms)),
      plannerMs: stats(chunks.filter(c => c.propagations || c.queries).map(c => c.ms)), gateMs: stats(chunks.filter(c => c.phase === 'actual-gate').map(c => c.ms)),
      outliers: raw.frames.filter(f => f.ms >= 30), longTasks: raw.longTasks, state: raw.state, distance: raw.distance, hull: raw.hull,
      committed: raw.committed, omitted: raw.omitted, resources: raw.resources, assets: raw.assets,
      maximumDrawCalls: Math.max(...raw.frames.map(f => f.calls)), maximumTriangles: Math.max(...raw.frames.map(f => f.triangles)), peakActive: Math.max(...raw.frames.map(f => f.active)), requests, errors };
    summary.visibility = [...new Set(raw.poses.map(p => p.id))].map(id => {
      const poses = raw.poses.filter(p => p.id === id), first = poses[0], motion = first.planned.motion;
      const sample = pixels => poses.find(p => p.inFrustum && p.cameraDistance < 190 && p.projectedDiameterPixels >= pixels);
      return { id, firstRendered: first, first4PixelProxy: sample(4), first12PixelProxy: sample(12), activationElapsed: motion.startTick / 120,
        lastRendered: poses.at(-1), note: 'Projected enclosing diameter and fog/frustum presence are visibility proxies, not measured human recognition.' };
    });
    if (!smoke) { assert.ok(raw.poses.some(p => Math.abs(p.x) < 1)); assert.ok(new Set(raw.poses.map(p => p.x)).size > 30); }
    summary.video = await stopVideo(page, `mine-motion-${smoke ? 'smoke-' : ''}${variant}-${name}.webm`); videos.push(summary.video);
    await shot(page, `mine-motion-${variant}-${name}-live.png`);
    async function restart() {
      await page.evaluate(() => { const g = window.spaceRunner, m = g.model; g.loop.stop(); m.state = 'GAME_OVER'; m.start(42); g.world.reset();
        for (let i = 0; i < 1030; i++) m.step(1 / 120, { x: 0, y: 1 }); for (let i = 0; i < 20; i++) g.loop.render(1 / 60); });
      await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
      return page.evaluate(heap => { const g = window.spaceRunner, f = g.model.field; return { memory: { ...g.world.renderer.info.memory }, programs: g.world.renderer.info.programs.length,
        slots: f.slots.length, records: f.ledger.snapshot().length, activeMines: f.slots.filter(s => s.active && s.kind === 9).length, requests: g.assets.requests, heap }; }, heap);
    }
    for (let i = 0; i < 5; i++) await restart(); const before = await restart(), restarts = [];
    assert.equal(before.activeMines, 1, 'Restart memory sample reaches an actual published moving mine');
    for (let i = 0; i < 10; i++) { const r = await restart(); assert.deepEqual({ ...r, heap: undefined }, { ...before, heap: undefined }); restarts.push(r); }
    summary.restarts = { before, samples: restarts, retainedHeapDelta: restarts.at(-1).heap.usedSize - before.heap.usedSize };
    assert.equal(requests.length, 7, 'No additional requests across restarts');
    await writeFile(join(output, `mine-motion-${variant}-${name}-raw.json`), JSON.stringify(raw)); results.push(summary); await context.close();
    console.log(`${variant}/${name}: frames ${JSON.stringify(summary.frameMs)}, planner ${JSON.stringify(summary.plannerMs)}`);
  }
  for (const [variant,name] of [['baseline','desktop'],['fast','desktop'],['diagonal','desktop'],['diagonal','portrait'],['diagonal','landscape']]) {
    const context=await contextFor(name),page=await context.newPage();
    await page.goto(url(variant));await page.locator('#launch').click();await harness(page);
    await stage(page,`mine-motion-${variant}-${name}-distant.png`,100);
    await stage(page,`mine-motion-${variant}-${name}-mid.png`,45);
    await stage(page,`mine-motion-${variant}-${name}-path.png`,10);
    const passed=await stage(page,`mine-motion-${variant}-${name}-avoidance.png`,-4);assert.equal(passed.hits,0);
    await context.close();
  }
  await writeFile(join(output,smoke?'mine-motion-browser-smoke.json':'mine-motion-browser.json'),JSON.stringify({smoke,results,videos,screenshots,stages,
    note:'Serial real Three.js, identical prerecorded horizontal inputs, CPU1ms and native VP8 for every policy. First-mine reproduction enabled equally. Stage captures use causal witnesses and accelerated actual120Hz steps. Desktop Chrome mobile emulation; no human or physical phone claims.'},null,2));
} finally { await browser?.close();server.kill(); }
