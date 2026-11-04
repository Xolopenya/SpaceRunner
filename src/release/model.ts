import { RuntimeGameModel } from '../debug/runtime-game-model.ts';
import type { RuntimeEncounterSource } from '../debug/runtime-field.ts';
import { mixedFlowSource,FLOW_GEOMETRY } from '../experiments/mixed-flow/source.ts';
import { StructureVariantsView } from '../experiments/structure-variants/view.ts';
import { ShipHazardCollision } from '../core/ship-hazard-collision.ts';
import { ShipPrediction } from '../core/ship-prediction.ts';
import { SHIP_COLLIDER } from '../core/ship-collider.ts';
import type { FieldTransaction, PlannedHazard } from '../core/field-types.ts';
import { RELEASE,flightSpeed } from './settings.ts';
import { placePassivePressure } from './placement.ts';
import { FragmentRun } from '../collectibles/run.ts';
import type { Axis } from '../core/ship.ts';
import { FRAGMENT } from '../collectibles/settings.ts';
export const RELEASE_GEOMETRY={...FLOW_GEOMETRY,version:`release-${SHIP_COLLIDER.version}`,shipProfile:SHIP_COLLIDER,prediction:()=>new ShipPrediction(),queryCost:(h:PlannedHazard)=>FLOW_GEOMETRY.queryCost(h)*SHIP_COLLIDER.parts.length,inspect:(c:FieldTransaction,k:Parameters<typeof FLOW_GEOMETRY.inspect>[1])=>{
   const first=FLOW_GEOMETRY.inspect(c,k);if(first.status!=='invalid')return first;
   return FLOW_GEOMETRY.inspect({...c,cellCount:c.cellCount-RELEASE.phase1ExtraCells,endDistance:c.endDistance-RELEASE.phase1ExtraCells*24},k);
  }};

export class ReleaseModel extends RuntimeGameModel {
 readonly fragments = new FragmentRun(SHIP_COLLIDER,FRAGMENT.pickupAssist);
 readonly shipColliderProfile = SHIP_COLLIDER;
 protected override readonly collisions=new ShipHazardCollision(SHIP_COLLIDER,true);
 get lastShipContact(){return this.collisions.contact;}
 get shipCollisionMetrics(){return{narrowQueries:this.collisions.narrowQueries,broadSkips:this.collisions.broadSkips};}
 constructor(encounterSource?:RuntimeEncounterSource){
  let owner: ReleaseModel;
  const base=mixedFlowSource();let distance=0,original:Parameters<RuntimeEncounterSource['candidate']>[0],extra=0;
  const source:RuntimeEncounterSource={version:'mixed-flow-v1',advance:r=>{distance=r.distance;},next(seed,cursor){
   const d=base.next(seed,cursor);original=d.section;extra=distance<RELEASE.phase2Distance&&original.cellCount<=4?RELEASE.phase1ExtraCells:0;
   return{section:{...original,cellCount:original.cellCount+extra,endDistance:original.endDistance+extra*24},next:{...d.next,firstCell:d.next.firstCell+extra}};
  },candidate(_s,known,root){const c=base.candidate(original,known,root),extend=(t:FieldTransaction)=>({...t,cellCount:t.cellCount+extra,endDistance:t.endDistance+extra*24});return{...c,geometry:RELEASE_GEOMETRY,transaction:extend(placePassivePressure(c.transaction,root,known)),...(c.fallback?{fallback:extend(c.fallback)}:{})};},
  published(transaction,root){owner.fragments.published(transaction,root,owner.field.ledger.knownHazards(root.distance));}};
  const selected=encounterSource??source;
  super('baseline',{...selected,published(transaction,root){selected.published?.(transaction,root);if(encounterSource&&!transaction.hazards.some(h=>h.motion))owner.fragments.published(transaction,root,owner.field.ledger.knownHazards(root.distance));}},true);
  owner=this;
 }
 get phase():1|2{return this.distance>=RELEASE.phase2Distance?2:1;}
 override get speed():number{return flightSpeed(this.elapsed,this.distance,true);}
 override start(seed:number):void{
  const allowed=this.state==='MENU'||this.state==='GAME_OVER';
  super.start(seed);if(allowed){this.fragments.reset();this.collisions.reset();}
 }
 override step(dt:number,axis:Axis):void{
  const playing=this.state==='PLAYING',x=this.ship.x,y=this.ship.y,distance=this.distance;
  super.step(dt,axis);
  if(playing&&this.distance>distance)this.fragments.step(x,y,distance,this.ship.x,this.ship.y,this.distance,this.elapsed,this.field.slots);
 }
 override dispose():void{this.fragments.reset();this.collisions.reset();super.dispose();}
}
/** Production visuals reuse the real wreck renderer, without diagnostic panels. */
export const releaseView=(scene:ConstructorParameters<typeof StructureVariantsView>[0])=>{
 const view=new StructureVariantsView(scene,'center','mixed',false);
 document.getElementById('structure-variants-debug-info')!.remove();
 return view;
};
