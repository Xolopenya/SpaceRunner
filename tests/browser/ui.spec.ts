import { test, expect, launch, collide, endRun } from './helpers';
import type { Page } from '@playwright/test';
import { test as rawTest } from '@playwright/test';

async function fit(page: Page) {
  const problems = await page.evaluate(() => {
    const visible = (node: HTMLElement) => node.getClientRects().length > 0;
    const inDialog = document.querySelector<HTMLDialogElement>('#sound-settings')!.open;
    const nodes = document.querySelectorAll<HTMLElement>(inDialog ? 'dialog button, dialog input' : '#game button');
    return [...nodes].filter(visible).flatMap(node => {
      const r = node.getBoundingClientRect();
      const scrolling = node.closest('dialog') && node.closest('dialog')!.scrollHeight > node.closest('dialog')!.clientHeight;
      return r.width < 44 || r.height < 44 || r.left < 0 || r.right > innerWidth + 1 || (!scrolling && (r.top < 0 || r.bottom > innerHeight + 1)) ? [{ name: node.id, rect: r.toJSON() }] : [];
    });
  });
  expect(problems).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function clearCenter(page: Page) {
  const overlaps = await page.evaluate(() => {
    const area = document.getElementById('game')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('#hud, #flight-hint, #damage, #telemetry')].filter(node => node.getClientRects().length).filter(node => {
      const r = node.getBoundingClientRect();
      return r.left < area.left + area.width * .8 && r.right > area.left + area.width * .2 && r.top < area.top + area.height * .8 && r.bottom > area.top + area.height * .2;
    }).map(node => node.id);
  });
  expect(overlaps).toEqual([]);
}

async function scoreFits(page: Page) {
  const clipped = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#distance, #menu-best, #paused-score, #final-score, #final-best')].filter(node => node.getClientRects().length).flatMap(node => {
    const r = node.getBoundingClientRect();
    const boundary = node.closest('.distance-block, .state-copy, .paused-metrics, .record')!.getBoundingClientRect();
    return r.left < Math.max(0, boundary.left) - 1 || r.right > Math.min(innerWidth, boundary.right) + 1 ? [node.id] : [];
  }));
  expect(clipped).toEqual([]);
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/ui-live-${name}.png` });
}

test('Concept A desktop uses live flight, damage, pause, native audio and replay state', async ({ page }) => {
  await page.goto('/?debug&seed=42');
  await expect(page.getByRole('heading', { name: 'Space Runner', exact: true })).toBeVisible();
  await expect(page.locator('#launch')).toBeFocused();
  await fit(page); await shot(page, 'menu-desktop');
  await page.locator('#launch').click();
  await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.score), { timeout: 9000 }).toBeGreaterThan(150);
  await expect.poll(() => page.evaluate(() => document.querySelector('#distance')!.textContent === window.spaceRunner!.model.score.toLocaleString('en-US'))).toBe(true);
  await expect(page.locator('#menu-title')).toBeHidden();
  await expect(page.locator('#hull-count')).toHaveText('3');
  await clearCenter(page); await fit(page); await shot(page, 'playing-desktop');
  await collide(page);
  await expect(page.locator('#hull-count')).toHaveText('2');
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('#damage')).toBeVisible();
  await clearCenter(page); await shot(page, 'damage-desktop');
  await page.locator('#pause').click();
  await expect(page.locator('#resume')).toBeFocused();
  await expect(page.locator('#paused-hull-count')).toHaveText('2');
  await expect(page.locator('#paused-score')).toHaveText((await page.locator('#distance').textContent())!);
  await expect(page.locator('#pause-reason')).toHaveText('Your flight is paused.');
  await fit(page); await shot(page, 'paused-desktop');
  const opener = page.locator('#paused [data-sound-open]');
  await opener.click();
  await expect(page.locator('#sound-status')).toHaveText('Audio enabled.');
  await fit(page); await shot(page, 'audio-desktop');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('dialog')?.id)).toBe('sound-settings');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PAUSED');
  await page.keyboard.press('KeyP');
  await endRun(page);
  await expect(page.getByRole('heading', { name: 'End of flight.' })).toBeVisible();
  await expect(page.locator('#replay')).toBeFocused();
  await expect(page.locator('#final-best')).toHaveText((await page.locator('#final-score').textContent())!);
  await fit(page); await shot(page, 'over-desktop');
  await page.keyboard.press('Enter');
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  await expect(page.locator('#hull-count')).toHaveText('3');
});

for (const [tier, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]] as const) {
  test.describe(tier, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
    test(`${tier} controls fit and touch reaches the canvas through noninteractive HUD`, async ({ page }) => {
      await page.goto('/?debug&seed=42');
      await expect(page.locator('#launch')).toBeVisible();
      await fit(page); await shot(page, `menu-${tier}`);
      await page.locator('#launch').tap();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width === 390 ? 250 : 500, y: 66 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width === 390 ? 190 : 440, y: 110 }] });
      await expect(page.locator('#joystick')).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.spaceRunner!.model.ship.x)).toBeLessThan(-.5);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(page.locator('#joystick')).toBeHidden();
      await fit(page); await clearCenter(page); await shot(page, `playing-${tier}`);
      await page.locator('#pause').tap();
      await fit(page); await shot(page, `paused-${tier}`);
      await page.locator('#paused [data-sound-open]').tap();
      await fit(page); await shot(page, `audio-${tier}`);
      await page.locator('#sound-mute').tap();
      await expect(page.locator('#sound-mute')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#sound-close').tap();
      await page.locator('#resume').tap();
      await endRun(page);
      await fit(page); await shot(page, `over-${tier}`);
      await page.locator('#replay').tap();
      await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
    });
  });
}

test('six-digit and larger live distances fit desktop, tablet and short mobile screens', async ({ page }) => {
  test.setTimeout(90_000);
  await launch(page);
  await page.evaluate(() => (window.spaceRunner as unknown as { loop: { stop(): void } }).loop.stop());
  for (const [width, height] of [[1440, 900], [1024, 600], [768, 1024], [390, 844], [360, 640], [320, 568], [844, 390], [667, 320]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    for (const distance of [999_999, 123_456_789, 1_234_567_890]) {
      await page.evaluate(value => {
        const game = window.spaceRunner!;
        game.model.distance = value;
        (game as unknown as { ui: { update(model: unknown): void } }).ui.update(game.model);
        game.world.render(game.model, 0);
      }, distance);
      await expect(page.locator('#distance')).toHaveText(distance.toLocaleString('en-US'));
      await fit(page); await scoreFits(page); await clearCenter(page);
    }
    await page.locator('#pause').click();
    // This fixture stopped the loop, so explicitly run its usual HUD sync after pause.
    await page.evaluate(() => {
      const game = window.spaceRunner!;
      (game as unknown as { ui: { update(model: unknown): void } }).ui.update(game.model);
    });
    await expect(page.locator('#flight-hint')).toBeHidden();
    await fit(page); await scoreFits(page);
    if (width === 390) await shot(page, 'large-score-portrait');
    if (width === 1440) await shot(page, 'large-score-desktop');
    await page.locator('#resume').click();
  }
  await page.evaluate(() => (window.spaceRunner as unknown as { loop: { start(): void } }).loop.start());
  await endRun(page);
  await scoreFits(page); await fit(page);
  await page.reload();
  await expect(page.locator('#menu-best')).not.toHaveText('0');
  await scoreFits(page); await fit(page);
});

test('loading progress remains visible while real model responses are delayed', async ({ page }) => {
  await page.route('**/*.glb', async route => { await new Promise(resolve => setTimeout(resolve, 350)); await route.continue(); });
  await page.goto('/?seed=42');
  await expect(page.locator('#loading-message')).toContainText('LOADING FLIGHT MODELS');
  await shot(page, 'loading-desktop');
});

rawTest('loading failure retains real retry and successful GLB recovery', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/meteor_half.glb', route => route.fulfill({ status: 404, body: 'Intentional required-model failure fixture' }));
  await page.goto('/?seed=42');
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('#loading-message')).toContainText('Required flight models could not load');
  await fit(page); await shot(page, 'error-desktop');
  await page.unroute('**/meteor_half.glb');
  await page.locator('#retry').click();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  await page.locator('#launch').click();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
  expect(errors).toEqual([]);
});

test('native safe-area environment insets protect HUD, menu and audio controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 44, right: 28, bottom: 34, left: 36 } });
  await launch(page);
  const hud = await page.locator('#hud').boundingBox();
  expect(hud!.x).toBeGreaterThanOrEqual(36);
  expect(hud!.y).toBeGreaterThanOrEqual(44);
  expect(hud!.x + hud!.width).toBeLessThanOrEqual(390 - 28);
  await page.locator('#pause').click();
  await page.locator('#paused [data-sound-open]').click();
  await fit(page);
  const panel = await page.locator('#sound-settings').boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(36);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390 - 28);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(844 - 34);
  await shot(page, 'safe-area-portrait');
  await page.keyboard.press('Escape');
});

test('built production uses local approved fonts, live UI and no review controls', async ({ page }) => {
  const fonts: string[] = [];
  page.on('response', response => { if (response.url().endsWith('.ttf')) { expect(response.ok()).toBe(true); fonts.push(response.url()); } });
  await page.goto('http://127.0.0.1:4173/?seed=42');
  await expect(page.locator('#launch')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(fonts).toHaveLength(2);
  expect(fonts.every(url => url.startsWith('http://127.0.0.1:4173/assets/fonts/'))).toBe(true);
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined();
  await expect(page.locator('.review-bar, .demo-caption, #concept, #screen')).toHaveCount(0);
  expect(await page.locator('body').textContent()).not.toContain('UI STUDY');
  await page.locator('#launch').click();
  await expect.poll(async () => Number((await page.locator('#distance').textContent())?.replaceAll(',', '')), { timeout: 9000 }).toBeGreaterThan(150);
  await clearCenter(page); await fit(page); await shot(page, 'production-preview');
});

test('focus loss reason, reduced motion and stable DOM ownership survive repeated pauses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await launch(page);
  const nodeCount = await page.locator('#game *').count();
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.locator('#pause-reason')).toHaveText('Window focus lost. Resume when you are ready.');
    await page.locator('#resume').click();
  }
  expect(await page.locator('#game *').count()).toBe(nodeCount);
  expect(await page.locator('#launch').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});
