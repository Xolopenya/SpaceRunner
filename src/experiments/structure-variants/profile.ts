import { CONFIG } from '../../config.ts';
import { sweptSphereBoxHit } from '../../core/collision.ts';
import { HazardCollision } from '../../core/hazard-collision.ts';
import { FlightPrediction } from '../../core/field-prediction.ts';
import type { FlightState } from '../../core/field-prediction.ts';
import type { Point3 } from '../../core/hazard-profile.ts';
import type { PlannedHazard } from '../../core/field-types.ts';

export const WRECK = Object.freeze({ profile: 'wreck-frame-compound-v2', contract: 'wreck-size-contract-v2',
  radius: 13, halfX: 10, halfY: 6.5, axial: 3, apertureX: 2.8, apertureY: 2.2, cellCount: 6, centerOffset: 60, primitiveCount: 4 } as const);
export const APERTURES = Object.freeze({ center: { x: 0, y: 0 }, left: { x: -3, y: 0 }, right: { x: 3, y: 0 }, upper: { x: 0, y: 1.9 }, lower: { x: 0, y: -1.9 } });
export type Aperture = keyof typeof APERTURES;
export const APERTURE_NAMES = Object.freeze(Object.keys(APERTURES) as Aperture[]);
export interface WreckBox { readonly name: string; readonly center: Readonly<Point3>; readonly half: Readonly<Point3> }
function box(name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): WreckBox {
  return Object.freeze({ name, center: Object.freeze({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }),
    half: Object.freeze({ x: (x1 - x0) / 2, y: (y1 - y0) / 2, z: (z1 - z0) / 2 }) });
}
export const PROFILES = Object.freeze(APERTURE_NAMES.map(name => {
  const p = Object.freeze(APERTURES[name]), l = p.x - WRECK.apertureX, r = p.x + WRECK.apertureX, b = p.y - WRECK.apertureY, t = p.y + WRECK.apertureY;
  return Object.freeze({ name, aperture: p, boxes: Object.freeze([
    box('port-spine', -10, l, -6.5, 6.5, -2.6, 2.6),
    box('starboard-machinery', r, 10, -5.9, 6.5, -1.8, 2.4),
    box('broken-crown', l, r, t, 6, -2.25, 1.35),
    box('keel-beam', l, r, -5.6, b, -2.6, 2.2),
  ]) });
}));
export function isWreck(h: { kind: number }): boolean { return Number.isInteger(h.kind) && h.kind >= 4 && h.kind < 9; }
export function wreckProfile(h: { kind: number }) { const p = PROFILES[h.kind - 4]; if (!p) throw new RangeError('Unknown wreck profile'); return p; }
export function apertureSelector(value: string | null): Aperture {
  if (value === null) return 'center';
  if (Object.hasOwn(APERTURES, value)) return value as Aperture;
  throw new RangeError(`Unknown aperture: ${value}`);
}
export type StructureMode = 'isolated' | 'mixed';
export function structureMode(value: string | null): StructureMode {
  if (value === null || value === 'isolated') return 'isolated'; if (value === 'mixed') return value;
  throw new RangeError(`Unknown structure mode: ${value}`);
}

/** Fixed world-axis solids with asymmetric depths. Every box is charged/executed.
 * Shared kernel and unchanged ship sphere; no sphere or plane across the hole.
 */
export class WreckCollision extends HazardCollision {
  primitiveQueries = 0;
  private readonly breaks = new Float64Array(8);
  private readonly a = { x: 0, y: 0, z: 0 };
  private readonly b = { x: 0, y: 0, z: 0 };
  override hit(from: Point3, to: Point3, h: { kind: number; radius: number; phase: number; spin: number }, elapsed: number, dt: number): boolean {
    if (!isWreck(h)) { this.primitiveQueries++; return super.hit(from, to, h, elapsed, dt); }
    return this.sweep(from, to, h, 0);
  }
  sweep(from: Point3, to: Point3, h: { kind: number }, margin: number): boolean {
    if (!Number.isFinite(margin) || margin < 0) throw new RangeError('Invalid clearance');
    let hit = false; const radius = CONFIG.ship.radius + margin, guard = radius + 1e-9;
    for (const part of wreckProfile(h).boxes) {
      for (const axis of ['x', 'y', 'z'] as const) { this.a[axis] = from[axis] - part.center[axis]; this.b[axis] = to[axis] - part.center[axis]; }
      this.primitiveQueries++;
      if (Math.min(this.a.x, this.b.x) > part.half.x + guard || Math.max(this.a.x, this.b.x) < -part.half.x - guard
        || Math.min(this.a.y, this.b.y) > part.half.y + guard || Math.max(this.a.y, this.b.y) < -part.half.y - guard
        || Math.min(this.a.z, this.b.z) > part.half.z + guard || Math.max(this.a.z, this.b.z) < -part.half.z - guard) continue;
      if (sweptSphereBoxHit(this.a, this.b, part.half, radius, 0, 1, this.breaks)) hit = true;
    }
    return hit;
  }
}
export class WreckPrediction extends FlightPrediction {
  private readonly wreck = new WreckCollision();
  override hit(previous: Readonly<FlightState>, next: Readonly<FlightState>, h: PlannedHazard, margin: number): boolean {
    if (!isWreck(h)) return super.hit(previous, next, h, margin);
    return this.wreck.sweep({ x: previous.x - h.x, y: previous.y - h.y, z: h.passDistance - previous.distance },
      { x: next.x - h.x, y: next.y - h.y, z: h.passDistance - next.distance }, h, margin);
  }
  override hitGameplay(previous: Readonly<FlightState>, next: Readonly<FlightState>, h: PlannedHazard): boolean {
    return isWreck(h) ? this.hit(previous, next, h, 0) : super.hitGameplay(previous, next, h);
  }
}
