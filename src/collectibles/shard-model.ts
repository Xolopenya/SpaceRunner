import {BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, TorusGeometry} from 'three';
import type {BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original contained energy shard: four retention shoes, one faceted energy
 * core and a faint field halo. Shared once by the existing eight-slot pool. */
export function shardResources() {
  const prism = new OctahedronGeometry(.32);
  prism.scale(.96,1.35,.95);
  const pieces:BufferGeometry[]=[],energyPieces:BufferGeometry[]=[prism];
  function shoe(parts:BufferGeometry[],w:number,h:number,d:number,x:number,y:number,z:number,angle:number):void {
    const box=new BoxGeometry(w,h,d),g=box.toNonIndexed();box.dispose();
    g.rotateZ(angle);g.translate(x,y,z);
    parts.push(g);
  }
  for(const x of [-1,1])for(const y of [-1,1]){
    const angle=-x*y*.45;
    shoe(pieces,.095,.20,.17,x*.205,y*.235,0,angle);
    shoe(pieces,.12,.055,.17,x*.145,y*.32,0,angle);
    shoe(energyPieces,.045,.09,.012,x*.205,y*.235,.091,angle);
  }
  const frame=mergeGeometries(pieces);for(const g of pieces)g.dispose();
  const core=mergeGeometries(energyPieces);for(const g of energyPieces)g.dispose();
  // Keep the approved pickup-burst geometry; the idle halo is simply fainter.
  const ring=new TorusGeometry(.51,.025,4,16);
  return {
    core,frame,ring,
    // Reuse the scene's existing standard shader path instead of compiling
    // vertex-color variants when a reward first enters the field.
    energy:new MeshStandardMaterial({color:0x30b5a5,emissive:0x33d9c4,emissiveIntensity:.65,metalness:.05,roughness:.58}),
    metal:new MeshStandardMaterial({color:0x547481,metalness:.30,roughness:.66}),
    halo:new MeshBasicMaterial({color:0x46ffe6,transparent:true,opacity:.40,depthWrite:false}),
  };
}
