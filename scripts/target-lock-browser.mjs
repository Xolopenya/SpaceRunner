import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { stats } from './director-fields.mjs';
import { analyzeTargetTimings } from './target-lock-analysis.mjs';

const smoke = process.argv.includes('--smoke'), output = resolve(process.env.REVIEW_RESULT_DIR ?? '.cache/review/GAMEPLAY-EXPERIMENT-003C3/final');
await mkdir(output, { recursive: true }); await mkdir('test-results', { recursive: true });
const base = 'http://127.0.0.1:5200/', server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5200', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
const screenshots = [], stages = [], results = [], videos = [];
let browser;
const url = (variant = 'fast', extra = '') => base + '?debug=field&experiment=moving-mine&seed=42&firstMine=1&motion=' + variant + extra;
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
  for (const [variant, name, capture = true] of smoke ? [['target-lock','desktop']] : [['fast','desktop'],['diagonal','desktop'],['target-lock','desktop'],['target-lock','portrait'],['target-lock','landscape'],['fast','desktop',false],['target-lock','desktop',false]]) {
    await browser.close(); browser = await chromium.launch({ channel: 'chrome', headless: true });
    const label=(variant==='target-lock'?'target':variant)+(capture?'':'-unrecorded');
    const context = await contextFor(name), page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => errors.push(r.url())); page.on('request', r => { if (r.url().includes('.glb')) requests.push(r.url()); });
    await page.goto(url(variant)); await page.locator('#launch').waitFor({ state: 'visible' }); const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    await page.evaluate(() => {
      const g = window.spaceRunner, m = g.model, step = m.step.bind(m);
      const p = window.mineProfile = { frames: [], steps: [], poses: [], acquisition: [], publications: [], longTasks: [], last: performance.now(), active: true };
      Object.defineProperty(g.input, 'axis', { configurable: true, get: () => ({ x: Math.floor(Math.round(m.elapsed * 120) / 180) % 2 ? -1 : 1, y: 0 }) });
      m.step = (dt, axis) => { const start = performance.now(), before = m.field.planningTicks; step(dt, axis); if (p.active) p.steps.push({ start, ms: performance.now() - start,
        elapsed: m.elapsed, chunk: m.field.planningTicks > before ? { ...m.field.samples.at(-1) } : null });
        if(p.active && m.field.lastOutcome && p.lastOutcome!==m.field.lastOutcome){p.lastOutcome=m.field.lastOutcome;p.publications.push(m.field.lastOutcome);} };
      const observer = new PerformanceObserver(list => { if (p.active) p.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration }))); }); observer.observe({ type: 'longtask' });
      const frame = time => { if (!p.active) return; p.frames.push({ time, ms: time - p.last, elapsed: m.elapsed, state: m.state,
        calls: g.world.renderer.info.render.calls, triangles: g.world.renderer.info.render.triangles, active: m.field.slots.filter(s => s.active).length }); p.last = time;
        const mine = m.field.slots.find(s => s.active && s.kind === 9); if (mine) {
          const mesh = g.world.collisionDebug.root.getObjectByName('moving-space-mine');
          const camera = g.world.camera, projected = mesh.position.clone().project(camera), cameraPoint = mesh.position.clone().applyMatrix4(camera.matrixWorldInverse);
          const pixels = 2 * mine.radius * g.world.renderer.domElement.clientHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * -cameraPoint.z);
          p.poses.push({ time, tick: Math.round(m.elapsed * 120), distance: m.distance, id: mine.planned.id, x: mine.x, y: mine.y, z: mine.z,
            planned: mine.planned, ship: { x:m.ship.x,y:m.ship.y }, projectedX: projected.x, projectedY: projected.y, projectedDiameterPixels: pixels,
            inFrustum: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1,
            cameraDistance: mesh.position.distanceTo(camera.position),
            renderedX: mesh.position.x, renderedY: mesh.position.y, renderedZ: mesh.position.z });
        } else if(m.motionPolicy==='target-lock' && m.field.pending?.resolvingTarget) {
          const mesh=g.world.collisionDebug.root.getObjectByName('moving-space-mine');
          p.acquisition.push({time,tick:Math.round(m.elapsed*120),ship:{x:m.ship.x,y:m.ship.y},preview:{x:mesh.position.x,y:mesh.position.y,z:mesh.position.z,visible:mesh.visible},liveMines:m.field.slots.filter(s=>s.active&&s.kind===9).length,info:document.getElementById('moving-mine-info').textContent});
        } requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      p.stop = () => { p.active = false; observer.disconnect(); m.step = step; delete g.input.axis; g.loop.stop(); };
    });
    if(capture) await record(page); await page.locator('#launch').click(); await page.waitForTimeout(smoke ? 8000 : capture ? 45000 : 20000);
    const raw = await page.evaluate(() => { const g = window.spaceRunner, m = g.model, p = window.mineProfile; p.stop();
      const arrays = new Set(); for (const geo of g.assets.resources.geometries) for (const a of [...Object.values(geo.attributes), geo.index].filter(Boolean)) arrays.add(a.isInterleavedBufferAttribute ? a.data.array : a.array);
      return { frames: p.frames, steps: p.steps, poses: p.poses, acquisition:p.acquisition, publications:p.publications, longTasks: p.longTasks, elapsed: m.elapsed, distance: m.distance, state: m.state, hull: m.hull, hits: m.hitSerial,
        committed: m.field.committed, omitted: m.field.omitted, events: m.field.events, fault: m.field.fault,
        assets: { geometries: g.assets.resources.geometries.size, materials: g.assets.resources.materials.size, textures: g.assets.resources.textures.size, typedArrayBytes: [...arrays].reduce((n, a) => n + a.byteLength, 0) },
        resources: { ...g.world.renderer.info.memory, calls: g.world.renderer.info.render.calls, triangles: g.world.renderer.info.render.triangles, programs: g.world.renderer.info.programs.length } }; });
    const { profile } = await cdp.send('Profiler.stop'); await cdp.send('Profiler.disable'); await writeFile(join(output, `target-lock-${label}-${name}-cpu.json`), JSON.stringify(profile));
    assert.deepEqual(errors, []); assert.equal(raw.fault, undefined); assert.equal(requests.length, 7);
    const chunks = raw.steps.filter(s => s.chunk).map(s => s.chunk); for (const c of chunks) assert.ok(c.propagations <= 3072 && c.queries <= 6144);
    const summary = { variant, viewport: name, recorded:capture, processIsolation:'fresh Chrome process per case', matched20sMs:stats(raw.frames.filter(f=>f.state==='PLAYING'&&f.elapsed>=2&&f.elapsed<20).map(f=>f.ms)), frameMs: stats(raw.frames.slice(1).map(f => f.ms)), playingMs: stats(raw.frames.filter(f => f.state === 'PLAYING').map(f => f.ms)),
      warmMs: stats(raw.frames.filter(f => f.elapsed >= 2 && f.state === 'PLAYING').map(f => f.ms)),
      plannerMs: stats(chunks.filter(c => c.propagations || c.queries).map(c => c.ms)), gateMs: stats(chunks.filter(c => c.phase === 'actual-gate').map(c => c.ms)),
      targetResolutionMs:stats(raw.publications.filter(o=>o.resolution).map(o=>o.resolution.ms)),
      outliers: raw.frames.filter(f => f.ms >= 30), longTasks: raw.longTasks, state: raw.state, distance: raw.distance, hull: raw.hull,
      committed: raw.committed, omitted: raw.omitted, resources: raw.resources, assets: raw.assets,
      maximumDrawCalls: Math.max(...raw.frames.map(f => f.calls)), maximumTriangles: Math.max(...raw.frames.map(f => f.triangles)), peakActive: Math.max(...raw.frames.map(f => f.active)), requests, errors };
    summary.visibility = [...new Set(raw.poses.map(p => p.id))].map(id => {
      const poses = raw.poses.filter(p => p.id === id), first = poses[0], motion = first.planned.motion;
      const sample = pixels => poses.find(p => p.inFrustum && p.cameraDistance < 190 && p.projectedDiameterPixels >= pixels);
      return { id, firstRendered: first, first4PixelProxy: sample(4), first12PixelProxy: sample(12), activationElapsed: motion.startTick / 120,
        lastRendered: poses.at(-1), note: 'Projected enclosing diameter and fog/frustum presence are visibility proxies, not measured human recognition.' };
    });
    if (!smoke) { if(variant!=='target-lock')assert.ok(raw.poses.some(p=>Math.abs(p.x)<1)); assert.ok(new Set(raw.poses.map(p=>p.x+'/'+p.y)).size>8); }
    if(variant==='target-lock'){assert.ok(raw.acquisition.length>0);assert.ok(raw.acquisition.every(p=>p.liveMines===0));}
    if(capture){summary.video = await stopVideo(page, `target-lock-${smoke ? 'smoke-' : ''}${label}-${name}.webm`); videos.push(summary.video);}
    await shot(page, `target-lock-${label}-${name}-live.png`);
    summary.micro=await page.evaluate(async()=>{
      const {mineX,mineY}=await import('/src/experiments/moving-mine/motion.ts'),{movingMineHit}=await import('/src/experiments/moving-mine/collision.ts');
      const h=window.mineProfile.poses[0]?.planned;if(!h)throw Error('No recorded mine for browser microbenchmark');
      const poses=[],queries=[];let checksum=0;const a={x:0,y:0,vx:0,vy:0,elapsed:h.motion.startTick/120,distance:h.passDistance},b={...a,elapsed:a.elapsed+1/120,distance:a.distance+20/120};
      for(let batch=0;batch<25;batch++){let start=performance.now();for(let n=0;n<10000;n++){const t=(h.motion.startTick+n%h.motion.durationTicks)/120;checksum+=mineX(h,t)+mineY(h,t);}const pose=performance.now()-start;
        start=performance.now();for(let n=0;n<1000;n++){a.x=(n%240)/20-6;b.x=a.x+.05;checksum+=+movingMineHit(a,b,h,.15);}const query=performance.now()-start;
        if(batch>=5){poses.push(pose);queries.push(query);}}
      return{poseBatchMs:poses,poseEvaluationsPerBatch:10000,ccdBatchMs:queries,queriesPerBatch:1000,checksum,note:'Isolated browser microbenchmark after RAF/profile capture; five warmup batches excluded. This is not a measurement of per-frame cumulative costs.'};
    });
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
    await writeFile(join(output, `target-lock-${label}-${name}-raw.json`), JSON.stringify(raw)); results.push(summary); await context.close();
    console.log(`${label}/${name}: frames ${JSON.stringify(summary.frameMs)}, planner ${JSON.stringify(summary.plannerMs)}`);
  }

  // Stage evidence follows the actual120Hz model and its causal certificate.
  for (const name of ['desktop','portrait','landscape']) {
    const context=await contextFor(name),page=await context.newPage();await page.goto(url('target-lock'));await page.locator('#launch').click();await harness(page);
    async function captureStage(label,fn){const state=await page.evaluate(fn);await shot(page,`target-lock-${name}-${label}.png`);stages.push({screenshot:`target-lock-${name}-${label}.png`,...state});return state;}
    await captureStage('acquisition',()=>{const h=window.mineHarness;for(let n=0;n<48;n++)h.step({x:0,y:0});const s=h.snapshot();return{...s,info:document.getElementById('moving-mine-info').textContent,preview:window.spaceRunner.world.collisionDebug.root.getObjectByName('moving-space-mine').visible};});
    await captureStage('lock',()=>{const h=window.mineHarness;h.mine();return h.snapshot();});
    await captureStage('warning',()=>{const h=window.mineHarness,m=window.spaceRunner.model,mine=h.mine();while(Math.round(m.elapsed*120)<mine.motion.startTick-60)h.step();return h.snapshot();});
    await captureStage('attack',()=>{const h=window.mineHarness,m=window.spaceRunner.model,mine=h.mine(),target=Math.round((mine.motion.startTick+mine.motion.passTick)/2);while(Math.round(m.elapsed*120)<target)h.step();return h.snapshot();});
    const evaded=await captureStage('evasion',()=>{const h=window.mineHarness;h.to(h.mine().passDistance+4);return h.snapshot();});assert.equal(evaded.hull,3);assert.equal(evaded.hits,0);
    if(name==='desktop'){
      await harness(page);const impact=await captureStage('collision',()=>{const h=window.mineHarness,m=window.spaceRunner.model;while(m.distance<184)h.step({x:0,y:0});return h.snapshot();});assert.equal(impact.hull,2);assert.equal(impact.hits,1);
      await harness(page);const off=await captureStage('off-center',()=>{const h=window.mineHarness;for(let n=0;n<97;n++)h.step({x:1,y:0});return h.snapshot();});assert.ok(off.mine.planned.motion.targetX>4);
      await page.goto(url('target-lock','&colliders=1'));await page.locator('#launch').click();await harness(page);await stage(page,'target-lock-desktop-colliders.png',10);
      await page.goto(base+'?debug=field&experiment=moving-mine&motion=target-lock&seed=42');await page.locator('#launch').click();await harness(page);
      const boundary=await captureStage('boundary',()=>{const h=window.mineHarness,m=window.spaceRunner.model;while(!h.first&&h.ticks<4000)h.step({x:1,y:1});if(!h.first)throw Error('No boundary target');return h.snapshot();});
      assert.ok(Math.abs(boundary.mine.planned.motion.targetX)>5.5&&Math.abs(boundary.mine.planned.motion.targetY)>3.2);
    }
    await context.close();
  }
  // A dedicated causal demonstration changes steering AFTER lock. No teleport,
  // future input tape or certificate actor supplies the evasion in this video.
  const context=await contextFor('desktop'),page=await context.newPage();await page.goto(url('target-lock'));await page.locator('#launch').waitFor({state:'visible'});
  await page.evaluate(()=>{const g=window.spaceRunner,m=g.model,trace=window.lockDemo={poses:[],active:true,locked:false,first:null};
    Object.defineProperty(g.input,'axis',{configurable:true,get:()=>{trace.first??=m.field.slots.find(h=>h.active&&h.kind===9)?.planned;if(trace.first)trace.locked=Math.round(m.elapsed*120)>=trace.first.motion.capture.tick+54;return trace.locked?{x:0,y:1}:{x:0,y:0};}});
    const frame=time=>{if(!trace.active)return;const h=m.field.slots.find(h=>h.planned?.kind===9),mesh=g.world.collisionDebug.root.getObjectByName('target-lock-course');
      trace.poses.push({time,tick:Math.round(m.elapsed*120),distance:m.distance,ship:{x:m.ship.x,y:m.ship.y},mine:h?{x:h.x,y:h.y,z:h.z,active:h.active,planned:h.planned}:null,pathVisible:mesh.visible,pathTarget:{x:mesh.geometry.attributes.position.getX(1),y:mesh.geometry.attributes.position.getY(1)}});requestAnimationFrame(frame);};requestAnimationFrame(frame);
  });
  await record(page);await page.locator('#launch').click();await page.waitForFunction(()=>window.lockDemo.first&&window.spaceRunner.model.distance>window.lockDemo.first.passDistance+6,{},{timeout:30000});
  const demo=await page.evaluate(()=>{const d=window.lockDemo,m=window.spaceRunner.model;d.active=false;window.spaceRunner.loop.stop();return{poses:d.poses,first:d.first,hull:m.hull,hits:m.hitSerial,distance:m.distance};});
  assert.equal(demo.hull,3);assert.equal(demo.hits,0);const captured=demo.poses.filter(p=>p.mine);assert.ok(captured.length>30);assert.equal(new Set(captured.map(p=>JSON.stringify(p.mine.planned.motion))).size,1);assert.ok(Math.max(...captured.map(p=>p.ship.y))-Math.min(...captured.map(p=>p.ship.y))>2);
  const demonstration=await stopVideo(page,'target-lock-no-retarget.webm');videos.push(demonstration);await writeFile(join(output,'target-lock-no-retarget-trace.json'),JSON.stringify(demo));await context.close();
  await writeFile(join(output,smoke?'target-lock-browser-smoke.json':'target-lock-browser.json'),JSON.stringify({smoke,results,videos,screenshots,stages,demonstration,
    note:'Real Three.js; each performance case starts a fresh Chrome process. Recorded45s A/B/C and mobile C use equal VP8/CPU1ms instrumentation; two20s unrecorded controls use the same CPU sampler and matched[2,20] window. Stage capture follows actual120Hz dynamics. Dedicated video uses causal post-lock upward steering, not a witness. Mobile is emulation, not a physical device.'},null,2));
  if(!smoke)await analyzeTargetTimings(output);
} finally {await browser?.close();server.kill();}
