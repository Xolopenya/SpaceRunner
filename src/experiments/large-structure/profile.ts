import { CONFIG } from '../../config.ts';
import { sweptSphereBoxHit } from '../../core/collision.ts';
import { HazardCollision } from '../../core/hazard-collision.ts';
import { FlightPrediction } from '../../core/field-prediction.ts';
import type { FlightState } from '../../core/field-prediction.ts';
import type { Point3 } from '../../core/hazard-profile.ts';
import type { PlannedHazard } from '../../core/field-types.ts';

/** Fixed world-unit contract, NOT a scale factor for an asteroid. Static XYZ=0.
 * The radius13 encloses all vertices; narrow phase is ONLY the four solid boxes.
 * Both the rendered mesh and every collision path consume these exact boxes.
 */
export const BULKHEAD = Object.freeze({
  version: 'bulkhead-compound-v1', encounterVersion: 'large-structure-v1',
  radius: 13, halfX: 10, halfY: 6.5, halfZ: 3, apertureX: 2.8, apertureY: 2.2,
  cellCount: 6, centerOffset: 60, primitiveCount: 4,
} as const);
export const BULKHEAD_BOXES = Object.freeze([
  { name: 'port-pier', center: { x: -6.4, y: 0, z: 0 }, half: { x: 3.6, y: 6.5, z: 3 } },
  { name: 'starboard-pier', center: { x: 6.4, y: 0, z: 0 }, half: { x: 3.6, y: 6.5, z: 3 } },
  { name: 'crown', center: { x: 0, y: 4.35, z: 0 }, half: { x: 2.8, y: 2.15, z: 3 } },
  { name: 'sill', center: { x: 0, y: -4.35, z: 0 }, half: { x: 2.8, y: 2.15, z: 3 } },
].map(box => Object.freeze({ ...box, center: Object.freeze(box.center), half: Object.freeze(box.half) })));

export function isBulkhead(h: { kind: number }): boolean { return h.kind === 3; }

/** No sphere across the aperture, no rotation, no instantaneous overlap shortcut.
 * All four primitive queries execute and are counted, including after first hit.
 */
export class BulkheadCollision extends HazardCollision {
  primitiveQueries = 0;
  private readonly compoundTimes = new Float64Array(8);
  private readonly a = { x: 0, y: 0, z: 0 };
  private readonly b = { x: 0, y: 0, z: 0 };
  override hit(from: Point3, to: Point3, hazard: { kind: number; radius: number; spin: number; phase: number }, elapsed: number, dt: number): boolean {
    if (!isBulkhead(hazard)) { this.primitiveQueries++; return super.hit(from, to, hazard, elapsed, dt); }
    return this.hitCompound(from, to);
  }
  hitCompound(from: Point3, to: Point3, margin = 0): boolean {
    if (!Number.isFinite(margin) || margin < 0) throw new RangeError('Invalid bulkhead margin');
    let hit = false;
    for (const box of BULKHEAD_BOXES) {
      this.a.x = from.x - box.center.x; this.a.y = from.y - box.center.y; this.a.z = from.z;
      this.b.x = to.x - box.center.x; this.b.y = to.y - box.center.y; this.b.z = to.z;
      this.primitiveQueries++;
      // Conservative per-primitive interval rejection. Still one charged box
      // query: only a strictly disjoint expanded slab may skip the exact kernel.
      const radius = CONFIG.ship.radius + margin + 1e-9;
      if (Math.min(this.a.x, this.b.x) > box.half.x + radius || Math.max(this.a.x, this.b.x) < -box.half.x - radius
        || Math.min(this.a.y, this.b.y) > box.half.y + radius || Math.max(this.a.y, this.b.y) < -box.half.y - radius
        || Math.min(this.a.z, this.b.z) > box.half.z + radius || Math.max(this.a.z, this.b.z) < -box.half.z - radius) continue;
      if (sweptSphereBoxHit(this.a, this.b, box.half, CONFIG.ship.radius + margin, 0, 1, this.compoundTimes)) hit = true;
    }
    return hit;
  }
}

export class BulkheadPrediction extends FlightPrediction {
  private readonly compound = new BulkheadCollision();
  private readonly a = { x: 0, y: 0, z: 0 };
  private readonly b = { x: 0, y: 0, z: 0 };
  override hit(previous: Readonly<FlightState>, next: Readonly<FlightState>, hazard: PlannedHazard, margin: number): boolean {
    if (!isBulkhead(hazard)) return super.hit(previous, next, hazard, margin);
    this.a.x = previous.x - hazard.x; this.a.y = previous.y - hazard.y; this.a.z = hazard.passDistance - previous.distance;
    this.b.x = next.x - hazard.x; this.b.y = next.y - hazard.y; this.b.z = hazard.passDistance - next.distance;
    return this.compound.hitCompound(this.a, this.b, margin);
  }
  override hitGameplay(previous: Readonly<FlightState>, next: Readonly<FlightState>, hazard: PlannedHazard): boolean {
    return isBulkhead(hazard) ? this.hit(previous, next, hazard, 0) : super.hitGameplay(previous, next, hazard);
  }
}
