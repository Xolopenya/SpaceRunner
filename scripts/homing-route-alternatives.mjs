/** Offline ablations only. Never imported by the game or used as stored tapes. */
import {readFile,writeFile} from 'node:fs/promises';
import {beginResolvedRuntimeSearch,beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {ADAPTIVE_GEOMETRY as base} from '../src/experiments/adaptive-homing/transaction.ts';
const preferCurrentFieldGoals=(known,distance)=>known.some(h=>h.kind>=4&&h.kind<9&&h.passDistance+3+.42+.15>=distance);
const runs=JSON.parse(await readFile('.cache/review/GAMEPLAY-003C4-FIX2/original-balanced-runs.json')),rows=[];
for(const variant of ['smaller-horizontal','vertical','current-mine-inertia'])for(const run of runs)for(const o of run.publications.filter(o=>o.section.encounter==='moving-mine')){
 const c=o.publicationChecks[0].context;
 const goal=(hazards,state)=>{const mine=hazards.find(h=>h.motion?.version==='adaptive-homing-v1');if(!mine||state.distance>mine.passDistance+mine.radius+.57||hazards.some(h=>h!==mine&&h.passDistance<mine.passDistance&&h.passDistance+h.radius+.57>=state.distance))return;
  const before=Math.round(state.elapsed*120)<mine.motion.passTick-132,sign=before?-1:1;
  if(variant==='smaller-horizontal')return{x:sign*Math.sign(mine.x)*3.2,y:0};
  if(variant==='vertical')return{x:0,y:sign*Math.sign(mine.y)*2.8};
  const m=state.homing??mine,lead=.6;return{x:Math.sign(state.x-m.x-(m.vx??0)*lead)*5.2,y:Math.sign(state.y-m.y-(m.vy??0)*lead)*2.8};
 };
 const geometry={...base,goalsAt:(h,d,s)=>{const g=s&&goal(h,s);return g?[g]:base.goalsAt(h,d,s);},steering:(h,s)=>{const g=goal(h,s);if(!g)return base.steering(h,s);const axis=(e,v)=>Math.abs(e)<=v*v/(2*25)+.08&&e*v>=0?0:Math.sign(e);return{x:axis(g.x-s.x,s.vx),y:axis(g.y-s.y,s.vy)};}};
 const j=beginResolvedRuntimeSearch(c,{geometry},preferCurrentFieldGoals(c.committed,c.distance)?undefined:o.resolution?.hint);j.advance({propagations:3072,narrowQueries:6144},1);const result=j.getResult();let independent;
 if(result?.decision==='accept'){const replay=beginTrajectoryReplay(c,result.witness.controls,{geometry});while(!replay.getResult())replay.advance();independent=replay.getResult();if(independent.decision!=='accept')throw Error('Replay mismatch');}
 rows.push({variant,seed:run.seed,history:run.history,section:o.section.id,before:o.publicationChecks[0].result.decision,result,metrics:j.metrics,independent:independent?.decision});
}
const summary=['smaller-horizontal','vertical','current-mine-inertia'].map(variant=>{const rs=rows.filter(r=>r.variant===variant);return{variant,accepted:rs.filter(r=>r.result?.decision==='accept').length,recovered:rs.filter(r=>r.before==='reject'&&r.result?.decision==='accept').length,regressions:rs.filter(r=>r.before==='accept'&&r.result?.decision!=='accept').length,unfinished:rs.filter(r=>!r.result).length};});
await writeFile('.cache/review/GAMEPLAY-003C4-FIX2/alternatives.json',JSON.stringify({summary,rows}));console.log(JSON.stringify(summary));
