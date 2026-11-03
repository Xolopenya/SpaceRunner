// Frozen c51da9d proposal functions for reproducing archived rejections only.
import {ADAPTIVE_GEOMETRY} from '../../src/experiments/adaptive-homing/transaction.ts';
import {MINE_GEOMETRY} from '../../src/experiments/moving-mine/source.ts';
import type {PlannedHazard} from '../../src/core/field-types.ts';
import type {FlightState} from '../../src/core/field-prediction.ts';
function goal(hazards:readonly PlannedHazard[],s:Readonly<FlightState>){const h=hazards.find(h=>h.motion?.version==='adaptive-homing-v1'),m=h?.motion;if(!h||m?.version!=='adaptive-homing-v1'||s.distance>h.passDistance+h.radius+.57)return;
 if(hazards.some(o=>o!==h&&o.passDistance<h.passDistance&&o.passDistance+o.radius+.57>=s.distance))return;
 const bait=-Math.sign(h.x)*4.8;return{x:Math.round(s.elapsed*120)<m.passTick-132?bait:-bait,y:0};}
export const ORIGINAL_HOMING_GEOMETRY={...ADAPTIVE_GEOMETRY,goalsAt:(h:readonly PlannedHazard[],d:number,s?:Readonly<FlightState>)=>{const g=s?goal(h,s):undefined;return g?[g]:MINE_GEOMETRY.goalsAt?.(h,d,s);},
 steering:(h:readonly PlannedHazard[],s:Readonly<FlightState>)=>{const g=goal(h,s);if(!g)return;const axis=(e:number,v:number)=>Math.abs(e)<=v*v/(2*25)+.08&&e*v>=0?0:Math.sign(e);return{x:axis(g.x-s.x,s.vx),y:axis(g.y-s.y,s.vy)};}};
