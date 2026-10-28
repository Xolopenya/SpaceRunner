import { test, expect, launch } from './helpers.ts';
const url = '/?debug=field&experiment=moving-mine&seed=42&firstMine=1&mine=slow-ltr';
test('moving mine GLB loads once, actual poses move, pause/focus/restart retain simulation lifecycle', async ({ page }) => {
  let mineRequests = 0; page.on('request', r => { if (r.url().includes('space-mine.glb')) mineRequests++; });
  await launch(page, url);
  const result = await page.evaluate(() => {
    const g = window.spaceRunner! as any, m = g.model; g.loop.stop(); m.state = 'GAME_OVER'; m.start(42);
    const input = () => { let t = m.field.certificate ? Math.round((m.elapsed - m.field.certificate.context.elapsed) * 120) : 0; for (const r of m.field.certificate?.controls ?? []) { if (t < r.ticks) return r.input; t -= r.ticks; } return { x: 0, y: 0 }; };
    let h; for (let t = 0; t < 2200; t++) { m.step(1 / 120, input()); h = m.field.slots.find((s: any) => s.active && s.kind === 9); if (h && m.elapsed > h.planned.motion.startTick / 120 + 1) break; }
    if (!h) throw Error('missing mine'); const id = h.planned.id, before = h.x, time = m.elapsed;
    for (let t = 0; t < 60; t++) m.step(1 / 120, input()); const after = h.x;
    m.pause(); for (let t = 0; t < 200; t++) m.step(1 / 120, { x: 1, y: 1 }); const paused = h.x;
    m.resume(); m.step(1 / 120, input()); const resumed = h.x; g.loop.render(1 / 60);
    const presentation = g.world.collisionDebug.root.getObjectByName('moving-space-mine');
    m.state = 'GAME_OVER'; m.start(42); for (let t = 0; t < 2200; t++) { m.step(1 / 120, input()); if (m.elapsed >= time) break; }
    const restarted = m.field.slots.find((s: any) => s.active && s.kind === 9);
    return { id, before, after, paused, resumed, restartId: restarted?.planned.id, restartX: restarted?.x, hull: m.hull, fault: m.field.fault,
      presented: !!presentation, owned: g.world.collisionDebug.resources.geometries.size };
  });
  expect(result.after - result.before).toBeCloseTo(.75, 9); expect(result.paused).toBe(result.after); expect(result.resumed).toBeGreaterThan(result.paused);
  expect(result.restartId).toBe(result.id); expect(result.restartX).toBe(result.before); expect(result.hull).toBe(3); expect(result.fault).toBeUndefined(); expect(result.presented).toBe(true);
  expect(mineRequests).toBe(1);
  await page.evaluate(() => { (window.spaceRunner as any).loop.start(); });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
});
test('production ignores the moving selector and makes no experimental asset request', async ({ page }) => {
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('.glb')) requests.push(r.url()); });
  await page.goto('http://127.0.0.1:4173' + url); await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined(); expect(requests.length).toBe(6);
  expect(requests.some(r => r.includes('space-mine'))).toBe(false); await expect(page.locator('#moving-mine-info')).toHaveCount(0);
});
test('invalid experimental GLB falls back to the existing certified mixed field', async ({ page }) => {
  await page.route('**/space-mine.glb**', route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: 'invalid GLB fixture' }));
  await launch(page, url); await expect(page.locator('#mixed-flow-debug-info')).toBeVisible();
  expect(await page.evaluate(() => (window.spaceRunner!.model as any).field.experiment.version)).toBe('mixed-flow-v1');
  await expect(page.locator('#moving-mine-info')).toHaveCount(0);
});
test('keyboard flight publishes a mine without certificate input and exposes no extra HUD control', async ({ page }) => {
  await launch(page, url); await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(6000); await page.keyboard.up('ArrowUp');
  const result = await page.evaluate(() => { const m = window.spaceRunner!.model as any; return { hull: m.hull, distance: m.distance,
    mines: m.field.events.filter((e: any) => e.ids.some((id: string) => id.startsWith('moving-mine-v1'))).length, fault: m.field.fault }; });
  expect(result.mines).toBeGreaterThan(0); expect(result.distance).toBeGreaterThan(100); expect(result.hull).toBe(3); expect(result.fault).toBeUndefined();
});
