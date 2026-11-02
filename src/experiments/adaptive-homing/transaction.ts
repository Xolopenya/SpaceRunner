import { CONFIG } from '../../config.ts';
import { FieldGenerator } from '../../core/field-generator.ts';
import { DEFAULT_FIELD_SETTINGS,fieldSettingsKey } from '../../core/field-settings.ts';
import type { AdaptiveHomingMotion,AdaptiveMineState,FieldTransaction,FieldValidationContext,PlannedHazard,StructuralResult } from '../../core/field-types.ts';
import type { SchedulerRoot } from '../../core/field-scheduler.ts';
import type { ValidationGeometry } from '../../core/field-validator-types.ts';
import type { FlightState } from '../../core/field-prediction.ts';
import { WRECK_GEOMETRY } from '../structure-variants/encounter.ts';
import { MINE_GEOMETRY,passTick } from '../moving-mine/source.ts';
import { targetCapture } from '../moving-mine/target-lock-source.ts';
import { MINE } from '../moving-mine/settings.ts';
import { simulationTick,isMine } from '../moving-mine/motion.ts';
import { HOMING as H,HOMING_PRESETS } from './settings.ts';
import type { HomingPreset } from './settings.ts';
import { adaptivePhase,initialAdaptiveState } from './controller.ts';
import { AdaptivePrediction } from './prediction.ts';

function hash(s:string):string{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0).toString(16).padStart(8,'0');}
export function isAdaptive(h:PlannedHazard):boolean{return h.motion?.version===H.version;}
export function adaptiveTransaction(seed:number,firstCell:number,root:SchedulerRoot,preset:HomingPreset='balanced'):FieldTransaction{
 const capture=targetCapture(root),tuning=HOMING_PRESETS[preset];
 if(!tuning||!Object.values(capture).every(Number.isFinite)||capture.elapsed<0||capture.distance<0||Math.abs(capture.x)>CONFIG.bounds.x||Math.abs(capture.y)>CONFIG.bounds.y
  ||Math.hypot(capture.vx,capture.vy)>CONFIG.ship.maxSpeed+1e-12||Math.abs(capture.inputX)>1||Math.abs(capture.inputY)>1)throw new RangeError('INVALID_HOMING_CAPTURE');
 const passDistance=firstCell*24+MINE.offset,plane=passTick(root,passDistance),startTick=plane-H.pursuitLeadTicks,warningTick=startTick-H.warningTicks;
 if(warningTick<capture.tick)throw new RangeError('INSUFFICIENT_HOMING_WARNING');
 const motion:Readonly<AdaptiveHomingMotion>=Object.freeze({version:H.version,startTick,durationTicks:H.maximumPursuitTicks,velocityX:H.initialVelocityX,velocityY:H.initialVelocityY,
  warningTick,passTick:plane,...tuning,preset,capture});
 const n=parseInt(hash(`${H.version}/${seed}/${firstCell}/origin`),16),provenance=Object.freeze({version:H.version,seed,settingsKey:fieldSettingsKey(DEFAULT_FIELD_SETTINGS)}),ownerCell=Math.floor(passDistance/24);
 const mine:PlannedHazard=Object.freeze({id:`${H.version}/${seed}/${firstCell}/${capture.tick}/${hash(JSON.stringify(motion))}`,ownerCell,anchorCell:ownerCell,localIndex:0,passDistance,
  x:n&1?H.initialX:-H.initialX,y:n&2?H.initialY:-H.initialY,radius:MINE.radius,kind:MINE.kind,visualVariant:MINE.visualVariant,collisionProfile:MINE.profile,spin:0,phase:0,orientation:'euler-xyz-v1',provenance,motion});
 const ambient=new FieldGenerator(seed).propose(firstCell,2);
 return Object.freeze({firstCell,cellCount:MINE.cellCount,startDistance:firstCell*24,endDistance:(firstCell+MINE.cellCount)*24,provenance,hazards:Object.freeze([...ambient.hazards,mine])});
}
function capturedRoot(m:AdaptiveHomingMotion):SchedulerRoot{const c=m.capture;return{player:{x:c.x,y:c.y,vx:c.vx,vy:c.vy},input:{x:c.inputX,y:c.inputY},elapsed:c.elapsed,distance:c.distance};}
function canonical(h:PlannedHazard):boolean{
 if(h.motion?.version!==H.version)return false;
 try{const m=h.motion,cell=Number(h.id.split('/')[2]),expected=adaptiveTransaction(h.provenance.seed,cell,capturedRoot(m),m.preset).hazards.at(-1);return JSON.stringify(h)===JSON.stringify(expected);}catch{return false;}
}
export function validAdaptiveState(s:Readonly<AdaptiveMineState>,h:PlannedHazard,elapsed:number):boolean{
 const m=h.motion;if(m?.version!==H.version)return false;
 const age=(s.tick-m.capture.tick)/120;
 return s.id===h.id&&Number.isSafeInteger(s.tick)&&s.tick===simulationTick(elapsed)&&age>=0&&s.phase===adaptivePhase(s.tick,m)
  &&[s.x,s.y,s.vx,s.vy,s.ax,s.ay,s.targetX,s.targetY].every(Number.isFinite)
  &&Math.hypot(s.vx,s.vy)<=m.maxSpeed+1e-10&&Math.hypot(s.ax,s.ay)<=m.maxAcceleration+1e-10
  &&Math.abs(s.x-h.x)<=m.maxSpeed*age+1e-8&&Math.abs(s.y-h.y)<=m.maxSpeed*age+1e-8
  &&Math.abs(s.targetX)<=CONFIG.bounds.x&&Math.abs(s.targetY)<=CONFIG.bounds.y;
}
function proposedGoal(hazards:readonly PlannedHazard[],distance:number,elapsed:number):{x:number;y:number}|undefined{
 const h=hazards.find(isAdaptive),m=h?.motion;if(!h||m?.version!==H.version||distance>h.passDistance+h.radius+.57)return undefined;
 if(hazards.some(other=>other!==h&&other.passDistance<h.passDistance&&other.passDistance+other.radius+.57>=distance))return undefined;
 const bait=-Math.sign(h.x)*4.8;return{x:simulationTick(elapsed)<m.passTick-H.escapeProposalTicks?bait:-bait,y:0};
}
export const ADAPTIVE_GEOMETRY:ValidationGeometry=Object.freeze({...MINE_GEOMETRY,version:H.geometry,
 validHazard:(h:PlannedHazard)=>isAdaptive(h)?canonical(h):MINE_GEOMETRY.validHazard(h),
 prediction:(context?:FieldValidationContext)=>new AdaptivePrediction([...context?.committed??[],...context?.candidate.hazards??[]].find(isAdaptive)),
 initialMine(context:FieldValidationContext){const existing=context.committed.find(isAdaptive);if(existing)return context.homing?Object.freeze({...context.homing}):undefined;const h=context.candidate.hazards.find(isAdaptive);return h?initialAdaptiveState(h):undefined;},
 validRoot(context:FieldValidationContext){const committed=context.committed.filter(isAdaptive),fresh=context.candidate.hazards.filter(isAdaptive);if(committed.length+fresh.length>1)return false;
  if(committed[0])return !!context.homing&&validAdaptiveState(context.homing,committed[0],context.elapsed);
  if(context.homing)return false;const h=fresh[0];return !h||(h.motion?.version===H.version&&JSON.stringify(h.motion.capture)===JSON.stringify(targetCapture(context)));},
 resolvedAt(context:FieldValidationContext){const h=context.candidate.hazards.find(isAdaptive);return h?.motion?.version===H.version&&JSON.stringify(h.motion.capture)===JSON.stringify(targetCapture(context));},
 goalsAt(hazards:readonly PlannedHazard[],distance:number,state?:Readonly<FlightState>){const goal=state?proposedGoal(hazards,distance,state.elapsed):undefined;return goal?[goal]:MINE_GEOMETRY.goalsAt?.(hazards,distance,state);},
 steering(hazards:readonly PlannedHazard[],state:Readonly<FlightState>){const goal=proposedGoal(hazards,state.distance,state.elapsed);if(!goal)return undefined;
  const axis=(error:number,velocity:number)=>Math.abs(error)<=velocity*velocity/(2*CONFIG.ship.braking)+.08&&error*velocity>=0?0:Math.sign(error);
  return{x:axis(goal.x-state.x,state.vx),y:axis(goal.y-state.y,state.vy)};},
 inspect(candidate:FieldTransaction,committed:readonly PlannedHazard[]):StructuralResult{
  const all=[...committed,...candidate.hazards],mines=all.filter(isMine),invalid=(reason:'metadata'|'incomplete'|'separation'|'capacity'):StructuralResult=>({status:'invalid',reason});
  if(mines.length>1)return invalid('capacity');if(mines.some(h=>isAdaptive(h)?!canonical(h):!MINE_GEOMETRY.validHazard(h))||all.some(h=>!!h.motion!==isMine(h)))return invalid('metadata');
  const old=committed.filter(h=>!isAdaptive(h));let result:StructuralResult;
  if(candidate.provenance.version===H.version){const mine=candidate.hazards.find(isAdaptive);if(mine?.motion?.version!==H.version)return invalid('incomplete');const expected=adaptiveTransaction(candidate.provenance.seed,candidate.firstCell,capturedRoot(mine.motion),mine.motion.preset);
   if(JSON.stringify(candidate)!==JSON.stringify(expected))return invalid('incomplete');result=WRECK_GEOMETRY.inspect(new FieldGenerator(candidate.provenance.seed).propose(candidate.firstCell,2),old);
  }else result=MINE_GEOMETRY.inspect(candidate,old);
  if(result.status==='invalid')return result;
  for(const mine of mines)for(const other of all)if(other!==mine&&Math.abs(other.passDistance-mine.passDistance)<mine.radius+other.radius+.3)return invalid('separation');
  const total=all.reduce((n,h)=>n+MINE_GEOMETRY.queryCost(h),0);return total>32?invalid('capacity'):{status:'valid',candidateCount:candidate.hazards.reduce((n,h)=>n+MINE_GEOMETRY.queryCost(h),0),totalCount:total,aboveSoftLimit:total>24};
 },
});
