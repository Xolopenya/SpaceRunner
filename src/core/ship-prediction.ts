import { CONFIG } from '../config.ts';
import { FlightPrediction } from './field-prediction.ts';
import type { FlightState } from './field-prediction.ts';
import type { PlannedHazard } from './field-types.ts';
import { ShipHazardCollision } from './ship-hazard-collision.ts';

/** Independent integration still comes from FlightPrediction; both clearance
 * replay and actual replay use the same measured shape, with fresh scratch. */
export class ShipPrediction extends FlightPrediction {
  private readonly collision = new ShipHazardCollision();
  private readonly a = { x: 0, y: 0, z: 0 };
  private readonly b = { x: 0, y: 0, z: 0 };
  override hit(previous: Readonly<FlightState>, next: Readonly<FlightState>, h: PlannedHazard, margin: number): boolean {
    this.a.x=previous.x-h.x;this.a.y=previous.y-h.y;this.a.z=h.passDistance-previous.distance;
    this.b.x=next.x-h.x;this.b.y=next.y-h.y;this.b.z=h.passDistance-next.distance;
    return this.collision.hit(this.a,this.b,h,next.elapsed,CONFIG.step,margin);
  }
  override hitGameplay(previous: Readonly<FlightState>, next: Readonly<FlightState>, h: PlannedHazard): boolean { return this.hit(previous,next,h,0); }
}
