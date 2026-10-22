import { test, expect, launch, collide, endRun } from './helpers';
import type { Page } from '@playwright/test';

async function arrange(page: Page, variants: number[], freeze = true) {
  await page.evaluate(({ variants, freeze }) => {
    const model = window.spaceRunner!.model;
    model.field.hazards.forEach(hazard => { hazard.active = false; });
    variants.forEach((variant, index) => Object.assign(model.field.hazards[index]!, {
      active: true, x: (index - (variants.length - 1) / 2) * 3.5, y: 1.25, z: -7,
      radius: 1, spin: 0, kind: variant === 0 ? 0 : variant < 3 ? 1 : 2,
      phase: variant === 2 || variant === 4 ? Math.PI * 2 : 0,
    }));
    model.invulnerability = 0;
    if (freeze) model.pause();
  }, { variants, freeze });
  if (freeze) {
    await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
    await page.evaluate(() => { document.getElementById('paused')!.hidden = true; });
  }
  await page.waitForTimeout(70);
}

test('normal flight has no safe-lane rectangles or collider geometry while logical waves remain', async ({ page }) => {
  await page.goto('/?seed=42');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined();
  await expect(page.locator('#collider-debug-info')).toHaveCount(0);
  await launch(page);
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.field.spawnedWaves), { timeout: 8000 }).toBeGreaterThan(0);
  const sceneState = await page.evaluate(() => {
    const game = window.spaceRunner!;
    const scene = (game.world as unknown as { scene: import('three').Scene }).scene;
    let loops = 0, cornerGuides = 0, greenGuides = 0;
    scene.traverse(node => {
      if (node.type === 'LineLoop') loops++;
      if (node.name.startsWith('environment-corner-guide-')) cornerGuides++;
      if ((node.type === 'LineSegments' || node.type === 'LineLoop') && ((node as import('three').Line).material as import('three').LineBasicMaterial).color.getHex() === 0x69f4d3) greenGuides++;
    });
    return { loops, cornerGuides, greenGuides, debug: !!scene.getObjectByName('collision-debug-root'), logicalWaves: game.model.field.waves.filter(wave => wave.active).length };
  });
  expect(sceneState.loops).toBe(0);
  expect(sceneState.cornerGuides).toBe(9);
  expect(sceneState.greenGuides).toBe(0);
  expect(sceneState.debug).toBe(false);
  expect(sceneState.logicalWaves).toBeGreaterThan(0);
  await expect(page.locator('#collider-debug-info')).toHaveCount(0);
  await expect(page.locator('#flight-hint')).not.toContainText(/cyan|green|gate/i);
  await arrange(page, [0, 1, 2], false);
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  await page.screenshot({ path: 'test-results/phase3-normal-gameplay.png' });
});

test('developer collider view aligns with models and stays bounded through restarts and disposal', async ({ page }) => {
  test.setTimeout(45000);
  const downloads: string[] = [];
  page.on('response', response => { if (response.url().endsWith('.glb')) downloads.push(response.url()); });
  await launch(page, '/?debug=colliders&seed=42');
  await expect(page.locator('#collider-debug-info')).toBeVisible();
  await collide(page);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await page.waitForTimeout(650);
  await arrange(page, [0, 1, 2]);
  await expect(page.locator('#collider-debug-info')).toContainText('3 active');
  await page.screenshot({ path: 'test-results/phase3-meteor-colliders.png' });
  await arrange(page, [3, 4]);
  await expect(page.locator('#collider-debug-info')).toContainText('2 active');
  await page.screenshot({ path: 'test-results/phase3-debris-colliders.png' });
  const snapshot = () => page.evaluate(() => {
    const world = window.spaceRunner!.world;
    const scene = (world as unknown as { scene: import('three').Scene }).scene;
    const root = scene.getObjectByName('collision-debug-root')!;
    return { memory: { ...world.renderer.info.memory }, uuid: root.uuid, children: root.children.length, active: root.children.filter(node => node.name.startsWith('collider-hazard-') && node.visible).map(node => ({ id: node.userData.modelId, shape: node.userData.shape, position: node.position.toArray(), radius: node.scale.x, box: node.children[1]!.scale.toArray() })) };
  });
  const baseline = await snapshot();
  expect(baseline.children).toBe(73);
  expect(baseline.active.map(item => item.id)).toEqual(['barrel', 'generator']);
  expect(baseline.active.map(item => item.shape)).toEqual(['sphere-and-box', 'sphere-and-box']);
  expect(baseline.active[0]!.box).toEqual([0.624696, 0.780869, 0.541002]);
  expect(baseline.active[1]!.box).toEqual([0.784773, 0.448442, 0.58858]);
  expect(baseline.active[0]!.position).toEqual([-1.75, 1.25, -7]);
  for (let run = 0; run < 5; run++) {
    await page.keyboard.press('KeyP');
    await page.evaluate(() => window.spaceRunner!.model.field.hazards.forEach(hazard => { hazard.active = false; }));
    await endRun(page);
    await page.getByRole('button', { name: 'Fly again' }).click();
    await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '3');
    await arrange(page, [3, 4]);
    const current = await snapshot();
    expect(current.memory).toEqual(baseline.memory);
    expect(current.uuid).toBe(baseline.uuid);
    expect(current.children).toBe(baseline.children);
    expect(downloads).toHaveLength(6);
  }
  console.log('Collider debugger restart sample:', JSON.stringify({ ...baseline.memory, rootChildren: baseline.children, downloads: downloads.length }));
  const disposed = await page.evaluate(() => {
    const game = window.spaceRunner!;
    const scene = (game.world as unknown as { scene: import('three').Scene }).scene;
    const root = scene.getObjectByName('collision-debug-root')!;
    const geometries = new Set<import('three').BufferGeometry>();
    root.traverse(node => { if (node.type === 'LineSegments') geometries.add((node as import('three').LineSegments).geometry); });
    let releases = 0;
    geometries.forEach(geometry => geometry.addEventListener('dispose', () => releases++));
    game.dispose();
    return { geometries: geometries.size, releases, rootPresent: !!scene.getObjectByName('collision-debug-root'), infoPresent: !!document.getElementById('collider-debug-info') };
  });
  expect(disposed).toEqual({ geometries: 2, releases: 2, rootPresent: false, infoPresent: false });
});

test('calibrated debris passes through old empty space, then a real hit still damages hull', async ({ page }) => {
  await launch(page);
  await page.evaluate(() => {
    const model = window.spaceRunner!.model;
    // Generator top is 0.448442 at radius 1: centerline clearance 1.0 leaves
    // more than the approved 0.42 player radius, while the old sphere would hit.
    Object.assign(model.field.hazards[0]!, { active: true, x: 0, y: -1, z: -3, radius: 1, spin: 0, kind: 2, phase: Math.PI * 2 });
  });
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.field.hazards[0]!.z)).toBeGreaterThan(2);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '3');
  await page.evaluate(() => {
    const model = window.spaceRunner!.model;
    Object.assign(model.field.hazards[1]!, { active: true, x: 0, y: 0, z: -0.3, radius: 1, spin: 0, kind: 2, phase: Math.PI * 2 });
  });
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('#damage')).toBeVisible();
});
