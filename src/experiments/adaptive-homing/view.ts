import { BufferGeometry,Float32BufferAttribute,Line,LineBasicMaterial } from 'three';
import type { Color,Group,Mesh,MeshBasicMaterial } from 'three';
import type { PlannedHazard } from '../../core/field-types.ts';
import type { AdaptiveHomingGameModel } from './model.ts';

/** The trail contains ONLY actual recorded simulation states at fixed world depth. */
export class HomingPresentation {
 private readonly positions=new Float32BufferAttribute(new Float32Array(241*3),3);
 private readonly trail=new Line(new BufferGeometry().setAttribute('position',this.positions),new LineBasicMaterial({color:0xff552c,transparent:true,opacity:.3,depthWrite:false}));
 private readonly lamp:MeshBasicMaterial;private readonly color:Color;
 constructor(root:Group,lamp:Mesh){this.lamp=lamp.material as MeshBasicMaterial;this.color=this.lamp.color.clone();this.trail.name='adaptive-mine-trail';this.trail.frustumCulled=false;this.trail.visible=false;root.add(this.trail);}
 update(model:AdaptiveHomingGameModel,mine:Group,h?:PlannedHazard):string{
  const f=model.homing.planningFrame,work=f.latest;
  const diagnostics=`\nPlanner/RAF ${work.chunks} chunks · ${work.ms.toFixed(1)}ms · ${work.propagations}/${work.queries} work · deferred ${work.deferred}\nMax planner ${f.maxMs.toFixed(1)}ms · frame ${f.maxFrameMs.toFixed(1)}ms · spikes ${f.spikes} · active ${model.field.slots.filter(s=>s.active).length}`;
  this.trail.visible=false;const source=model.homing,s=source.current,m=h?.motion;
  if(s&&m?.version==='adaptive-homing-v1'){
   if(s.phase==='waiting')mine.visible=false;
   this.lamp.color.copy(this.color).multiplyScalar(s.phase==='warning'?.5+.5*Math.sin(model.elapsed*Math.PI*3)**2:1);
   const samples=source.samples;let count=0;
   for(let i=Math.max(0,samples.length-960);i<samples.length&&count<240;i+=4){const p=samples[i]!;if(p.mine.id!==h!.id||p.tick<m.startTick)continue;this.positions.setXYZ(count++,p.mine.x,p.mine.y,0);}
   this.positions.setXYZ(count++,s.x,s.y,0);this.positions.needsUpdate=true;this.trail.geometry.setDrawRange(0,count);this.trail.position.z=model.distance-h!.passDistance;this.trail.visible=count>1;
   const relative=Math.hypot(model.ship.x-s.x,model.ship.y-s.y,model.distance-h!.passDistance);
   return `Preset ${m.preset} · phase ${s.phase.toUpperCase()} · pursuit ${source.activePursuitSeconds.toFixed(2)}s\n`
    +`Mine ${s.x.toFixed(2)},${s.y.toFixed(2)} · velocity ${s.vx.toFixed(2)},${s.vy.toFixed(2)} · speed ${Math.hypot(s.vx,s.vy).toFixed(2)}\n`
    +`Acceleration ${s.ax.toFixed(2)},${s.ay.toFixed(2)} · target ${s.targetX.toFixed(2)},${s.targetY.toFixed(2)}\n`
    +`Ship ${model.ship.x.toFixed(2)},${model.ship.y.toFixed(2)} · relative ${relative.toFixed(1)}\n`
    +`Warning/launch ${(Math.max(0,m.startTick-s.tick)/120).toFixed(2)}s · plane ${(Math.max(0,m.passTick-s.tick)/120).toFixed(2)}s\n`
    +`Admission ${model.field.lastOutcome?.status??'pending'} · reject ${model.field.lastRejection??'none'}`+diagnostics;
  }
  return `Phase ${source.encounters.length?'PASSED / CONTACT':'PREPARING'}\nLast rejection ${model.field.lastRejection??'none'}`+diagnostics;
 }
}
