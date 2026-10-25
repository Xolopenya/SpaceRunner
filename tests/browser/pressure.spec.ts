import { test, expect } from './helpers';
import type { RuntimeGameModel } from '../../src/debug/runtime-game-model.ts';

for (const policy of ['baseline', 'pressure']) test(`${policy} selector preserves pause, score, hull, restart and stable published geometry`, async ({ page }) => {
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('.glb')) requests.push(r.url()); });
  await page.goto(`/?debug=field&policy=${policy}&seed=42`); await page.locator('#launch').click();
  await page.evaluate(() => (window.spaceRunner! as unknown as { loop: { stop(): void } }).loop.stop());
  const first = await page.evaluate(() => {
    const g = window.spaceRunner! as unknown as { model: RuntimeGameModel; loop: { render(dt: number): void } }, m = g.model;
    // Reset to an exact common clock after the real Launch lifecycle.
    m.state = 'GAME_OVER'; m.start(42);
    for (let i = 0; i < 1440; i++) m.step(1 / 120, { x: 0, y: 0 }); g.loop.render(1 / 60);
    return { policy: m.field.policy, events: m.field.events, geometry: m.field.ledger.knownHazards(m.distance),
      score: m.score, distance: m.distance, hull: m.hull, fault: m.field.fault };
  });
  expect(first.policy.name).toBe(policy); expect(first.policy.version).toBe(policy === 'pressure' ? 'pressure-v1' : 'director-v1');
  expect(first.score).toBe(Math.floor(first.distance)); expect(first.score).toBeGreaterThan(200);
  expect(first.fault).toBeUndefined(); expect(first.events.some(e => e.status === 'committed')).toBe(true);
  await page.screenshot({ path: `test-results/pressure-${policy}-desktop-12s.png` });
  await page.locator('#pause').click();
  const frozen = await page.evaluate(() => { const m = window.spaceRunner!.model as RuntimeGameModel; return [m.elapsed, m.distance, m.field.planningTicks]; });
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.spaceRunner!.model.step(1 / 120, { x: 1, y: 1 }); });
  expect(await page.evaluate(() => { const m = window.spaceRunner!.model as RuntimeGameModel; return [m.elapsed, m.distance, m.field.planningTicks]; })).toEqual(frozen);
  await page.locator('#resume').click();
  const before = await page.evaluate(() => ({ ...((window.spaceRunner! as unknown as { world: { renderer: { info: { memory: object } } } }).world.renderer.info.memory) }));
  for (let restart = 0; restart < 3; restart++) {
    const again = await page.evaluate(() => {
      const g = window.spaceRunner! as unknown as { model: RuntimeGameModel; loop: { render(dt: number): void } }, m = g.model;
      m.state = 'GAME_OVER'; m.start(42);
      for (let i = 0; i < 1440; i++) m.step(1 / 120, { x: 0, y: 0 }); g.loop.render(1 / 60);
      return { geometry: m.field.ledger.knownHazards(m.distance), hull: m.hull, slots: m.field.hazards.length, events: m.field.events.length, samples: m.field.samples.length };
    });
    expect(again.geometry).toEqual(first.geometry); expect(again.hull).toBe(first.hull); expect(again.slots).toBe(72);
    expect(again.events).toBeLessThanOrEqual(64); expect(again.samples).toBeLessThanOrEqual(2048);
  }
  const after = await page.evaluate(() => ({ ...((window.spaceRunner! as unknown as { world: { renderer: { info: { memory: object } } } }).world.renderer.info.memory) }));
  expect(after).toEqual(before); expect(requests).toHaveLength(6);
  // Natural damage through unchanged CCD, with no injected obstacles or immunity changes.
  const end = await page.evaluate(() => {
    const m = window.spaceRunner!.model as RuntimeGameModel;
    for (let i = 0; i < 180 * 120 && m.state === 'PLAYING'; i++) m.step(1 / 120, { x: 0, y: 0 });
    return { state: m.state, hull: m.hull, hits: m.hitSerial, score: m.score, fault: m.field.fault };
  });
  expect(end.state).toBe('GAME_OVER'); expect(end.hull).toBe(0); expect(end.hits).toBe(3); expect(end.fault).toBeUndefined();
  await page.evaluate(() => (window.spaceRunner! as unknown as { loop: { render(dt: number): void } }).loop.render(1 / 60));
  await page.locator('#replay').click(); expect(await page.evaluate(() => window.spaceRunner!.model.hull)).toBe(3);
});

test('pressure URL is ignored in production and without the field debug selector', async ({ page }) => {
  await page.goto('/?debug=inspect&policy=pressure&seed=42');
  expect(await page.evaluate(() => 'policy' in window.spaceRunner!.model.field)).toBe(false);
  await page.goto('http://127.0.0.1:4173/?debug=field&policy=pressure&seed=42'); await page.locator('#launch').click();
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined();
  const source = await page.locator('script[type=module]').getAttribute('src');
  const js = await (await page.request.get(new URL(source!, 'http://127.0.0.1:4173').href)).text();
  for (const sentinel of ['pressure-v1', 'director-v1', 'ACTUAL_REPLAY_BUDGET', 'Unknown development field policy']) expect(js).not.toContain(sentinel);
});
