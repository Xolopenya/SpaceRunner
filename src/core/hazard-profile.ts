export interface Point3 { x: number; y: number; z: number }
export interface HazardPose { spin: number; phase: number }

// Measured from the shipped, normalized GLBs, rounded outward to 1e-6.
// Unit half-extents; multiply by hazard.radius. See scripts/collision-audit.mjs.
export const HAZARD_BOXES: readonly (Readonly<Point3> | undefined)[] = [
  undefined, undefined,
  { x: 0.920546, y: 0.390636, z: 0.797216 }, // meteor_half.glb
  { x: 0.624696, y: 0.780869, z: 0.541002 }, // barrel.glb
  { x: 0.784773, y: 0.448442, z: 0.588580 }, // machine_generator.glb
];

/** Same mapping and random draw count as the approved Phase 2 generator. */
export function hazardVariant(kind: number, phase: number): number {
  return kind === 0 ? 0 : kind === 1 ? (phase < Math.PI ? 1 : 2) : (phase < Math.PI ? 3 : 4);
}

/** Three.js Euler XYZ; shared by rendering, collision and developer visualization. */
export function hazardOrientation(pose: HazardPose, elapsed: number, out: Point3): void {
  out.x = elapsed * pose.spin + pose.phase;
  out.y = elapsed * pose.spin * 0.7;
  out.z = pose.phase;
}

export function inverseRotate(point: Point3, angles: Point3, out: Point3): void {
  const originalX = point.x;
  const cx = Math.cos(angles.x), sx = Math.sin(angles.x);
  const cy = Math.cos(angles.y), sy = Math.sin(angles.y);
  const cz = Math.cos(angles.z), sz = Math.sin(angles.z);
  const y = cx * point.y + sx * point.z;
  const z = -sx * point.y + cx * point.z;
  const x = cy * originalX - sy * z;
  out.x = cz * x + sz * y;
  out.y = -sz * x + cz * y;
  out.z = sy * originalX + cy * z;
}
