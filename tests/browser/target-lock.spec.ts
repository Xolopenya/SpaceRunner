import { test,expect,launch } from './helpers.ts';
const url='/?debug=field&experiment=moving-mine&motion=target-lock&seed=42&firstMine=1';

test('acquisition preview has no collider; actual off-center publication freezes target, warning pose and resources',async({page})=>{
 let requests=0;page.on('request',r=>{if(r.url().includes('space-mine.glb'))requests++;});await launch(page,url);
 const result=await page.evaluate(()=>{
  const g=window.spaceRunner! as any,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);
  for(let n=0;n<48;n++)m.step(1/120,{x:1,y:0});g.loop.render(1/60);
  const preview={mines:m.field.slots.filter((h:any)=>h.active&&h.kind===9).length,visible:g.world.collisionDebug.root.getObjectByName('moving-space-mine').visible,text:document.getElementById('moving-mine-info')!.textContent};
  for(let n=48;n<97;n++)m.step(1/120,{x:1,y:0});g.loop.render(1/60);
  const h=m.field.slots.find((h:any)=>h.active&&h.kind===9),motion=structuredClone(h.planned.motion),bytes=JSON.stringify(h.planned),position={x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy},id=h.planned.id;
  for(let n=0;n<60;n++)m.step(1/120,{x:0,y:-1});g.loop.render(1/60);const unchanged=JSON.stringify(h.planned)===bytes,afterShip={x:m.ship.x,y:m.ship.y};
  const beforePause={time:m.elapsed,x:h.x,y:h.y};m.pause();for(let n=0;n<100;n++)m.step(1/120,{x:1,y:1});const paused={time:m.elapsed,x:h.x,y:h.y};
  m.state='GAME_OVER';m.start(42);for(let n=0;n<97;n++)m.step(1/120,{x:1,y:0});const again=m.field.slots.find((h:any)=>h.active&&h.kind===9);
  return{preview,motion,position,unchanged,afterShip,beforePause,paused,id,restart:again.planned.id,fault:m.field.fault};
 });
 expect(result.preview.mines).toBe(0);expect(result.preview.visible).toBe(true);expect(result.preview.text).toContain('ACQUIRING');
 expect(result.motion.capture.x).toBe(result.position.x);expect(result.motion.capture.y).toBe(result.position.y);expect(result.motion.capture.vx).toBe(result.position.vx);
 expect(result.motion.capture.inputX).toBe(1);expect(result.motion.targetX).toBeGreaterThan(4);expect(result.motion.targetX).toBe(result.position.x);
 expect(result.unchanged).toBe(true);expect(result.afterShip.y).toBeLessThan(result.position.y);expect(result.paused).toEqual(result.beforePause);expect(result.restart).toBe(result.id);expect(result.fault).toBeUndefined();expect(requests).toBe(1);
});

test('locked attack moves on both axes, uses exact authoritative pose and can be deliberately evaded',async({page})=>{
 await launch(page,url);const r=await page.evaluate(()=>{
  const g=window.spaceRunner! as any,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);for(let n=0;n<97;n++)m.step(1/120,{x:0,y:0});
  const h=m.field.slots.find((s:any)=>s.active&&s.kind===9),plan=structuredClone(h.planned),motion=plan.motion;
  while(Math.round(m.elapsed*120)<motion.startTick)m.step(1/120,{x:0,y:1});const start={x:h.x,y:h.y};
  for(let n=0;n<60;n++)m.step(1/120,{x:0,y:1});g.loop.render(1/60);const mesh=g.world.collisionDebug.root.getObjectByName('moving-space-mine');
  const after={x:h.x,y:h.y,renderedX:mesh.position.x,renderedY:mesh.position.y};while(m.distance<plan.passDistance+4&&m.state==='PLAYING')m.step(1/120,{x:0,y:1});
  return{motion,start,after,hull:m.hull,hits:m.hitSerial,same:JSON.stringify(h.planned)===JSON.stringify(plan),fault:m.field.fault};
 });
 expect(r.after.x-r.start.x).toBeCloseTo(r.motion.velocityX*.5,9);expect(r.after.y-r.start.y).toBeCloseTo(r.motion.velocityY*.5,9);
 expect(r.after.renderedX).toBe(r.after.x);expect(r.after.renderedY).toBe(r.after.y);expect(r.hull).toBe(3);expect(r.hits).toBe(0);expect(r.same).toBe(true);expect(r.fault).toBeUndefined();
});

test('unavoided target makes one real hull contact without changing existing damage behavior',async({page})=>{
 await launch(page,url);const r=await page.evaluate(()=>{
  const g=window.spaceRunner! as any,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);for(let n=0;n<1150;n++)m.step(1/120,{x:0,y:0});g.loop.render(1/60);
  return{hull:m.hull,hits:m.hitSerial,state:m.state,invulnerability:m.invulnerability,fault:m.field.fault};
 });expect(r.hull).toBe(2);expect(r.hits).toBe(1);expect(r.state).toBe('PLAYING');expect(r.invulnerability).toBeGreaterThan(0);expect(r.fault).toBeUndefined();
});

test('production strips target selector, diagnostics and experimental asset',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('.glb'))requests.push(r.url());});
 await page.goto('http://127.0.0.1:4173'+url);await expect(page.locator('#game')).toHaveAttribute('data-state','MENU');expect(await page.evaluate(()=>window.spaceRunner)).toBeUndefined();
 expect(requests.length).toBe(6);expect(requests.some(r=>r.includes('space-mine'))).toBe(false);await expect(page.locator('#moving-mine-info')).toHaveCount(0);
});
