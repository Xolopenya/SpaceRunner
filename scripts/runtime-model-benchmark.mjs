import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RuntimeGameModel} from '../src/debug/runtime-game-model.ts';
import {GameModel} from '../src/core/game-model.ts';
import {CONFIG} from '../src/config.ts';
import {beginTrajectoryReplay} from '../src/core/field-validator.ts';
import {recordedInputs,INPUT_HISTORIES,simulateRuntime} from '../tests/fixtures/runtime-simulation.ts';
import {APPROVED_SEEDS} from '../tests/fixtures/trajectory-corpus.ts';

/** Actual inherited GameModel pipeline, including hull/immunity/removal/death.
 * Distinct from the longer collision-independent feasibility histories.
 */
export async function measureRuntimeModels(output){
 const rows=[],events=[];let audits=0;
 for(const seed of APPROVED_SEEDS)for(const history of INPUT_HISTORIES)for(const experimental of [false,true]){
  const m=experimental?new RuntimeGameModel():new GameModel();m.ready();m.start(seed);
  const tape=recordedInputs(seed^0x5a19,history,1440);let last,firstHit;
  for(let tick=0;tick<1440&&m.state==='PLAYING';tick++){
   const hits=m.hitSerial;m.step(CONFIG.step,tape[tick]);if(m.hitSerial>hits)firstHit??={elapsed:m.elapsed,distance:m.distance};
   if(experimental){assert.equal(m.field.fault,undefined);assert.ok(m.field.slots.filter(s=>s.planned).length<=32);
    const o=m.field.lastOutcome;if(o&&o!==last){last=o;
     if(o.witness){assert.deepEqual(o.witness.context.player,{x:m.ship.x,y:m.ship.y,vx:m.ship.vx,vy:m.ship.vy});assert.deepEqual(o.witness.context.input,tape[tick]);assert.equal(o.witness.context.elapsed,m.elapsed);assert.equal(o.witness.context.distance,m.distance);
      const replay=beginTrajectoryReplay(o.witness.context,o.witness.controls);for(let i=1;!replay.getResult()&&i<=144;i++)replay.advance(undefined,i);const result=replay.getResult();assert.equal(result?.decision,'accept');assert.equal(result.witness.hash,o.witness.hash);audits++;
     }
    }
   }
  }
  if(experimental)events.push({seed,history,events:[...m.field.events]});
  rows.push({seed,history,experimental,elapsed:m.elapsed,distance:m.distance,state:m.state,hull:m.hull,hits:m.hitSerial,firstHit,
   scheduled:experimental?m.field.scheduled:null,committed:experimental?m.field.committed:null,omitted:experimental?m.field.omitted:null,
   pending:experimental?Number(!!m.field.pending):0,known:experimental?m.field.slots.filter(s=>s.planned).length:null});
  if(experimental)m.dispose();
 }
 const longPassive=[];
 for(const seed of [0,42,0xffffffff])for(const history of ['neutral','boundary']){
  const r=simulateRuntime({seed,history,sections:32,audit:true});assert.equal(r.remainingRecords,0);longPassive.push(r);
 }
 const longPassiveSummary=longPassive.map(r=>({seed:r.seed,history:r.history,sections:r.outcomes.length,committed:r.outcomes.filter(o=>o.status==='committed').length,
  firstContact:r.firstActualContact??null,uniqueContactHazards:r.uniqueContactHazards,distance:r.distance,survived:r.firstActualContact===undefined,audits:r.audits}));
 const bootstrap=bootstrapProbe();
 const result={generatedAt:new Date().toISOString(),cases:rows.length,rows,events,audits,violations:0,bootstrap,longPassiveSummary,
  method:'16seeds×12 prerecorded current-input histories×2 actual GameModels, up to12 simulated seconds, STOP at real GAME_OVER. Same real120Hz super.step/collision/hull/score pipeline and post-movement adapter capture phase. No forecast/tape is passed to planning. Each actual-model publication is independently fully replayed from the exact current ship/input/time/distance. The abandoned-witness label here uses only its prerecorded analog tape, unlike the separate policy-following feasibility case.'};
 await mkdir(output,{recursive:true});await writeFile(join(output,'runtime-model-metrics.json'),JSON.stringify(result,null,2)+'\n');
 await writeFile(join(output,'runtime-long-passive.json'),JSON.stringify({runs:longPassive,summary:longPassiveSummary,note:'Six supplemental32-section current-input schedules,192 decisions, independent full replay. Actors continue collision-independently; survived means zero contacts throughout, not post-death survival. Separate from the2632-decision primary/comparator corpus.'},null,2)+'\n');
 console.log(JSON.stringify({modelCases:rows.length,audits,violations:0,newCommitted:rows.filter(r=>r.experimental).reduce((n,r)=>n+r.committed,0),newOmitted:rows.filter(r=>r.experimental).reduce((n,r)=>n+r.omitted,0),bootstrap},null,2));return result;
}
function bootstrapProbe(){
 const a=new RuntimeGameModel();a.ready();a.start(42);let firstHit,initialIds;
 for(let i=0;i<6000&&!firstHit;i++){const old=a.hitSerial;a.step(CONFIG.step,{x:0,y:0});if(!initialIds&&a.field.lastOutcome?.status==='committed')initialIds=a.field.lastOutcome.transaction.hazards.map(h=>h.id);
  if(a.hitSerial>old){const h=a.field.slots.find(s=>s.planned&&!s.active&&s.z<=8);firstHit={elapsed:a.elapsed,distance:a.distance,id:h?.planned?.id,belongsToInitialField:initialIds.includes(h?.planned?.id)};}}
 const b=new RuntimeGameModel();b.ready();b.start(42);let firstSteering;
 for(let i=0;i<4000&&b.state==='PLAYING';i++){const w=b.field.certificate;let input={x:0,y:0},tick=w?Math.round((b.elapsed-w.context.elapsed)*120):0;if(w)for(const r of w.controls){if(tick<r.ticks){input=r.input;break;}tick-=r.ticks;}
  b.step(CONFIG.step,input);if(input.x||input.y)firstSteering??={elapsed:b.elapsed,distance:b.distance};}
 const value={seed:42,firstPublication:a.field.firstPublication,firstOpportunity:a.field.firstOpportunity,firstNeutralHit:firstHit,firstCausalReferenceSteering:firstSteering,referenceHits:b.hitSerial,
  interpretation:'The same initial ambient geometry is used. Reference first steering is a chosen valid action, NOT a proved earliest/uniquely required human maneuver. A neutral first-hit identifies failure of that particular passive route. Later admitted layouts can depend on the input history.'};a.dispose();b.dispose();return value;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await measureRuntimeModels(resolve(process.env.REVIEW_RESULT_DIR??'.cache/review/GAMEPLAY-001B-5A/final'));
