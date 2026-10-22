import { test, expect, launch, collide, endRun } from './helpers';
import { test as rawTest } from '@playwright/test';
import { MODEL_ASSETS } from '../../src/assets/catalog';

test('six GLBs load once, all variants render, and restarts retain shared GPU resources', async ({ page }) => {
  const downloads: string[] = [];
  page.on('response', response => {
    if (response.url().endsWith('.glb')) {
      expect(response.ok()).toBe(true);
      downloads.push(response.url());
    }
  });
  await launch(page);
  expect(downloads.length).toBe(6);
  for (const spec of MODEL_ASSETS) expect(downloads.filter(url => url.endsWith(spec.file))).toHaveLength(1);
  // Three.js uploads geometries lazily. Warm the impact burst before taking the
  // baseline so its first upload is not mistaken for a restart leak.
  await collide(page);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await page.waitForTimeout(650);
  async function showModels() {
    await page.evaluate(() => {
      const model = window.spaceRunner!.model;
      model.field.hazards.forEach(hazard => { hazard.active = false; });
      for (let i = 0; i < 5; i++) Object.assign(model.field.hazards[i]!, {
        active: true, x: (i - 2) * 2.45, y: i % 2 ? 1.2 : -0.7, z: -9 - i * 1.8,
        radius: 0.85, kind: i === 0 ? 0 : i < 3 ? 1 : 2, phase: i === 2 || i === 4 ? 4 : 0,
      });
      model.invulnerability = 0;
      model.pause();
    });
    await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
    await page.evaluate(() => {
      // Hide only the UI overlay for a frozen deterministic verification image.
      document.getElementById('paused')!.hidden = true;
    });
    await page.waitForTimeout(150);
  }
  await showModels();
  await page.screenshot({ path: 'test-results/desktop-models.png' });
  const memory = await page.evaluate(() => ({ ...window.spaceRunner!.world.renderer.info.memory }));
  for (let run = 0; run < 5; run++) {
    await page.keyboard.press('KeyP');
    await page.evaluate(() => window.spaceRunner!.model.field.hazards.forEach(hazard => { hazard.active = false; }));
    await endRun(page);
    await page.getByRole('button', { name: 'Fly again' }).click();
    await showModels();
    expect(await page.evaluate(() => ({ ...window.spaceRunner!.world.renderer.info.memory }))).toEqual(memory);
    expect(downloads.length).toBe(6);
  }
  console.log('Shared model restart sample:', JSON.stringify({ downloads: downloads.length, ...memory }));
});

rawTest('missing required model blocks launch and retry recovers', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/meteor_half.glb', route => route.fulfill({ status: 404, body: 'Intentional missing-asset fixture' }));
  await page.goto('/?debug');
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
  await expect(page.locator('#loading-message')).toContainText('Required flight models could not load');
  await expect(page.getByRole('button', { name: 'Launch run' })).toBeHidden();
  await page.unroute('**/meteor_half.glb');
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  expect(pageErrors).toEqual([]);
});

test('keyboard flight, bounds, pause controls, focus pause, and released keys', async ({ page }) => {
  await launch(page);
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.x)).toBeGreaterThan(2);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.y)).toBeGreaterThan(2);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('Escape');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  const distance = await page.locator('#distance').textContent();
  await page.waitForTimeout(200);
  await expect(page.locator('#distance')).toHaveText(distance!);
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await page.getByRole('button', { name: 'Pause flight' }).click();
  await page.keyboard.press('KeyP');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  await page.keyboard.down('KeyA');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  await page.keyboard.up('KeyA');
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.vx)).toBe(0);
  await page.screenshot({ path: 'test-results/desktop-flight.png' });
});

test('collision feedback, invulnerability, death, persisted best, and bounded restarts', async ({ page }) => {
  await launch(page);
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.distance)).toBeGreaterThan(10);
  await collide(page);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('#damage')).toBeVisible();
  await collide(page);
  await page.waitForTimeout(150);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await collide(page, true);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '1');
  await collide(page, true);
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'GAME_OVER');
  const best = Number((await page.locator('#final-best').textContent())?.replaceAll(',', ''));
  expect(best).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/desktop-game-over.png' });
  const baseline = await page.evaluate(() => ({ ...window.spaceRunner!.world.renderer.info.memory }));
  for (let run = 0; run < 5; run++) {
    await page.getByRole('button', { name: 'Fly again' }).click();
    await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '3');
    const reset = await page.evaluate(() => {
      const model = window.spaceRunner!.model;
      return { x: model.ship.x, y: model.ship.y, vx: model.ship.vx, active: model.field.hazards.filter(item => item.active).length };
    });
    expect(reset).toEqual({ x: 0, y: 0, vx: 0, active: 0 });
    await endRun(page);
  }
  const after = await page.evaluate(() => ({ ...window.spaceRunner!.world.renderer.info.memory }));
  expect(after).toEqual(baseline);
  await page.reload();
  await expect(page.locator('#menu-best')).toHaveText(String(best));
});

test('incoming waves render and scrolling remains bounded over an unmodified run', async ({ page }) => {
  await launch(page);
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.field.spawnedWaves), { timeout: 8000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const telemetry = await page.evaluate(async () => {
    const game = window.spaceRunner!;
    const frames: number[] = [];
    let previous = performance.now();
    await new Promise<void>(resolve => {
      function frame(now: number) {
        frames.push(now - previous);
        previous = now;
        if (frames.length < 90) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    const sorted = frames.slice(1).sort((a, b) => a - b);
    return { activeHazards: game.model.field.hazards.filter(item => item.active).length, drawCalls: game.world.renderer.info.render.calls, geometries: game.world.renderer.info.memory.geometries, medianFrameMs: sorted[Math.floor(sorted.length / 2)] };
  });
  console.log('Desktop Chrome sample:', JSON.stringify(telemetry));
  expect(telemetry.activeHazards).toBeGreaterThan(0);
  expect(telemetry.drawCalls).toBeLessThan(100);
  await page.screenshot({ path: 'test-results/desktop-hazards.png' });
});

test('visibility pause and graphics context recovery require deliberate resume', async ({ page }) => {
  await launch(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  await page.evaluate(() => { delete (document as { hidden?: boolean }).hidden; });
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await page.evaluate(() => window.spaceRunner!.world.renderer.forceContextLoss());
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  await expect(page.getByRole('button', { name: 'Resume flight' })).toBeDisabled();
  await page.evaluate(() => window.spaceRunner!.world.renderer.forceContextRestore());
  await expect(page.getByRole('button', { name: 'Resume flight' })).toBeEnabled();
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
});
