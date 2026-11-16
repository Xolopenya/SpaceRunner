import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {IntegratedModel} from '../src/integrated/model.ts';
import {trailScheduled} from '../src/collectibles/trails.ts';
import {certifiedInput} from '../tests/fixtures/fragment-flight.ts';
const root=resolve('.cache/review/FEEDBACK-001C2');await mkdir(root,{recursive:true});
function replay(seed,partial=false,typical=false,search=false){
 const m=new IntegratedModel();m.ready();m.start(seed);const inputs=[],shots=[],events=[];let trail,pattern,points,locked=false,tick=0,foundAt;
 m.events.subscribe(e=>{if(e.type==='collectible.collected'){events.push({tick,...e.payload});if(partial&&e.payload.itemId.startsWith(trail+'/trail/'))locked=true;}});
 while(tick<7200&&m.state==='PLAYING'){
  if(tick%2===0)m.beginPlanningFrame();const active=m.fragments.active.slice().sort((a,b)=>a.passDistance-b.passDistance),p=active[0];
  if(!trail&&p?.trail){trail=p.trail;pattern=p.pattern;points=active.filter(a=>a.trail===trail);foundAt=tick;}
  let input=certifiedInput(m);
  if(p&&p.passDistance-m.distance<Math.max(55,m.speed*2.4)){const goal=p.approach??p;input={x:Math.max(-1,Math.min(1,(goal.x-m.ship.x)*2.6-m.ship.vx*.8)),y:Math.max(-1,Math.min(1,(goal.y-m.ship.y)*2.6-m.ship.vy*.8))};}
  if(locked)input={x:0,y:0};inputs.push({...input});m.step(1/120,input);tick++;if(tick%2===0){m.events.flush();m.finishPlanningFrame(1/60);}
  if(trail){for(const depth of [80,45,22,6])if(points[0].passDistance-m.distance<depth&&!shots.some(s=>s.name==='depth-'+depth))shots.push({name:'depth-'+depth,tick});
   for(const e of events.filter(e=>e.itemId.startsWith(trail+'/trail/')))if(!shots.some(s=>s.name===e.itemId))shots.push({name:e.itemId,tick:e.tick});
   if(!typical&&m.distance>points.at(-1).passDistance+10)break;
  }
  if(search&&!trail&&m.fragments.stats.groups>0&&!m.fragments.active.some(p=>p.trail))break;
 }
 if(trail)shots.push({name:'after',tick});
 const out={name:typical?'typical':`${pattern}-${partial?'partial':'complete'}`,seed,partial,pattern,trail,points,foundAt,inputs,shots,endTick:tick,
  count:m.fragments.count,hull:m.hull,events,stats:{...m.fragments.stats},fault:m.field.fault,method:'Original IntegratedModel, fixed120Hz/two steps per planning frame, bounded steering only. No positions/HP/hazards/camera edits. Simulated pilot, not a human usability result.'};m.dispose();return out;
}
const selected=[],attempts=[],patterns=new Set();
for(let seed=0;seed<1024&&patterns.size<3;seed++){
 if(!trailScheduled(seed,0))continue;const run=replay(seed,false,false,true);attempts.push({seed,pattern:run.pattern,count:run.count,hull:run.hull,stats:run.stats});
 if(run.pattern&&!patterns.has(run.pattern)&&run.events.filter(e=>e.itemId.startsWith(run.trail+'/trail/')).length===3&&run.hull>0){selected.push(run);patterns.add(run.pattern);console.log('found',run.pattern,seed,run.endTick,run.hull);}
}
await writeFile(resolve(root,'scenario-search.json'),JSON.stringify(attempts,null,2));
if(patterns.size!==3)throw Error('No natural complete example for every trail pattern');
const curve=selected.find(r=>r.pattern==='curve');selected.push(replay(curve.seed,true),replay(curve.seed,false,true));
await writeFile(resolve(root,'scenario-inputs.json'),JSON.stringify({method:'Natural seed search; only first-group scheduled seeds considered, all attempted receipts retained. Chosen complete examples use actual bounded gameplay input. Partial deliberately stops steering after its first trail pickup.',attempts,scenarios:selected},null,2));
console.log('scenarios',selected.map(s=>({name:s.name,seed:s.seed,count:s.count,HP:s.hull,trailPickups:s.events.filter(e=>e.itemId.startsWith(s.trail+'/trail/')).length})));
