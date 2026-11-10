import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ cleanConsole: void }>({
  cleanConsole: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});

export { expect };

/** Observe the actual module loaded by Vite, including an HMR timestamp.
 * Importing the bare path can create a different constructor after an edit. */
export async function observeOrdinaryLaunch(page: Page, key: string): Promise<void> {
  await page.evaluate(async key => {
    const url=performance.getEntriesByType('resource').map(e=>e.name).find(name=>new URL(name).pathname==='/src/game.ts');
    if(!url)throw new Error('Loaded Game module not found');
    const {Game}=await import(url),start=Game.prototype.start;
    Game.prototype.start=function(){(window as any)[key]=this;start.call(this);};
  },key);
}

export async function launch(page: Page, url = '/?debug&seed=42') {
  await page.goto(url);
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'MENU');
  await page.getByRole('button', { name: 'Launch run' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'PLAYING');
}

/** Controlled fixtures enter the actual collision/update path; no production test hooks. */
export async function collide(page: Page, resetCooldown = false) {
  await page.evaluate(reset => {
    const model = window.spaceRunner!.model;
    if (reset) model.invulnerability = 0;
    const hazard = model.field.hazards.find(item => !item.active)!;
    Object.assign(hazard, { active: true, x: model.ship.x, y: model.ship.y, z: -0.3, radius: 1, kind: 0 });
  }, resetCooldown);
}

export async function endRun(page: Page) {
  // A restart updates the model before the next HUD frame; read the live hull.
  const remaining = await page.evaluate(() => window.spaceRunner!.model.hull);
  for (let hull = remaining - 1; hull >= 0; hull--) {
    await collide(page, true);
    await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow', String(hull));
  }
  await expect(page.locator('#game')).toHaveAttribute('data-state', 'GAME_OVER');
}
