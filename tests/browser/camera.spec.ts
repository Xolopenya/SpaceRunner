import { test, expect } from './helpers';

test('camera switches while ordinary RAF flight and held steering continue',async({page})=>{
  await page.goto('/?debug=camera&seed=42');await page.locator('#launch').click();
  await page.keyboard.down('KeyD');await page.waitForTimeout(250);
  const before=await page.evaluate(()=>({x:window.spaceRunner!.model.ship.x,distance:window.spaceRunner!.model.distance,hull:window.spaceRunner!.model.hull}));
  await page.locator('[data-camera="full-chase"]').click();await page.waitForTimeout(250);
  const after=await page.evaluate(()=>({x:window.spaceRunner!.model.ship.x,distance:window.spaceRunner!.model.distance,hull:window.spaceRunner!.model.hull,mode:window.spaceRunner!.world.flightCamera.mode,state:window.spaceRunner!.model.state}));
  await page.keyboard.up('KeyD');expect(after.mode).toBe('full-chase');expect(after.state).toBe('PLAYING');expect(after.distance).toBeGreaterThan(before.distance);expect(after.x).toBeGreaterThan(before.x);expect(after.hull).toBe(before.hull);
});

test('DEV camera selector switches live without simulation or resource changes; pause, resize and restart', async ({ page }) => {
  await page.goto('/?debug=camera&camera=full-chase&colliders=1&seed=42');await page.locator('#launch').click();
  await page.evaluate(()=>{const g=window.spaceRunner!;(g as any).loop.stop();});
  const before=await page.evaluate(()=>{const g=window.spaceRunner!;return JSON.stringify(g.model);});
  const cameras=[];
  for(const mode of ['baseline','full-chase','hybrid-chase']) {
    await page.locator(`[data-camera="${mode}"]`).click();
    await expect(page.locator(`[data-camera="${mode}"]`)).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>JSON.stringify(window.spaceRunner!.model))).toEqual(before);
    cameras.push(await page.evaluate(()=>{const g=window.spaceRunner!;g.world.render(g.model,1/60);return {...g.world.renderer.info.memory};}));
  }
  expect(cameras[0]).toEqual(cameras[2]);
  await page.locator('#pause').click();
  await page.locator('[data-camera="full-chase"]').click();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#camera-research')).toBeInViewport();
  const resize=await page.evaluate(()=>{const g=window.spaceRunner!;g.world.render(g.model,1/60);const c=g.world.flightCamera.camera,rect=document.getElementById('flight')!.getBoundingClientRect();return{aspect:c.aspect,w:rect.width,h:rect.height,fov:c.fov,state:g.model.state};});
  expect(resize.aspect).toBeCloseTo(resize.w/resize.h,9);expect(resize.fov).toBe(58);expect(resize.state).toBe('PAUSED');
  await page.locator('#restart-pause').click();expect(await page.evaluate(()=>({mode:window.spaceRunner!.world.flightCamera.mode,distance:window.spaceRunner!.model.distance,hull:window.spaceRunner!.model.hull}))).toEqual({mode:'full-chase',distance:0,hull:3});
});

test('camera research URL and controls are absent in production; historical collectible diagnostics retain baseline',async({page})=>{
  await page.goto('http://127.0.0.1:4173/?debug=camera&camera=full-chase&seed=42');await expect(page.locator('#launch')).toBeVisible();await expect(page.locator('#camera-research')).toHaveCount(0);expect(await page.evaluate(()=>window.spaceRunner)).toBeUndefined();
  await page.goto('/?debug=collectibles&seed=42');await expect(page.locator('#launch')).toBeVisible();expect(await page.evaluate(()=>window.spaceRunner!.world.flightCamera.mode)).toBe('baseline');await expect(page.locator('#camera-research')).toHaveCount(0);
});
