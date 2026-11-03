import { CONFIG } from '../config.ts';
import { sweptSphereHit } from '../core/collision.ts';
import type { FieldTransaction, PlannedHazard } from '../core/field-types.ts';
import type { SchedulerRoot } from '../core/field-scheduler.ts';
import { isWreck } from '../experiments/structure-variants/profile.ts';
import { fragmentHash, proposeFragment } from './placement.ts';
import type { FragmentProposal } from './placement.ts';
import { FRAGMENT as S } from './settings.ts';
import { BODY_COLLIDER } from '../core/ship-collider.ts';
import type { ShipColliderProfile, ShipColliderPart } from '../core/ship-collider.ts';
import { ShipHazardCollision } from '../core/ship-hazard-collision.ts';

interface PickupFeedback { x:number; y:number; distance:number; elapsed:number; z?:number; slot?:number; assisted?:boolean; part?:ShipColliderPart['id'] }
type PickupHazard = PlannedHazard | { readonly planned?: PlannedHazard };
const EMPTY_HAZARDS: readonly PickupHazard[] = [];
const SIGHT_RAY: ShipColliderPart = Object.freeze({id:'body',offsetX:0,offsetY:0,offsetZ:0,radius:.02});

export interface FragmentSlot { proposal?: FragmentProposal; state: 'disposed' | 'active' | 'collected' | 'retired' }
export class FragmentRun {
  readonly slots: FragmentSlot[] = Array.from({ length: S.capacity }, () => ({ state: 'disposed' }));
  count = 0;
  lastPickup: PickupFeedback = { x: 0, y: 0, distance: 0, elapsed: -1 };
  readonly stats = { published: 0, ordinary: 0, opportunities: 0, placed: 0, skipped: 0, candidatesRejected: 0,
    collected: 0, retired: 0, checks: 0, peakActive: 0, debris: 0, aperture: 0, occluded:0 };
  private ordinarySince = 0;
  private nextOrdinary = 2;
  private lastSection = -1;
  private readonly from = { x: 0, y: 0, z: 0 };
  private readonly to = { x: 0, y: 0, z: 0 };
  private readonly sightFrom = { x:0,y:0,z:0 };
  private readonly sightTo = { x:0,y:0,z:0 };
  private readonly sight = new ShipHazardCollision();
  readonly pickupProfile:ShipColliderProfile;
  readonly pickupAssist:number;
  constructor(pickupProfile:ShipColliderProfile=BODY_COLLIDER,pickupAssist=0) {this.pickupProfile=pickupProfile;this.pickupAssist=pickupAssist;}
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
    const proposal = proposeFragment(transaction, root, known, this.active, () => this.stats.candidatesRejected++,
      this.pickupAssist?{profile:this.pickupProfile,assist:this.pickupAssist}:undefined);
    if (!proposal) { this.stats.skipped++; return; }
    slot.proposal = proposal; slot.state = 'active'; this.stats.placed++; this.stats[proposal.situation]++;
    this.ordinarySince = 0; this.nextOrdinary = 2 + fragmentHash(proposal.id + '/cadence') % 3;
    this.stats.peakActive = Math.max(this.stats.peakActive, this.active.length);
  }

  step(previousX: number, previousY: number, previousDistance: number, x: number, y: number, distance: number, elapsed: number, hazards: readonly PickupHazard[] = EMPTY_HAZARDS): void {
    for (let index=0;index<this.slots.length;index++) {
      const slot=this.slots[index]!;
      const p = slot.proposal;
      if (slot.state !== 'active' || !p) continue;
      let contact:ShipColliderPart|undefined;
      for(const part of this.pickupProfile.parts){
        this.from.x=previousX+part.offsetX-p.x;this.from.y=previousY+part.offsetY-p.y;this.from.z=p.passDistance-previousDistance+part.offsetZ;
        this.to.x=x+part.offsetX-p.x;this.to.y=y+part.offsetY-p.y;this.to.z=p.passDistance-distance+part.offsetZ;
        this.stats.checks++;
        if(!sweptSphereHit(this.from,this.to,part.radius+S.pickupRadius+this.pickupAssist))continue;
        const dx=this.to.x-this.from.x,dy=this.to.y-this.from.y,dz=this.to.z-this.from.z,l=dx*dx+dy*dy+dz*dz;
        const t=l?Math.max(0,Math.min(1,-(this.from.x*dx+this.from.y*dy+this.from.z*dz)/l)):0;
        let blocked=false;
        for(const item of hazards){
          const h='planned' in item?item.planned:item as PlannedHazard;if(!h)continue;
          this.sightFrom.x=previousX+(x-previousX)*t+part.offsetX-h.x;this.sightFrom.y=previousY+(y-previousY)*t+part.offsetY-h.y;
          this.sightFrom.z=h.passDistance-(previousDistance+(distance-previousDistance)*t)+part.offsetZ;
          this.sightTo.x=p.x-h.x;this.sightTo.y=p.y-h.y;this.sightTo.z=h.passDistance-p.passDistance;
          if(this.sight.hitPart(this.sightFrom,this.sightTo,h,elapsed-CONFIG.step*(1-t),0,SIGHT_RAY)){blocked=true;break;}
        }
        if(blocked){this.stats.occluded++;continue;}contact=part;break;
      }
      if (contact) {
        slot.state = 'collected'; this.count++; this.stats.collected++;
        this.lastPickup = { x: p.x, y: p.y, z:distance-p.passDistance,distance,elapsed,slot:index,assisted:this.pickupAssist>0,part:contact.id };
      } else if (distance - p.passDistance > CONFIG.hazards.despawnZ) { slot.state = 'retired'; this.stats.retired++; }
      if (slot.state !== 'active') slot.proposal = undefined;
    }
  }
}
