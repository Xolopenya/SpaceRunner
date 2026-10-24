import assert from 'node:assert/strict';
import {CONFIG,difficulty} from '../src/config.ts';

/** Post-processing of RECORDED admitted geometry, not a publisher or a safety
 * query. Same half-open spatial window and end-step clock for both generators.
 * The slab is axial center proximity, not XY collision risk/human engagement.
 */
export function matchedWindowPresence(run,comparison){
 const end=comparison.end;
 assert.equal(run.initial.distance,0);assert.equal(run.initial.elapsed,0);
 for(const o of run.outcomes)if(o.status==='committed')for(const h of o.transaction.hazards)
  assert.ok(h.passDistance-o.witness.context.distance>10+h.radius,'Presence must not count unpublished nearby geometry');
 assert.ok(-CONFIG.hazards.spawnZ>10+CONFIG.hazards.maxRadius);
 const intervals=positions=>{
  const spans=positions.map(h=>[Math.max(0,h.passDistance-10-h.radius),Math.min(end,h.passDistance+CONFIG.hazards.despawnZ)])
   .filter(([a,b])=>a<=b).sort((a,b)=>a[0]-b[0]);const result=[];
  for(const span of spans){const last=result.at(-1);if(last&&span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else result.push([...span]);}return result;
 };
 const old=intervals(comparison.oldPositions),fresh=intervals(comparison.newPositions);
 let elapsed=0,distance=0,ticks=0,oldEmpty=0,newEmpty=0,a=0,b=0;
 for(let tick=0;tick<run.steps;tick++){
  elapsed+=CONFIG.step;distance+=difficulty(elapsed).speed*CONFIG.step;if(distance>=end)break;ticks++;
  while(a<old.length&&old[a][1]<distance)a++;while(b<fresh.length&&fresh[b][1]<distance)b++;
  if(a===old.length||old[a][0]>distance)oldEmpty++;
  if(b===fresh.length||fresh[b][0]>distance)newEmpty++;
 }
 return{seed:run.seed,history:run.history,start:0,end,ticks,seconds:ticks*CONFIG.step,
  oldEmptySeconds:oldEmpty*CONFIG.step,newEmptySeconds:newEmpty*CONFIG.step,oldEmptyFraction:oldEmpty/ticks,newEmptyFraction:newEmpty/ticks,
  definition:'Recorded centers in[0,end); presence starts at q-10-radius, ends at q+8 (same visual center despawn). Identical120Hz forward clock, tail outside the matched window excluded. No damage deletion in either logical actor. Publication precedes every counted new interval. Axial proximity only.'};
}
export function summarizePresence(windows){const seconds=windows.reduce((n,w)=>n+w.seconds,0),oldEmpty=windows.reduce((n,w)=>n+w.oldEmptySeconds,0),newEmpty=windows.reduce((n,w)=>n+w.newEmptySeconds,0);return{windows:windows.length,seconds,oldEmptySeconds:oldEmpty,newEmptySeconds:newEmpty,oldEmptyFraction:oldEmpty/seconds,newEmptyFraction:newEmpty/seconds};}
