import {test,expect} from '@playwright/test';

async function open(page:any) {
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};});
 await page.goto('/?debug=integrated&seed=0');await page.locator('#launch').click();
 await page.waitForFunction(()=>window.spaceRunner!.audio.status==='running');
 await page.evaluate(async()=>{await(window.spaceRunner!.audio as any).graph.samples.ready;});
}

test('eight optional samples decode once, material buffers/panning differ, volume and reset preserve ownership',async({page})=>{
 const requested:string[]=[];page.on('request',r=>{if(r.url().endsWith('.wav'))requested.push(r.url());});
 await open(page);
 const result=await page.evaluate(async()=>{
  const g=window.spaceRunner! as any,a=g.audio,graph=a.graph,bank=graph.samples;
  graph.clearVoices();
  const retained=[...bank.buffers.values()];graph.play('rock1',0,{gain:1,rate:1,pan:-.16});graph.play('metal1',0,{gain:1,rate:1,pan:.16});
  const voices=[...graph.voices] as any[],different=voices[0].source.buffer!==voices[1].source.buffer;
  const pans=voices.map(v=>v.panner.pan.value);
  a.setSettings({sfx:.34,music:.66});const until=performance.now()+5000;
  while(Math.abs(graph.sfxBus.gain.value-.34)>.000002||Math.abs(graph.musicBus.gain.value-.66)>.000002){if(performance.now()>until)throw Error('User gain did not settle');await new Promise(r=>setTimeout(r,25));}
  const gains=[graph.sfxBus.gain.value,graph.musicBus.gain.value];
  a.setSettings({muted:true});a.play('mine1');const cleared=graph.voices.size;a.setSettings({muted:false});
  for(let i=0;i<20;i++)a.resetRun();
  return{stats:{...bank.stats},different,pans,gains,cleared,same:retained.every((b,i)=>b===[...bank.buffers.values()][i]),voices:graph.voices.size};
 });
 expect(requested).toHaveLength(8);expect(result.stats.loaded).toBe(8);expect(result.stats.failed).toBe(0);expect(result.stats.bytes).toBe(212612);
 expect(result.different).toBe(true);expect(result.pans[0]).toBeCloseTo(-.16,5);expect(result.pans[1]).toBeCloseTo(.16,5);
 expect(result.gains[0]).toBeCloseTo(.34,5);expect(result.gains[1]).toBeCloseTo(.66,5);expect(result.same).toBe(true);expect(result.cleared).toBe(0);expect(result.voices).toBe(0);
 await page.evaluate(()=>window.spaceRunner!.dispose());
 await expect.poll(()=>page.evaluate(()=> (window.spaceRunner!.audio as any).context.state)).toBe('closed');
});

test('failed optional decoding retains immediate procedural hits and one fatal response',async({page})=>{
 await page.route('**/assets/collision-audio/*.wav',route=>route.fulfill({contentType:'audio/wav',body:'intentionally invalid optional sample fixture'}));
 await open(page);
 const result=await page.evaluate(()=>{
  const g=window.spaceRunner! as any,m=g.model,a=g.audio,graph=a.graph;
  // Controlled actual collision path, isolated from natural generation only in this fixture.
  m.field.update=()=>{};m.field.hazards.forEach((h:any)=>h.active=false);
  for(let hp=3;hp>0;hp--){m.invulnerability=0;Object.assign(m.field.hazards[0],{active:true,x:m.ship.x,y:m.ship.y,z:-.1,radius:1,kind:0});g.loop.update(1/120);g.loop.render(0);}
  return{failed:graph.samples.stats.failed,loaded:graph.samples.stats.loaded,status:a.status,hp:m.hull,impacts:graph.counts.impact,fatal:graph.counts.destruction,voices:graph.voices.size};
 });
 expect(result.failed).toBe(8);expect(result.loaded).toBe(0);expect(result.status).toBe('running');expect(result.hp).toBe(0);expect(result.impacts).toBe(2);expect(result.fatal).toBe(1);expect(result.voices).toBeLessThanOrEqual(6);
 await page.locator('#skip-destruction').click();await page.locator('#replay').click();await page.evaluate(()=> (window.spaceRunner as any).loop.render(0));
 await expect(page.locator('#hull')).toHaveAttribute('aria-valuenow','3');
});
