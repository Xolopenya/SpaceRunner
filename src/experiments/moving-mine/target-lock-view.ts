import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, LineSegments } from 'three';
import type { Color, Group, Mesh, MeshBasicMaterial } from 'three';
import type { PlannedHazard } from '../../core/field-types.ts';
import type { MovingMineGameModel } from './model.ts';
import { simulationTick } from './motion.ts';
import { TARGET_LOCK as T } from './target-lock-settings.ts';

/** Presentation only. Preview can observe current XY; a published course never does. */
export class TargetLockPresentation {
  private readonly points = new Float32BufferAttribute(new Float32Array(6),3);
  private readonly path = new Line(new BufferGeometry().setAttribute('position',this.points),
    new LineBasicMaterial({color:0xff4b28,transparent:true,opacity:.18,depthWrite:false}));
  constructor(root:Group,privateLamp:Mesh) {
    this.lamp=privateLamp.material as MeshBasicMaterial;
    this.baseColor=this.lamp.color.clone();
    this.path.name='target-lock-course';this.path.frustumCulled=false;this.path.visible=false;root.add(this.path);
  }
  private readonly lamp:MeshBasicMaterial;
  private readonly baseColor:Color;
  update(m:MovingMineGameModel,mine:Group,active?:PlannedHazard):string {
    this.path.visible=false;const tick=simulationTick(m.elapsed),motion=active?.motion;
    if(motion?.version===T.version){
      for(const child of mine.children)if(child instanceof LineSegments)child.visible=true;
      const left=Math.max(0,motion.startTick-tick)/120,plane=Math.max(0,motion.passTick-tick)/120;
      const phase=tick<motion.capture.tick+24?'LOCK FLASH':tick<motion.startTick-motion.minimumWarningTicks?'LOCKED':tick<motion.startTick?'WARNING':tick<motion.passTick?'ATTACK':'COMPLETE';
      const brightness=phase==='LOCK FLASH'?1.3:phase==='WARNING' ? .55+.45*Math.sin(m.elapsed*Math.PI*3)**2
        :tick<motion.startTick ? .45+.3*Math.sin(m.elapsed*Math.PI)**2:1;
      this.lamp.color.copy(this.baseColor).multiplyScalar(brightness);
      if(tick<motion.startTick)this.course(active!.x,active!.y,motion.targetX,motion.targetY,m.distance-active!.passDistance);
      return `Phase ${phase} · target ${motion.targetX.toFixed(2)},${motion.targetY.toFixed(2)}\nCapture tick ${motion.capture.tick} · launch ${left.toFixed(2)}s · plane ${plane.toFixed(2)}s\nLocked velocity ${motion.velocityX.toFixed(2)},${motion.velocityY.toFixed(2)}\nAdmission ${m.field.lastOutcome?.status??'pending'} · reject ${m.field.lastRejection??'none'}`;
    }
    const pending=m.field.pending;
    if(pending?.resolvingTarget&&pending.phase==='ready'){
      const p=pending.previewPose!;mine.visible=true;mine.position.set(p.x,p.y,m.distance-p.passDistance);
      for(const child of mine.children)if(child instanceof LineSegments)child.visible=false;
      const brightness=.3+.3*Math.sin(m.elapsed*Math.PI)**2;this.lamp.color.copy(this.baseColor).multiplyScalar(brightness);
      this.course(p.x,p.y,m.ship.x,m.ship.y,mine.position.z);
      return `Phase ACQUIRING · noncollidable preview\nObserved ${m.ship.x.toFixed(2)},${m.ship.y.toFixed(2)} · tick ${tick}\nTarget freezes only on certified publication`;
    }
    const contact=m.field.slots.find(h=>h.planned?.motion?.version===T.version&&!h.active&&h.z<=8);
    return `Phase ${contact?'CONTACT':'IDLE'} · last ${m.field.events.at(-1)?.status??'pending'}\n${m.field.lastRejection??'No target rejection'}`;
  }
  private course(x:number,y:number,tx:number,ty:number,z:number):void {
    this.points.setXYZ(0,x,y,0);this.points.setXYZ(1,tx,ty,0);this.points.needsUpdate=true;this.path.position.set(0,0,z);this.path.visible=true;
  }
}
