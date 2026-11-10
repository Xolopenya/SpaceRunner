import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {IntegratedModel} from '../src/integrated/model.ts';
import {certifiedInput,fragmentInput} from '../tests/fixtures/fragment-flight.ts';
import {isWreck,APERTURE_NAMES} from '../src/experiments/structure-variants/profile.ts';
const dir='.cache/review/VISUAL-007B';await mkdir(dir,{recursive:true});
const tapes=[],variants=new Set();let coexist;
const steer=(m,p)=>({x:Math.max(-1,Math.min(1,(p.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(p.y-m.ship.y)*2.6-m.ship.vy*.8))});
for(const seed of [42,0,11,1,7]){
 const m=new IntegratedModel();m.ready();m.start(seed);const inputs=[],events=new Map(),extras=[];let lastCount=0;
 for(let t=0;t<26000&&m.state==='PLAYING';t++){
  if(t%2===0)m.beginPlanningFrame();const input=certifiedInput(m);inputs.push({...input});m.step(1/120,input);if(t%2===1)m.finishPlanningFrame(1/60);assert.equal(m.field.fault,undefined);
  for(const h of m.field.slots)if(h.active&&isWreck(h)&&!variants.has(h.kind)){
   let e=events.get(h.planned.id);if(!e){e={kind:h.kind,shots:[]};events.set(h.planned.id,e);}
   const name=APERTURE_NAMES[h.kind-4],add=(stage,yes,mobile=false)=>{if(yes&&!e.shots.some(s=>s.name===`station-${name}-${stage}`))e.shots.push({name:`station-${name}-${stage}`,tick:t+1,mobile});};
   add('haze',h.z> -205&&h.z< -150);add('distant',h.z> -95&&h.z< -90);add('approach',h.z> -36&&h.z< -30);add('close',h.z> -11&&h.z< -8);add('passage',Math.abs(h.z)<.25,true);
   if(['distant','approach','close','passage'].every(stage=>e.shots.some(s=>s.name===`station-${name}-${stage}`))){variants.add(h.kind);e.complete=true;console.log('station',seed,name,t+1,m.hull);}
  }
  const mine=m.field.slots.find(h=>h.active&&h.kind===9&&h.z< -5&&h.z> -110),fragment=m.fragments.active.find(p=>p.passDistance-m.distance>5&&p.passDistance-m.distance<90);
  if(!coexist&&mine&&fragment)coexist={seed,inputs,shots:[{name:'mine-and-fragment',tick:t+1}],tick:t+1};
  if(seed===42&&m.fragments.count!==lastCount&&m.distance>500&&extras.length===0){extras.push({name:'phase2-pickup',tick:t+1});}lastCount=m.fragments.count;
  if(variants.size===5&&t>14000)break;
 }
 for(const e of events.values())if(e.complete)tapes.push({name:`station-${APERTURE_NAMES[e.kind-4]}`,seed,inputs,startTick:Math.max(0,e.shots[0].tick-30),endTick:e.shots.at(-1).tick+30,shots:e.shots,video:e.kind===4||e.kind===8});
 if(seed===42){tapes.push({name:'performance',seed,inputs,startTick:2400,endTick:3000,shots:[]});}
 m.dispose();if(variants.size===5)break;
}
assert.equal(variants.size,5);
for(const part of ['body','left-wing','right-wing','phase2']){
 let found=false;
 for(const seed of [0,42,11,1,7,16]){
  const m=new IntegratedModel();m.ready();m.start(seed);const inputs=[],shots=[];let target,pickupTick,initialCount=0;
  for(let t=0;t<14000&&m.state==='PLAYING';t++){
   if(t%2===0)m.beginPlanningFrame();
   if(!target&&(part!=='phase2'||m.distance>500)){target=m.fragments.active[0];initialCount=m.fragments.count;}
   const sign=part==='left-wing'?-1:part==='right-wing'?1:0;
   const goal=target?{x:target.x-sign*1.99,y:target.y+(sign?.30:0)}:undefined;
   const input=goal?steer(m,goal):certifiedInput(m);inputs.push({...input});m.step(1/120,input);if(t%2===1)m.finishPlanningFrame(1/60);assert.equal(m.field.fault,undefined);
   if(target){const depth=target.passDistance-m.distance;const add=(name,yes,mobile=false)=>{if(yes&&!shots.some(s=>s.name===name))shots.push({name,tick:t+1,mobile});};
    add(`${part}-fragment-distant`,depth<55&&depth>50);
    add(`${part}-fragment-close`,depth<9&&depth>7,true);
    add(`${part}-fragment-inspect`,depth<3&&depth>2);
    add(`${part}-fragment-debris`,depth<28&&depth>12&&m.field.slots.some(h=>h.active&&h.kind<4&&h.z> -50&&h.z< -3));
    if(m.fragments.count>initialCount&&!pickupTick){if(part!=='phase2'&&m.fragments.lastPickup.part!==part)break;pickupTick=t+1;add(`${part}-pickup`,true);}
    add(`${part}-magnet`,pickupTick&&t+1===pickupTick+6);add(`${part}-after-pickup`,pickupTick&&t+1===pickupTick+22);
    if(pickupTick&&t+1>=pickupTick+30){found=true;break;}
    if(!pickupTick&&depth< -6)break;
   }
  }
  if(found){tapes.push({name:`pickup-${part}`,seed,inputs,startTick:Math.max(0,shots[0].tick-30),endTick:inputs.length,shots,video:part==='phase2'||part==='body'});console.log('pickup',part,seed,m.fragments.lastPickup);m.dispose();break;}m.dispose();
 }
 assert.ok(found,`Natural ${part} pickup required`);
}
if(coexist)tapes.push({name:'mine-and-fragment',seed:coexist.seed,inputs:coexist.inputs,startTick:coexist.tick,endTick:coexist.tick,shots:coexist.shots});
await writeFile(`${dir}/scenarios.json`,JSON.stringify(tapes,null,2));
console.log('scenarios',tapes.length,'mine coexistence',!!coexist);
