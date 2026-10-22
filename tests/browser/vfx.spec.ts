import { test, expect, launch, collide, endRun } from './helpers';
import type { Page } from '@playwright/test';

// Visual evidence fixture: real GLBs and approved simulation, a held maximum-
// speed scene with deliberately arranged hazards. No production fixture code.
async function flightFixture(page: Page) {
  await page.evaluate(() => {
    const game = window.spaceRunner!;
    (game as unknown as { loop: { stop(): void } }).loop.stop();
    const model = game.model;
    model.elapsed = 120;
    model.distance = 500;
    model.field.hazards.forEach(hazard => { hazard.active = false; });
    for (let i = 0; i < 6; i++) Object.assign(model.field.hazards[i]!, {
      active: true, x: (i % 3 - 1) * 4.3, y: i < 3 ? 1.7 : -1.6,
      z: -36 - i * 5, radius: 1, spin: 0.4, kind: i === 0 ? 0 : i < 3 ? 1 : 2, phase: i % 2 ? 4 : 0,
    });
    for (let i = 0; i < 45; i++) {
      model.step(1 / 120, { x: i < 24 ? -0.7 : 0.5, y: 0.25 });
      game.world.render(model, 1 / 120);
    }
    (game as unknown as { ui: { update(model: typeof model): void } }).ui.update(model);
  });
}

test('space layers, engines and speed effects render; current desktop and impact evidence', async ({ page }) => {
  await launch(page);
  await flightFixture(page);
  const structure = await page.evaluate(() => {
    const world = window.spaceRunner!.world as unknown as { scene: import('three').Scene };
    return { layers: world.scene.getObjectsByProperty('type', 'Points').filter(node => node.name.startsWith('star-layer')).length, trails: world.scene.getObjectsByProperty('name', 'engine-trails').length, gates: world.scene.getObjectsByProperty('type', 'LineLoop').length };
  });
  expect(structure).toEqual({ layers: 3, trails: 1, gates: 0 });
  await page.screenshot({ path: 'test-results/vfx-main-gameplay.png' });
  await page.screenshot({ path: 'test-results/vfx-engine-effects.png', clip: { x: 360, y: 260, width: 550, height: 470 } });
  await page.evaluate(() => {
    const game = window.spaceRunner!;
    for (let i = 0; i < 24; i++) { game.model.step(1 / 120, { x: 0.4, y: -0.2 }); game.world.render(game.model, 1 / 120); }
    (game as unknown as { ui: { update(model: typeof game.model): void } }).ui.update(game.model);
  });
  await page.screenshot({ path: 'test-results/vfx-speed-effects.png' });
  await page.evaluate(() => {
    const game = window.spaceRunner!, model = game.model;
    Object.assign(model.field.hazards[10]!, { active: true, x: model.ship.x, y: model.ship.y, z: -0.2, radius: 1, kind: 0 });
    for (let i = 0; i < 24; i++) { model.step(1 / 120, { x: 0, y: 0 }); game.world.render(model, 1 / 120); }
    (game as unknown as { ui: { update(model: typeof model): void } }).ui.update(model);
  });
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('#damage')).toBeVisible();
  await page.screenshot({ path: 'test-results/vfx-impact-effects.png' });
});

test('damage emits once, pause freezes VFX, death finishes burst and restarts retain resources', async ({ page }) => {
  const downloads: string[] = [];
  page.on('response', response => { if (response.url().endsWith('.glb')) downloads.push(response.url()); });
  await launch(page);
  await collide(page);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await collide(page);
  await page.waitForTimeout(80);
  const inspect = () => page.evaluate(() => {
    const world = window.spaceRunner!.world as unknown as {
      scene: import('three').Scene;
      engines: { time: number; trails: import('three').Mesh; root: import('three').Group };
      impacts: { remaining: number; emissions: number; root: import('three').Group };
    };
    const trail = world.engines.trails;
    const particles = world.impacts.root.getObjectByName('impact-particles') as import('three').Points;
    const layers = [0, 1, 2].map(index => Array.from((world.scene.getObjectByName(`star-layer-${index}`) as import('three').Points).geometry.getAttribute('position').array));
    return { time: world.engines.time, life: world.impacts.remaining, emissions: world.impacts.emissions, trails: Array.from(trail.geometry.getAttribute('position').array), particles: Array.from(particles.geometry.getAttribute('position').array), layers, ids: [trail.uuid, trail.geometry.uuid, world.engines.root.uuid, particles.uuid, particles.geometry.uuid], roots: world.scene.getObjectsByProperty('name', 'engine-trails').length, memory: { ...window.spaceRunner!.world.renderer.info.memory } };
  });
  await page.keyboard.press('KeyP');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  const paused = await inspect();
  expect(paused.emissions).toBe(1);
  await page.waitForTimeout(220);
  expect(await inspect()).toEqual(paused);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await inspect()).toEqual(paused);
  await page.keyboard.press('KeyP');
  await endRun(page);
  await page.waitForTimeout(650);
  expect((await inspect()).life).toBe(0);
  expect(await page.evaluate(() => ((window.spaceRunner!.world as unknown as { scene: import('three').Scene }).scene.getObjectByName('engine-trails')!).visible)).toBe(false);
  const baseline = await inspect();
  for (let run = 0; run < 5; run++) {
    await page.getByRole('button', { name: 'Fly again' }).click();
    const reset = await inspect();
    expect(reset.emissions).toBe(0);
    expect(reset.life).toBe(0);
    expect(reset.ids).toEqual(baseline.ids);
    expect(reset.roots).toBe(1);
    expect(reset.memory).toEqual(baseline.memory);
    expect(downloads).toHaveLength(6);
    await endRun(page);
  }
  console.log('VFX five-restart sample:', JSON.stringify({ ...baseline.memory, downloads: downloads.length, pooledEmitters: baseline.roots }));
});

test('mobile portrait and landscape use the lower cost tier without changing gameplay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await launch(page);
  await flightFixture(page);
  await page.screenshot({ path: 'test-results/vfx-mobile-portrait.png' });
  const tier = () => page.evaluate(() => {
    const world = window.spaceRunner!.world as unknown as { quality: { mobile: boolean; stars: number[]; streaks: number; impactParticles: number } };
    return { quality: world.quality, speed: window.spaceRunner!.model.speed, seed: window.spaceRunner!.model.seed, pixelRatio: window.spaceRunner!.world.renderer.getPixelRatio() };
  });
  const portrait = await tier();
  expect(portrait.quality.mobile).toBe(true);
  expect(portrait.quality.streaks).toBe(10);
  expect(portrait.pixelRatio).toBeLessThanOrEqual(1.4);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.spaceRunner!.world.render(window.spaceRunner!.model, 0));
  await expect.poll(async () => (await tier()).quality.mobile).toBe(true);
  await page.waitForTimeout(80);
  await page.evaluate(() => window.spaceRunner!.world.render(window.spaceRunner!.model, 0));
  await page.screenshot({ path: 'test-results/vfx-mobile-landscape.png' });
  expect(await tier()).toEqual(portrait);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reduced motion removes decorative streaks and lowers particles; collider debugger still renders', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await launch(page, '/?debug=colliders&seed=42');
  await flightFixture(page);
  const result = await page.evaluate(() => {
    const world = window.spaceRunner!.world as unknown as { scene: import('three').Scene; quality: { reducedMotion: boolean; streaks: number; impactParticles: number } };
    return { quality: world.quality, visible: world.scene.getObjectByName('edge-speed-streaks')!.visible, speed: window.spaceRunner!.model.speed, player: !!world.scene.getObjectByName('collider-player') };
  });
  expect(result.quality.reducedMotion).toBe(true);
  expect(result.quality.streaks).toBe(0);
  expect(result.quality.impactParticles).toBe(12);
  expect(result.visible).toBe(false);
  expect(result.player).toBe(true);
  expect(result.speed).toBe(34);
  // Diagnostics text is wall-clock throttled, unlike the wire transforms.
  await page.waitForTimeout(300);
  await page.evaluate(() => window.spaceRunner!.world.render(window.spaceRunner!.model, 0));
  await expect(page.locator('#collider-debug-info')).toBeVisible();
  await expect(page.locator('#collider-debug-info')).not.toContainText('No active hazards');
  await page.screenshot({ path: 'test-results/vfx-developer-colliders.png' });
});
