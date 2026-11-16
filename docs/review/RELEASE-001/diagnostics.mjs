import {writeFile} from 'node:fs/promises';
import {IntegratedModel} from '../../../src/integrated/model.ts';
const rows=[];
for(const seed of [0,11,42,99,123,2026]){
 const m=new IntegratedModel();m.ready();m.start(seed);
 const publications=[],samples=[];let last,emptyAt,maxEmpty={seconds:0};
 for(let tick=0;m.state==='PLAYING'&&m.elapsed<180;tick++){
  if(tick%2===0)m.beginPlanningFrame();
  m.step(1/120,{x:0,y:0});m.events.flush();
  if(tick%2===1)m.finishPlanningFrame(1/60);
  const o=m.field.lastOutcome;
  if(o&&o!==last){last=o;publications.push({elapsed:m.elapsed,distance:m.distance,status:o.status,reason:o.reason,encounter:o.section.encounter,firstCell:o.section.firstCell,hazards:o.transaction?.hazards.map(h=>({kind:h.kind,x:h.x,y:h.y,passDistance:h.passDistance}))});}
  // Model-space forward band, NOT a camera/frustum or human visibility test.
  const forward=m.field.slots.filter(h=>h.active&&h.kind<=2&&h.z<0&&h.z>=-100);
  if(m.elapsed>=5&&!forward.length)emptyAt??={elapsed:m.elapsed,distance:m.distance};
  if(emptyAt&&(forward.length||m.state!=='PLAYING')){const gap={seconds:m.elapsed-emptyAt.elapsed,from:emptyAt,to:{elapsed:m.elapsed,distance:m.distance}};if(gap.seconds>maxEmpty.seconds)maxEmpty=gap;emptyAt=undefined;}
  if(tick%120===0)samples.push({elapsed:m.elapsed,distance:m.distance,hull:m.hull,forwardAsteroids:forward.length,allActive:m.field.slots.filter(h=>h.active).length,scheduled:m.field.scheduled,committed:m.field.committed,omitted:m.field.omitted,fault:m.field.fault??null});
 }
 if(emptyAt){const gap={seconds:m.elapsed-emptyAt.elapsed,from:emptyAt,to:{elapsed:m.elapsed,distance:m.distance}};if(gap.seconds>maxEmpty.seconds)maxEmpty=gap;}
 const row={seed,final:{state:m.state,elapsed:m.elapsed,distance:m.distance,hull:m.hull,scheduled:m.field.scheduled,committed:m.field.committed,omitted:m.field.omitted,fault:m.field.fault??null},maxForwardAsteroidGap:maxEmpty,publications,samples};rows.push(row);m.dispose();console.log(seed,JSON.stringify(row.final),'max asteroid-free band seconds',maxEmpty.seconds);
}
await writeFile('.cache/review/RELEASE-001/diagnostics.json',JSON.stringify({method:'Six original IntegratedModel neutral flights at120Hz/two ticks per planning frame, to natural death or180s. No health, spawn, position, collision or gameplay modifications. kind0..2 are asteroid models; forward band -100<=z<0 is a model-space count, not rendered visibility or a guaranteed threat. Warm-up excluded before5s. Natural deaths limit observation duration; no universal generator-health or reproduction claim.',rows},null,2));
