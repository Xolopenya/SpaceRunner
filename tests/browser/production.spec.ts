import { test, expect } from './helpers';

test('static production output loads locally and plays with no debug seam or runtime CDN', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/?debug');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  expect(requests.filter(url => url.endsWith('.glb'))).toHaveLength(6);
  await page.screenshot({ path: 'test-results/production-menu.png' });
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined();
  await page.getByRole('button', { name: 'Launch run' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  await expect.poll(() => page.locator('#distance').textContent()).not.toBe('0');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  const notice = await page.request.get('/THIRD_PARTY_NOTICES.txt');
  expect(notice.ok()).toBe(true);
  expect(await notice.text()).toContain('Copyright © 2010-2026 three.js authors');
  expect(requests.filter(url => !url.startsWith('http://127.0.0.1:4173') && !url.startsWith('data:'))).toEqual([]);
});
