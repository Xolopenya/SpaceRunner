import { CONFIG } from '../../config.ts';
import { sweptSphereHit } from '../../core/collision.ts';
import { WreckCollision, WreckPrediction } from '../structure-variants/profile.ts';
import type { Point3 } from '../../core/hazard-profile.ts';
import type { FlightState } from '../../core/field-prediction.ts';
import type { PlannedHazard } from '../../core/field-types.ts';
import { isMine, mineX, mineY } from './motion.ts';

/** Pure relative CCD, using the approved exact sphere primitive. */
export function movingMineHit(previous: Readonly<FlightState>, next: Readonly<FlightState>, h: PlannedHazard, margin = 0): boolean {
  return sweptSphereHit({ x: previous.x - mineX(h, previous.elapsed), y: previous.y - mineY(h, previous.elapsed), z: h.passDistance - previous.distance },
    { x: next.x - mineX(h, next.elapsed), y: next.y - mineY(h, next.elapsed), z: h.passDistance - next.distance }, h.radius + CONFIG.ship.radius + margin);
}
export class MinePrediction extends WreckPrediction {
  override hit(previous: Readonly<FlightState>, next: Readonly<FlightState>, h: PlannedHazard, margin: number): boolean {
    return isMine(h) ? movingMineHit(previous, next, h, margin) : super.hit(previous, next, h, margin);
  }
  override hitGameplay(previous: Readonly<FlightState>, next: Readonly<FlightState>, h: PlannedHazard): boolean {
    return isMine(h) ? movingMineHit(previous, next, h) : super.hitGameplay(previous, next, h);
  }
}
/** GameModel supplies endpoints relative to END pose. Correct the previous XY;
 * the base ship/damage/update loop and static/wreck queries remain intact. */
export class MineCollision extends WreckCollision {
  private readonly mineFrom = { x: 0, y: 0, z: 0 };
  override hit(from: Point3, to: Point3, h: { kind: number; radius: number; phase: number; spin: number; planned?: PlannedHazard }, elapsed: number, dt: number): boolean {
    if (!isMine(h)) return super.hit(from, to, h, elapsed, dt);
    if (!h.planned?.motion) throw new Error('Mine without authoritative trajectory');
    this.primitiveQueries++;
    this.mineFrom.x = from.x + mineX(h.planned, elapsed) - mineX(h.planned, elapsed - dt);
    this.mineFrom.y = from.y + mineY(h.planned, elapsed) - mineY(h.planned, elapsed - dt); this.mineFrom.z = from.z;
    return sweptSphereHit(this.mineFrom, to, h.radius + CONFIG.ship.radius);
  }
}
