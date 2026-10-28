import { test, expect, launch } from './helpers.ts';

for (const policy of ['baseline','fast','diagonal']) test(`${policy} DEV URL publishes the selected vector and renders exact XY through pause/restart`, async ({page}) => {
  await launch(page,`/?debug=field&experiment=moving-mine&motion=${policy}&seed=42&firstMine=1`);
  const result=await page.evaluate(() => {
    const g=window.spaceRunner! as any,m=g.model;g.loop.stop();m.state='GAME_OVER';m.start(42);
    const input=()=>{const w=m.field.certificate;let n=w?Math.round((m.elapsed-w.context.elapsed)*120):0;for(const r of w?.controls??[]){if(n<r.ticks)return r.input;n-=r.ticks;}return{x:0,y:0};};
    const to=()=>{for(let i=0;i<1000;i++)m.step(1/120,input());g.loop.render(1/60);return m.field.slots.find((h:any)=>h.active&&h.kind===9);};
    const h=to(),before={x:h.x,y:h.y,id:h.planned.id},v=h.planned.motion;
    for(let i=0;i<12;i++)m.step(1/120,input());g.loop.render(1/60);const after={x:h.x,y:h.y};
    const mesh=g.world.collisionDebug.root.getObjectByName('moving-space-mine'),rendered={x:mesh.position.x,y:mesh.position.y};
    m.pause();for(let i=0;i<80;i++)m.step(1/120,{x:1,y:1});const paused={x:h.x,y:h.y};
    m.state='GAME_OVER';m.start(42);const again=to();return{policy:m.motionPolicy,before,after,rendered,paused,v,restart:{x:again.x,y:again.y,id:again.planned.id},hull:m.hull,fault:m.field.fault};
  });
  expect(result.policy).toBe(policy);expect(result.after.x-result.before.x).toBeCloseTo(result.v.velocityX*.1,8);
  expect(result.after.y-result.before.y).toBeCloseTo((result.v.velocityY??0)*.1,8);
  expect(result.rendered).toEqual(result.after);expect(result.paused).toEqual(result.after);expect(result.restart).toEqual(result.before);
  expect(result.hull).toBe(3);expect(result.fault).toBeUndefined();await expect(page.locator('#moving-mine-info')).toContainText(policy);
});

test('production ignores all three motion policies and never requests the DEV mine model',async({page})=>{
  for(const policy of ['baseline','fast','diagonal']){
    const requests:string[]=[];const listener=(r:any)=>{if(r.url().includes('.glb'))requests.push(r.url());};page.on('request',listener);
    await page.goto(`http://127.0.0.1:4173/?debug=field&experiment=moving-mine&motion=${policy}&seed=42&firstMine=1`);
    await expect(page.locator('#game')).toHaveAttribute('data-state','MENU');expect(await page.evaluate(()=>window.spaceRunner)).toBeUndefined();
    expect(requests.length).toBe(6);expect(requests.some(r=>r.includes('space-mine'))).toBe(false);await expect(page.locator('#moving-mine-info')).toHaveCount(0);page.off('request',listener);
  }
});
