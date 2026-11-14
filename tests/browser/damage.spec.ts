import { test, expect } from './helpers';
import type { Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function setup(page: Page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; window.cancelAnimationFrame = () => {}; });
  await page.goto('/?debug=integrated&seed=42'); await page.locator('#launch').click();
  await page.evaluate(() => {
    const g = window.spaceRunner as any, m = g.model; m.field.update = () => {};
    m.field.slots.forEach((h: any) => { h.active = false; h.planned = undefined; });
    (window as any).damageEvents = []; m.events.subscribe((e: any) => (window as any).damageEvents.push(e));
    (window as any).hitDamageFixture = () => {
      m.invulnerability = 0;
      Object.assign(m.field.hazards[0], { active: true, x: m.ship.x, y: m.ship.y, z: -.2, kind: 0, radius: 1, phase: 0, spin: 0 });
      g.loop.update(1 / 120); g.loop.render(0);
    };
    (window as any).renderDamageFrames = (n: number) => { for (let i = 0; i < n; i++) g.loop.render(1 / 60); g.loop.render(0); };
    // Ordinary RAF uploads the existing engine trail before gameplay. This held-
    // RAF fixture must do the same before taking a strict GPU-count baseline.
    g.loop.render(1 / 60);
  });
  await page.evaluate(() => window.spaceRunner!.audio.unlock());
}
async function hit(page: Page) { await page.evaluate(() => (window as any).hitDamageFixture()); }
async function frames(page: Page, count: number) { await page.evaluate(n => (window as any).renderDamageFrames(n), count); }

test('HP is final immediately, visible ship breaks apart, results/cue wait, and ten restarts retain ownership', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { const g = window.spaceRunner as any; g.model.distance = 123; (window as any).recordCalls = 0;
    const record = g.platform.scores.record.bind(g.platform.scores); g.platform.scores.record = (score: number) => { (window as any).recordCalls++; return record(score); }; });
  await hit(page); expect(await page.evaluate(() => window.spaceRunner!.world.hullDamage.stage)).toBe(1);
  await hit(page); expect(await page.evaluate(() => window.spaceRunner!.world.hullDamage.stage)).toBe(2);
  await page.locator('#pause').click();
  const frozen = await page.evaluate(() => { const g = window.spaceRunner as any; g.loop.render(0);
    return JSON.stringify({ life: g.world.impacts.remaining, camera: g.world.camera.position.toArray(), leak: Array.from(g.world.hullDamage.root.geometry.attributes.position.array), sequence: g.world.destruction.sequence.elapsed }); });
  await frames(page, 60);
  expect(await page.evaluate(() => { const g = window.spaceRunner as any;
    return JSON.stringify({ life: g.world.impacts.remaining, camera: g.world.camera.position.toArray(), leak: Array.from(g.world.hullDamage.root.geometry.attributes.position.array), sequence: g.world.destruction.sequence.elapsed }); })).toBe(frozen);
  await page.locator('#resume').click(); await hit(page);
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'GAME_OVER');
  await expect(page.locator('#game-over')).toBeHidden(); await expect(page.locator('#skip-destruction')).toBeVisible();
  const initial = await page.evaluate(() => { const g = window.spaceRunner as any; return {
    score: g.model.score, best: g.platform.scores.best, distance: g.model.distance, elapsed: g.model.elapsed, ship: { ...g.model.ship },
    ended: (window as any).damageEvents.filter((e: any) => e.type === 'player.destroyed').length,
    destructionSounds: g.audio.graph.counts.destruction, resultSounds: g.audio.graph.counts.gameOver,
    memory: { ...g.world.renderer.info.memory }, subscribers: g.model.events.subscriberCount,
  }; });
  expect(initial.ended).toBe(1); expect(initial.destructionSounds).toBe(1); expect(initial.resultSounds).toBe(0);
  expect(initial.best).toBe(initial.score); expect(initial.score).toBe(123);
  await frames(page, 40);
  expect(await page.evaluate(() => (window.spaceRunner as any).world.ship.visible)).toBe(false);
  expect(await page.evaluate(() => window.spaceRunner!.world.destruction.root.getObjectsByProperty('type', 'Mesh').filter(n => n.name.startsWith('ship-fragment:') && n.visible).length)).toBe(6);
  await expect(page.locator('#game-over')).toBeHidden(); await frames(page, 90);
  await expect(page.locator('#game-over')).toBeVisible();
  expect(await page.evaluate(() => (window.spaceRunner as any).audio.graph.counts.gameOver)).toBe(1);
  expect(await page.evaluate(() => (window as any).recordCalls)).toBe(1);
  expect(await page.evaluate(() => { const m = window.spaceRunner!.model; return { distance: m.distance, elapsed: m.elapsed, ship: { ...m.ship } }; })).toEqual({ distance: initial.distance, elapsed: initial.elapsed, ship: initial.ship });
  const resets = [];
  for (let run = 0; run < 10; run++) {
    await page.locator('#replay').click(); await frames(page, 0);
    const reset = await page.evaluate(() => { const g = window.spaceRunner as any; return { hp: g.model.hull, stage: g.world.hullDamage.stage,
      explosions: g.world.destruction.explosions, active: g.world.collisionEffects.activeCount, subscribers: g.model.events.subscriberCount,
      memory: { ...g.world.renderer.info.memory }, borrowedClean: [...g.assets.resources.materials].every((m: any) => !m.name.includes('hull-damage')) }; });
    expect(reset).toEqual({ hp: 3, stage: 0, explosions: 0, active: 0, subscribers: initial.subscribers, memory: initial.memory, borrowedClean: true });
    resets.push(reset); for (let i = 0; i < 3; i++) await hit(page); await page.keyboard.press('Space');
    await expect(page.locator('#game-over')).toBeVisible();
  }
  await mkdir('.cache/review/FEEDBACK-001B', { recursive: true });
  await writeFile('.cache/review/FEEDBACK-001B/browser-lifecycle.json', JSON.stringify({ initial, resets, note: 'Controlled contacts through original collision/model pipeline; final gameplay proof uses natural production tapes separately.' }, null, 2));
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) test(`touch skip, mute and reduced-motion at ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' }); await setup(page);
  await page.evaluate(() => window.spaceRunner!.audio.setSettings({ muted: true }));
  for (let i = 0; i < 3; i++) await hit(page);
  await expect(page.locator('#skip-destruction')).toBeVisible();
  expect(await page.evaluate(() => window.spaceRunner!.world.destruction.sequence.duration)).toBe(.65);
  expect(await page.evaluate(() => (window.spaceRunner as any).audio.graph.counts.destruction)).toBe(0);
  await page.locator('#skip-destruction').click(); await expect(page.locator('#game-over')).toBeVisible();
  await page.locator('#replay').click(); for (let i = 0; i < 3; i++) await hit(page); await frames(page, 42);
  await expect(page.locator('#game-over')).toBeVisible();
  expect(await page.evaluate(() => (window.spaceRunner as any).audio.graph.counts.gameOver)).toBe(0);
  expect(await page.evaluate(() => (window.spaceRunner as any).world.camera.position.x)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('hidden tab freezes the cinematic; real WebGL interruption reveals safe results and recovers', async ({ page }) => {
  await setup(page); for (let i = 0; i < 3; i++) await hit(page); await frames(page, 12);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const age = await page.evaluate(() => window.spaceRunner!.world.destruction.sequence.elapsed); await frames(page, 150);
  expect(await page.evaluate(() => window.spaceRunner!.world.destruction.sequence.elapsed)).toBe(age);
  await page.evaluate(() => { delete (document as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  const hasExtension = await page.evaluate(() => {
    const extension = window.spaceRunner!.world.renderer.getContext().getExtension('WEBGL_lose_context');
    (window as any).contextLoss = extension; return !!extension;
  }); expect(hasExtension).toBe(true);
  await page.evaluate(() => (window as any).contextLoss.loseContext());
  await expect(page.locator('#game-over')).toBeVisible(); await expect(page.locator('#skip-destruction')).toBeHidden();
  await page.evaluate(() => (window as any).contextLoss.restoreContext());
  await expect.poll(() => page.evaluate(() => (window.spaceRunner as any).contextLost)).toBe(false);
  await page.locator('#replay').click(); await frames(page, 1);
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  expect(await page.evaluate(() => window.spaceRunner!.world.hullDamage.stage)).toBe(0);
});

test('polished field follows real immunity and hull state; shader programs are warm before the first hit', async ({ page }) => {
  await setup(page);
  const before = await page.evaluate(() => window.spaceRunner!.world.renderer.info.programs!.length);
  await hit(page); await frames(page, 10);
  const active = await page.evaluate(() => {
    const g = window.spaceRunner as any, field = g.world.impacts.root.getObjectByName('invulnerability-shimmer');
    return { hp: g.model.hull, stage: g.world.hullDamage.stage, visible: field.visible, alpha: field.material.uniforms.alpha.value,
      quaternion: field.quaternion.toArray(), ship: g.world.ship.quaternion.toArray(), programs: g.world.renderer.info.programs.length };
  });
  expect(active.hp).toBe(2); expect(active.stage).toBe(1); expect(active.visible).toBe(true);
  expect(active.alpha).toBeGreaterThan(0); expect(active.quaternion).toEqual(active.ship); expect(active.programs).toBe(before);
  await page.evaluate(() => {
    const g = window.spaceRunner as any;
    for (let tick = 0; tick < 400 && g.model.invulnerability > 0; tick++) { g.loop.update(1 / 120); g.loop.render(1 / 120); }
  });
  const ended = await page.evaluate(() => {
    const g = window.spaceRunner as any, field = g.world.impacts.root.getObjectByName('invulnerability-shimmer');
    return { immunity: g.model.invulnerability, hp: g.model.hull, visible: field.visible, stage: g.world.hullDamage.stage };
  });
  expect(ended).toEqual({ immunity: 0, hp: 2, visible: false, stage: 1 });
});
