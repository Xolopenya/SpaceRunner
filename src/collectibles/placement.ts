import { CONFIG } from '../config.ts';
import { sweptSphereBoxHit } from '../core/collision.ts';
import type { FieldTransaction, PlannedHazard } from '../core/field-types.ts';
import type { SchedulerRoot } from '../core/field-scheduler.ts';
import { isWreck, wreckProfile } from '../experiments/structure-variants/profile.ts';
import { RELEASE } from '../release/settings.ts';
import { FRAGMENT as S } from './settings.ts';

export interface FragmentProposal {
  readonly id: string; readonly section: number; readonly anchor: string;
  readonly situation: 'debris' | 'aperture';
  readonly x: number; readonly y: number; readonly passDistance: number;
}
export function fragmentHash(value: string): number {
  let hash = 2166136261;
  for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Conservative local capsule check, including every station solid. Ordinary
 * rotating proxies remain inside their full sphere at ALL orientations.
 * This checks a local approach, not a route from the current player position. */
export function fragmentClear(p: Pick<FragmentProposal, 'x' | 'y' | 'passDistance'>, hazards: readonly PlannedHazard[]): boolean {
  const radius = CONFIG.ship.radius + S.pickupRadius + S.clearance;
  for (const h of hazards) {
    const z = h.passDistance - p.passDistance;
    if (isWreck(h)) {
      for (const box of wreckProfile(h).boxes) {
        const from = { x: p.x - h.x - box.center.x, y: p.y - h.y - box.center.y, z: z - box.center.z - S.approachDepth };
        const to = { ...from, z: from.z + S.approachDepth * 2 };
        if (sweptSphereBoxHit(from, to, box.half, radius)) return false;
      }
    } else if (Math.hypot(p.x - h.x, p.y - h.y, Math.max(0, Math.abs(z) - S.approachDepth)) <= h.radius + radius) return false;
  }
  return true;
}

export function fragmentReachable(p: Pick<FragmentProposal, 'x' | 'y' | 'passDistance'>, root: SchedulerRoot): boolean {
  if (Math.abs(p.x) > CONFIG.bounds.x - S.boundaryInset || Math.abs(p.y) > CONFIG.bounds.y - S.boundaryInset) return false;
  const ship = root.player, speed = Math.hypot(ship.vx, ship.vy);
  const travel = Math.hypot(p.x - ship.x, p.y - ship.y);
  // Time allowance for reaction, cancelling existing velocity, acceleration,
  // travel and braking. Maximum forward speed makes the lead estimate shorter.
  const required = S.reactionSeconds + speed / CONFIG.ship.braking
    + CONFIG.ship.maxSpeed / CONFIG.ship.acceleration + travel / CONFIG.ship.maxSpeed
    + CONFIG.ship.maxSpeed / CONFIG.ship.braking;
  return (p.passDistance - root.distance - S.approachDepth) / (CONFIG.flight.maxSpeed * RELEASE.phase2SpeedMultiplier) >= required;
}

/** One bounded proposal per admitted section. No generator RNG or planning work. */
export function proposeFragment(transaction: FieldTransaction, root: SchedulerRoot, hazards: readonly PlannedHazard[],
  active: readonly FragmentProposal[], reject: (reason: string) => void): FragmentProposal | undefined {
  const key = `${S.version}/${transaction.provenance.seed}/${transaction.firstCell}`;
  const hash = fragmentHash(key), wreck = transaction.hazards.find(isWreck);
  const anchors = wreck ? [wreck] : [...transaction.hazards].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (!anchors.length) return undefined;
  for (let i = 0; i < S.maxCandidates; i++) {
    const anchor = anchors[(hash + Math.floor(i / 4)) % anchors.length]!;
    const index = ((hash >>> 8) + i) % 8;
    const angle = index * Math.PI / 4;
    const aperture = wreck ? wreckProfile(wreck).aperture : undefined;
    const offset = anchor.radius + CONFIG.ship.radius + S.pickupRadius + S.clearance + .18;
    const x = anchor.x + (aperture ? aperture.x + Math.cos(angle) * 1.55 : Math.cos(angle) * offset);
    const y = anchor.y + (aperture ? aperture.y + Math.sin(angle) * 1.08 : Math.sin(angle) * offset);
    const p: FragmentProposal = Object.freeze({ id: key, section: transaction.firstCell, anchor: anchor.id,
      situation: wreck ? 'aperture' : 'debris', x, y, passDistance: anchor.passDistance });
    if (!fragmentReachable(p, root)) { reject('bounds-or-lead'); continue; }
    const coastX = root.player.x + root.player.vx * Math.abs(root.player.vx) / (2 * CONFIG.ship.braking);
    const coastY = root.player.y + root.player.vy * Math.abs(root.player.vy) / (2 * CONFIG.ship.braking);
    if (Math.hypot(x - coastX, y - coastY) < S.naturalRouteOffset) { reject('natural-route'); continue; }
    if (active.some(a => Math.hypot(a.x - x, a.y - y, a.passDistance - p.passDistance) < S.separation)) { reject('separation'); continue; }
    if (!fragmentClear(p, hazards)) { reject('hazard-clearance'); continue; }
    return p;
  }
  return undefined;
}
