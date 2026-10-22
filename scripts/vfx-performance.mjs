import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// The same held six-hazard fixture is used before and after the rendering change.
// Rendering-only sample: no simulation, changing hazard count or gameplay RNG.
const directory = resolve(process.env.REVIEW_RESULT_DIR || '.cache/review/PHASE-3-002/final');
await mkdir(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5184, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  const samples = [];
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:5184/?debug&seed=42');
    await page.locator('#launch').waitFor({ state: 'visible' });
    await page.locator('#launch').click();
    const sample = await page.evaluate(async () => {
      const game = window.spaceRunner;
      game.loop.stop();
      const model = game.model;
      model.elapsed = 120;
      model.distance = 500;
      model.field.hazards.forEach(hazard => { hazard.active = false; });
      for (let i = 0; i < 6; i++) Object.assign(model.field.hazards[i], {
        active: true, x: (i % 3 - 1) * 3.4, y: i < 3 ? 1.5 : -1.5,
        z: -16 - i * 4, radius: 1, spin: 0.4, kind: i === 0 ? 0 : i < 3 ? 1 : 2, phase: i % 2 ? 4 : 0,
      });
      const intervals = [], renderTimes = [];
      let previous;
      for (let frame = 0; frame < 240; frame++) {
        const now = await new Promise(resolve => requestAnimationFrame(resolve));
        model.elapsed += 1 / 60;
        model.distance += model.speed / 60;
        const start = performance.now();
        game.world.render(model, 1 / 60);
        const renderMs = performance.now() - start;
        if (frame >= 60) { intervals.push(now - previous); renderTimes.push(renderMs); }
        previous = now;
      }
      const stats = values => {
        values.sort((a, b) => a - b);
        return { median: values[Math.floor(values.length / 2)], p95: values[Math.floor(values.length * 0.95)] };
      };
      const renderer = game.world.renderer;
      const gl = renderer.getContext();
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, seed: model.seed, activeHazards: model.field.hazards.filter(hazard => hazard.active).length, frames: intervals.length, frameIntervalMs: stats(intervals), renderCpuMs: stats(renderTimes), drawCalls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, renderPixelRatio: renderer.getPixelRatio(), gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
    });
    if (errors.length) throw new Error(errors.join('\n'));
    samples.push({ tier: mobile ? 'mobile-emulation' : 'desktop', ...sample });
    await context.close();
  }
  const report = { browser: browser.version(), generatedAt: new Date().toISOString(), fixture: 'seed 42; 6 fixed visible hazards; speed 34; 60 warmup + 180 sampled RAF frames; dev rendering; same machine. CPU submission and RAF timing, not GPU timer queries or physical phone measurements.', samples };
  await writeFile(join(directory, 'vfx-performance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
