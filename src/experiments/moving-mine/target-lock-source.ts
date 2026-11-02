import { CONFIG } from '../../config.ts';
import { FieldGenerator } from '../../core/field-generator.ts';
import { DEFAULT_FIELD_SETTINGS, fieldSettingsKey } from '../../core/field-settings.ts';
import type { FieldTransaction, FieldValidationContext, PlannedHazard, StructuralResult, TargetCapture, TargetLockMotion } from '../../core/field-types.ts';
import type { SchedulerRoot } from '../../core/field-scheduler.ts';
import type { ValidationGeometry } from '../../core/field-validator-types.ts';
import type { RuntimeEncounterSource } from '../../debug/runtime-field.ts';
import { WRECK_GEOMETRY } from '../structure-variants/encounter.ts';
import { MINE } from './settings.ts';
import { TARGET_LOCK as T, DEFAULT_TARGET_TUNING } from './target-lock-settings.ts';
import type { TargetLockTuning } from './target-lock-settings.ts';
import { movingMineSource, MINE_GEOMETRY, passTick } from './source.ts';
import { isMine, mineX, mineY, simulationTick } from './motion.ts';

function hash(value: string): string { let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16).padStart(8,'0'); }
export function targetLockInitial(seed: number, firstCell: number, choice:0|1=0): Readonly<{x:number;y:number}> {
  const n=parseInt(hash(`${T.version}/${seed}/${firstCell}/origin`),16);
  const sign=choice?-1:1;return Object.freeze({x:(n&1?6:-6)*sign,y:(n&2?3:-3)*sign});
}
export function targetOriginChoice(seed:number,firstCell:number,observed:Readonly<{x:number;y:number}>):0|1 {
  const p=targetLockInitial(seed,firstCell);return Math.hypot(p.x-observed.x,p.y-observed.y)<T.minimumTravel?1:0;
}
export function targetCapture(root: SchedulerRoot): Readonly<TargetCapture> {
  return Object.freeze({tick:simulationTick(root.elapsed),elapsed:root.elapsed,distance:root.distance,
    x:root.player.x,y:root.player.y,vx:root.player.vx,vy:root.player.vy,inputX:root.input.x,inputY:root.input.y});
}
export function targetLockTransaction(seed: number, firstCell: number, root: SchedulerRoot, acquisitionStartTick: number,
  tuning: TargetLockTuning=DEFAULT_TARGET_TUNING,originChoice:0|1=targetOriginChoice(seed,firstCell,root.player)): FieldTransaction {
  const c=targetCapture(root), start=targetLockInitial(seed,firstCell,originChoice), speed=tuning.attackSpeed, minimumWarningTicks=tuning.minimumWarningTicks;
  if(!Object.values(c).every(Number.isFinite)||c.elapsed<0||c.distance<0||Math.abs(c.x)>CONFIG.bounds.x||Math.abs(c.y)>CONFIG.bounds.y
    ||Math.hypot(c.vx,c.vy)>CONFIG.ship.maxSpeed+1e-12||Math.abs(c.inputX)>1||Math.abs(c.inputY)>1
    ||!Number.isSafeInteger(acquisitionStartTick)||acquisitionStartTick<0||c.tick-acquisitionStartTick<T.acquisitionTicks
    ||c.tick-acquisitionStartTick>144||!T.speeds.includes(speed)||!T.warningTicks.includes(minimumWarningTicks)||(originChoice!==0&&originChoice!==1))throw new RangeError('INVALID_TARGET_CAPTURE');
  const dx=c.x-start.x,dy=c.y-start.y,travel=Math.hypot(dx,dy);
  if(travel<T.minimumTravel)throw new RangeError('TARGET_TOO_CLOSE_TO_ORIGIN');
  const passDistance=firstCell*24+MINE.offset, plane=passTick(root,passDistance), durationTicks=Math.ceil(travel/speed/CONFIG.step), startTick=plane-durationTicks;
  if(startTick-c.tick<minimumWarningTicks)throw new RangeError('TARGET_WARNING_EXPIRED');
  const seconds=durationTicks*CONFIG.step;
  const motion: Readonly<TargetLockMotion>=Object.freeze({version:T.version,startTick,durationTicks,velocityX:dx/seconds,velocityY:dy/seconds,
    acquisitionStartTick,passTick:plane,minimumWarningTicks,attackSpeed:speed,targetX:c.x,targetY:c.y,originChoice,capture:c});
  const provenance=Object.freeze({version:T.version,seed,settingsKey:fieldSettingsKey(DEFAULT_FIELD_SETTINGS)}),ownerCell=Math.floor(passDistance/24);
  const mine: PlannedHazard=Object.freeze({id:`${T.version}/${seed}/${firstCell}/${c.tick}/${hash(JSON.stringify(motion))}`,ownerCell,anchorCell:ownerCell,localIndex:0,
    passDistance,x:start.x,y:start.y,radius:MINE.radius,kind:MINE.kind,visualVariant:MINE.visualVariant,collisionProfile:MINE.profile,
    spin:0,phase:0,orientation:'euler-xyz-v1',provenance,motion});
  const ambient=new FieldGenerator(seed).propose(firstCell,2);
  return Object.freeze({firstCell,cellCount:MINE.cellCount,startDistance:firstCell*24,endDistance:(firstCell+MINE.cellCount)*24,provenance,hazards:Object.freeze([...ambient.hazards,mine])});
}
export function isTargetLock(h: PlannedHazard): boolean { return isMine(h)&&h.motion?.version===T.version; }
function captureRoot(c: TargetCapture): SchedulerRoot { return {player:{x:c.x,y:c.y,vx:c.vx,vy:c.vy},input:{x:c.inputX,y:c.inputY},elapsed:c.elapsed,distance:c.distance}; }
function canonical(h: PlannedHazard): boolean {
  if(!isTargetLock(h)||h.motion?.version!==T.version||!h.motion.capture)return false;
  try {const m=h.motion,p=h.id.split('/'),expected=targetLockTransaction(h.provenance.seed,Number(p[2]),captureRoot(m.capture),m.acquisitionStartTick,
    {attackSpeed:m.attackSpeed,minimumWarningTicks:m.minimumWarningTicks},m.originChoice).hazards.at(-1)!;return JSON.stringify(h)===JSON.stringify(expected);}catch{return false;}
}
function escapeGoals(h: PlannedHazard): readonly {x:number;y:number}[] {
  if(h.motion?.version!==T.version)return MINE_GEOMETRY.goals(h);
  const {targetX:x,targetY:y}=h.motion,goals=[];
  for(const a of [-5,0,5])for(const b of [-2.8,0,2.8])if(Math.hypot(a-x,b-y)>=2.72)goals.push({x:a,y:b});
  return goals;
}
export const TARGET_GEOMETRY: ValidationGeometry=Object.freeze({...MINE_GEOMETRY,version:T.geometry,
  validHazard:(h:PlannedHazard)=>isTargetLock(h)?canonical(h):MINE_GEOMETRY.validHazard(h),
  resolvedAt(context:FieldValidationContext){const mine=context.candidate.hazards.find(isTargetLock);return mine?.motion?.version===T.version
    &&JSON.stringify(mine.motion.capture)===JSON.stringify(targetCapture(context));},
  goals:escapeGoals,
  goalsAt(hazards:readonly PlannedHazard[],distance:number){const next=hazards.filter(h=>h.passDistance+h.radius+.57>=distance).sort((a,b)=>a.passDistance-b.passDistance)[0];
    return next&&isTargetLock(next)?escapeGoals(next):MINE_GEOMETRY.goalsAt?.(hazards,distance);},
  inspect(candidate:FieldTransaction,committed:readonly PlannedHazard[]):StructuralResult{
    const all=[...committed,...candidate.hazards],mines=all.filter(isMine),invalid=(reason:'metadata'|'incomplete'|'separation'|'capacity'):StructuralResult=>({status:'invalid',reason});
    if(mines.length>1)return invalid('capacity');
    if(mines.some(h=>isTargetLock(h)?!canonical(h):!MINE_GEOMETRY.validHazard(h))||all.some(h=>!!h.motion!==isMine(h)))return invalid('metadata');
    const oldCommitted=committed.filter(h=>!isTargetLock(h));let result:StructuralResult;
    if(candidate.provenance.version===T.version){const mine=candidate.hazards.find(isTargetLock);if(mine?.motion?.version!==T.version)return invalid('incomplete');
      const m=mine.motion,expected=targetLockTransaction(candidate.provenance.seed,candidate.firstCell,captureRoot(m.capture),m.acquisitionStartTick,
        {attackSpeed:m.attackSpeed,minimumWarningTicks:m.minimumWarningTicks},m.originChoice);
      if(JSON.stringify(candidate)!==JSON.stringify(expected))return invalid('incomplete');
      result=WRECK_GEOMETRY.inspect(new FieldGenerator(candidate.provenance.seed).propose(candidate.firstCell,2),oldCommitted);
    }else result=MINE_GEOMETRY.inspect(candidate,oldCommitted);
    if(result.status==='invalid')return result;
    for(const mine of mines)for(const other of all)if(other!==mine&&Math.abs(other.passDistance-mine.passDistance)<mine.radius+other.radius+.3)return invalid('separation');
    const total=all.reduce((n,h)=>n+MINE_GEOMETRY.queryCost(h),0);if(total>32)return invalid('capacity');
    return{status:'valid',candidateCount:candidate.hazards.reduce((n,h)=>n+MINE_GEOMETRY.queryCost(h),0),totalCount:total,aboveSoftLimit:total>24};
  },
});
export function targetLockSource(first=false,tuning:TargetLockTuning=DEFAULT_TARGET_TUNING):RuntimeEncounterSource{
  const base=movingMineSource(undefined,first),options=Object.freeze({...tuning});
  return Object.freeze<RuntimeEncounterSource>({version:T.version,diagnostics:true,pose:(h,t)=>isMine(h)?{x:mineX(h,t),y:mineY(h,t)}:h,
    next(seed,cursor){const d=base.next(seed,cursor);return d.section.encounter==='moving-mine'?{...d,section:Object.freeze({...d.section,version:T.version,id:`${T.version}/${seed}/${cursor.index}`})}:d;},
    candidate(section,committed=[],root){
      if(section.encounter!=='moving-mine')return{...base.candidate(section,committed,root),geometry:TARGET_GEOMETRY};
      if(!root)throw new Error('Target template requires observed acquisition clock');
      const payload=new FieldGenerator(section.seed).propose(section.firstCell,section.cellCount-1),template=Object.freeze({...payload,cellCount:section.cellCount,endDistance:section.endDistance});
      const acquisition=simulationTick(root.elapsed);
      const choice=targetOriginChoice(section.seed,section.firstCell,root.player),origin=targetLockInitial(section.seed,section.firstCell,choice);
      return{transaction:template,geometry:TARGET_GEOMETRY,publicationPolicy:'resolve-at-publication-v1',publicationDelayTicks:T.acquisitionTicks+1,fallback:template,
        previewPose:Object.freeze({...origin,passDistance:section.startDistance+MINE.offset}),
        resolveAtPublication:current=>targetLockTransaction(section.seed,section.firstCell,current,acquisition,options,choice)};
    },
  });
}
