import { CONFIG } from '../config.ts';
import { sweptSphereBoxHit, sweptSphereHit, sweptSphereInterval } from './collision.ts';
import { HAZARD_BOXES, hazardOrientation, hazardVariant, inverseRotate } from './hazard-profile.ts';
import type { HazardPose, Point3 } from './hazard-profile.ts';

/** Isolated margin adapter. Same sweeps/profiles/XYZ/midpoint guard as gameplay.
 * Gameplay's pinned zero-margin module remains untouched. Differential goldens
 * compare this adapter with its frozen approved implementation over10000 sweeps.
 */
export class ClearanceHazardCollision {
  private readonly range = new Float64Array(2);
  private readonly times = new Float64Array(8);
  private readonly angles = { x: 0, y: 0, z: 0 };
  private readonly localFrom = { x: 0, y: 0, z: 0 };
  private readonly localTo = { x: 0, y: 0, z: 0 };
  private readonly half = { x: 0, y: 0, z: 0 };

  hit(from: Point3, to: Point3, hazard: HazardPose & { kind: number; radius: number }, elapsed: number, dt: number, margin = 0): boolean {
    if (!Number.isFinite(margin) || margin < 0) throw new RangeError('Collision margin must be finite and nonnegative');
    const bounds = HAZARD_BOXES[hazardVariant(hazard.kind, hazard.phase)];
    const outerRadius = hazard.radius + CONFIG.ship.radius + margin;
    if (!bounds) return sweptSphereHit(from, to, outerRadius);
    if (!sweptSphereInterval(from, to, outerRadius, this.range)) return false;
    hazardOrientation(hazard, elapsed - dt / 2, this.angles);
    inverseRotate(from, this.angles, this.localFrom);
    inverseRotate(to, this.angles, this.localTo);
    this.half.x = bounds.x * hazard.radius;
    this.half.y = bounds.y * hazard.radius;
    this.half.z = bounds.z * hazard.radius;
    const rotationPad = Math.hypot(this.half.x, this.half.y, this.half.z) * Math.abs(hazard.spin) * 1.7 * dt / 2;
    return sweptSphereBoxHit(this.localFrom, this.localTo, this.half, CONFIG.ship.radius + margin + rotationPad, this.range[0], this.range[1], this.times);
  }
}
