import {CONFIG} from '../config.ts';
import {RELEASE} from '../release/settings.ts';
import {sweptSphereHit,sweptSphereBoxHit} from '../core/collision.ts';
import type {FieldTransaction,PlannedHazard} from '../core/field-types.ts';
import type {SchedulerRoot} from '../core/field-scheduler.ts';
import {isWreck,wreckProfile} from '../experiments/structure-variants/profile.ts';
import {FRAGMENT as S} from './settings.ts';
import {fragmentHash,fragmentReachable} from './placement.ts';
import type {FragmentProposal,PickupPolicy} from './placement.ts';

export type TrailPattern='straight'|'curve'|'offset';
/** Local full-profile capsule route, conservative at every ordinary rotation.
 * Moving hazards at this depth suppress the optional trail; no homing forecast.
 * This certifies the short trail segment, not a global route from the player. */
export function trailSegmentClear(a:FragmentProposal,b:FragmentProposal,hazards:readonly PlannedHazard[],policy:PickupPolicy):boolean {
 for(const h of hazards){
  if(h.motion&&h.passDistance+h.radius>=a.passDistance-S.approachDepth&&h.passDistance-h.radius<=b.passDistance+S.approachDepth)return false;
  for(const part of policy.profile.parts){
   const from={x:a.x+part.offsetX-h.x,y:a.y+part.offsetY-h.y,z:h.passDistance-a.passDistance+part.offsetZ};
   const to={x:b.x+part.offsetX-h.x,y:b.y+part.offsetY-h.y,z:h.passDistance-b.passDistance+part.offsetZ};
   const radius=part.radius+S.clearance;
   if(isWreck(h)){for(const box of wreckProfile(h).boxes)if(sweptSphereBoxHit(
    {x:from.x-box.center.x,y:from.y-box.center.y,z:from.z-box.center.z},
    {x:to.x-box.center.x,y:to.y-box.center.y,z:to.z-box.center.z},box.half,radius))return false;
   }else if(sweptSphereHit(from,to,h.radius+radius))return false;
  }
 }
 return true;
}

/** At most one three-shard upgrade in each12 admitted groups. No bonus debt,
 * retries or RNG consumption: a rejected upgrade stays a single opportunity. */
export function trailScheduled(seed:number,group:number):boolean {
 return group%S.trailCycle===fragmentHash(`${seed}/trail-slot/${Math.floor(group/S.trailCycle)}`)%S.trailCycle;
}
export function trailPattern(seed:FragmentProposal):TrailPattern {
 return (['straight','curve','offset'] as const)[fragmentHash(seed.id+'/shape')%3]!;
}
export function proposeTrail(seed:FragmentProposal,transaction:FieldTransaction,root:SchedulerRoot,hazards:readonly PlannedHazard[],
 active:readonly FragmentProposal[],policy:PickupPolicy,pattern:TrailPattern=trailPattern(seed)):readonly FragmentProposal[]|undefined {
 const hash=fragmentHash(seed.id+'/bend'),axis=(hash&1)?'x':'y',sign=(hash&2)?1:-1;
 const coastX=root.player.x+root.player.vx*Math.abs(root.player.vx)/(2*CONFIG.ship.braking);
 const coastY=root.player.y+root.player.vy*Math.abs(root.player.vy)/(2*CONFIG.ship.braking);
 const points:FragmentProposal[]=[];
 for(let i=0;i<S.trailCount;i++){
  const t=i/(S.trailCount-1),bend=pattern==='curve'?(t*t-.25)*S.trailCurve*sign:0;
  const p:FragmentProposal=Object.freeze({...seed,id:`${seed.id}/trail/${i}`,trail:seed.id,pattern,trailIndex:i,trailLength:S.trailCount,
   x:seed.x+(axis==='x'?bend:0),y:seed.y+(axis==='y'?bend:0),passDistance:seed.passDistance+(i-1)*S.trailSpacing,
   approach:Object.freeze({x:seed.x+(axis==='x'?bend:0),y:seed.y+(axis==='y'?bend:0)})});
  if(p.passDistance<transaction.startDistance+S.approachDepth+2||p.passDistance>transaction.endDistance-S.approachDepth-2||!fragmentReachable(p,root))return undefined;
  if(Math.hypot(p.x-coastX,p.y-coastY)<(pattern==='offset'?2.6:S.naturalRouteOffset))return undefined;
  if(policy.profile.parts.some(part=>Math.hypot(p.x-coastX-part.offsetX,p.y-coastY-part.offsetY)<part.radius+S.pickupRadius+policy.assist+(part.id==='body'?0:policy.wingAssist??0)+S.coastClearance))return undefined;
  if(active.some(a=>Math.hypot(a.x-p.x,a.y-p.y,a.passDistance-p.passDistance)<S.separation))return undefined;
  points.push(p);
 }
 const seconds=S.trailSpacing/(CONFIG.flight.maxSpeed*RELEASE.phase2SpeedMultiplier);
 for(let i=1;i<points.length;i++)if(Math.hypot(points[i]!.x-points[i-1]!.x,points[i]!.y-points[i-1]!.y)/seconds>CONFIG.ship.maxSpeed*.5)return undefined;
 if(points.length>=3){const [a,b,c]=points as [FragmentProposal,FragmentProposal,FragmentProposal];
  if(Math.hypot(c.x-2*b.x+a.x,c.y-2*b.y+a.y)/(seconds*seconds)>CONFIG.ship.acceleration*.5)return undefined;}
 for(let i=1;i<points.length;i++)if(Math.hypot(points[i]!.x-points[i-1]!.x,points[i]!.y-points[i-1]!.y)/seconds>CONFIG.ship.maxSpeed*.45)return undefined;
 const first=points[0]!,last=points.at(-1)!;
 const route=[{...first,passDistance:first.passDistance-S.approachDepth},...points,{...last,passDistance:last.passDistance+S.approachDepth}];
 for(let i=1;i<route.length;i++)if(!trailSegmentClear(route[i-1]!,route[i]!,hazards,policy))return undefined;
 return Object.freeze(points);
}
