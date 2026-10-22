import type { Point3 } from './hazard-profile.ts';

/** Closest approach of two spheres over one simulation step (relative motion). */
export function sweptSphereHit(from: Point3, to: Point3, radius: number): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, -(from.x * dx + from.y * dy + from.z * dz) / length2)) : 0;
  return Math.hypot(from.x + dx * t, from.y + dy * t, from.z + dz * t) <= radius;
}

/** Entry/exit times for the ORIGINAL outer sphere. No allocation per query. */
export function sweptSphereInterval(from: Point3, to: Point3, radius: number, range: Float64Array): boolean {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const offset = from.x * from.x + from.y * from.y + from.z * from.z - radius * radius;
  if (!length2) {
    range[0] = 0; range[1] = 1;
    return offset <= 0;
  }
  const dot = from.x * dx + from.y * dy + from.z * dz;
  const discriminant = dot * dot - length2 * offset;
  if (discriminant < 0) return false;
  const root = Math.sqrt(discriminant);
  range[0] = Math.max(0, (-dot - root) / length2);
  range[1] = Math.min(1, (-dot + root) / length2);
  return range[0]! <= range[1]!;
}

const AXES = ['x', 'y', 'z'] as const;
const DEFAULT_BREAKPOINTS = new Float64Array(8);

function distanceToBoxAt(from: Point3, to: Point3, half: Point3, t: number): number {
  const x = Math.max(0, Math.abs(from.x + (to.x - from.x) * t) - half.x);
  const y = Math.max(0, Math.abs(from.y + (to.y - from.y) * t) - half.y);
  const z = Math.max(0, Math.abs(from.z + (to.z - from.z) * t) - half.z);
  return x * x + y * y + z * z;
}

/** Exact linear sphere-vs-box CCD, including rounded edges/corners.
 * Distance² is quadratic between the six box-plane crossings. Restricting the
 * time range makes the box and outer-sphere conditions simultaneous.
 */
export function sweptSphereBoxHit(
  from: Point3, to: Point3, half: Point3, radius: number,
  start = 0, end = 1, times = DEFAULT_BREAKPOINTS,
): boolean {
  if (start > end) return false;
  const radius2 = radius * radius;
  if (distanceToBoxAt(from, to, half, start) <= radius2 + 1e-12) return true;
  times[0] = start; times[1] = end;
  let count = 2;
  for (const axis of AXES) {
    const delta = to[axis] - from[axis];
    if (!delta) continue;
    for (let sign = -1; sign <= 1; sign += 2) {
      const t = (sign * half[axis] - from[axis]) / delta;
      if (t <= start || t >= end) continue;
      let slot = count;
      while (slot > 0 && times[slot - 1]! > t) { times[slot] = times[slot - 1]!; slot--; }
      times[slot] = t;
      count++;
    }
  }
  for (let interval = 0; interval < count - 1; interval++) {
    const lo = times[interval]!, hi = times[interval + 1]!, middle = (lo + hi) / 2;
    let quadratic = 0, linear = 0;
    for (const axis of AXES) {
      const delta = to[axis] - from[axis];
      const position = from[axis] + delta * middle;
      if (Math.abs(position) <= half[axis]) continue;
      const offset = from[axis] - Math.sign(position) * half[axis];
      quadratic += delta * delta;
      linear += delta * offset;
    }
    const t = quadratic ? Math.max(lo, Math.min(hi, -linear / quadratic)) : middle;
    if (distanceToBoxAt(from, to, half, t) <= radius2 + 1e-12) return true;
  }
  return false;
}
