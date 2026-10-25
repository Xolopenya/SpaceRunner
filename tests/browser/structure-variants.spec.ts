import { test, expect } from './helpers';
import type { StructureVariantsGameModel } from '../../src/experiments/structure-variants/model.ts';

for (const mode of ['isolated', 'mixed']) for (const aperture of ['center', 'left', 'right', 'upper', 'lower']) test(`${mode}/${aperture}: query, diagnostic, actual passage and complete representation`, async ({ page }) => {
  await page.goto(`/?debug=field&experiment=large-structure&mode=${mode}&aperture=${aperture}&seed=42`); await page.locator('#launch').click();
  const result = await page.evaluate(() => {
    const g = window.spaceRunner! as unknown as { model: StructureVariantsGameModel; loop: { stop(): void; render(dt: number): void }; world: { hazards: { visible: boolean }[] } };
    g.loop.stop(); const m = g.model; m.state = 'GAME_OVER'; m.start(42);
    for (let i = 0; i < 1300; i++) { const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, axis = { x: 0, y: 0 };
      for (const run of w?.controls ?? []) { if (tick < run.ticks) { axis = run.input; break; } tick -= run.ticks; } m.step(1 / 120, axis); }
    g.loop.render(1 / 60);
    return { mode: m.mode, aperture: m.aperture, hits: m.hitSerial, committed: m.field.committed, events: m.field.events, fault: m.field.fault,
      wrongModels: m.field.slots.filter((h, i) => h.kind >= 4 && h.planned && g.world.hazards[i]!.visible).length };
  });
  expect(result.aperture).toBe(aperture); expect(result.mode).toBe(mode); expect(result.hits).toBe(0); expect(result.committed).toBeGreaterThan(0);
  expect(result.fault).toBeUndefined(); expect(result.wrongModels).toBe(0);
  expect(result.events.filter(e => e.status === 'committed').every(e => e.count === (mode === 'mixed' ? 3 : 1))).toBe(true);
  await expect(page.locator('#structure-variants-debug-info')).toContainText(`APERTURE ${aperture.toUpperCase()}`);
  await expect(page.locator('#structure-variants-debug-info')).toContainText(mode.toUpperCase());
  await page.locator('#pause').click(); const before = await page.evaluate(() => window.spaceRunner!.model.distance);
  await page.evaluate(() => window.spaceRunner!.model.step(1 / 120, { x: 1, y: 0 })); expect(await page.evaluate(() => window.spaceRunner!.model.distance)).toBe(before);
});

test('v2 mixed experiment is absent from production and cannot change the default game', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/?debug=field&experiment=large-structure&mode=mixed&aperture=lower&seed=42'); await page.locator('#launch').click();
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined(); await expect(page.locator('#structure-variants-debug-info')).toHaveCount(0);
  const source = await page.locator('script[type=module]').getAttribute('src'), js = await (await page.request.get(new URL(source!, 'http://127.0.0.1:4173').href)).text();
  for (const marker of ['structure-mixed-v2', 'wreck-frame-compound-v2', 'station-wreck-v2']) expect(js).not.toContain(marker);
});

test('a player can steer through the right internal opening with the normal keyboard controls', async ({ page }) => {
  await page.goto('/?debug=field&experiment=large-structure&aperture=right&seed=42'); await page.locator('#launch').click();
  await page.waitForFunction(() => window.spaceRunner!.model.elapsed >= 2); await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.spaceRunner!.model.elapsed >= 9);
  expect(await page.evaluate(() => window.spaceRunner!.model.hitSerial)).toBe(0);
});
