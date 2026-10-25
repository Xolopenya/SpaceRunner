import { test, expect } from './helpers';
import type { LargeStructureGameModel } from '../../src/experiments/large-structure/model.ts';

for (const aperture of ['center', 'left', 'right', 'upper', 'lower']) test(`large structure ${aperture}: real meshes, certified aperture, pause and restart`, async ({ page }) => {
  await page.goto(`/?debug=field&experiment=large-structure&aperture=${aperture}&seed=42&colliders=1`);
  await page.locator('#launch').click();
  const result = await page.evaluate(() => {
    const g = window.spaceRunner! as unknown as { model: LargeStructureGameModel; loop: { stop(): void; render(dt: number): void }; world: {
      renderer: { info: { memory: object } }; hazards: { visible: boolean }[]; collisionDebug: { root: { children: { visible: boolean }[] } } } };
    g.loop.stop(); const m = g.model; m.state = 'GAME_OVER'; m.start(42);
    let represented = 0, wrongSmallModels = 0;
    for (let i = 0; i < 1100; i++) {
      const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, input = { x: 0, y: 0 };
      for (const run of w?.controls ?? []) { if (tick < run.ticks) { input = run.input; break; } tick -= run.ticks; }
      m.step(1 / 120, input);
      if (i === 849) {
        g.loop.render(1 / 60);
        represented = g.world.collisionDebug.root.children.filter(c => c.visible).length;
        wrongSmallModels = m.field.slots.filter((s, index) => s.planned && s.kind === 3 && g.world.hazards[index]!.visible).length;
      }
    }
    g.loop.render(1 / 60);
    return { hits: m.hitSerial, hull: m.hull, fault: m.field.fault, committed: m.field.committed, represented, wrongSmallModels, version: m.field.experiment?.version, geometry: m.field.ledger.knownHazards(m.distance) };
  });
  expect(result.hits).toBe(0); expect(result.hull).toBe(3); expect(result.committed).toBeGreaterThan(0);
  expect(result.fault).toBeUndefined(); expect(result.version).toBe('large-structure-v1');
  expect(result.represented).toBeGreaterThanOrEqual(2); expect(result.wrongSmallModels).toBe(0);
  await expect(page.locator('#large-structure-debug-info')).toBeVisible();
  await page.locator('#pause').click(); const t = await page.evaluate(() => window.spaceRunner!.model.elapsed);
  await page.evaluate(() => window.spaceRunner!.model.step(1 / 120, { x: 1, y: 0 }));
  expect(await page.evaluate(() => window.spaceRunner!.model.elapsed)).toBe(t);
  await page.locator('#resume').click();
  const restart = await page.evaluate(() => { const m = window.spaceRunner!.model as LargeStructureGameModel; m.state = 'GAME_OVER'; m.start(42); return { hull: m.hull, slots: m.field.hazards.length, records: m.field.ledger.snapshot().length }; });
  expect(restart).toEqual({ hull: 3, slots: 72, records: 0 });
});

test('experimental URL and source are excluded from the production build', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/?debug=field&experiment=large-structure&seed=42'); await page.locator('#launch').click();
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined(); await expect(page.locator('#large-structure-debug-info')).toHaveCount(0);
  const src = await page.locator('script[type=module]').getAttribute('src'), js = await (await page.request.get(new URL(src!, 'http://127.0.0.1:4173').href)).text();
  for (const marker of ['bulkhead-compound-v1', 'bulkhead-size-contract-v1', 'large-structure-v1', 'large-structure-dev-root']) expect(js).not.toContain(marker);
});

test('ordinary keyboard steering traverses the right aperture in the real RAF loop', async ({ page }) => {
  await page.goto('/?debug=field&experiment=large-structure&aperture=right&seed=42'); await page.locator('#launch').click();
  await page.waitForFunction(() => window.spaceRunner!.model.elapsed >= 2);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.spaceRunner!.model.elapsed >= 9);
  const state = await page.evaluate(() => ({ x: window.spaceRunner!.model.ship.x, hits: window.spaceRunner!.model.hitSerial, hull: window.spaceRunner!.model.hull }));
  expect(state.x).toBeGreaterThan(2.5); expect(state.x).toBeLessThan(5); expect(state.hits).toBe(0); expect(state.hull).toBe(3);
});
