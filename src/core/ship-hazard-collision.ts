import { HazardCollision } from './hazard-collision.ts';
import { sweptSphereBoxHit, sweptSphereHit, sweptSphereInterval } from './collision.ts';
import { HAZARD_BOXES, hazardOrientation, hazardVariant, inverseRotate } from './hazard-profile.ts';
import type { Point3 } from './hazard-profile.ts';
import { SHIP_COLLIDER } from './ship-collider.ts';
import type { ShipColliderPart, ShipColliderProfile } from './ship-collider.ts';
import { isWreck, wreckProfile } from '../experiments/structure-variants/profile.ts';
import type { PlannedHazard } from './field-types.ts';

export interface CollisionHazard { kind: number; radius: number; phase: number; spin: number; planned?: PlannedHazard; x?:number;y?:number;z?:number }
export interface ShipContact {readonly id?:string;readonly part:ShipColliderPart['id'];readonly bodyClear:boolean;readonly elapsed:number;readonly x:number;readonly y:number;readonly z:number;readonly kind:number;readonly radius:number;readonly phase:number;readonly spin:number}
const AXES = ['x','y','z'] as const;
/** Shared runtime/clearance kernel. Union of actual spheres; enclosing sphere
 * is ONLY broad phase. No allocations or mutable globals in the tick loop. */
export class ShipHazardCollision extends HazardCollision {
  readonly profile: ShipColliderProfile;
  narrowQueries = 0;
  broadSkips = 0;
  lastPart?: ShipColliderPart['id'];
  contact?:ShipContact;
  private readonly captureContacts:boolean;
  private readonly interval = new Float64Array(2);
  private readonly breaks = new Float64Array(8);
  private readonly orientation = { x: 0, y: 0, z: 0 };
  private readonly a = { x: 0, y: 0, z: 0 };
  private readonly b = { x: 0, y: 0, z: 0 };
  private readonly localA = { x: 0, y: 0, z: 0 };
  private readonly localB = { x: 0, y: 0, z: 0 };
  private readonly halfSize = { x: 0, y: 0, z: 0 };
  constructor(profile = SHIP_COLLIDER,captureContacts=false) { super(); this.profile = profile;this.captureContacts=captureContacts; }
  reset():void {this.narrowQueries=this.broadSkips=0;this.lastPart=undefined;this.contact=undefined;}
  override hit(from: Point3, to: Point3, h: CollisionHazard, elapsed: number, dt: number, margin = 0): boolean {
    if (!Number.isFinite(margin) || margin < 0) throw new RangeError('Invalid ship clearance');
    this.lastPart = undefined;
    if (!sweptSphereHit(from, to, h.radius + this.profile.enclosingRadius + margin + 1e-9)) { this.broadSkips++; return false; }
    for (const part of this.profile.parts) if (this.hitPart(from, to, h, elapsed, dt, part, margin)) {
      this.lastPart = part.id;
      if(this.captureContacts&&h.x!==undefined&&h.y!==undefined&&h.z!==undefined)this.contact=Object.freeze({id:h.planned?.id,part:part.id,bodyClear:part.id!=='body',elapsed,x:h.x,y:h.y,z:h.z,kind:h.kind,radius:h.radius,phase:h.phase,spin:h.spin});
      return true;
    }
    return false;
  }
  hitPart(from: Point3, to: Point3, h: CollisionHazard, elapsed: number, dt: number, part: ShipColliderPart, margin = 0): boolean {
    this.a.x = from.x + part.offsetX; this.a.y = from.y + part.offsetY; this.a.z = from.z + part.offsetZ;
    this.b.x = to.x + part.offsetX; this.b.y = to.y + part.offsetY; this.b.z = to.z + part.offsetZ;
    const radius = part.radius + margin,guard=radius+1e-9;
    if (isWreck(h)) {
      for (const box of wreckProfile(h).boxes) {
        for (const axis of AXES) { this.localA[axis] = this.a[axis] - box.center[axis]; this.localB[axis] = this.b[axis] - box.center[axis]; }
        if (Math.min(this.localA.x,this.localB.x)>box.half.x+guard || Math.max(this.localA.x,this.localB.x)<-box.half.x-guard
          || Math.min(this.localA.y,this.localB.y)>box.half.y+guard || Math.max(this.localA.y,this.localB.y)<-box.half.y-guard
          || Math.min(this.localA.z,this.localB.z)>box.half.z+guard || Math.max(this.localA.z,this.localB.z)<-box.half.z-guard) { this.broadSkips++; continue; }
        this.narrowQueries++;
        if (sweptSphereBoxHit(this.localA,this.localB,box.half,radius,0,1,this.breaks)) return true;
      }
      return false;
    }
    // Kind3 is the existing sphere-only moving mine; caller supplies its
    // relative endpoints. It is not admitted by the production release source.
    const bounds = h.kind === 3 ? undefined : HAZARD_BOXES[hazardVariant(h.kind,h.phase)];
    if (!bounds) { this.narrowQueries++; return sweptSphereHit(this.a,this.b,h.radius+radius); }
    if (!sweptSphereInterval(this.a,this.b,h.radius+radius,this.interval)) { this.broadSkips++; return false; }
    hazardOrientation(h,elapsed-dt/2,this.orientation);
    inverseRotate(this.a,this.orientation,this.localA); inverseRotate(this.b,this.orientation,this.localB);
    this.halfSize.x=bounds.x*h.radius;this.halfSize.y=bounds.y*h.radius;this.halfSize.z=bounds.z*h.radius;
    const rotationPad=Math.hypot(this.halfSize.x,this.halfSize.y,this.halfSize.z)*Math.abs(h.spin)*1.7*dt/2;
    this.narrowQueries++;
    return sweptSphereBoxHit(this.localA,this.localB,this.halfSize,radius+rotationPad,this.interval[0],this.interval[1],this.breaks);
  }
}
