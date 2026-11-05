import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {IntegratedModel} from '../src/integrated/model.ts';
import {certifiedInput} from '../tests/fixtures/fragment-flight.ts';
import {IntegratedModel as Old} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/integrated/model.ts';
const steer=(m,p)=>({x:Math.max(-1,Math.min(1,(p.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(p.y-m.ship.y)*2.6-m.ship.vy*.8))});
const rows=[];
for(const kind of ['lower-near-miss','left-wing-hit','right-wing-hit','pickup-body','pickup-wing','pickup-deliberate-miss','pickup-phase2']){
 let found;
 for(let seed=0;seed<48&&!found;seed++){
  const old=new Old(),next=new IntegratedModel();for(const m of [old,next]){m.ready();m.start(seed)}
  const inputs=[];let target,selected,firstEvent=0,initialCounts;
  for(let tick=0;tick<(kind==='pickup-phase2'?6000:3000)&&old.state==='PLAYING'&&next.state==='PLAYING';tick++){
   if(tick%2===0){old.beginPlanningFrame();next.beginPlanningFrame();}
   if(!target){
    if(kind.startsWith('pickup')&&(kind!=='pickup-phase2'||old.distance>=500)){
     const a=old.fragments.active.find(p=>next.fragments.active.some(q=>p.id===q.id&&p.x===q.x&&p.y===q.y));
     if(a){const wing=kind==='pickup-wing',offset=kind==='pickup-deliberate-miss'?1.2:1.06;
      const p={x:a.x-(wing?1.08+.91:0),y:a.y-(wing?-.35:offset)};
      if(Math.abs(p.x)<5.5&&Math.abs(p.y)<3.1){target=p;selected={...a};initialCounts=[old.fragments.count,next.fragments.count];}
     }
    }else if(!kind.startsWith('pickup')){
     const sign=kind==='left-wing-hit'?-1:1;
     for(const h of old.field.slots){if(!h.planned||h.kind!==0||h.z> -40)continue;const q=next.field.slots.find(q=>q.planned?.id===h.planned.id);if(!q||JSON.stringify(q.planned)!==JSON.stringify(h.planned))continue;
      const p={x:h.x-sign*(1.08+(kind==='lower-near-miss'?0:.35)),y:h.y+.35+(kind==='lower-near-miss'?h.radius+.22:0)};
      if(Math.abs(p.x)<5.5&&Math.abs(p.y)<3.1){target=p;selected={...h.planned};break;}
     }
    }
   }
   const input=target?steer(old,target):kind==='pickup-phase2'?certifiedInput(old):{x:0,y:0};inputs.push(input);old.step(1/120,input);next.step(1/120,input);
   if(tick%2===1){old.finishPlanningFrame(1/60);next.finishPlanningFrame(1/60);}
   if(!selected)continue;
   const pass=selected.passDistance;
   if(kind==='lower-near-miss'&&old.lastShipContact?.id===selected.id&&old.lastShipContact.bodyClear&&!next.hitSerial&&next.distance>pass+3){
    const e=old.lastShipContact,p=next.field.slots.find(q=>q.planned?.id===selected.id);
    if(p&&Math.abs(next.ship.vx)<.3&&Math.abs(next.ship.vy)<.3)found={name:kind,seed,inputs,selected,target,tick:inputs.length,captureTick:firstEvent||inputs.length-12,old:{hull:old.hull,contact:e,ship:{...old.ship}},next:{hull:next.hull,contact:next.lastShipContact,ship:{...next.ship}}};
   }
   if(kind.endsWith('wing-hit')&&next.lastShipContact?.id===selected.id&&next.lastShipContact.bodyClear&&next.lastShipContact.part===kind.slice(0,-4))found={name:kind,seed,inputs,selected,target,tick:inputs.length,captureTick:inputs.length,old:{hull:old.hull,contact:old.lastShipContact},next:{hull:next.hull,contact:next.lastShipContact}};
   if(kind==='lower-near-miss'&&old.lastShipContact?.id===selected.id&&!firstEvent)firstEvent=inputs.length;
   if(kind.startsWith('pickup')&&old.distance>pass+4){
    const expected=kind==='pickup-deliberate-miss'?0:1;
    if(next.fragments.count===initialCounts[1]+expected&&old.fragments.count===initialCounts[0]&&old.hull===3&&next.hull===3)found={name:kind,seed,inputs,selected,target,tick:inputs.length,captureTick:next.fragments.lastPickup.elapsed>0?Math.round(next.fragments.lastPickup.elapsed*120):inputs.length-12,old:{count:old.fragments.count,hull:old.hull},next:{count:next.fragments.count,hull:next.hull,pickup:next.fragments.lastPickup}};
    break;
   }
   if(found||next.distance>pass+6||next.hitSerial||old.hitSerial&&kind!=='lower-near-miss')break;
  }
  old.dispose();next.dispose();
 }
 if(found){rows.push(found);console.log(kind,found.seed,found.tick,found.next);}else console.log('NOT FOUND',kind);
}
await writeFile('.cache/review/GAMEPLAY-005B2/final/polish-scenarios.json',JSON.stringify(rows));assert.ok(rows.some(r=>r.name==='lower-near-miss'));assert.ok(rows.some(r=>r.name==='left-wing-hit'));assert.ok(rows.some(r=>r.name==='right-wing-hit'));
