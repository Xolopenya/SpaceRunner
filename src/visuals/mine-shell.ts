import {BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry} from 'three';
import type {BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {HAZARD_STYLE as S} from './hazard-style.ts';

export type MineVisualPhase = 'waiting' | 'warning' | 'pursuit' | 'coast';
/** Kitbash around the licensed mine. All new vertices fit its unit sphere.
 * Two static armor batches and one signal batch. No transform feeds gameplay. */
export class MineShell {
  readonly root=new Group();
  readonly signals: Mesh;
  constructor(core: Group) {
    core.scale.multiplyScalar(S.mineCoreScale);this.root.add(core);
    const armor:BufferGeometry[]=[],trim:BufferGeometry[]=[],lights:BufferGeometry[]=[];
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      armor.push(new BoxGeometry(.38,.16,.56).translate(0,.68,0).rotateZ(angle));
      trim.push(new BoxGeometry(.16,.13,.22).translate(0,.82,0).rotateZ(angle));
      lights.push(new BoxGeometry(.21,.055,.08).translate(0,.73,.32).rotateZ(angle));
    }
    for(const side of [-1,1]){
      trim.push(new TorusGeometry(.40,.055,4,8).translate(0,0,side*.57));
      lights.push(new SphereGeometry(.19,8,6).translate(0,0,side*.62));
    }
    const add=(parts:BufferGeometry[],material:MeshStandardMaterial|MeshBasicMaterial,name:string)=>{
      const mesh=new Mesh(mergeGeometries(parts),material);mesh.name=name;this.root.add(mesh);for(const p of parts)p.dispose();return mesh;
    };
    add(armor,new MeshStandardMaterial({color:S.navy,metalness:.45,roughness:.6}),'segmented-armor');
    add(trim,new MeshStandardMaterial({color:S.steel,metalness:.5,roughness:.65}),'sensor-collars');
    this.signals=add(lights,new MeshBasicMaterial({color:S.amber}),'mine-state-emitters');
    this.root.name='mine-technical-shell';
  }
  update(phase: MineVisualPhase, elapsed: number, reducedMotion = false): void {
    // ObjectReveal swaps material variants. Update the active material, rather
    // than the borrowed source or a detached original that is no longer drawn.
    const material=this.signals.material as MeshBasicMaterial;
    const pulse=reducedMotion?1:Math.sin(elapsed*Math.PI*(phase==='warning'?3:5))**2;
    if(phase==='waiting')material.color.setRGB(.20,.37,.40);
    else if(phase==='warning')material.color.setRGB(.65+.35*pulse,.26+.13*pulse,.045);
    else material.color.setRGB(.85+.15*pulse,.065+.04*pulse,.025);
  }
}
