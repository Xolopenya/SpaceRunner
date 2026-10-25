import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { stats } from './director-fields.mjs';

const root = process.cwd(), output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003A/final');
await mkdir(output, { recursive: true }); await mkdir('test-results', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:5197/')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready); browser = await chromium.launch({ channel: 'chrome', headless: true });
  const cases = [];
  for (const mobile of [false, true]) for (const policy of ['baseline', 'pressure']) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url())); page.on('request', r => { if (r.url().endsWith('.glb')) requests.push(r.url()); });
    await page.goto(`http://127.0.0.1:5197/?debug=field&policy=${policy}&seed=42`); await page.locator('#launch').waitFor({ state: 'visible' });
    await page.evaluate(record => {
      const g = window.spaceRunner, m = g.model, step = m.step.bind(m);
      const p = window.pressureProfile = { frames: [], steps: [], inputs: [], active: true, last: performance.now(), longTasks: [] };
      // Identical time-indexed prerecorded horizontal history. Only this research
      // driver sees it; the planner continues receiving current observations.
      Object.defineProperty(g.input, 'axis', { configurable: true, get: () => ({ x: Math.floor(Math.round(m.elapsed * 120) / 180) % 2 ? -1 : 1, y: 0 }) });
      m.step = (dt, input) => { const start = performance.now(), before = m.field.planningTicks; step(dt, input); if (p.active) { p.steps.push({ ms: performance.now() - start, elapsed: m.elapsed, distance: m.distance, chunk: m.field.planningTicks > before ? { ...m.field.samples.at(-1) } : null }); p.inputs.push({ tick: Math.round(m.elapsed * 120), input }); } };
      const observer = new PerformanceObserver(list => { if (p.active) p.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration }))); }); observer.observe({ type: 'longtask' });
      const frame = now => { if (!p.active) return; p.frames.push({ ms: now - p.last, elapsed: m.elapsed, state: m.state }); p.last = now; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      p.stop = () => { p.active = false; observer.disconnect(); m.step = step; delete g.input.axis; };
      if (record) {
        const stream = document.querySelector('#flight').captureStream(30), chunks = [], recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1200000 });
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.start(500); p.recording = { stream, chunks, recorder };
      }
    }, !mobile);
    await page.locator('#launch').click(); await page.waitForTimeout(14000);
    const raw = await page.evaluate(() => {
      const g = window.spaceRunner, m = g.model, p = window.pressureProfile; p.stop();
      return { frames: p.frames, steps: p.steps, inputs: p.inputs, longTasks: p.longTasks, policy: m.field.policy,
        elapsed: m.elapsed, distance: m.distance, hull: m.hull, hits: m.hitSerial, score: m.score, state: m.state,
        fault: m.field.fault, scheduled: m.field.scheduled, committed: m.field.committed, omitted: m.field.omitted,
        geometry: m.field.ledger.knownHazards(m.distance), events: m.field.events, audio: g.audio.status,
        resources: { ...g.world.renderer.info.memory, calls: g.world.renderer.info.render.calls } };
    });
    assert.deepEqual(errors, []); assert.equal(raw.fault, undefined); assert.equal(raw.policy.name, policy); assert.equal(raw.state, 'PLAYING'); assert.equal(raw.audio, 'running'); assert.equal(requests.length, 6);
    const name = `pressure-${policy}-${mobile ? 'portrait' : 'desktop'}`;
    await page.screenshot({ path: `test-results/${name}-live.png` });
    const summary = { name, policy: raw.policy, frames: stats(raw.frames.slice(1).map(f => f.ms)),
      playingFrames: stats(raw.frames.slice(1).filter(f => f.state === 'PLAYING').map(f => f.ms)),
      steadyFrames: stats(raw.frames.filter(f => f.elapsed >= 1 && f.state === 'PLAYING').map(f => f.ms)),
      stepCpu: stats(raw.steps.map(s => s.ms)), work: stats(raw.steps.filter(s => s.chunk && !['ready', 'failed', 'actual-gate'].includes(s.chunk.phase)).map(s => s.chunk.ms)),
      gate: stats(raw.steps.filter(s => s.chunk?.phase === 'actual-gate').map(s => s.chunk.ms)),
      elapsed: raw.elapsed, distance: raw.distance, resources: raw.resources, committed: raw.committed, omitted: raw.omitted, errors };
    if (!mobile) {
      const data = await page.evaluate(() => new Promise(done => {
        const r = window.pressureProfile.recording;
        r.recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(r.chunks, { type: 'video/webm' }).arrayBuffer()); r.stream.getTracks().forEach(t => t.stop()); done(Array.from(bytes)); }; r.recorder.stop();
      }));
      const file = `${name}-canvas.webm`, bytes = Buffer.from(data); assert.ok(bytes.length > 1024); await writeFile(`test-results/${file}`, bytes);
      const videoPage = await context.newPage(); await videoPage.goto('http://127.0.0.1:5197/tests/browser/trajectory-harness.html');
      await videoPage.setContent(`<video id="v" muted src="/test-results/${file}"></video>`);
      const frames = [];
      for (const time of [2, 6]) frames.push(await videoPage.evaluate(time => new Promise(done => {
        const v = document.querySelector('video'); v.onseeked = () => { const c = document.createElement('canvas'); c.width = 160; c.height = 100; const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, 160, 100); let hash = 2166136261; for (const b of ctx.getImageData(0, 0, 160, 100).data) hash = Math.imul(hash ^ b, 16777619); done({ time: v.currentTime, width: v.videoWidth, height: v.videoHeight, hash: hash >>> 0 }); }; v.currentTime = time;
      }), time));
      assert.ok(frames[0].width > 0); assert.notEqual(frames[0].hash, frames[1].hash); summary.video = { file, bytes: bytes.length, decodedFrames: frames, silentCanvasOnly: true }; await videoPage.close(); await page.bringToFront();
    }
    await page.evaluate(() => window.spaceRunner.loop.stop());
    // Warm the existing pooled renderer before finite same-phase restart samples.
    async function restart() { return page.evaluate(() => { const g = window.spaceRunner, m = g.model, old = m.field.pending; m.state = 'GAME_OVER'; m.start(42); for (let i = 0; i < 20; i++) m.step(1 / 120, { x: 0, y: 0 }); g.loop.render(1 / 60); return { cancelled: !old || old.getResult()?.reason === 'CANCELLED', memory: { ...g.world.renderer.info.memory }, slots: m.field.hazards.length, events: m.field.events.length, samples: m.field.samples.length }; }); }
    for (let i = 0; i < 5; i++) await restart(); const before = await restart(); const restarts = [];
    for (let i = 0; i < 10; i++) { const r = await restart(); assert.ok(r.cancelled); assert.deepEqual(r.memory, before.memory); assert.equal(r.slots, 72); assert.ok(r.events <= 64 && r.samples <= 2048); restarts.push(r); }
    summary.restarts = { before, samples: restarts, finite: true }; await writeFile(join(output, `${name}-raw.json`), JSON.stringify(raw) + '\n'); cases.push(summary); await context.close();
    console.log(`${name}: frame p50/p95/max ${summary.frames.p50}/${summary.frames.p95}/${summary.frames.max}ms`);
  }
  const result = { generatedAt: new Date().toISOString(), browser: browser.version(), cases, humanParticipants: 0,
    method: 'Four14s real RAF/120Hz/Three.js/GLB/VFX/audio cases with identical time-indexed prerecorded horizontal inputs; cold Launch frames retained. No stopped loop or accelerated steps during performance. Independent finite same-phase restart stress follows measurement. Native desktop recordings add capture cost, silent canvas only; portrait is desktop touch emulation. Different wall-clock lengths cause slightly different terminal simulation clocks; exact fixed-clock screenshots are separately captured at12s with neutral input. No physical phone or human preference claim.' };
  await writeFile(join(output, 'pressure-browser.json'), JSON.stringify(result, null, 2) + '\n');
} finally { await browser?.close(); server.kill(); }
