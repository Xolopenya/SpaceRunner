import { CONFIG } from '../config.ts';
import { sweptSphereHit } from '../core/collision.ts';
import type { FieldTransaction, PlannedHazard } from '../core/field-types.ts';
import type { SchedulerRoot } from '../core/field-scheduler.ts';
import { isWreck } from '../experiments/structure-variants/profile.ts';
import { fragmentHash, proposeFragment } from './placement.ts';
import type { FragmentProposal } from './placement.ts';
import { FRAGMENT as S } from './settings.ts';

export interface FragmentSlot { proposal?: FragmentProposal; state: 'disposed' | 'active' | 'collected' | 'retired' }
export class FragmentRun {
  readonly slots: FragmentSlot[] = Array.from({ length: S.capacity }, () => ({ state: 'disposed' }));
  count = 0;
  lastPickup = { x: 0, y: 0, distance: 0, elapsed: -1 };
  readonly stats = { published: 0, ordinary: 0, opportunities: 0, placed: 0, skipped: 0, candidatesRejected: 0,
    collected: 0, retired: 0, checks: 0, peakActive: 0, debris: 0, aperture: 0 };
  private ordinarySince = 0;
  private nextOrdinary = 2;
  private lastSection = -1;
  private readonly from = { x: 0, y: 0, z: 0 };
  private readonly to = { x: 0, y: 0, z: 0 };
  get active(): readonly FragmentProposal[] { return this.slots.flatMap(s => s.state === 'active' && s.proposal ? [s.proposal] : []); }

  reset(): void {
    for (const slot of this.slots) { slot.proposal = undefined; slot.state = 'disposed'; }
    this.count = this.ordinarySince = 0; this.nextOrdinary = 2; this.lastSection = -1;
    this.lastPickup = { x: 0, y: 0, distance: 0, elapsed: -1 };
    for (const key of Object.keys(this.stats) as (keyof typeof this.stats)[]) this.stats[key] = 0;
  }

  /** Called exclusively by ReleaseModel's successful publication hook. Full
   * field ownership is already committed; rejected proposals never enter here. */
  published(transaction: FieldTransaction, root: SchedulerRoot, known: readonly PlannedHazard[]): void {
    if (transaction.firstCell <= this.lastSection) return;
    this.lastSection = transaction.firstCell; this.stats.published++;
    const structure = transaction.hazards.some(isWreck);
    if (!structure) { this.ordinarySince++; this.stats.ordinary++; }
    // An occasional usable aperture may replace the next ordinary opportunity.
    // At least one ordinary section still separates it from the previous reward.
    if (this.ordinarySince < this.nextOrdinary && !(structure && this.ordinarySince >= 1)) return;
    this.stats.opportunities++;
    const slot = this.slots.find(s => s.state !== 'active');
    if (!slot) { this.stats.skipped++; return; }
    const proposal = proposeFragment(transaction, root, known, this.active, () => this.stats.candidatesRejected++);
    if (!proposal) { this.stats.skipped++; return; }
    slot.proposal = proposal; slot.state = 'active'; this.stats.placed++; this.stats[proposal.situation]++;
    this.ordinarySince = 0; this.nextOrdinary = 2 + fragmentHash(proposal.id + '/cadence') % 3;
    this.stats.peakActive = Math.max(this.stats.peakActive, this.active.length);
  }

  step(previousX: number, previousY: number, previousDistance: number, x: number, y: number, distance: number, elapsed: number): void {
    for (const slot of this.slots) {
      const p = slot.proposal;
      if (slot.state !== 'active' || !p) continue;
      this.from.x = previousX - p.x; this.from.y = previousY - p.y; this.from.z = p.passDistance - previousDistance;
      this.to.x = x - p.x; this.to.y = y - p.y; this.to.z = p.passDistance - distance;
      this.stats.checks++;
      if (sweptSphereHit(this.from, this.to, CONFIG.ship.radius + S.pickupRadius)) {
        slot.state = 'collected'; this.count++; this.stats.collected++;
        this.lastPickup = { x: p.x, y: p.y, distance, elapsed };
      } else if (distance - p.passDistance > CONFIG.hazards.despawnZ) { slot.state = 'retired'; this.stats.retired++; }
      if (slot.state !== 'active') slot.proposal = undefined;
    }
  }
}
