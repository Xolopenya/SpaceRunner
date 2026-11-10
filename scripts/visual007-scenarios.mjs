import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {IntegratedModel} from '../src/integrated/model.ts';
import {fragmentInput} from '../tests/fixtures/fragment-flight.ts';
import {isWreck, wreckProfile} from '../src/experiments/structure-variants/profile.ts';
const dir='.cache/review/VISUAL-007A';await mkdir(dir,{recursive:true});
const tapes=[];
for(const seed of [42,0,11]){
 const m=new IntegratedModel();m.ready();m.start(seed);const inputs=[],shots=[];let lastPhase;
 for(let t=0;t<14000&&m.state==='PLAYING';t++){
  if(t%2===0)m.beginPlanningFrame();const input=fragmentInput(m,m.fragments.active[0]);inputs.push({...input});m.step(1/120,input);if(t%2===1)m.finishPlanningFrame(1/60);
  assert.equal(m.field.fault,undefined);
  const add=(name,yes)=>{if(yes&&!shots.some(s=>s.name===name))shots.push({name,tick:t+1,distance:m.distance,hull:m.hull,count:m.fragments.count});};
  const mine=m.field.slots.find(h=>h.active&&h.kind===9),phase=m.homing.current?.phase;
  add('mine-idle',mine&&phase==='waiting'&&mine.z> -105);
  add('mine-warning',mine&&phase==='warning');add('mine-pursuit',mine&&phase==='pursuit'&&phase===lastPhase&&mine.z> -32);lastPhase=phase;
  add('mine-close',mine&&(phase==='pursuit'||phase==='coast')&&mine.z> -7&&mine.z< -5);
  const station=m.field.slots.find(h=>h.active&&isWreck(h)&&h.z> -36&&h.z< -28);
  add('structure-approach',station);
  add('structure-asteroids',station&&m.field.slots.some(h=>h.active&&h.kind<4&&h.z> -60&&h.z< -8));
  add('structure-collectible',station&&m.fragments.active.some(p=>p.passDistance-m.distance<65));
  const through=m.field.slots.find(h=>h.active&&isWreck(h)&&Math.abs(h.z)<.3&&Math.abs(m.ship.x-wreckProfile(h).aperture.x)<1.7&&Math.abs(m.ship.y-wreckProfile(h).aperture.y)<1.6);
  add('aperture-passage',through);
 }
 console.log(seed,inputs.length,m.hull,shots);
 if(seed===42){
   tapes.push({name:'integrated-flight',seed,inputs,startTick:0,endTick:inputs.length,shots:[]});
 }
 for(const [name,names] of [['mine-flight',['mine-idle','mine-warning','mine-pursuit','mine-close']],['station-flight',['structure-approach','aperture-passage']],['mixed-flight',['structure-asteroids','structure-collectible']]]){
  if(tapes.some(t=>t.name===name))continue;
  const selected=shots.filter(s=>names.includes(s.name)).sort((a,b)=>a.tick-b.tick);
  if(selected.length===names.length)tapes.push({name,seed,inputs,startTick:Math.max(0,selected[0].tick-120),endTick:Math.min(inputs.length,selected.at(-1).tick+180),shots:selected});
 }
 m.dispose();if(tapes.length===4)break;
}
assert.equal(tapes.length,4,'All required naturally admitted scenes must be found');
// Full input tape is retained for matched performance; its video is a short clean excerpt.
const flight=tapes[0];flight.startTick=2400;flight.endTick=3000;flight.shots=[{name:'integrated-flight',tick:2700}];
await writeFile(`${dir}/scenarios.json`,JSON.stringify(tapes,null,2));
