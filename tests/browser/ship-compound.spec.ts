import { test, expect } from './helpers';
for(const sign of [-1,1])test(`accepted ordinary asteroid damages ONLY the ${sign<0?'left':'right'} wing in actual integrated flight and DEV overlay`,async({page})=>{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
  await page.goto('/?debug=integrated&colliders=1&seed=0');await page.locator('#launch').click();
  const result=await page.evaluate(sign=>{
    const g=window.spaceRunner! as any;g.loop.stop();const m=g.model;let target:{x:number;y:number}|undefined,tick=0;
    while(!m.hitSerial&&m.distance<300&&m.state==='PLAYING'){
      if(tick%2===0)m.beginPlanningFrame();
      if(!target){const h=m.field.slots.find((h:any)=>h.planned&&h.kind===0&&h.z< -40&&Math.abs(h.x-sign*1.43)<5.5&&Math.abs(h.y+.35)<3.1);if(h)target={x:h.x-sign*1.43,y:h.y+.35};}
      const axis=target?{x:Math.max(-1,Math.min(1,(target.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(target.y-m.ship.y)*2.6-m.ship.vy*.8))}:{x:0,y:0};
      m.step(1/120,axis);tick++;if(tick%2===0)m.finishPlanningFrame(1/60);
    }
    g.loop.render(1/60);return{hit:m.hitSerial,hull:m.hull,contact:m.lastShipContact,committed:m.field.committed,fault:m.field.fault};
  },sign);
  const part=sign<0?'left-wing':'right-wing';
  expect(result.hull).toBe(2);expect(result.hit).toBe(1);expect(result.contact?.part).toBe(part);expect(result.contact?.bodyClear).toBe(true);expect(result.committed).toBeGreaterThan(0);expect(result.fault).toBeUndefined();
  await expect(page.locator('#collider-debug-info')).toContainText(`LAST REAL HIT: ${part}`);
  await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow','2');await page.screenshot({path:`test-results/005b2-${part}-contact.png`});
});

test('historical004B greedy steering still touches the old wing volume but clears the calibrated live profile',async({page})=>{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
  await page.goto('/?debug=collectibles&colliders=1&seed=42');await page.locator('#launch').click();
  const result=await page.evaluate(async()=>{
    const {ShipHazardCollision}=await import('/src/core/ship-hazard-collision.ts');
    const old={version:'historical-005B',axialExtent:.98,radialExtent:1.36,enclosingRadius:1.57,parts:[{id:'body',offsetX:0,offsetY:0,offsetZ:0,radius:.42},{id:'left-wing',offsetX:-1.02,offsetY:-.35,offsetZ:.7,radius:.28},{id:'right-wing',offsetX:1.02,offsetY:-.35,offsetZ:.7,radius:.28}]};
    const query=new ShipHazardCollision(old),g=window.spaceRunner! as any,m=g.model;g.loop.stop();let shadowPart;
    while(!m.hitSerial&&m.distance<200&&m.state==='PLAYING'){
      const p=m.fragments.active[0],t=p?.approach??p,x=m.ship.x,y=m.ship.y,d=m.distance;
      const axis=t?{x:Math.max(-1,Math.min(1,(t.x-m.ship.x)*1.6-m.ship.vx*.3)),y:Math.max(-1,Math.min(1,(t.y-m.ship.y)*1.6-m.ship.vy*.3))}:{x:0,y:0};m.step(1/120,axis);
      for(const h of m.field.slots)if(h.active&&query.hit({x:x-h.x,y:y-h.y,z:-(h.z-(m.distance-d))},{x:m.ship.x-h.x,y:m.ship.y-h.y,z:-h.z},h,m.elapsed,1/120))shadowPart??=query.lastPart;
    }
    return{hull:m.hull,hit:m.hitSerial,shadowPart};
  });
  expect(result.shadowPart).toBe('left-wing');expect(result.hull).toBe(3);expect(result.hit).toBe(0);
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
