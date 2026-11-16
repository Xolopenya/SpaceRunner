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

test('real wing pickup keeps exact guidance depth and gameplay through ON/OFF, resize, pause and restart',async({page})=>{
 await open(page);
 const result=await page.evaluate(()=>{
  const g=window.spaceRunner! as any,m=g.model,guide=g.world.guidance;let tick=0,target,seen=0;
  while(m.fragments.count===0&&tick<2400&&m.state==='PLAYING') {
   if(tick%2===0)m.beginPlanningFrame();target??=m.fragments.active[0];
   let input={x:0,y:0};
   if(target){input={x:Math.max(-1,Math.min(1,(target.x-1.99-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(target.y+.30-m.ship.y)*2.6-m.ship.vy*.8))};}
   else {const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0;for(const c of w?.controls??[]){if(at<c.ticks){input=c.input;break;}at-=c.ticks;}}
   m.step(1/120,input);if(++tick%2===0){g.loop.render(1/60);
    if(guide.diagnostics.target){const p=m.fragments.slots.find((s:any)=>s.proposal?.id===guide.diagnostics.target)?.proposal;if(p){if(Math.abs(guide.marker.mesh.position.z-(m.distance-p.passDistance))>1e-7)throw Error('Wrong marker depth');seen++;}}
    const before=JSON.stringify({ship:m.ship,distance:m.distance,hp:m.hull,fragments:m.fragments.slots,count:m.fragments.count});
    guide.enabled=false;g.loop.render(0);guide.enabled=true;g.loop.render(0);
    if(JSON.stringify({ship:m.ship,distance:m.distance,hp:m.hull,fragments:m.fragments.slots,count:m.fragments.count})!==before)throw Error('Guidance changed gameplay');
   }
  }
  m.pause();g.loop.render(0);const bytes=Array.from(guide.beam.geometry.getAttribute('position').array);for(let n=0;n<10;n++)g.loop.render(1/60);
  return{count:m.fragments.count,part:m.fragments.lastPickup.part,seen,frozen:JSON.stringify(bytes)===JSON.stringify(Array.from(guide.beam.geometry.getAttribute('position').array)),fault:m.field.fault};
 });
 expect(result.count).toBe(1);expect(result.part).toBe('right-wing');expect(result.seen).toBeGreaterThan(10);expect(result.frozen).toBe(true);expect(result.fault).toBeUndefined();
 await page.setViewportSize({width:390,height:844});
 await page.locator('#restart-pause').click();await page.evaluate(()=> (window.spaceRunner as any).loop.render(0));
 expect(await page.evaluate(()=> (window.spaceRunner as any).world.guidance.diagnostics.target)).toBeUndefined();
 await page.setViewportSize({width:844,height:390});
 await expect.poll(()=>page.evaluate(()=>{(window.spaceRunner as any).loop.render(0);const c=document.querySelector('canvas')!;return{resolution:(window.spaceRunner as any).world.guidance.beam.material.uniforms.resolution.value.toArray(),canvas:[c.clientWidth,c.clientHeight]};})).toEqual({resolution:[780,390],canvas:[780,390]});
});
