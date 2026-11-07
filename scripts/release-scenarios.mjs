import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {IntegratedModel} from '../src/integrated/model.ts';
import {certifiedInput,fragmentInput} from '../tests/fixtures/fragment-flight.ts';
const directory=process.env.REVIEW_RESULT_DIR??'.cache/review/RELEASE-007/final';await mkdir(directory,{recursive:true});
const rows=[],steer=(m,p)=>({x:Math.max(-1,Math.min(1,(p.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(p.y-m.ship.y)*2.6-m.ship.vy*.8))});
for(const name of ['left-wing-hit','right-wing-hit','pickup-wing','pickup-phase2','clean-integrated','natural-game-over']){
 let found;
 for(const seed of [0,42,11,1,7,16,20,99]){
  const m=new IntegratedModel();m.ready();m.start(seed);const inputs=[],events=[];let target,selected,lastHit=0,lastCount=0,captureTick;
  for(let t=0;t<14000&&m.state==='PLAYING';t++){
   if(t%2===0)m.beginPlanningFrame();
   if(!target&&name.endsWith('wing-hit')){const sign=name.startsWith('left')?-1:1;for(const h of m.field.slots)if(h.planned&&h.kind===0&&h.z< -40){const p={x:h.x-sign*1.43,y:h.y+.35};if(Math.abs(p.x)<5.5&&Math.abs(p.y)<3.1){target=p;selected=h.planned;break}}}
   if(!target&&name.startsWith('pickup')&&(name!=='pickup-phase2'||m.distance>=500)){for(const p of m.fragments.active){const wing=name==='pickup-wing',goal={x:p.x-(wing?1.99:0),y:p.y-(wing?-.30:1.06)};if(Math.abs(goal.x)<5.5&&Math.abs(goal.y)<3.1){target=goal;selected=p;break}}}
   const input=target?steer(m,target):name==='clean-integrated'?fragmentInput(m,m.fragments.active[0]):name==='natural-game-over'?{x:0,y:0}:name==='pickup-phase2'?certifiedInput(m):{x:0,y:0};inputs.push({...input});m.step(1/120,input);if(t%2===1)m.finishPlanningFrame(1/60);
   assert.equal(m.field.fault,undefined);
   if(m.hitSerial!==lastHit){lastHit=m.hitSerial;events.push({tick:t+1,kind:'damage',contact:m.lastShipContact,hull:m.hull,distance:m.distance});}
   if(m.fragments.count!==lastCount){lastCount=m.fragments.count;events.push({tick:t+1,kind:'pickup',pickup:m.fragments.lastPickup,count:m.fragments.count,distance:m.distance});}
   if(name==='clean-integrated'){
    const once=(kind,yes)=>{if(yes&&!events.some(e=>e.kind===kind))events.push({tick:t+1,kind,distance:m.distance});};
    once('mine',m.homing.current?.phase==='warning');once('station',m.field.slots.some(h=>h.active&&h.kind>=4&&h.kind<=8&&h.z< -20&&h.z> -30));once('phase2',m.phase===2);
   }
   if(name.endsWith('wing-hit')&&selected&&m.lastShipContact?.id===selected.id&&m.lastShipContact.bodyClear&&m.lastShipContact.part===name.slice(0,-4)){captureTick=t+1;found=true;break;}
   if(name.startsWith('pickup')&&m.fragments.count>0&&(!name.endsWith('phase2')||m.distance>=500)&&(!name.endsWith('wing')||m.fragments.lastPickup.part!=='body')){captureTick=t+1;found=true;break;}
   if(name==='clean-integrated'&&m.distance>=1500&&m.fragments.count>0){captureTick=t+1;found=true;break;}
   if(name==='natural-game-over'&&m.state==='GAME_OVER'){captureTick=t+1;found=true;break;}
   if(selected&&m.distance>selected.passDistance+6||m.hitSerial&&name.startsWith('pickup'))break;
  }
  if(found){rows.push({name,seed,inputs,events,captureTick,selected,final:{distance:m.distance,hull:m.hull,phase:m.phase,count:m.fragments.count,state:m.state}});console.log(name,seed,inputs.length,rows.at(-1).final);m.dispose();break;}m.dispose();
 }
 assert.ok(found,`No natural accepted scenario: ${name}`);
}
await writeFile(`${directory}/release-scenarios.json`,JSON.stringify(rows,null,2));
