import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {beginResolvedRuntimeSearch,beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {ADAPTIVE_GEOMETRY,adaptiveTransaction} from '../src/experiments/adaptive-homing/transaction.ts';
const {ADAPTIVE_GEOMETRY:oldGeometry}=await import(pathToFileURL(resolve('.cache/review/GAMEPLAY-003C4-FIX2/baseline/src/experiments/adaptive-homing/transaction.ts')).href);
const rows=[],witnesses=[];
for(const preset of ['soft','balanced','aggressive'])for(const seed of [0,11,42])for(const elapsed of [1,121])for(const[x,y]of [[0,0],[-6,0],[6,0],[0,-3.6],[0,3.6],[-6,-3.6],[-6,3.6],[6,-3.6],[6,3.6]])for(const[vx,vy]of [[0,0],[-8,0],[8,0],[0,8],[0,-8],[4,-4]]){
 const root={player:{x,y,vx,vy},input:{x:0,y:0},elapsed,distance:20},candidate=adaptiveTransaction(seed,4,root,preset),c={...root,committed:[],candidate,reservedUntilDistance:candidate.endDistance},row={preset,seed,elapsed,x,y,vx,vy};
 for(const[version,geometry]of [['before',oldGeometry],['after',ADAPTIVE_GEOMETRY]]){const j=beginResolvedRuntimeSearch(c,{geometry});j.advance({propagations:3072,narrowQueries:6144},1);const r=j.getResult();assert.ok(r);row[version]={decision:r.decision,reason:r.reason,metrics:j.metrics};if(version==='after'&&r.decision==='accept'){const replay=beginTrajectoryReplay(c,r.witness.controls,{geometry});while(!replay.getResult())replay.advance();const rr=replay.getResult();assert.equal(rr.decision,'accept');assert.equal(rr.witness.hash,r.witness.hash);witnesses.push(r.witness);}}
 rows.push(row);
}
const summary={cases:rows.length,before:rows.filter(r=>r.before.decision==='accept').length,after:rows.filter(r=>r.after.decision==='accept').length,recovered:rows.filter(r=>r.before.decision==='reject'&&r.after.decision==='accept').length,regressed:rows.filter(r=>r.before.decision==='accept'&&r.after.decision==='reject'),audits:witnesses.length};assert.equal(summary.before,781);
await writeFile('.cache/review/GAMEPLAY-003C4-FIX2/matrix.json',JSON.stringify({summary,rows,witnesses}));console.log(JSON.stringify({...summary,regressed:summary.regressed.length}));
