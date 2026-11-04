import type { PlannedHazard } from '../../core/field-types.ts';
import { CONFIG } from '../../config.ts';
import type { FlightState } from '../../core/field-prediction.ts';
import { HOMING_ROUTE_PROPOSAL as R, HOMING as H } from './settings.ts';
import { MINE } from '../moving-mine/settings.ts';
import { FIELD_LIMITS } from '../../core/field-settings.ts';
import { simulationTick } from '../moving-mine/motion.ts';

const ESCAPES=Object.freeze([{x:-R.halfX,y:-R.halfY},{x:-R.halfX,y:R.halfY},{x:R.halfX,y:-R.halfY},{x:R.halfX,y:R.halfY}].map(p=>Object.freeze(p)));
/** Four fixed goals ranked from the CURRENT coupled state. Extrapolation is
 * only a scoring feature, never a collision check or a future mine tape. */
export function homingEscapeGoal(hazards:readonly PlannedHazard[],state:Readonly<FlightState>):Readonly<{x:number;y:number}>|undefined {
 const h=hazards.find(h=>h.motion?.version==='adaptive-homing-v1');
 if(!h||state.distance>h.passDistance+h.radius+.57||hazards.some(o=>o!==h&&o.passDistance<h.passDistance&&o.passDistance+o.radius+.57>=state.distance))return;
 // Complete ownership distinguishes prior committed source spans from this
 // candidate's own two-cell ambient payload. Keep the isolated reference.
 const firstCell=(h.passDistance-MINE.offset)/FIELD_LIMITS.cellSize;
 if(!hazards.some(o=>o!==h&&o.ownerCell<firstCell)){
  const motion=h.motion;if(motion?.version!=='adaptive-homing-v1')return;
  const bait=-Math.sign(h.x)*4.8;return{x:simulationTick(state.elapsed)<motion.passTick-H.escapeProposalTicks?bait:-bait,y:0};
 }
 const m=state.homing??{x:h.x,y:h.y,vx:0,vy:0};
 const stopX=Math.max(-CONFIG.bounds.x,Math.min(CONFIG.bounds.x,state.x+state.vx*Math.abs(state.vx)/(2*CONFIG.ship.braking)));
 const stopY=Math.max(-CONFIG.bounds.y,Math.min(CONFIG.bounds.y,state.y+state.vy*Math.abs(state.vy)/(2*CONFIG.ship.braking)));
 const ex=stopX-m.x-m.vx*R.mineLeadSeconds,ey=stopY-m.y-m.vy*R.mineLeadSeconds;
 let best=ESCAPES[0]!,score=-Infinity;
 for(const goal of ESCAPES){const travel=Math.hypot(goal.x-stopX,goal.y-stopY),turn=(state.vx*(goal.x-state.x)<0?Math.abs(state.vx):0)+(state.vy*(goal.y-state.y)<0?Math.abs(state.vy):0);
  const value=(goal.x-state.x)*ex+(goal.y-state.y)*ey-R.travelWeight*travel-R.reversalWeight*turn/CONFIG.ship.acceleration;
  if(value>score){best=goal;score=value;}
 }return best;
}
