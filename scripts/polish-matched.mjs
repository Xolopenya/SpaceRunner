import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {IntegratedModel,INTEGRATED_GEOMETRY} from '../src/integrated/model.ts';import {IntegratedModel as Old} from '../.cache/review/GAMEPLAY-005B2/baseline-project/src/integrated/model.ts';import {certifiedInput} from '../tests/fixtures/fragment-flight.ts';import {beginTrajectoryReplay} from '../src/core/field-validator.ts';
const rows=[];let replays=0;
for(const seed of [0,1,7,11,16,20,42,99]){
 const inputs=[],results=[];
 for(const source of ['baseline','final']){
  const m=new (source==='baseline'?Old:IntegratedModel)();m.ready();m.start(seed);let last,serial=0;const decisions=[],hits=[];
  for(let tick=0;m.state==='PLAYING'&&m.distance<2500;tick++){
   if(source==='final'&&tick>=inputs.length)break;if(tick%2===0)m.beginPlanningFrame();const input=source==='baseline'?certifiedInput(m):inputs[tick];if(source==='baseline')inputs.push({...input});m.step(1/120,input);if(tick%2===1)m.finishPlanningFrame(1/60);assert.equal(m.field.fault,undefined);
   if(m.hitSerial!==serial){serial=m.hitSerial;hits.push({tick:tick+1,distance:m.distance,ship:{...m.ship},contact:m.lastShipContact,liveCertificate:m.field.certificate?.hash})}
   const o=m.field.lastOutcome;if(!o||o===last)continue;last=o;
   if(source==='final'&&o.witness){const j=beginTrajectoryReplay(o.witness.context,o.witness.controls,{geometry:INTEGRATED_GEOMETRY});while(!j.getResult())j.advance();assert.equal(j.getResult().decision,'accept');assert.equal(j.getResult().witness.hash,o.witness.hash);replays++}
   decisions.push({tick:tick+1,distance:m.distance,elapsed:m.elapsed,status:o.status,family:o.section.encounter,reason:o.reason,transaction:o.transaction,metrics:o.metrics,witness:o.witness?.hash});
  }
  let chain=0,maxOmissions=0;for(const d of decisions){chain=d.status==='committed'?0:chain+1;maxOmissions=Math.max(chain,maxOmissions)}
  const pub=decisions.filter(d=>d.status==='committed');results.push({source,distance:m.distance,hull:m.hull,hits,committed:m.field.committed,omitted:m.field.omitted,maxOmissions,maxTimeBetweenPublications:Math.max(0,...pub.slice(1).map((d,i)=>d.elapsed-pub[i].elapsed)),mines:pub.filter(d=>d.transaction?.hazards.some(h=>h.kind===9)).length,stations:pub.filter(d=>d.transaction?.hazards.some(h=>h.kind>=4&&h.kind<=8)).length,fragments:{...m.fragments.stats},work:m.field.samples,decisions});m.dispose();
 }
 const [a,b]=results;const key=d=>JSON.stringify([d?.status,d?.transaction]);const index=a.decisions.findIndex((d,i)=>key(d)!==key(b.decisions[i]));rows.push({seed,inputTicks:inputs.length,results,firstPublicationDifference:index<0?null:{index,before:a.decisions[index],after:b.decisions[index]},interpretation:'Old steering is identical; final accepted witness steering is not followed. Any later contact is checked against its new actual field, not classified as a failed new witness.'});console.log(seed,'hull',b.hull,'first publication difference',index,'hit',b.hits[0]?.contact?.id);
}
await writeFile('.cache/review/GAMEPLAY-005B2/final/matched-publication.json',JSON.stringify({rows,replays},null,2));console.log('Matched new witnesses replayed:',replays);
