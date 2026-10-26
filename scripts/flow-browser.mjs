import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { stats } from './director-fields.mjs';

const smoke = process.argv.includes('--smoke'), output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003B3/final');
await mkdir(output, { recursive: true }); await mkdir('test-results', { recursive: true });
const base = 'http://127.0.0.1:5197/', server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser; const screenshots = [], results = [], guided = [], stages = [];
const viewport = name => name === 'portrait' ? { width: 390, height: 844 } : name === 'landscape' ? { width: 844, height: 390 } : { width: 1280, height: 800 };
const url = variant => variant === 'A' ? '?debug=field&experiment=large-structure&mode=mixed&aperture=right&seed=42' : '?debug=field&experiment=mixed-flow&seed=42';
async function contextFor(name) { return browser.newContext({ viewport: viewport(name), isMobile: name !== 'desktop', hasTouch: name !== 'desktop', deviceScaleFactor: name === 'desktop' ? 1 : 2 }); }
async function screenshot(page, name) { await page.screenshot({ path: `test-results/${name}` }); screenshots.push(name); }
async function record(page) { await page.evaluate(() => {
  const stream = document.querySelector('#flight').captureStream(30), chunks = [], recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1200000 });
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start(500); window.flowVideo = { recorder, stream, chunks };
}); }
async function stopVideo(page, filename) {
  const data = await page.evaluate(() => new Promise(done => { const v = window.flowVideo; v.recorder.onstop = () => { const reader = new FileReader(); reader.onload = () => done(reader.result.split(',')[1]);
    reader.readAsDataURL(new Blob(v.chunks, { type: 'video/webm' })); v.stream.getTracks().forEach(t => t.stop()); }; v.recorder.stop(); }));
  const bytes = Buffer.from(data, 'base64'); await writeFile(`test-results/${filename}`, bytes);
  const videoPage = await page.context().newPage(); await videoPage.goto(base + 'tests/browser/trajectory-harness.html');
  await videoPage.setContent(`<video muted src="/test-results/${filename}"></video>`); await videoPage.waitForFunction(() => document.querySelector('video').readyState >= 2);
  const decoded = [];
  for (const time of [2, 6]) decoded.push(await videoPage.evaluate(time => new Promise(done => { const v = document.querySelector('video'); v.onseeked = () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 100; const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, 160, 100); let h = 2166136261;
    for (const b of ctx.getImageData(0, 0, 160, 100).data) h = Math.imul(h ^ b, 16777619); done({ time: v.currentTime, width: v.videoWidth, height: v.videoHeight, hash: h >>> 0, duration: v.duration }); }; v.currentTime = time; }), time));
  assert.notEqual(decoded[0].hash, decoded[1].hash); await videoPage.close(); await page.bringToFront(); return { filename, bytes: bytes.length, decoded };
}
async function harness(page) { await page.evaluate(() => {
  const g = window.spaceRunner, m = g.model; g.loop.stop(); m.state = 'GAME_OVER'; m.start(42); g.world.reset();
  const h = window.flowHarness = { frames: [], ticks: 0,
    input() { const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0; for (const r of w?.controls ?? []) { if (tick < r.ticks) return r.input; tick -= r.ticks; } return { x: 0, y: 0 }; },
    step(axis) { if (m.state !== 'PLAYING') throw Error('unexpected actual death'); m.step(1 / 120, axis ?? h.input()); h.ticks++;
      for (const s of m.field.slots) if (s.planned && s.kind >= 4 && !h.frames.some(f => f.id === s.planned.id)) h.frames.push(s.planned); if (h.ticks % 120 === 0) g.loop.render(1 / 60); },
    to(distance) { while (m.distance < distance && h.ticks < 22000) h.step(); if (m.distance < distance) throw Error('stage not reached'); },
    frame(index) { while (h.frames.length <= index && h.ticks < 22000) h.step(); if (!h.frames[index]) throw Error('missing structure'); return h.frames[index]; },
    snapshot() { for (let i = 0; i < 20; i++) g.loop.render(1 / 60); return { elapsed: m.elapsed, distance: m.distance, hull: m.hull, hits: m.hitSerial, ship: { ...m.ship },
      committed: m.field.committed, omitted: m.field.omitted, frames: h.frames.map(f => ({ id: f.id, kind: f.kind, passDistance: f.passDistance })), trace: m.field.exportDiagnosticTrace() }; }
  };
}); }
async function stage(page, name, index, lead) {
  const state = await page.evaluate(({ index, lead }) => { const h = window.flowHarness, frame = h.frame(index); h.to(frame.passDistance - lead); return { target: frame, ...h.snapshot() }; }, { index, lead });
  assert.equal(state.hits, 0); await screenshot(page, name); stages.push({ screenshot: name, ...state }); return state;
}
try {
  let ready = false; for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); } assert.ok(ready);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const cases = smoke ? [['B', 'desktop']] : [['A', 'desktop'], ['B', 'desktop'], ['B', 'portrait'], ['B', 'landscape']];
  for (const [variant, name] of cases) {
    const context = await contextFor(name), page = await context.newPage(), errors = [], glbs = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url())); page.on('request', r => { if (r.url().endsWith('.glb')) glbs.push(r.url()); });
    await page.goto(base + url(variant)); await page.locator('#launch').waitFor({ state: 'visible' });
    const cdp = await context.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await page.evaluate(() => {
      const g = window.spaceRunner, m = g.model, w = g.world, step = m.step.bind(m), render = w.render.bind(w);
      const p = window.flowProfile = { frames: [], steps: [], renders: [], longTasks: [], last: performance.now(), active: true, profileUnits: 0, hazardQueries: 0 };
      const collision = m.collisions, hit = collision.hit;
      collision.hit = function (...args) { p.hazardQueries++; p.profileUnits += args[2].kind >= 4 ? 4 : 1; return hit.apply(this, args); };
      // Prerecorded horizontal policy. No geometry/witness enters this controller.
      Object.defineProperty(g.input, 'axis', { configurable: true, get: () => ({ x: Math.floor(Math.round(m.elapsed * 120) / 180) % 2 ? -1 : 1, y: 0 }) });
      m.step = (dt, input) => { const start = performance.now(), before = m.field.planningTicks; step(dt, input); const end = performance.now(); if (p.active) p.steps.push({ start, end, ms: end - start,
        elapsed: m.elapsed, chunk: m.field.planningTicks > before ? { ...m.field.samples.at(-1) } : null }); };
      w.render = (model, dt) => { const start = performance.now(); render(model, dt); if (p.active) p.renders.push({ start, end: performance.now() }); };
      const observer = new PerformanceObserver(list => { if (p.active) p.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration }))); }); observer.observe({ type: 'longtask' });
      const frame = t => { if (!p.active) return; p.frames.push({ time: t, ms: t - p.last, elapsed: m.elapsed, state: m.state }); p.last = t; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      p.stop = () => { p.active = false; observer.disconnect(); m.step = step; w.render = render; collision.hit = hit; delete g.input.axis; g.loop.stop(); };
    });
    if (name === 'desktop') await record(page);
    await page.locator('#launch').click(); await page.waitForTimeout(smoke ? 8000 : 45000);
    const raw = await page.evaluate(() => { const g = window.spaceRunner, m = g.model, p = window.flowProfile; p.stop(); const owner = g.world.collisionDebug?.resources;
      const arrays = new Set(); if (owner) for (const geo of owner.geometries) for (const a of [...Object.values(geo.attributes), geo.index].filter(Boolean)) arrays.add(a.isInterleavedBufferAttribute ? a.data.array : a.array);
      return { frames: p.frames, steps: p.steps, renders: p.renders, longTasks: p.longTasks, distance: m.distance, elapsed: m.elapsed, hits: m.hitSerial, hull: m.hull, state: m.state,
        committed: m.field.committed, omitted: m.field.omitted, events: m.field.events, fault: m.field.fault, profileUnits: p.profileUnits, hazardQueries: p.hazardQueries,
        primitiveCounter: m.collisionQueries, resources: { ...g.world.renderer.info.memory, calls: g.world.renderer.info.render.calls, programs: g.world.renderer.info.programs.length },
        owned: owner ? { geometries: owner.geometries.size, materials: owner.materials.size, textures: owner.textures.size, typedArrayBytes: [...arrays].reduce((n, a) => n + a.byteLength, 0) } : null }; });
    const { profile: cpu } = await cdp.send('Profiler.stop'); await cdp.send('Profiler.disable');
    const samples = new Map(); for (const id of cpu.samples ?? []) samples.set(id, (samples.get(id) ?? 0) + 1);
    const hotspots = cpu.nodes.map(n => ({ name: n.callFrame.functionName, url: n.callFrame.url, line: n.callFrame.lineNumber, samples: samples.get(n.id) ?? 0 })).sort((a, b) => b.samples - a.samples).slice(0, 25);
    await writeFile(join(output, `flow-${variant}-${name}-cpu.json`), JSON.stringify(cpu) + '\n');
    assert.deepEqual(errors, []); assert.equal(glbs.length, 6); assert.equal(raw.fault, undefined); assert.equal(raw.state, 'PLAYING');
    assert.equal(raw.profileUnits, raw.primitiveCounter); assert.ok(raw.distance > (smoke ? 100 : 650));
    const chunks = raw.steps.filter(s => s.chunk).map(s => s.chunk), active = chunks.filter(s => s.propagations || s.queries);
    for (const c of chunks) assert.ok(c.propagations <= 3072 && c.queries <= 6144);
    const summary = { variant, viewport: name, frameMs: stats(raw.frames.slice(1).map(f => f.ms)), steadyMs: stats(raw.frames.filter(f => f.elapsed >= 2).map(f => f.ms)),
      planningMs: stats(active.filter(c => c.phase !== 'actual-gate').map(c => c.ms)), gateMs: stats(active.filter(c => c.phase === 'actual-gate').map(c => c.ms)),
      allCoordinatorMs: stats(chunks.map(c => c.ms)), totalPropagations: chunks.reduce((n, c) => n + c.propagations, 0), totalQueries: chunks.reduce((n, c) => n + c.queries, 0),
      distance: raw.distance, elapsed: raw.elapsed, hits: raw.hits, committed: raw.committed, omitted: raw.omitted, resources: raw.resources, owned: raw.owned,
      gameplayProfileUnits: raw.profileUnits, errors, glbRequests: glbs.length, cpuHotspots: hotspots,
      outlierFrames: raw.frames.filter(f => f.ms >= 30), longTasks: raw.longTasks.map(t => ({ ...t, overlappingModelSteps: raw.steps.filter(s => s.start < t.start + t.ms && s.end > t.start).map(s => ({ ms: s.ms, elapsed: s.elapsed, chunk: s.chunk })) })) };
    if (name === 'desktop') summary.video = await stopVideo(page, `flow-${smoke ? 'smoke-' : ''}${variant}-desktop.webm`);
    await screenshot(page, `flow-${variant}-${name}-live.png`);
    async function restart() {
      await page.evaluate(() => { const g = window.spaceRunner, m = g.model; g.loop.stop(); m.state = 'GAME_OVER'; m.start(42); g.world.reset(); for (let i = 0; i < 600; i++) m.step(1 / 120, { x: 0, y: 0 }); for (let i = 0; i < 20; i++) g.loop.render(1 / 60); });
      await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
      return page.evaluate(heap => { const g = window.spaceRunner, f = g.model.field; return { memory: { ...g.world.renderer.info.memory }, programs: g.world.renderer.info.programs.length,
        slots: f.slots.length, records: f.ledger.snapshot().length, trace: f.publicationTrace.length, inputRuns: f.inputTrace.length, heap }; }, heap);
    }
    for (let i = 0; i < 5; i++) await restart(); const before = await restart(), restarts = [];
    for (let i = 0; i < 10; i++) { const r = await restart(); assert.deepEqual({ ...r, heap: undefined }, { ...before, heap: undefined }); restarts.push(r); }
    summary.restarts = { before, samples: restarts, retainedHeapDelta: restarts.at(-1).heap.usedSize - before.heap.usedSize,
      note: 'Same-phase forced-GC V8 heap and finite resource/ring samples, not whole-process/GPU-driver or indefinite phone memory proof.' };
    await writeFile(join(output, `flow-${variant}-${name}-raw.json`), JSON.stringify(raw) + '\n'); results.push(summary); await context.close();
    console.log(`${variant}/${name}: frame p50/p95/p99/max ${summary.frameMs.p50}/${summary.frameMs.p95}/${summary.frameMs.p99}/${summary.frameMs.max}; ${summary.committed} committed/${summary.omitted} omitted`);
  }
  // Static stage captures use actual fixed-step integration and original camera.
  const context = await contextFor('desktop'), page = await context.newPage(); await page.goto(base + url('B')); await page.locator('#launch').click(); await harness(page);
  await page.evaluate(() => { window.flowHarness.to(110); window.flowHarness.snapshot(); }); await screenshot(page, 'flow-ordinary.png');
  await page.evaluate(() => { window.flowHarness.frame(0); window.flowHarness.snapshot(); }); await screenshot(page, 'flow-first-visible.png');
  await stage(page, 'flow-approach.png', 0, 45); const first = await stage(page, 'flow-entry-right.png', 0, 8); await stage(page, 'flow-passed.png', 0, -10);
  const second = await stage(page, 'flow-second-entry-left.png', 1, 8); assert.notEqual(first.target.kind, second.target.kind);
  await stage(page, 'flow-entry-lower.png', 2, 8); await stage(page, 'flow-entry-upper.png', 3, 8); await stage(page, 'flow-entry-center.png', 4, 8);
  await page.evaluate(() => { window.flowHarness.to(3300); window.flowHarness.snapshot(); }); await screenshot(page, 'flow-long-3300m.png');
  const exported = await page.evaluate(() => window.spaceRunner.model.field.exportDiagnosticTrace()); assert.equal(exported.publications.length, 16);
  await writeFile(join(output, 'flow-browser-export.json'), JSON.stringify(exported) + '\n');
  await harness(page); const impact = await page.evaluate(() => { const h = window.flowHarness, m = window.spaceRunner.model, frame = h.frame(0); h.to(frame.passDistance - 30);
    const before = m.hitSerial; let damaged;
    while (m.hitSerial === before && m.distance < frame.passDistance + 8) { const active = m.field.slots.filter(s => s.active).map(s => ({ id: s.planned.id, kind: s.kind })); h.step({ x: -1, y: 0 });
      if (m.hitSerial > before) damaged = active.find(a => !m.field.slots.some(s => s.active && s.planned?.id === a.id)); }
    return { damaged, ...h.snapshot() }; });
  assert.ok(impact.damaged.kind >= 4); assert.equal(impact.hits, 1); await screenshot(page, 'flow-solid-impact.png');
  await page.goto(base + url('B') + '&colliders=1'); await page.locator('#launch').click(); await harness(page); await stage(page, 'flow-colliders.png', 0, 8); await context.close();
  for (const name of ['portrait', 'landscape']) {
    const context = await contextFor(name), page = await context.newPage(); await page.goto(base + url('B')); await page.locator('#launch').click(); await harness(page);
    await stage(page, `flow-${name}-entry.png`, 0, 8); await stage(page, `flow-${name}-second.png`, 1, 8); await stage(page, `flow-${name}-vertical.png`, 2, 8); await context.close();
  }
  if (!smoke) for (const [name, seconds] of [['desktop', 90], ['portrait', 60], ['landscape', 60]]) {
    const context = await contextFor(name), page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + url('B')); await page.locator('#launch').waitFor({ state: 'visible' });
    await page.evaluate(() => { const g = window.spaceRunner, m = g.model; Object.defineProperty(g.input, 'axis', { configurable: true, get: () => {
      const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0; for (const r of w?.controls ?? []) { if (tick < r.ticks) return r.input; tick -= r.ticks; } return { x: 0, y: 0 }; } }); });
    await record(page); await page.locator('#launch').click();
    const samples = [];
    for (let s = 0; s < seconds; s += 15) { await page.waitForTimeout(15000); const sample = await page.evaluate(() => { const m = window.spaceRunner.model; return { elapsed: m.elapsed, distance: m.distance, hits: m.hitSerial, state: m.state, committed: m.field.committed, omitted: m.field.omitted }; });
      assert.equal(sample.hits, 0); assert.equal(sample.state, 'PLAYING'); samples.push(sample); console.log(`Guided supplement ${name}: ${sample.distance.toFixed(0)}m, ${sample.committed} published/${sample.omitted} omitted`); }
    await page.evaluate(() => window.spaceRunner.loop.stop()); const video = await stopVideo(page, `flow-guided-${name}.webm`);
    guided.push({ viewport: name, controller: 'Causal certificate follower; supplementary illustration, not ordinary input evidence', samples, video, errors }); assert.deepEqual(errors, []); await context.close();
  }
  const report = { generatedAt: new Date().toISOString(), browser: browser.version(), smoke, results, screenshots, stages, impact, guided, humanParticipants: 0, physicalDevices: 0,
    method: 'Serial45s real RAF/120Hz/Three.js profiles: approved B2 mixed versus new flow with the same prerecorded horizontal input. Cold launch retained; warmed frames elapsed>=2s separately. All profiles use1ms CDP CPU sampling; desktop profiles equally record silent VP8 canvas. Ten same-phase forced-GC/resource restarts. Stage PNGs integrate actual GameModel with stopped RAF, no position/geometry teleports. Guided90s/60s videos supplement ordinary-input tests and long paired diagnostics; they do not establish human readability/enjoyment. Portrait/landscape are desktop Chrome touch/DPR emulation.' };
  await writeFile(join(output, smoke ? 'flow-browser-smoke.json' : 'flow-browser.json'), JSON.stringify(report, null, 2) + '\n');
} finally { await browser?.close(); server.kill(); }
