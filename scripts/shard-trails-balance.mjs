import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {certifiedInput,fragmentInput} from '../tests/fixtures/fragment-flight.ts';
const root=resolve('.cache/review/FEEDBACK-001C2');await mkdir(root,{recursive:true});
const mode=process.argv[2]??'baseline',seconds=Number(process.argv[3]??180),source=mode==='baseline'?resolve(root,'baseline-source/src/integrated/model.ts'):resolve('src/integrated/model.ts');
const {IntegratedModel}=await import(pathToFileURL(source).href),rows=[],passive=process.argv[4]==='passive';
for(const seed of [0,7,11,42])for(const policy of passive?['passive']:['certificate','pursuit']){
 const m=new IntegratedModel();m.ready();m.start(seed);const seen=new Map(),inputs=[],events=[];
 m.events.subscribe(e=>{if(e.type==='collectible.collected')events.push(e);});
 for(let tick=0;tick<seconds*120&&m.state==='PLAYING';tick++){
  if(tick%2===0)m.beginPlanningFrame();const active=m.fragments.active;
  const target=active.slice().sort((a,b)=>a.passDistance-b.passDistance)[0];
  const input=policy==='passive'?{x:0,y:0}:policy==='pursuit'?fragmentInput(m,target):certifiedInput(m);inputs.push({...input});m.step(1/120,input);if(tick%2===1){m.events.flush();m.finishPlanningFrame(1/60);}
  for(const p of m.fragments.active)if(!seen.has(p.id))seen.set(p.id,{...p,publishedAt:m.elapsed,publishedDistance:m.distance,leadSeconds:(p.passDistance-m.distance)/m.speed,conservativeLeadSeconds:(p.passDistance-m.distance)/36.72,correction:Math.hypot((p.approach??p).x-m.ship.x,(p.approach??p).y-m.ship.y)});
 }
 const row={seed,policy,seconds:m.elapsed,distance:m.distance,hull:m.hull,count:m.fragments.count,stats:{...m.fragments.stats},active:m.fragments.active.length,placements:[...seen.values()],events,inputs,hazardsHash:createHash('sha256').update(JSON.stringify(m.field.events)).digest('hex'),fault:m.field.fault};rows.push(row);
 console.log(mode,seed,policy,'seconds',m.elapsed.toFixed(1),'opps',row.stats.opportunities,'placed',row.stats.placed,'count',row.count,'HP',row.hull);m.dispose();
}
await writeFile(resolve(root,`${passive?'passive-':''}${mode}-balance.json`),JSON.stringify({method:`Four seeds, simulated ${passive?'zero-input control':'certificate and pursuit'} policies,${seconds}s maximum per live run, fixed120Hz/2steps per planning frame. No human satisfaction/rate inference. Each pursuit reacts to that version; certificate policy has identical inputs and hazard hashes in both versions.`,mode,rows},null,2));
