import { test, expect, launch, endRun } from './helpers';

test('portrait touch steering, capture release, cancel, rotate, pause, and replay', async ({ page }) => {
  await launch(page);
  const canvas = page.locator('#flight');
  // Chromium's touch protocol sends actual touch pointers through pointer capture.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 170, y: 520 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 250, y: 440 }] });
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.x)).toBeGreaterThan(1);
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.y)).toBeGreaterThan(1);
  await expect(page.locator('#joystick')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#joystick')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.vx)).toBe(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 500 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 100, y: 500 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#joystick')).toBeHidden();
  await page.evaluate(() => {
    const model = window.spaceRunner!.model;
    for (let i = 0; i < 3; i++) Object.assign(model.field.hazards[i]!, { active: true, x: (i - 1) * 3.7, y: 0, z: -12 - i * 3, radius: 1, kind: i === 0 ? 0 : 1, phase: i === 2 ? 4 : 0 });
  });
  await page.screenshot({ path: 'test-results/touch-portrait.png' });
  expect(await canvas.evaluate(node => node.width)).toBeLessThanOrEqual(550);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Pause flight' }).tap();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  await page.screenshot({ path: 'test-results/touch-landscape-paused.png' });
  const resume = page.getByRole('button', { name: 'Resume flight' });
  const box = await resume.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThan(390);
  await resume.tap();
  await endRun(page);
  await page.getByRole('button', { name: 'Fly again' }).tap();
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '3');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
