import * as T from 'three';
import type { GameModel } from '../core/game-model.ts';
import { SHIP_COLLIDER } from '../core/ship-collider.ts';
import { ShipHazardCollision } from '../core/ship-hazard-collision.ts';
import { fragmentsOf } from './state.ts';
import { FRAGMENT } from './settings.ts';
import { GUIDANCE as G } from './guidance-settings.ts';
import { GuideRibbon } from './guide-ribbon.ts';

const ray={id:'body' as const,offsetX:0,offsetY:0,offsetZ:0,radius:.02};

/** Current transverse alignment, not future steering/pickup prediction. The
 * outlines use the model's actual pickup profile/assists and target depth.
 * Queries use an independent kernel; no model collision counters are touched. */
export class PickupGuidance {
  readonly root=new T.Group();
  enabled:boolean=G.enabled;
  readonly beam=new GuideRibbon(G.segments*2,G.color,G.beamPixels,G.opacity);
  readonly marker=new GuideRibbon(G.markerSteps*3,G.color,G.markerPixels,G.opacity);
  readonly diagnostics={target:undefined as string|undefined,depth:0,aligned:false,blocked:false};
  private readonly query=new ShipHazardCollision();
  private readonly from={x:0,y:0,z:0};private readonly to={x:0,y:0,z:0};
  private readonly point=new T.Vector3();private readonly origin=new T.Vector3();
  private profile?:object;private assist=-1;private wingAssist=-1;
  private disposed=false;
  constructor(scene:T.Scene) {
    this.root.name='pickup-navigation';this.beam.mesh.name='wing-navigation-beams';this.marker.mesh.name='current-pickup-section';
    this.root.add(this.beam.mesh,this.marker.mesh);this.root.visible=false;scene.add(this.root);
  }
  reset():void {this.root.visible=false;this.marker.mesh.visible=false;this.diagnostics.target=undefined;this.diagnostics.depth=0;this.diagnostics.aligned=false;this.diagnostics.blocked=false;}
  private blocked(model:GameModel,ax:number,ay:number,az:number,bx:number,by:number,bz:number):boolean {
    for(const h of model.field.hazards) {
      if(!h.active)continue;
      this.from.x=ax-h.x;this.from.y=ay-h.y;this.from.z=az-h.z;
      this.to.x=bx-h.x;this.to.y=by-h.y;this.to.z=bz-h.z;
      if(this.query.hitPart(this.from,this.to,h,model.elapsed,0,ray))return true;
    }
    return false;
  }
  update(model:GameModel,ship:T.Object3D,camera:T.PerspectiveCamera,width:number,height:number):void {
    if(this.disposed)return;
    const run=fragmentsOf(model);
    if(!this.enabled||!run||(model.state!=='PLAYING'&&model.state!=='PAUSED')){this.reset();return;}
    this.beam.material.uniforms.resolution!.value.set(width,height);this.marker.material.uniforms.resolution!.value.set(width,height);
    if(model.state==='PAUSED'&&this.root.visible)return;
    this.root.visible=true;this.root.position.set(model.ship.x,model.ship.y,0);
    let index=0;
    for(const part of SHIP_COLLIDER.parts) {
      if(part.id==='body')continue;
      this.origin.set(part.offsetX,part.offsetY,part.offsetZ).applyQuaternion(ship.quaternion);
      for(let i=0;i<G.segments;i++) {
        const a=i===0?0:G.connectorDepth+(G.length-G.connectorDepth)*(i-1)/(G.segments-1),b=G.connectorDepth+(G.length-G.connectorDepth)*i/(G.segments-1);
        this.beam.segment(index++,i===0?this.origin.x:part.offsetX,i===0?this.origin.y:part.offsetY,i===0?this.origin.z:-a,
          part.offsetX,part.offsetY,-b,(1-a/G.length)**1.8);
      }
    }
    this.beam.commit(index);
    if(this.profile!==run.pickupProfile||this.assist!==run.pickupAssist||this.wingAssist!==run.wingPickupAssist) {
      this.profile=run.pickupProfile;this.assist=run.pickupAssist;this.wingAssist=run.wingPickupAssist;index=0;
      const parts=run.pickupProfile.parts;
      for(const part of parts) {
        const r=part.radius+FRAGMENT.pickupRadius+run.pickupAssist+(part.id==='body'?0:run.wingPickupAssist);
        for(let i=0;i<G.markerSteps;i++) {
          const angle=(i+.5)*Math.PI*2/G.markerSteps,x=part.offsetX+r*Math.cos(angle),y=part.offsetY+r*Math.sin(angle);
          if(parts.some(other=>other!==part&&Math.hypot(x-other.offsetX,y-other.offsetY)<other.radius+FRAGMENT.pickupRadius+run.pickupAssist+(other.id==='body'?0:run.wingPickupAssist)))continue;
          const a=i*Math.PI*2/G.markerSteps,b=(i+.72)*Math.PI*2/G.markerSteps;
          this.marker.segment(index++,part.offsetX+r*Math.cos(a),part.offsetY+r*Math.sin(a),0,part.offsetX+r*Math.cos(b),part.offsetY+r*Math.sin(b),0,1);
        }
      }
      this.marker.commit(index);
    }
    let target:typeof run.slots[number]['proposal'];let depth:number=G.length;
    camera.updateMatrixWorld();
    for(const slot of run.slots) {
      const p=slot.proposal;if(slot.state!=='active'||!p)continue;const z=p.passDistance-model.distance;
      if(z<G.nearDepth||z>depth)continue;
      this.point.set(p.x,p.y,-z).project(camera);
      if(Math.abs(this.point.x)>1.05||Math.abs(this.point.y)>1.05||this.point.z>1)continue;
      if(this.blocked(model,camera.position.x,camera.position.y,camera.position.z,p.x,p.y,-z))continue;
      target=p;depth=z;
    }
    this.marker.mesh.visible=!!target;this.diagnostics.target=target?.id;this.diagnostics.depth=target?depth:0;this.diagnostics.aligned=false;this.diagnostics.blocked=false;
    if(!target)return;
    this.marker.mesh.position.z=-depth;
    for(const part of run.pickupProfile.parts) {
      const r=part.radius+FRAGMENT.pickupRadius+run.pickupAssist+(part.id==='body'?0:run.wingPickupAssist);
      if(Math.hypot(target.x-model.ship.x-part.offsetX,target.y-model.ship.y-part.offsetY)>r)continue;
      if(this.blocked(model,model.ship.x+part.offsetX,model.ship.y+part.offsetY,part.offsetZ,target.x,target.y,-depth)){this.diagnostics.blocked=true;continue;}
      this.diagnostics.aligned=true;
    }
    this.marker.material.uniforms.opacity!.value=(this.diagnostics.aligned?G.alignedOpacity:G.opacity)*Math.min(1,(depth-G.nearDepth)/3)*Math.min(1,(G.length-depth)/8);
  }
  dispose():void {if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.beam.dispose();this.marker.dispose();}
}
