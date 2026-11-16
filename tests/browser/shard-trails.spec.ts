import {test,expect} from './helpers';

for(const mobile of [false,true])for(const partial of [false,true])test.describe(`${mobile?'portrait reduced':'desktop'} ${partial?'partial':'complete'} trail`,()=>{
 test.use({viewport:mobile?{width:390,height:844}:{width:1280,height:800},reducedMotion:mobile?'reduce':'no-preference'});
 test('natural curve through bounded controls, no guidance resources, original shards and restart',async({page})=>{
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
  await page.goto('/?debug=integrated&seed=42');await page.locator('#launch').click();
  const result=await page.evaluate(partial=>{
   const g=window.spaceRunner as any,m=g.model,w=g.world;g.loop.stop();let tick=0,trail:string|undefined,locked=false;const ids=new Set<string>(),events:any[]=[];
   m.events.subscribe((e:any)=>{if(e.type==='collectible.collected'&&e.payload.itemId.startsWith(trail+'/trail/')){events.push(e.payload);if(partial)locked=true;}});
   while(tick<6000&&m.state==='PLAYING'){
    if(tick%2===0)m.beginPlanningFrame();
    const points=m.fragments.active.slice().sort((a:any,b:any)=>a.passDistance-b.passDistance),p=points[0];
    if(p?.trail){trail??=p.trail;points.filter((p:any)=>p.trail===trail).forEach((p:any)=>ids.add(p.id));}
    let axis={x:0,y:0};const cert=m.field.certificate;let at=cert?Math.round((m.elapsed-cert.context.elapsed)*120):0;
    for(const c of cert?.controls??[]){if(at<c.ticks){axis=c.input;break;}at-=c.ticks;}
    if(p&&p.passDistance-m.distance<Math.max(55,m.speed*2.4)){const goal=p.approach??p;axis={x:Math.max(-1,Math.min(1,(goal.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(goal.y-m.ship.y)*2.6-m.ship.vy*.8))};}
    if(locked)axis={x:0,y:0};m.step(1/120,axis);tick++;if(tick%2===0)g.loop.render(1/60);
    if(trail&&m.fragments.stats.retired+events.length>=3&& !m.fragments.active.some((p:any)=>p.trail===trail))break;
   }
   g.loop.render(0);
   return{ids:ids.size,events:events.length,rewards:events.map(e=>e.reward),pattern:m.fragments.stats.curve,total:m.fragments.count,hull:m.hull,fault:m.field.fault,
    guidance:('guidance'in w)||!!w.scene.getObjectByName('pickup-navigation')||!!w.scene.getObjectByName('wing-navigation-beams'),
    pool:w.fragments.root.children.length,slots:m.fragments.slots.length,quality:w.quality,trailCount:m.fragments.stats.trails};
  },partial);
  expect(result.ids).toBe(3);expect(result.pattern).toBeGreaterThan(0);expect(result.trailCount).toBe(1);expect(result.guidance).toBe(false);
  expect(result.events).toBe(partial?2:3);expect(result.rewards).toEqual(Array(partial?2:3).fill(1));expect(result.hull).toBeGreaterThan(0);expect(result.fault).toBeUndefined();expect(result.pool).toBe(9);expect(result.slots).toBe(8);
  if(mobile){expect(result.quality.mobile).toBe(true);expect(result.quality.reducedMotion).toBe(true);}
  await page.locator('#pause').click();await page.locator('#restart-pause').click();
  expect(await page.evaluate(()=>{const g=window.spaceRunner as any;g.loop.render(0);return{count:g.model.fragments.count,active:g.model.fragments.active.length,trails:g.model.fragments.stats.trails,pool:g.world.fragments.root.children.length};})).toEqual({count:0,active:0,trails:0,pool:9});
 });
});
