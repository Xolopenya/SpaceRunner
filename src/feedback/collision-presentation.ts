import { Euler, Quaternion, Vector3 } from 'three';
import type { CollisionContext } from '../events/game-events.ts';
import { hazardOrientation, hazardVariant, HAZARD_BOXES } from '../core/hazard-profile.ts';
import { PROFILES } from '../experiments/structure-variants/profile.ts';

export type CollisionFamily = 'rock' | 'metal' | 'mine' | 'station';
export function collisionFamily(kind: number): CollisionFamily {
  return kind === 9 ? 'mine' : kind >= 3 && kind < 9 ? 'station' : kind < 2 ? 'rock' : 'metal';
}

/** Nearest proxy surface for VFX only. No sweep, hit test, acceptance or gameplay writes.
 * The result is an approximation at the accepted step, not a swept TOI/physics normal. */
export function presentationContact(event: CollisionContext): { point: Vector3; normal: Vector3; family: CollisionFamily } {
  const family = collisionFamily(event.obstacleKind), center = new Vector3().copy(event.obstaclePosition);
  const ship = new Vector3().copy(event.position), local = ship.clone().sub(center);
  const pose = event.obstaclePose ?? { radius: 1, phase: 0, spin: 0 };
  const rotation = new Quaternion();
  if (family !== 'station' && family !== 'mine') {
    const angles = { x: 0, y: 0, z: 0 }; hazardOrientation(pose, event.elapsed, angles);
    rotation.setFromEuler(new Euler(angles.x, angles.y, angles.z)); local.applyQuaternion(rotation.clone().invert());
  }
  const box = HAZARD_BOXES[hazardVariant(event.obstacleKind, pose.phase)];
  const boxes = family === 'station' && PROFILES[event.obstacleKind - 4] ? PROFILES[event.obstacleKind - 4]!.boxes
    : family === 'metal' && box ? [{ center: { x: 0, y: 0, z: 0 }, half: { x: box.x * pose.radius, y: box.y * pose.radius, z: box.z * pose.radius } }] : [];
  let point = new Vector3(), normal = new Vector3(), best = Infinity;
  if (boxes.length) for (const b of boxes) {
    const p = new Vector3(Math.max(-b.half.x, Math.min(b.half.x, local.x - b.center.x)),
      Math.max(-b.half.y, Math.min(b.half.y, local.y - b.center.y)), Math.max(-b.half.z, Math.min(b.half.z, local.z - b.center.z)));
    const n = local.clone().sub(new Vector3().copy(b.center)).sub(p);
    if (n.lengthSq() < 1e-10) {
      const gaps = [b.half.x - Math.abs(p.x), b.half.y - Math.abs(p.y), b.half.z - Math.abs(p.z)];
      const axis = gaps.indexOf(Math.min(...gaps)); const sign = Math.sign(p.getComponent(axis)) || 1;
      p.setComponent(axis, [b.half.x, b.half.y, b.half.z][axis]! * sign); n.setComponent(axis, sign);
    }
    p.add(new Vector3().copy(b.center)); const distance = p.distanceToSquared(local);
    if (distance < best) { best = distance; point = p; normal = n.normalize(); }
  }
  else { normal.copy(local).normalize(); if (!normal.lengthSq()) normal.set(0, 0, 1); point.copy(normal).multiplyScalar(pose.radius); }
  point.applyQuaternion(rotation).add(center); normal.applyQuaternion(rotation);
  return { point, normal, family };
}
