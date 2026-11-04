import { CONFIG } from '../config.ts';
import type { Point3 } from '../core/hazard-profile.ts';
import type { FlightState } from '../core/field-prediction.ts';
import type { FieldValidationContext, PlannedHazard } from '../core/field-types.ts';
import { ShipHazardCollision } from '../core/ship-hazard-collision.ts';
import type { CollisionHazard } from '../core/ship-hazard-collision.ts';
import { SHIP_COLLIDER } from '../core/ship-collider.ts';
import { AdaptivePrediction } from '../experiments/adaptive-homing/prediction.ts';
import type { AdaptiveSource } from '../experiments/adaptive-homing/source.ts';

/** Same compound kernel for runtime, clearance search and independent replay. */
export class IntegratedPrediction extends AdaptivePrediction {
  private readonly compound = new ShipHazardCollision();
  private readonly compoundFrom = { x: 0, y: 0, z: 0 };
  private readonly compoundTo = { x: 0, y: 0, z: 0 };
  constructor(context?: FieldValidationContext) {
    super([...context?.committed ?? [], ...context?.candidate.hazards ?? []].find(h => h.motion?.version === 'adaptive-homing-v1'));
  }
  override hit(a: Readonly<FlightState>, b: Readonly<FlightState>, h: PlannedHazard, margin: number): boolean {
    const moving = h.motion?.version === 'adaptive-homing-v1';
    if (moving && a.distance > h.passDistance + h.radius + SHIP_COLLIDER.axialExtent + margin
      && b.distance > h.passDistance + h.radius + SHIP_COLLIDER.axialExtent + margin) return false;
    if (moving && (a.homing?.id !== h.id || b.homing?.id !== h.id)) throw new Error('Missing compound feedback endpoints');
    this.compoundFrom.x = a.x - (moving ? a.homing!.x : h.x);
    this.compoundFrom.y = a.y - (moving ? a.homing!.y : h.y);
    this.compoundFrom.z = h.passDistance - a.distance;
    this.compoundTo.x = b.x - (moving ? b.homing!.x : h.x);
    this.compoundTo.y = b.y - (moving ? b.homing!.y : h.y);
    this.compoundTo.z = h.passDistance - b.distance;
    return this.compound.hit(this.compoundFrom, this.compoundTo, h, b.elapsed, CONFIG.step, margin);
  }
  override hitGameplay(a: Readonly<FlightState>, b: Readonly<FlightState>, h: PlannedHazard): boolean { return this.hit(a, b, h, 0); }
}

export class IntegratedCollision extends ShipHazardCollision {
  private readonly source: AdaptiveSource;
  private readonly previous = { x: 0, y: 0, z: 0 };
  constructor(source: AdaptiveSource) { super(SHIP_COLLIDER, true); this.source = source; }
  override hit(from: Point3, to: Point3, h: CollisionHazard, elapsed: number, dt: number, margin = 0): boolean {
    if (h.planned?.motion?.version !== 'adaptive-homing-v1') return super.hit(from, to, h, elapsed, dt, margin);
    const interval = this.source.interval(h.planned);
    if (!interval) throw new Error('Missing authoritative compound interval');
    this.previous.x = from.x + interval.to.x - interval.from.x;
    this.previous.y = from.y + interval.to.y - interval.from.y;
    this.previous.z = from.z;
    return super.hit(this.previous, to, h, elapsed, dt, margin);
  }
}
