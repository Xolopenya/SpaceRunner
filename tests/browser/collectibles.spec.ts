import { test, expect } from './helpers';
import { ReleaseModel } from '../../src/release/model.ts';
import { certifiedInput } from '../fixtures/fragment-flight.ts';

test('normal production Play collects through keyboard movement with no query or debug seam', async ({ page }) => {
  test.setTimeout(90_000);
  const m = new ReleaseModel(); m.ready(); m.start(42);
  const frames: { x: number; y: number }[] = [];
  for (let frame = 0; frame < 950; frame++) {
    const p = m.fragments.active[0], steer = p ? { x: (p.x-m.ship.x)*1.6-m.ship.vx*.3, y: (p.y-m.ship.y)*1.6-m.ship.vy*.3 } : certifiedInput(m);
    const input = { x: Math.abs(steer.x) > .24 ? Math.sign(steer.x) : 0, y: Math.abs(steer.y) > .24 ? Math.sign(steer.y) : 0 };
    frames.push(input); m.step(1/120,input); m.step(1/120,input);
  }
  expect(m.fragments.count).toBeGreaterThan(0); m.dispose();
  await page.addInitScript(() => {
    let now = 0, next = 0; const pending = new Map<number, FrameRequestCallback>();
    crypto.getRandomValues = (<T extends ArrayBufferView | null>(a: T): T => { if(a) new Uint32Array(a.buffer).fill(42); return a; }) as Crypto['getRandomValues'];
    performance.now = () => now;
    window.requestAnimationFrame = cb => { pending.set(++next, cb); return next; };
    window.cancelAnimationFrame = id => { pending.delete(id); };
    (window as unknown as { advance(): void }).advance = () => { now += 1000/60; const callbacks = [...pending.values()]; pending.clear(); for (const cb of callbacks) cb(now); };
  });
  await page.goto('http://127.0.0.1:4173/'); await page.locator('#launch').click();
  expect(await page.evaluate(() => window.spaceRunner)).toBeUndefined();
  await page.evaluate(frames => {
    const keys = ['KeyA','KeyD','KeyS','KeyW'];
    for (const f of frames) {
      for(const code of keys) window.dispatchEvent(new KeyboardEvent('keyup',{code}));
      if(f.x) window.dispatchEvent(new KeyboardEvent('keydown',{code:f.x>0?'KeyD':'KeyA'}));
      if(f.y) window.dispatchEvent(new KeyboardEvent('keydown',{code:f.y>0?'KeyW':'KeyS'}));
      (window as unknown as { advance(): void }).advance();
    }
  }, frames);
  await expect(page.locator('#energy-count')).toHaveText('01');
  await page.locator('#pause').click();
  await page.evaluate(() => { for(let i=0;i<100;i++) (window as unknown as { advance(): void }).advance(); });
  await expect(page.locator('#energy-count')).toHaveText('01');
  await page.locator('#restart-pause').click();
  await page.evaluate(() => (window as unknown as { advance(): void }).advance());
  await expect(page.locator('#energy-count')).toHaveText('00');
});
