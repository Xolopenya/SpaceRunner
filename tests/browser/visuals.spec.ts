import { test, expect } from './helpers.ts';

async function boot(page: import('@playwright/test').Page, params = '') {
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
  await page.goto(`/?debug=visuals&seed=42${params}`);await page.locator('#launch').click();
  await page.evaluate(() => { (window.spaceRunner as any).loop.stop(); });
}
async function advance(page: import('@playwright/test').Page, ticks: number, cadence = 2) {
  await page.evaluate(({ ticks, cadence }) => {
    const g = window.spaceRunner! as any, m = g.model;
    for (let i = 0; i < ticks; i++) {
      if (i % cadence === 0) m.beginPlanningFrame();
      const w = m.field.certificate;let t = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, input = { x: 0, y: 0 };
      for (const r of w?.controls ?? []) { if (t < r.ticks) { input = r.input;break; }t -= r.ticks; }
      m.step(1 / 120, input);
      if (i % cadence === cadence - 1) { m.finishPlanningFrame(cadence / 120);g.world.render(m, cadence / 120); }
    }
    g.world.render(m, 0);
  }, { ticks, cadence });
}

test('ordinary Play enables warp and seamless reveal without DEV controls or extra assets', async ({ page }) => {
  const assets: string[] = [];page.on('response', r => { if (r.url().endsWith('.glb')) assets.push(r.url()); });
  await page.goto('/?seed=42');await expect(page.locator('#launch')).toBeVisible();
  await page.evaluate(async () => { const path = '/src/game.ts', { Game } = await import(path), start = Game.prototype.start;
    Game.prototype.start = function () { (window as any).visualGame = this;start.call(this); }; });
  await page.locator('#launch').click();
  const r = await page.evaluate(() => { const g = (window as any).visualGame;g.loop.stop();g.world.render(g.model, 0);
    return { camera: g.world.flightCamera.mode, boundaries: g.world.boundaries.mode, reveal: g.world.reveal.mode, warp: g.world.boundaries.warp.root.visible, source: g.model.field.experiment.version }; });
  expect(r).toEqual({ camera: 'hybrid-chase', boundaries: 'warp', reveal: 'seamless', warp: true, source: 'integrated-playable-v1' });
  expect(assets).toHaveLength(7);await expect(page.locator('#visual-comparison')).toHaveCount(0);expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined();
});
test('four live visual combinations preserve the complete model and pooled resources at the same Phase 2 state', async ({ page }) => {
  await boot(page);await advance(page, 4500);
  const before = await page.evaluate(() => JSON.stringify(window.spaceRunner!.model));const rows = [];
  for (const boundaries of ['legacy', 'warp']) for (const reveal of ['legacy', 'seamless']) {
    await page.locator(`[data-boundaries="${boundaries}"]`).click();await page.locator(`[data-reveal="${reveal}"]`).click();
    rows.push(await page.evaluate(() => { const g = window.spaceRunner! as any;g.world.render(g.model, 0);return { model: JSON.stringify(g.model), phase: g.model.phase, hull: g.model.hull, memory: { ...g.world.renderer.info.memory }, variants: g.world.reveal.materials.size }; }));
  }
  for (const r of rows) { expect(r.model).toBe(before);expect(r.phase).toBe(2);expect(r.hull).toBe(3);expect(r.variants).toBe(rows[0]!.variants); }
  expect(rows[3]!.memory).toEqual(rows[1]!.memory);
});
test('new certified debris starts at zero coverage, advances without transparency sorting and resets reused identities', async ({ page }) => {
  await boot(page);await advance(page, 48);
  const first = await page.evaluate(() => { const g = window.spaceRunner! as any, m = g.model, h = m.field.slots.find((h: any) => h.active);return { id: h.planned.id, reveal: g.world.reveal.diagnostic(h.planned.id), active: m.field.committed }; });
  expect(first.active).toBeGreaterThan(0);expect((first.reveal as any).coverage).toBe(0);
  await advance(page, 60);
  const later = await page.evaluate(id => { const g = window.spaceRunner! as any;return { reveal: g.world.reveal.diagnostic(id), fallback: g.world.reveal.fallbackCount,
    opaque: g.world.reveal.targets.filter((t: any) => t.family === 'debris').every((t: any) => t.entries.every((e: any) => !Array.isArray(e.mesh.material) && !e.mesh.material.transparent && e.mesh.material.depthWrite)) }; }, first.id);
  expect((later.reveal as any).coverage).toBeGreaterThan(.8);expect(later.opaque).toBe(true);expect(later.fallback).toBe(0);
  await page.locator('#pause').click();await page.locator('#restart-pause').click();await advance(page, 48);
  expect(await page.evaluate(id => (window.spaceRunner!.world.reveal.diagnostic(id) as any).coverage, first.id)).toBe(0);
});
test('mine distant hull precedes its unchanged red warning; pause/resume retains warp and reveal clocks', async ({ page }) => {
  await boot(page);await advance(page, 3000);
  const waiting = await page.evaluate(() => { const g = window.spaceRunner! as any;return { phase: g.model.homing.current?.phase, body: g.world.collisionDebug.mine.visible, lamp: g.world.collisionDebug.lamp.visible }; });
  expect(waiting.phase).toBe('waiting');expect(waiting.body).toBe(true);expect(waiting.lamp).toBe(false);
  const warning = await page.evaluate(() => { const g = window.spaceRunner! as any, m = g.model;
    while (m.homing.current?.phase === 'waiting') { const w = m.field.certificate;let t = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, axis = { x: 0, y: 0 };for (const r of w?.controls ?? []) { if (t < r.ticks) { axis = r.input;break; }t -= r.ticks; }m.step(1 / 120, axis); }
    g.world.render(m, 0);const h = m.field.slots.find((s: any) => s.active && s.kind === 9);
    return { tick: m.homing.current.tick, warningTick: h.planned.motion.warningTick, body: g.world.collisionDebug.mine.visible, lamp: g.world.collisionDebug.lamp.visible, coverage: g.world.reveal.diagnostic(h.planned.id).coverage, hull: m.hull }; });
  expect(warning.tick).toBe(warning.warningTick);expect(warning.body).toBe(true);expect(warning.lamp).toBe(true);expect(warning.coverage).toBe(1);expect(warning.hull).toBe(3);
  await page.locator('#pause').click();
  const frozen = await page.evaluate(() => { const g = window.spaceRunner! as any, sample = () => JSON.stringify({ mine: g.model.homing.current, uniforms: g.world.boundaries.warp.sides.map((s: any) => s.material.uniforms), age: g.world.reveal.banks.map((b: any) => b.age.value) });const before = sample();for (let i = 0; i < 120; i++) g.world.render(g.model, 1 / 30);return before === sample(); });
  expect(frozen).toBe(true);await page.locator('#resume').click();await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
});
for (const cadence of [2, 4, 12]) test(`visual lifecycle stays bounded at ${cadence} simulation ticks per render and responsive resize`, async ({ page }) => {
  await boot(page);await advance(page, 600, cadence);
  const original = await page.evaluate(() => { const g = window.spaceRunner! as any;return { variants: g.world.reveal.materials.size, memory: { ...g.world.renderer.info.memory }, fallbacks: g.world.reveal.fallbackCount }; });
  for (let i = 0; i < 5; i++) { await page.locator('#pause').click();await page.locator('#restart-pause').click();await advance(page, 600, cadence); }
  const final = await page.evaluate(() => { const g = window.spaceRunner! as any;return { variants: g.world.reveal.materials.size, memory: { ...g.world.renderer.info.memory }, fallbacks: g.world.reveal.fallbackCount }; });
  expect(final).toEqual(original);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) { await page.setViewportSize(viewport);await expect.poll(()=>page.evaluate(()=>{const g=window.spaceRunner!,r=document.getElementById('flight')!.getBoundingClientRect();return Math.abs(g.world.flightCamera.camera.aspect-r.width/r.height);})).toBeLessThan(1e-6);const r = await page.evaluate(() => { const g = window.spaceRunner!;g.world.render(g.model, 0);const rect=document.getElementById('flight')!.getBoundingClientRect();return {aspect:g.world.flightCamera.camera.aspect,expected:rect.width/rect.height}; });expect(r.aspect).toBeCloseTo(r.expected, 6); }
});
