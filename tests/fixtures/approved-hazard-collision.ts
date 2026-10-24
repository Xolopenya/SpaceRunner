import { CONFIG } from '../../src/config.ts';
import { sweptSphereBoxHit, sweptSphereHit, sweptSphereInterval } from '../../src/core/collision.ts';
import { HAZARD_BOXES, hazardOrientation, hazardVariant, inverseRotate } from '../../src/core/hazard-profile.ts';
import type { HazardPose, Point3 } from '../../src/core/hazard-profile.ts';

interface ColliderHazard extends HazardPose { kind: number; radius: number }

/** Per-game reusable scratch state; no scene/model/Three.js dependency. */
export class ApprovedHazardCollision {
  private readonly range = new Float64Array(2);
  private readonly times = new Float64Array(8);
  private readonly angles = { x: 0, y: 0, z: 0 };
  private readonly localFrom = { x: 0, y: 0, z: 0 };
  private readonly localTo = { x: 0, y: 0, z: 0 };
  private readonly half = { x: 0, y: 0, z: 0 };

  hit(from: Point3, to: Point3, hazard: ColliderHazard, elapsed: number, dt: number): boolean {
    const bounds = HAZARD_BOXES[hazardVariant(hazard.kind, hazard.phase)];
    const outerRadius = hazard.radius + CONFIG.ship.radius;
    if (!bounds) return sweptSphereHit(from, to, outerRadius);
    // Retain the old sphere as a hard envelope: calibration cannot enlarge a
    // hazard's effective reach or invalidate any previously safe corridor.
    if (!sweptSphereInterval(from, to, outerRadius, this.range)) return false;
    hazardOrientation(hazard, elapsed - dt / 2, this.angles);
    inverseRotate(from, this.angles, this.localFrom);
    inverseRotate(to, this.angles, this.localTo);
    this.half.x = bounds.x * hazard.radius;
    this.half.y = bounds.y * hazard.radius;
    this.half.z = bounds.z * hazard.radius;
    // Continuous rotation guard: a point moves at most R * angular travel.
    // Euler X/Y rates bound angular speed by |spin|*(1+0.7); midpoint halves
    // the interval. At 120 Hz / maximum spin, padding is below 0.007 units.
    const rotationPad = Math.hypot(this.half.x, this.half.y, this.half.z) * Math.abs(hazard.spin) * 1.7 * dt / 2;
    return sweptSphereBoxHit(this.localFrom, this.localTo, this.half, CONFIG.ship.radius + rotationPad, this.range[0], this.range[1], this.times);
  }
}
