import { CONFIG } from '../../config.ts';
import { sweptSphereHit } from '../../core/collision.ts';
import type { FlightState } from '../../core/field-prediction.ts';
import type { PlannedHazard } from '../../core/field-types.ts';
import type { Axis } from '../../core/ship.ts';
import { MinePrediction } from '../moving-mine/collision.ts';
import { stepAdaptiveMine } from './controller.ts';

/** Branch-local immutable mine state travels WITH each exact Ship state. */
export class AdaptivePrediction extends MinePrediction {
 private readonly mine?:PlannedHazard;
 constructor(mine?:PlannedHazard){super();this.mine=mine;}
 override step(state:FlightState,input:Readonly<Axis>):void{super.step(state,input);this.mineStep(state);}
 override stepAt(state:FlightState,input:Readonly<Axis>,elapsed:number,distance:number):void{super.stepAt(state,input,elapsed,distance);this.mineStep(state);}
 private mineStep(state:FlightState):void{if(this.mine?.motion?.version==='adaptive-homing-v1'){
  if(!state.homing&&state.distance>this.mine.passDistance+this.mine.radius+CONFIG.hazards.despawnZ)return;
  if(!state.homing||state.homing.id!==this.mine.id)throw new Error('Missing branch-local homing state');
  state.homing=stepAdaptiveMine(state.homing,state,this.mine.motion);
  if(state.distance>this.mine.passDistance+this.mine.radius+CONFIG.hazards.despawnZ)delete state.homing;
 }}
 override hit(a:Readonly<FlightState>,b:Readonly<FlightState>,h:PlannedHazard,margin:number):boolean{return h.motion?.version==='adaptive-homing-v1'?adaptiveHit(a,b,h,margin):super.hit(a,b,h,margin);}
 override hitGameplay(a:Readonly<FlightState>,b:Readonly<FlightState>,h:PlannedHazard):boolean{return h.motion?.version==='adaptive-homing-v1'?adaptiveHit(a,b,h,0):super.hitGameplay(a,b,h);}
}
export function adaptiveHit(a:Readonly<FlightState>,b:Readonly<FlightState>,h:PlannedHazard,margin=0):boolean{
 const extent=h.radius+CONFIG.ship.radius+margin;
 if(a.distance>h.passDistance+extent&&b.distance>h.passDistance+extent)return false;
 if(!a.homing||!b.homing||a.homing.id!==h.id||b.homing.id!==h.id)throw new Error('Missing interval feedback endpoints');
 return sweptSphereHit({x:a.x-a.homing.x,y:a.y-a.homing.y,z:h.passDistance-a.distance},
  {x:b.x-b.homing.x,y:b.y-b.homing.y,z:h.passDistance-b.distance},h.radius+CONFIG.ship.radius+margin);
}
