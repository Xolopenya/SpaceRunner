import { test, expect } from './helpers';
test('accepted ordinary asteroid damages ONLY a wing in actual ReleaseModel flight and DEV overlay',async({page})=>{
  await page.goto('/?debug=collectibles&colliders=1&seed=42');await page.locator('#launch').click();
  const result=await page.evaluate(()=>{
    const g=window.spaceRunner! as unknown as {model:import('../../src/release/model.ts').ReleaseModel;loop:{stop():void;render(dt:number):void}};
    g.loop.stop();const m=g.model;
    while(!m.hitSerial&&m.distance<200&&m.state==='PLAYING'){
      const p=m.fragments.active[0],t=p?.approach??p;
      const axis=t?{x:Math.max(-1,Math.min(1,(t.x-m.ship.x)*1.6-m.ship.vx*.3)),y:Math.max(-1,Math.min(1,(t.y-m.ship.y)*1.6-m.ship.vy*.3))}:{x:0,y:0};
      m.step(1/120,axis);
    }
    g.loop.render(1/60);return{hit:m.hitSerial,hull:m.hull,contact:m.lastShipContact,committed:m.field.committed,fault:m.field.fault};
  });
  expect(result.hull).toBe(2);expect(result.hit).toBe(1);expect(result.contact?.part).toBe('left-wing');expect(result.contact?.bodyClear).toBe(true);expect(result.committed).toBeGreaterThan(0);expect(result.fault).toBeUndefined();
  await expect(page.locator('#collider-debug-info')).toContainText('LAST REAL HIT: left-wing');
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow','2');await page.screenshot({path:'test-results/004b-wing-left-contact.png'});
});
test('pickup magnet freezes on pause, restart clears it and production excludes collider visualization',async({page})=>{
  await page.goto('/?debug=collectibles&colliders=1&seed=42');await page.locator('#launch').click();
  const result=await page.evaluate(async()=>{
    const g=window.spaceRunner! as unknown as {model:import('../../src/release/model.ts').ReleaseModel;loop:{stop():void;render(dt:number):void};world:{fragments:{root:{children:{visible:boolean;position:{toArray():number[]}}[]}}}};
    const {fragmentInput}=await import('/tests/fixtures/fragment-flight.ts');g.loop.stop();const m=g.model;
    while(!m.fragments.count&&m.distance<400&&m.state==='PLAYING')m.step(1/120,fragmentInput(m,m.fragments.active[0]));
    for(let i=0;i<6;i++)m.step(1/120,{x:0,y:0});
    g.loop.render(1/60);m.pause();g.loop.render(1/60);
    const a=JSON.stringify(g.world.fragments.root.children.map(x=>[x.visible,x.position.toArray()]));
    for(let i=0;i<50;i++){m.step(1/120,{x:1,y:0});g.loop.render(1/60);}
    const b=JSON.stringify(g.world.fragments.root.children.map(x=>[x.visible,x.position.toArray()]));return{frozen:a===b,count:m.fragments.count};
  });
  expect(result.frozen).toBe(true);expect(result.count).toBe(1);
  await page.locator('#restart-pause').click();await page.evaluate(()=>(window.spaceRunner as unknown as {loop:{render(dt:number):void}}).loop.render(1/60));await expect(page.locator('#energy-count')).toHaveText('00');
  await page.goto('http://127.0.0.1:4173/?debug=collectibles&colliders=1&seed=42');await page.locator('#launch').click();expect(await page.evaluate(()=>window.spaceRunner)).toBeUndefined();await expect(page.locator('#collider-debug-info')).toHaveCount(0);
});
