import { test, expect } from './helpers.ts';

test('ordinary Play uses Hybrid, mines and fragments through stations and Phase 2; UI pause/resume/restart resets one shared scene', async ({ page }) => {
  await page.goto('/?seed=42'); await expect(page.locator('#launch')).toBeVisible();
  // Observe the ordinary Game instance at its existing launch method. No debug URL or app test hook.
  await page.evaluate(async () => {
    const path = '/src/game.ts', { Game } = await import(path), original = Game.prototype.start;
    Game.prototype.start = function () { (window as any).integratedTest = this; original.call(this); };
  });
  await page.locator('#launch').click();
  await expect(page.locator('#camera-research')).toHaveCount(0);
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined();
  const run = await page.evaluate(() => {
    const g = (window as any).integratedTest, m = g.model; g.loop.stop();
    let peak = 0, mineRendered = false, station = false, pickups = 0;
    while (m.distance < 2200 && m.state === 'PLAYING') {
      m.beginPlanningFrame();
      for (let n = 0; n < 2; n++) {
        const w = m.field.certificate; let t = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, input = { x: 0, y: 0 };
        for (const r of w?.controls ?? []) { if (t < r.ticks) { input = r.input; break; } t -= r.ticks; }
        m.step(1 / 120, input); peak = Math.max(peak, m.field.slots.filter((s: any) => s.active && s.kind === 9).length);
      }
      m.finishPlanningFrame(1 / 60); g.loop.render(1 / 60);
      mineRendered ||= g.world.collisionDebug.root.getObjectByName('integrated-adaptive-mine').visible;
      station ||= m.field.slots.some((s: any) => s.active && s.kind >= 4 && s.kind <= 8 && Math.abs(s.z) < 2);
      pickups = m.fragments.count;
    }
    return { mode: g.world.flightCamera.mode, phase: m.phase, hull: m.hull, distance: m.distance, fault: m.field.fault, peak, mineRendered, station, pickups,
      bounds: g.world.boundaries.sides.map((s: any) => s.material.opacity), memory: { ...g.world.renderer.info.memory } };
  });
  expect(run.mode).toBe('hybrid-chase'); expect(run.phase).toBe(2); expect(run.hull).toBe(3);
  expect(run.distance).toBeGreaterThan(2200); expect(run.fault).toBeUndefined(); expect(run.peak).toBe(1);
  expect(run.mineRendered).toBe(true); expect(run.station).toBe(true); expect(run.pickups).toBeGreaterThan(0);
  await page.locator('#pause').click();
  const frozen = await page.evaluate(() => {
    const g = (window as any).integratedTest, before = JSON.stringify(g.model);
    for (let n = 0; n < 120; n++) { g.model.step(1 / 120, { x: 1, y: 0 }); g.loop.render(1 / 60); }
    return before === JSON.stringify(g.model);
  }); expect(frozen).toBe(true);
  await page.locator('#resume').click(); await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  await page.locator('#pause').click();
  for (let n = 0; n < 10; n++) {
    await page.locator('#restart-pause').click();
    const reset = await page.evaluate(() => {
      const g = (window as any).integratedTest, m = g.model; g.loop.render(0);
      return { distance: m.distance, count: m.fragments.count, mine: m.homing.current, hull: m.hull, mode: g.world.flightCamera.mode, memory: { ...g.world.renderer.info.memory } };
    });
    expect(reset.distance).toBe(0); expect(reset.count).toBe(0); expect(reset.mine).toBeUndefined(); expect(reset.hull).toBe(3);
    expect(reset.mode).toBe('hybrid-chase'); expect(reset.memory).toEqual(run.memory);
    await page.locator('#pause').click();
  }
});

test('integrated DEV diagnostics use the same loop and boundary strength follows real keyboard motion', async ({ page }) => {
  await page.goto('/?debug=integrated&seed=42&colliders=1'); await page.locator('#launch').click();
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1100); await page.keyboard.up('KeyD');
  const edge = await page.evaluate(() => {
    const g = window.spaceRunner!; return { x: g.model.ship.x, mode: g.world.flightCamera.mode, opacities: g.world.boundaries.sides.map(s => s.material.opacity) };
  });
  expect(edge.x).toBeGreaterThan(5); expect(edge.mode).toBe('hybrid-chase'); expect(edge.opacities[1]).toBeGreaterThan(edge.opacities[0]! * 3);
  await expect(page.locator('#collider-debug-info')).toBeVisible(); await expect(page.locator('#camera-research')).toHaveCount(0);
  await page.locator('#pause').click(); await page.setViewportSize({ width: 390, height: 844 });
  const portrait = await page.evaluate(() => { const g = window.spaceRunner!; g.world.render(g.model, 0); return { aspect: g.world.flightCamera.camera.aspect, fov: g.world.flightCamera.camera.fov }; });
  expect(portrait.aspect).toBeCloseTo(390 / 844, 5); expect(portrait.fov).toBe(58);
});
