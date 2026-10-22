interface Point3 { x: number; y: number; z: number }

/** Closest approach of two spheres over one simulation step (relative motion). */
export function sweptSphereHit(from: Point3, to: Point3, radius: number): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, -(from.x * dx + from.y * dy + from.z * dz) / length2)) : 0;
  return Math.hypot(from.x + dx * t, from.y + dy * t, from.z + dz * t) <= radius;
}
