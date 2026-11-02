import {writeFile} from 'node:fs/promises';
import {ReleaseModel} from '../src/release/model.ts';
const rows=[];
for(const seed of [0,11,42])for(const phase of [1,2])for(const mode of ['neutral','left','right','off-center']){
 const m=new ReleaseModel();m.ready();m.start(seed);
 if(phase===2)while(m.distance<600&&m.state==='PLAYING'){
  const w=m.field.certificate;let tick=w?Math.round((m.elapsed-w.context.elapsed)*120):0,axis={x:0,y:0};
  for(const r of w?.controls??[]){if(tick<r.ticks){axis=r.input;break;}tick-=r.ticks;}m.step(1/120,axis);
 }
 const start=m.elapsed,committed=m.field.committed,omitted=m.field.omitted;let blank=0,maxBlank=0,last,events=[];
 while(m.elapsed-start<45&&m.state==='PLAYING'){
  const x=mode==='left'?-1:mode==='right'?1:mode==='off-center'&&m.elapsed-start<.6?.7:0;
  m.step(1/120,{x,y:0});
  if(m.distance>150&&!m.field.slots.some(h=>h.active)){blank+=1/120;maxBlank=Math.max(maxBlank,blank);}else blank=0;
  if(m.field.lastOutcome!==last){last=m.field.lastOutcome;if(last)events.push({status:last.status,reason:last.reason,attempts:last.attempts.map(a=>a.reason),family:last.section.family});}
 }
 rows.push({seed,phase,mode,elapsed:m.elapsed-start,distance:m.distance,hull:m.hull,x:m.ship.x,y:m.ship.y,committed:m.field.committed-committed,omitted:m.field.omitted-omitted,maxBlank,events,fault:m.field.fault??null});m.dispose();
}
await writeFile(process.argv[2]??'.cache/hotfix-assignment-002/passive.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(({events,...r})=>r),null,2));
