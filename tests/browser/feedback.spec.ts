import { test, expect } from './helpers';
import { mkdir, writeFile } from 'node:fs/promises';

const evidence = '.cache/review/FEEDBACK-001A';

test('integrated pickup, collision, immunity, pause, death and ten restarts use the real feedback channels', async ({ page }) => {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; window.cancelAnimationFrame = () => {}; });
  await page.goto('/?debug=integrated&seed=42'); await page.locator('#launch').click();
  await page.evaluate(() => window.spaceRunner!.audio.unlock());
  const flight = await page.evaluate(() => {
    const g = window.spaceRunner! as any, m = g.model;
    const facts: any[] = []; m.events.subscribe((e: any) => facts.push(e));
    (window as any).feedbackFacts = facts;
    let tick = 0;
    while (!m.fragments.count && tick < 3600 && m.state === 'PLAYING') {
      const p = m.fragments.active[0]; let axis = { x: 0, y: 0 };
      if (p) axis = { x: Math.max(-1, Math.min(1, (p.x - m.ship.x) * 1.6 - m.ship.vx * .3)),
        y: Math.max(-1, Math.min(1, (p.y - m.ship.y) * 1.6 - m.ship.vy * .3)) };
      else {
        const w = m.field.certificate; let at = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0;
        for (const c of w?.controls ?? []) { if (at < c.ticks) { axis = c.input; break; } at -= c.ticks; }
      }
      Object.assign(g.input.touch, axis); g.loop.update(1 / 120);
      if (++tick % 2 === 0) g.loop.render(1 / 60);
    }
    g.loop.render(0);
    return { tick, hull: m.hull, count: m.fragments.count, facts: facts.filter(e => e.type === 'collectible.collected').length,
      pickupSounds: g.audio.graph.counts.pickup, ring: g.world.fragments.burst.visible,
      mode: g.world.flightCamera.mode, fault: m.field.fault };
  });
  expect(flight.count).toBe(1); expect(flight.facts).toBe(1); expect(flight.pickupSounds).toBe(1);
  expect(flight.ring).toBe(true); expect(flight.mode).toBe('hybrid-chase'); expect(flight.fault).toBeUndefined();
  await expect(page.locator('#energy-count')).toHaveText('01');
  await page.screenshot({ path: `${evidence}/screenshots/pickup.png` });

  // Controlled contact fixture: only collision positions/cooldown are arranged.
  // The original collision, health, model events, Game loop and all channels execute.
  const hit = () => page.evaluate(() => {
    const g = window.spaceRunner! as any, m = g.model;
    m.field.update = () => {}; g.input.clear();
    m.field.hazards.forEach((h: any) => { h.active = false; h.planned = undefined; });
    Object.assign(m.field.hazards[0], { active: true, x: m.ship.x, y: m.ship.y, z: -.1, radius: 1, kind: 0, phase: 0 });
    g.loop.update(1 / 120); g.loop.render(0);
  });
  // Finish prior pickup, then permit one real hit.
  await page.evaluate(() => { const g = window.spaceRunner! as any; g.model.invulnerability = 0;
    for (let i = 0; i < 80; i++) { g.loop.update(1 / 120); if (i % 2) g.loop.render(1 / 60); } });
  const before = await page.evaluate(() => window.spaceRunner!.model.hull);
  await hit(); await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', String(before - 1));
  await page.screenshot({ path: `${evidence}/screenshots/damage.png` });
  const inspect = () => page.evaluate(() => {
    const g = window.spaceRunner! as any;
    return { hull: g.model.hull, elapsed: g.model.elapsed, life: g.world.impacts.remaining,
      camera: g.world.camera.position.toArray(), pulse: g.world.cameraImpulse.amplitude,
      emissions: g.world.impacts.emissions, sounds: { ...g.audio.graph.counts }, phase: g.feedback.phase,
      facts: (window as any).feedbackFacts.map((e: any) => e.type),
      memory: { ...g.world.renderer.info.memory }, subscribers: g.model.events.subscriberCount,
      ids: [g.world.impacts.root.uuid, g.world.fragments.root.uuid] };
  });
  const contact = await inspect(); await hit(); const immune = await inspect();
  expect(immune.hull).toBe(contact.hull); expect(immune.emissions).toBe(contact.emissions);
  expect(immune.sounds.impact).toBe(contact.sounds.impact);
  await page.locator('#pause').click(); await page.evaluate(() => (window.spaceRunner as any).loop.render(0));
  const paused = await inspect();
  await page.evaluate(() => { const g = window.spaceRunner as any;
    for (let i = 0; i < 90; i++) { g.loop.update(1 / 120); g.loop.render(1 / 60); } });
  expect(await inspect()).toEqual(paused);
  await page.screenshot({ path: `${evidence}/screenshots/paused.png` });
  await page.locator('#resume').click();
  while (await page.evaluate(() => window.spaceRunner!.model.hull > 0)) {
    await page.evaluate(() => { window.spaceRunner!.model.invulnerability = 0; }); await hit();
  }
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'GAME_OVER');
  const death = await inspect();
  expect(death.facts.filter(t => t === 'player.damage')).toHaveLength(3);
  expect(death.facts.filter(t => t === 'player.destroyed')).toHaveLength(1);
  expect(death.facts.filter(t => t === 'run.ended')).toHaveLength(1);
  expect(death.sounds.destruction).toBe(1); expect(death.sounds.gameOver).toBe(0);
  await page.screenshot({ path: `${evidence}/screenshots/destroyed.png` });
  await page.evaluate(() => { const g = window.spaceRunner as any; for (let i = 0; i < 150; i++) g.loop.render(1 / 60); });
  expect((await inspect()).life).toBe(0); expect((await inspect()).pulse).toBe(0);
  expect((await inspect()).sounds.gameOver).toBe(1);
  const restarts = [];
  for (let run = 0; run < 10; run++) {
    await page.locator('#replay').click(); await page.evaluate(() => (window.spaceRunner as any).loop.render(0));
    const reset = await inspect(); restarts.push(reset);
    expect(reset.hull).toBe(3); expect(reset.life).toBe(0); expect(reset.pulse).toBe(0);
    expect(reset.subscribers).toBe(death.subscribers); expect(reset.ids).toEqual(death.ids); expect(reset.memory).toEqual(death.memory);
    await expect(page.locator('#energy-count')).toHaveText('00');
    for (let hp = 3; hp > 0; hp--) { await page.evaluate(() => { window.spaceRunner!.model.invulnerability = 0; }); await hit(); }
    await page.locator('#skip-destruction').click();
  }
  await page.locator('#replay').click(); await page.evaluate(() => (window.spaceRunner as any).loop.render(0));
  await page.screenshot({ path: `${evidence}/screenshots/restarted.png` });
  await mkdir(evidence, { recursive: true });
  await writeFile(`${evidence}/browser-lifecycle.json`, JSON.stringify({ fixture: 'Natural seeded pickup with analog input pilot; controlled actual collision contacts thereafter', flight, contact, paused, death, restarts }, null, 2));
});

test('muted real events are discarded; reduced motion disables camera impulses on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?debug&seed=42'); await page.locator('#launch').click();
  await page.evaluate(() => window.spaceRunner!.audio.unlock());
  const result = await page.evaluate(() => {
    const g = window.spaceRunner! as any, m = g.model; g.audio.setSettings({ muted: true });
    m.field.update = () => {}; m.field.hazards.forEach((h: any) => { h.active = false; });
    Object.assign(m.field.hazards[0], { active: true, x: 0, y: 0, z: -.1, radius: 1, kind: 0 });
    g.loop.update(1 / 120); g.loop.render(0);
    const muted = g.audio.graph.counts.impact; g.audio.setSettings({ muted: false }); g.loop.render(0);
    return { muted, after: g.audio.graph.counts.impact, x: g.world.camera.position.x, reduced: g.world.quality.reducedMotion,
      particles: g.world.quality.impactParticles, hp: m.hull, failures: g.feedback.failures };
  });
  expect(result).toEqual({ muted: 0, after: 0, x: 0, reduced: true, particles: 12, hp: 2, failures: 0 });
  await page.screenshot({ path: `${evidence}/screenshots/mobile-muted.png` });
});
