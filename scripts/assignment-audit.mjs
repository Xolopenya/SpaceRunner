import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ReleaseModel,RELEASE_GEOMETRY} from '../src/release/model.ts';
import {beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {FLOW_GEOMETRY} from '../src/experiments/mixed-flow/source.ts';
const rows=[];let audits=0;
for(const seed of [0,11,42]){
 const m=new ReleaseModel();m.ready();m.start(seed);let last;const events=[];let transition;
 while(m.elapsed<180&&m.state==='PLAYING'){
  const w=m.field.certificate;let at=w?Math.round((m.elapsed-w.context.elapsed)*120):0,input={x:0,y:0};for(const c of w?.controls??[]){if(at<c.ticks){input=c.input;break;}at-=c.ticks;}
  const before={distance:m.distance,speed:m.speed,phase:m.phase};m.step(1/120,input);assert.equal(m.field.fault,undefined);
  if(!transition&&m.phase===2){transition={before,after:{distance:m.distance,speed:m.speed},elapsed:m.elapsed};m.pause();const d=m.distance;m.step(1/120,{x:1,y:0});assert.equal(m.distance,d);assert.equal(m.phase,2);m.resume();}
  const o=m.field.lastOutcome;if(o&&o!==last){last=o;if(o.witness){const j=beginTrajectoryReplay(o.witness.context,o.witness.controls,{geometry:RELEASE_GEOMETRY});while(!j.getResult())j.advance();assert.equal(j.getResult().decision,'accept');audits++;}events.push({distance:m.distance,status:o.status,encounter:o.section.encounter,aperture:o.section.aperture,metrics:o.metrics});}
 }
 assert.equal(m.hull,3);assert.ok(m.elapsed>=180);assert.ok(transition);const band=(a,b)=>{const e=events.filter(e=>e.distance>=a&&e.distance<b);return{published:e.filter(e=>e.status==='committed').length,omitted:e.filter(e=>e.status!=='committed').length};};rows.push({seed,elapsed:m.elapsed,distance:m.distance,hull:m.hull,transition,phase1:band(100,500),phase2:band(600,1000),events});m.state='GAME_OVER';m.start(seed);assert.equal(m.phase,1);m.dispose();console.log(seed,'passed');
}
await mkdir('.cache/review/ASSIGNMENT-002',{recursive:true});await writeFile((process.env.REVIEW_RESULT_DIR??'.cache/review/ASSIGNMENT-002')+'/audit.json',JSON.stringify({rows,audits},null,2));
