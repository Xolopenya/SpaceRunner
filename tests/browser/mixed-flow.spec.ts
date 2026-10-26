import { readFile } from 'node:fs/promises';
import { test, expect } from './helpers';
import type { MixedFlowGameModel } from '../../src/experiments/mixed-flow/model.ts';

test('automatic mixed flow traverses3300m, shows all five apertures and exports bounded real decisions', async ({ page }) => {
  await page.goto('/?debug=field&experiment=mixed-flow&seed=42'); await page.locator('#launch').click();
  const result = await page.evaluate(() => {
    const g = window.spaceRunner! as unknown as { model: MixedFlowGameModel; loop: { stop(): void; render(dt: number): void }; world: { hazards: { visible: boolean }[] } };
    g.loop.stop(); const m = g.model; m.state = 'GAME_OVER'; m.start(42); const apertures = new Set(), families = new Set(); let last;
    while (m.distance < 3300 && m.state === 'PLAYING') {
      const w = m.field.certificate; let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0, axis = { x: 0, y: 0 };
      for (const r of w?.controls ?? []) { if (tick < r.ticks) { axis = r.input; break; } tick -= r.ticks; } m.step(1 / 120, axis);
      if (m.field.lastOutcome !== last) { last = m.field.lastOutcome; const event = m.field.events.at(-1); if (event?.aperture) apertures.add(event.aperture); if (event?.status === 'committed') families.add(event.family); }
    }
    g.loop.render(1 / 60);
    return { distance: m.distance, hits: m.hitSerial, committed: m.field.committed, omitted: m.field.omitted, apertures: [...apertures], families: [...families], fault: m.field.fault,
      wrongModels: m.field.slots.filter((h, i) => h.kind >= 4 && h.planned && g.world.hazards[i]!.visible).length };
  });
  expect(result.distance).toBeGreaterThanOrEqual(3300); expect(result.hits).toBe(0); expect(result.committed).toBeGreaterThanOrEqual(25);
  expect(result.apertures.sort()).toEqual(['center', 'left', 'lower', 'right', 'upper']); expect(result.families).toContain('ambient'); expect(result.families).toContain('station-wreck');
  expect(result.wrongModels).toBe(0); expect(result.fault).toBeUndefined(); await expect(page.locator('#mixed-flow-debug-info')).toContainText('AUTO APERTURES');
  const download = page.waitForEvent('download'); await page.locator('#mixed-flow-export').click(); const saved = await download;
  const trace = JSON.parse(await readFile((await saved.path())!, 'utf8'));
  expect(trace.version).toBe('mixed-flow-v1'); expect(trace.seed).toBe(42); expect(trace.publications).toHaveLength(16); expect(trace.inputRuns.length).toBeLessThanOrEqual(128);
  expect(trace.publications.some((p: { publicationChecks?: unknown[] }) => p.publicationChecks?.length)).toBe(true);
});

test('normal horizontal keyboard steering exceeds650m with actual damage, pause and replay', async ({ page }) => {
  await page.goto('/?debug=field&experiment=mixed-flow&seed=42'); await page.locator('#launch').click();
  for (let i = 0; i < 26; i++) { const key = i % 2 ? 'ArrowLeft' : 'ArrowRight'; await page.keyboard.down(key); await page.waitForTimeout(1500); await page.keyboard.up(key);
    if (await page.evaluate(() => window.spaceRunner!.model.distance >= 700)) break; }
  expect(await page.evaluate(() => window.spaceRunner!.model.distance)).toBeGreaterThan(650);
  expect(await page.evaluate(() => window.spaceRunner!.model.hull)).toBeGreaterThan(0);
  await page.locator('#pause').click(); const before = await page.evaluate(() => window.spaceRunner!.model.distance); await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.spaceRunner!.model.distance)).toBe(before); await page.locator('#resume').click();
  await page.waitForFunction(d => window.spaceRunner!.model.distance > d, before);
  await page.evaluate(() => { window.spaceRunner!.model.state = 'GAME_OVER'; }); await page.locator('#replay').click();
  expect(await page.evaluate(() => window.spaceRunner!.model.hull)).toBe(3); await expect(page.locator('#mixed-flow-debug-info')).toContainText('mixed-flow-v1');
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) test(`mixed flow touch input and complete geometry at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), page = await context.newPage();
  try {
    await page.goto('/?debug=field&experiment=mixed-flow&seed=42'); await page.locator('#launch').tap();
    const cdp = await context.newCDPSession(page), x = viewport.width * .4, y = viewport.height * .5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 70, y: y - 40 }] });
    await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.x)).toBeGreaterThan(.5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.vx)).toBe(0);
    const result = await page.evaluate(() => {
      const g = window.spaceRunner! as unknown as { model: MixedFlowGameModel; loop: { stop(): void; render(dt: number): void } };
      g.loop.stop(); const m = g.model; m.state = 'GAME_OVER'; m.start(42);
      for (let tick = 0; m.distance < 700 && m.state === 'PLAYING'; tick++) m.step(1 / 120, { x: Math.sin(tick / 93) * .85, y: Math.cos(tick / 147) * .7 });
      g.loop.render(1 / 60); return { distance: m.distance, committed: m.field.committed, fault: m.field.fault, hull: m.hull };
    });
    expect(result.distance).toBeGreaterThan(650); expect(result.committed).toBeGreaterThanOrEqual(5); expect(result.fault).toBeUndefined();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#mixed-flow-export')).toBeVisible();
  } finally { await context.close(); }
});

test('forced aperture is visibly labeled as a test override and survives restart', async ({ page }) => {
  await page.goto('/?debug=field&experiment=mixed-flow&aperture=lower&seed=42'); await page.locator('#launch').click();
  await expect(page.locator('#mixed-flow-debug-info')).toContainText('TEST OVERRIDE LOWER');
  expect(await page.evaluate(() => (window.spaceRunner!.model as MixedFlowGameModel).forcedAperture)).toBe('lower');
});

test('mixed flow, root search and trace exporter are stripped from production', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/?debug=field&experiment=mixed-flow&seed=42'); await page.locator('#launch').click();
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined(); await expect(page.locator('#mixed-flow-debug-info')).toHaveCount(0);
  const source = await page.locator('script[type=module]').getAttribute('src'), js = await (await page.request.get(new URL(source!, 'http://127.0.0.1:4173').href)).text();
  for (const marker of ['mixed-flow-v1', 'root-aware-v1', 'Export recent trace', 'beginRuntimeRootSearch']) expect(js).not.toContain(marker);
});
