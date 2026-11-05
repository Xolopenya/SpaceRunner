import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, SphereGeometry, WireframeGeometry } from 'three';
import type { Scene } from 'three';
import { CONFIG } from '../config.ts';
import { ResourceOwner } from '../assets/resources.ts';
import { HAZARD_MODELS } from '../assets/catalog.ts';
import { HAZARD_BOXES, hazardOrientation, hazardVariant } from '../core/hazard-profile.ts';
import type { GameModel } from '../core/game-model.ts';
import type { ColliderDebugView } from './types.ts';
import { BODY_COLLIDER } from '../core/ship-collider.ts';
import type { ShipColliderProfile } from '../core/ship-collider.ts';
import type { ShipContact } from '../core/ship-hazard-collision.ts';
import { fragmentsOf } from '../collectibles/state.ts';
import { FRAGMENT } from '../collectibles/settings.ts';
import { isWreck, wreckProfile } from '../experiments/structure-variants/profile.ts';

/** Imported dynamically only under import.meta.env.DEV. No production geometry. */
export class ColliderDebugger implements ColliderDebugView {
  private readonly root = new Group();
  private readonly player: LineSegments;
  private readonly hazards: Group[] = [];
  private readonly resources = new ResourceOwner();
  private readonly angles = { x: 0, y: 0, z: 0 };
  private readonly info = document.createElement('aside');
  private lastInfoTime = -1;
  private disposed = false;
  private readonly profile:ShipColliderProfile;
  private readonly players:LineSegments[]=[];
  private readonly fragmentVolumes:LineSegments[]=[];
  private readonly ghost=new Group();
  private slots:readonly Group[]=[];
  private hitSerial=0;
  private impact?:ShipContact;

  constructor(scene: Scene,profile:ShipColliderProfile=BODY_COLLIDER) {
    this.profile=profile;
    this.root.name = 'collision-debug-root';
    const sphereSource = new SphereGeometry(1, 16, 10);
    const sphere = new WireframeGeometry(sphereSource);
    sphereSource.dispose();
    const boxSource = new BoxGeometry(2, 2, 2);
    const box = new EdgesGeometry(boxSource);
    boxSource.dispose();
    const material = (color: number, opacity: number) => new LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
    const sphereMaterial = material(0xffb66e, 0.35);
    const boxMaterial = material(0x69f4d3, 0.9);
    this.player = new LineSegments(sphere, material(0xff83d1, 0.95));
    this.player.name = 'collider-player';
    this.player.scale.setScalar(CONFIG.ship.radius);
    this.root.add(this.player);
    this.players.push(this.player);
    if(profile.parts.length>1){
      for(let i=1;i<profile.parts.length;i++){const wire=new LineSegments(sphere,material(i===1?0x52ffb2:0x7faaff,.95));wire.name=`collider-${profile.parts[i]!.id}`;this.players.push(wire);this.root.add(wire);}
      for(let i=0;i<FRAGMENT.capacity;i++){const wire=new LineSegments(sphere,material(0xffef80,.7));wire.scale.setScalar(FRAGMENT.pickupRadius+FRAGMENT.pickupAssist);wire.visible=false;this.fragmentVolumes.push(wire);this.root.add(wire);}
      this.ghost.name='recorded-wing-impact';this.root.add(this.ghost);
    }
    for (let i = 0; i < CONFIG.hazards.capacity; i++) {
      const group = new Group();
      group.name = `collider-hazard-${i}`;
      group.add(new LineSegments(sphere, sphereMaterial), new LineSegments(box, boxMaterial));
      if(profile.parts.length>1)for(let part=0;part<3;part++)group.add(new LineSegments(box,boxMaterial));
      group.visible = false;
      this.hazards.push(group);
      this.root.add(group);
    }
    this.root.renderOrder = 10;
    this.resources.track(this.root);
    scene.add(this.root);
    this.info.id = 'collider-debug-info';
    this.info.setAttribute('aria-label', 'Developer collision diagnostics');
    Object.assign(this.info.style, { position: 'absolute', zIndex: '5', left: '20px', bottom: '46px', maxWidth: 'min(460px, 90%)', padding: '10px 12px', background: '#050b19e8', border: '1px solid #586b82', borderRadius: '6px', color: '#d2deed', font: '10px/1.6 monospace', whiteSpace: 'pre-line', pointerEvents: 'none' });
    document.getElementById('game')!.append(this.info);
  }
  bind(slots:readonly Group[]):void{this.slots=slots;}

  update(model: GameModel): void {
    if (this.disposed) return;
    const hitChanged=model.hitSerial!==this.hitSerial;
    this.player.position.set(model.ship.x, model.ship.y, 0);
    for(let i=0;i<this.players.length;i++){const part=this.profile.parts[i]!,wire=this.players[i]!;wire.position.set(model.ship.x+part.offsetX,model.ship.y+part.offsetY,part.offsetZ);wire.scale.setScalar(part.radius);}
    const run=fragmentsOf(model);
    for(let i=0;i<this.fragmentVolumes.length;i++){const wire=this.fragmentVolumes[i]!,slot=run?.slots[i],p=slot?.proposal;wire.visible=slot?.state==='active'&&!!p;if(p)wire.position.set(p.x,p.y,model.distance-p.passDistance);}
    if(model.hitSerial<this.hitSerial){this.ghost.clear();this.impact=undefined;}
    const contact='lastShipContact' in model?model.lastShipContact as ShipContact|undefined:undefined;
    if(model.hitSerial>this.hitSerial&&contact){
      this.impact=contact;this.ghost.clear();
      const index=model.field.hazards.findIndex(h=>h.x===contact.x&&h.y===contact.y&&h.kind===contact.kind);
      const source=this.slots[index];
      if(source&&!isWreck(contact)){
        const copy=source.clone(true);copy.visible=true;copy.position.set(0,0,0);copy.scale.setScalar(contact.radius);hazardOrientation(contact,contact.elapsed,this.angles);copy.rotation.set(this.angles.x,this.angles.y,this.angles.z);
        copy.children.forEach((child,i)=>child.visible=i===hazardVariant(contact.kind,contact.phase));this.ghost.add(copy);
        const proxy=this.hazards[index]!.clone(true);proxy.visible=true;proxy.position.set(0,0,0);proxy.scale.setScalar(contact.radius);proxy.rotation.copy(copy.rotation);
        const bounds=HAZARD_BOXES[hazardVariant(contact.kind,contact.phase)];proxy.children.forEach((child,i)=>{child.visible=i===0||(i===1&&!!bounds);child.position.set(0,0,0);});
        if(bounds)proxy.children[1]!.scale.set(bounds.x,bounds.y,bounds.z);this.ghost.add(proxy);
      }
      this.ghost.position.set(contact.x,contact.y,contact.z);
    }
    this.hitSerial=model.hitSerial;this.ghost.visible=!!this.impact&&model.elapsed-this.impact.elapsed<.6;
    let count = 0;
    let closest = Infinity;
    let closestIndex = -1;
    for (let i = 0; i < this.hazards.length; i++) {
      const hazard = model.field.hazards[i]!;
      const group = this.hazards[i]!;
      group.visible = hazard.active;
      if (!hazard.active) continue;
      count++;
      if(this.profile.parts.length>1&&isWreck(hazard)){
        group.position.set(hazard.x,hazard.y,hazard.z);group.scale.setScalar(1);group.rotation.set(0,0,0);group.children[0]!.visible=false;
        wreckProfile(hazard).boxes.forEach((box,i)=>{const wire=group.children[i+1]!;wire.visible=true;wire.position.set(box.center.x,box.center.y,box.center.z);wire.scale.set(box.half.x,box.half.y,box.half.z);});continue;
      }
      for(let part=0;part<group.children.length;part++){const child=group.children[part]!;child.visible=part<2;child.position.set(0,0,0);}
      const variant = hazardVariant(hazard.kind, hazard.phase);
      const bounds = HAZARD_BOXES[variant];
      group.position.set(hazard.x, hazard.y, hazard.z);
      group.scale.setScalar(hazard.radius);
      hazardOrientation(hazard, model.elapsed, this.angles);
      group.rotation.set(this.angles.x, this.angles.y, this.angles.z);
      const wireBox = group.children[1]!;
      wireBox.visible = !!bounds;
      if (bounds) wireBox.scale.set(bounds.x, bounds.y, bounds.z);
      group.userData.shape = bounds ? 'sphere-and-box' : 'sphere';
      group.userData.modelId = HAZARD_MODELS[variant];
      if (Math.abs(hazard.z) < closest) {
        closest = Math.abs(hazard.z);
        closestIndex = i;
      }
    }
    // Text is developer-only and throttled; wire transforms update every render.
    const now = performance.now();
    if (hitChanged || now - this.lastInfoTime >= 250 || this.lastInfoTime < 0) {
      this.lastInfoTime = now;
      let detail = 'No active hazards';
      if (closestIndex >= 0) {
        const hazard = model.field.hazards[closestIndex]!;
        detail = `${HAZARD_MODELS[hazardVariant(hazard.kind, hazard.phase)]} · r=${hazard.radius.toFixed(2)}\ncenter (${hazard.x.toFixed(2)}, ${hazard.y.toFixed(2)}, ${hazard.z.toFixed(2)})`;
      }
      this.info.textContent = `COLLIDERS · ${count} active · player sphere r=${CONFIG.ship.radius}\nPink: player · amber: outer sphere · mint: calibrated box\nBox variants require BOTH bounds; sphere variants use amber.\nContinuous sweep + bounded rotation tolerance.\n${detail}`;
      if(this.profile.parts.length>1)this.info.textContent=`SHIP COLLIDERS · body pink / left green / right blue\n${this.profile.parts.map(p=>`${p.id} r=${p.radius} @ (${p.offsetX},${p.offsetY},${p.offsetZ})`).join('\n')}\nYellow: fragment r=${FRAGMENT.pickupRadius} + assist=${run?.pickupAssist??0}\nWing-only pickup assistance +${run?.wingPickupAssist??0}; damage spheres unchanged by pickup\nAmber: asteroid sphere · mint: calibrated boxes / station solids\n${this.impact?`LAST REAL HIT: ${this.impact.part} · body ${this.impact.bodyClear?'CLEAR':'HIT'}\nDEV ghost holds the recorded asteroid pose for .6s`:'120Hz swept union · no hit recorded'}`;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.ghost.clear();this.slots=[];
    this.resources.dispose();
    this.info.remove();
  }
}
