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

for(const sign of [-1,1])test(`contained shard supports a natural ${sign<0?'left':'right'} wing pickup, magnet, pause and reset`,async({page})=>{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
  await page.goto('/?debug=integrated&seed=0');await page.locator('#launch').click();
  const result=await page.evaluate(sign=>{
    const g=window.spaceRunner! as any,m=g.model;g.loop.stop();let target,tick=0;
    const step=()=>{if(tick%2===0)m.beginPlanningFrame();target??=m.fragments.active[0];
      const goal=target?{x:target.x-sign*1.99,y:target.y+.30}:m.ship;
      let axis={x:Math.max(-1,Math.min(1,(goal.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(goal.y-m.ship.y)*2.6-m.ship.vy*.8))};
      if(!target){const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0;axis={x:0,y:0};for(const c of w?.controls??[]){if(at<c.ticks){axis=c.input;break;}at-=c.ticks;}}
      m.step(1/120,axis);tick++;if(tick%2===0)g.loop.render(1/60);};
    while(!m.fragments.count&&tick<2400&&m.state==='PLAYING')step();
    for(let i=0;i<6;i++)step();g.loop.render(0);
    const shard=g.world.fragments.root.children[m.fragments.lastPickup.slot];
    const pose=()=>JSON.stringify({position:shard.position.toArray(),scale:shard.scale.toArray(),rotation:shard.rotation.toArray(),count:m.fragments.count,pickup:m.fragments.lastPickup});
    const attracting=shard.visible&&shard.scale.x<1&&shard.scale.x>.35;
    m.pause();g.loop.render(0);const before=pose();for(let i=0;i<30;i++){m.step(1/120,{x:1,y:0});g.loop.render(1/60);}const frozen=pose()===before;
    m.resume();for(let i=0;i<24;i++)step();g.loop.render(0);
    return{count:m.fragments.count,part:m.fragments.lastPickup.part,attracting,frozen,disappeared:!shard.visible,hull:m.hull,fault:m.field.fault};
  },sign);
  // The same seed/input replay on frozen 007A loses one hull on the left route
  // before pickup; the optional reward must not heal or suppress that contact.
  expect(result).toEqual({count:1,part:sign<0?'left-wing':'right-wing',attracting:true,frozen:true,disappeared:true,hull:sign<0?2:3,fault:undefined});
  await expect(page.locator('#energy-count')).toHaveText('01');await page.locator('#pause').click();await page.locator('#restart-pause').click();
  await page.evaluate(()=>{const g=window.spaceRunner as any;g.loop.render(0);});await expect(page.locator('#energy-count')).toHaveText('00');
});
