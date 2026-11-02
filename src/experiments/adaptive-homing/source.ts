import { CONFIG } from '../../config.ts';
import { FieldGenerator } from '../../core/field-generator.ts';
import type { FieldTransaction,PlannedHazard,AdaptiveMineState } from '../../core/field-types.ts';
import type { SchedulerRoot } from '../../core/field-scheduler.ts';
import type { RuntimeEncounterSource } from '../../debug/runtime-field.ts';
import { movingMineSource } from '../moving-mine/source.ts';
import { mineX,mineY,simulationTick } from '../moving-mine/motion.ts';
import { initialAdaptiveState,stepAdaptiveMine } from './controller.ts';
import { adaptiveTransaction,ADAPTIVE_GEOMETRY,isAdaptive,validAdaptiveState } from './transaction.ts';
import { HOMING as H } from './settings.ts';
import type { HomingPreset } from './settings.ts';

export interface PursuitSample {readonly tick:number;readonly elapsed:number;readonly distance:number;readonly ship:Readonly<SchedulerRoot['player']>;readonly input:Readonly<SchedulerRoot['input']>;readonly mine:Readonly<AdaptiveMineState>}
/** One authoritative controller, no renderer mutation and no precomputed pursuit tape. */
export class AdaptiveSource implements RuntimeEncounterSource {
 readonly version=H.version;readonly diagnostics=true;
 private readonly base=movingMineSource();
 private readonly first:boolean;private readonly preset:HomingPreset;
 private descriptor?:PlannedHazard;
 private currentState?:Readonly<AdaptiveMineState>;private previousState?:Readonly<AdaptiveMineState>;
 get current():Readonly<AdaptiveMineState>|undefined{return this.currentState;}
 get previous():Readonly<AdaptiveMineState>|undefined{return this.previousState;}
 readonly samples:PursuitSample[]=[];readonly encounters:PlannedHazard[]=[];
 liveUpdates=0;
 constructor(first=false,preset:HomingPreset='balanced'){this.first=first;this.preset=preset;}
 next(seed:Parameters<RuntimeEncounterSource['next']>[0],cursor:Parameters<RuntimeEncounterSource['next']>[1]){
  const decision=(this.first?movingMineSource(undefined,true):this.base).next(seed,cursor);
  return decision.section.encounter==='moving-mine'?{...decision,section:Object.freeze({...decision.section,version:H.version,id:`${H.version}/${seed}/${cursor.index}`})}:decision;
 }
 candidate(section:Parameters<RuntimeEncounterSource['candidate']>[0],committed:readonly PlannedHazard[]=[],root?:SchedulerRoot){
  if(section.encounter!=='moving-mine')return{...this.base.candidate(section,committed,root),geometry:ADAPTIVE_GEOMETRY};
  const ambient=new FieldGenerator(section.seed).propose(section.firstCell,section.cellCount-1),template=Object.freeze({...ambient,cellCount:section.cellCount,endDistance:section.endDistance});
  return{transaction:template,fallback:template,geometry:ADAPTIVE_GEOMETRY,publicationPolicy:'resolve-at-publication-v1' as const,publicationDelayTicks:1,
   resolveAtPublication:(current:SchedulerRoot)=>adaptiveTransaction(section.seed,section.firstCell,current,this.preset)};
 }
 advance(root:SchedulerRoot):void{
  if(!this.descriptor||!this.currentState)return;const m=this.descriptor.motion;
  if(m?.version!==H.version||simulationTick(root.elapsed)!==this.currentState.tick+1)throw new Error('Noncausal live feedback tick');
  this.previousState=this.currentState;this.currentState=stepAdaptiveMine(this.currentState,root.player,m);this.liveUpdates++;
  if(this.samples.length===H.traceTicks)this.samples.shift();
  this.samples.push(Object.freeze({tick:this.currentState.tick,elapsed:root.elapsed,distance:root.distance,ship:Object.freeze({...root.player}),input:Object.freeze({...root.input}),mine:this.currentState}));
 }
 bindRoot(root:SchedulerRoot,known:readonly PlannedHazard[]):SchedulerRoot{
  const h=known.find(isAdaptive);
  if(!h){this.descriptor=undefined;this.currentState=this.previousState=undefined;return root;}
  if(!this.currentState||!validAdaptiveState(this.currentState,h,root.elapsed))throw new Error('Missing actual feedback root');
  return{...root,homing:this.currentState};
 }
 published(transaction:FieldTransaction,root:SchedulerRoot):void{
  const h=transaction.hazards.find(isAdaptive);if(!h)return;
  if(this.descriptor)throw new Error('Only one adaptive mine is permitted');
  this.descriptor=h;this.currentState=initialAdaptiveState(h);this.previousState=this.currentState;
  if(this.currentState.tick!==simulationTick(root.elapsed))throw new Error('Stale adaptive publication');
  if(this.encounters.length===8)this.encounters.shift();this.encounters.push(h);
 }
 pose(h:PlannedHazard,elapsed:number):Readonly<{x:number;y:number}>{
  if(!isAdaptive(h))return h.motion?{x:mineX(h,elapsed),y:mineY(h,elapsed)}:h;
  const tick=simulationTick(elapsed),s=this.currentState?.id===h.id&&this.currentState.tick===tick?this.currentState:this.previousState?.id===h.id&&this.previousState.tick===tick?this.previousState:undefined;
  if(!s)throw new Error('Feedback pose has no authoritative interval state');return s;
 }
 reset():void{this.descriptor=undefined;this.currentState=this.previousState=undefined;this.samples.length=this.encounters.length=0;this.liveUpdates=0;}
 trace():unknown{return{version:H.version,encounters:this.encounters,samples:this.samples,liveUpdates:this.liveUpdates,maximumSamples:H.traceTicks,note:'Actual post-Ship controller states; depth=distance-passDistance. Inputs are recorded, never forecast.'};}
 interval(h:PlannedHazard):Readonly<{from:Readonly<AdaptiveMineState>;to:Readonly<AdaptiveMineState>}>|undefined{
  return this.previousState?.id===h.id&&this.currentState?.id===h.id?{from:this.previousState,to:this.currentState}:undefined;
 }
 get activePursuitSeconds():number{const m=this.descriptor?.motion;return m?.version===H.version&&this.currentState?Math.max(0,Math.min(this.currentState.tick-m.startTick,m.durationTicks))*CONFIG.step:0;}
}
