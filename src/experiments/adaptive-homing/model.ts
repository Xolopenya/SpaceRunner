import { CONFIG } from '../../config.ts';
import { RuntimeGameModel } from '../../debug/runtime-game-model.ts';
import { sweptSphereHit } from '../../core/collision.ts';
import type { Point3 } from '../../core/hazard-profile.ts';
import type { PlannedHazard } from '../../core/field-types.ts';
import { MineCollision } from '../moving-mine/collision.ts';
import { AdaptiveSource } from './source.ts';
import type { HomingPreset } from './settings.ts';

class AdaptiveCollision extends MineCollision {
 private readonly source:AdaptiveSource;
 constructor(source:AdaptiveSource){super();this.source=source;}
 override hit(from:Point3,to:Point3,h:{kind:number;radius:number;phase:number;spin:number;planned?:PlannedHazard},elapsed:number,dt:number):boolean{
  if(h.planned?.motion?.version!=='adaptive-homing-v1')return super.hit(from,to,h,elapsed,dt);
  const interval=this.source.interval(h.planned);if(!interval)throw new Error('Missing authoritative collision interval');this.primitiveQueries++;
  return sweptSphereHit({x:from.x+interval.to.x-interval.from.x,y:from.y+interval.to.y-interval.from.y,z:from.z},to,h.radius+CONFIG.ship.radius);
 }
}
export class AdaptiveHomingGameModel extends RuntimeGameModel {
 protected override readonly collisions:AdaptiveCollision;
 readonly motionPolicy='adaptive-homing';
 readonly homing:AdaptiveSource;
 constructor(first=false,preset:HomingPreset='balanced'){
  const source=new AdaptiveSource(first,preset);super('baseline',source);this.homing=source;this.collisions=new AdaptiveCollision(source);
 }
 get collisionQueries():number{return this.collisions.primitiveQueries;}
 override dispose():void{super.dispose();this.homing.reset();}
}
