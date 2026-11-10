import {BoxGeometry, BufferGeometry, EdgesGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PROFILES, WRECK as W} from '../experiments/structure-variants/profile.ts';
import {HAZARD_STYLE as S} from './hazard-style.ts';

/** Damaged pressure-frame. XY footprints and the four body bounds are exact.
 * Face plating projects at most 10cm in Z; nothing projects into the aperture.
 * Five detail batches, shared by every pooled clone; no textures or lights. */
export function salvageStation(index: number, colliders = false): Group {
  const profile = PROFILES[index]!;
  const root = new Group();root.name = `station-wreck-v2:${profile.name}`;
  const material = (color: number, metalness = .35) => new MeshStandardMaterial({color, metalness, roughness: .73});
  const bodyMaterial = material(S.graphite);
  const materials = [material(S.navy), material(S.steel), material(S.recess), material(S.amber), material(S.cyan)];
  materials[4]!.emissive.setHex(S.cyan);materials[4]!.emissiveIntensity = .45;
  const batches: BufferGeometry[][] = materials.map(() => []);
  function block(batch: number, x: number, y: number, z: number, w: number, h: number, d: number): void {
    batches[batch]!.push(new BoxGeometry(w,h,d).translate(x,y,z));
  }
  function cassette(batch:number,x:number,y:number,z:number,w:number,h:number):void {
    const cut=Math.min(.28,w*.15,h*.16),xy=[[-w/2+cut,-h/2],[w/2,-h/2],[w/2,h/2-cut],[w/2-cut,h/2],[-w/2,h/2],[-w/2,-h/2+cut]];
    const positions:number[]=[],uv:number[]=[],indices:number[]=[];
    for(const dz of [-.025,.025])for(const [px,py] of xy){positions.push(x+px!,y+py!,z+dz);uv.push(px!/w+.5,py!/h+.5);}
    for(let i=1;i<5;i++)indices.push(0,i+1,i,6,6+i,7+i);
    for(let i=0;i<6;i++){const n=(i+1)%6;indices.push(i,n,n+6,i,n+6,i+6);}
    const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3)).setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);
    const flat=g.toNonIndexed();flat.computeVertexNormals();g.dispose();batches[batch]!.push(flat);
  }
  function brace(x0:number,y0:number,x1:number,y1:number,z:number):void {
    const dx=x1-x0,dy=y1-y0;
    batches[1]!.push(new BoxGeometry(Math.hypot(dx,dy),.18,.08).rotateZ(Math.atan2(dy,dx)).translate((x0+x1)/2,(y0+y1)/2,z));
  }
  for (const [i,b] of profile.boxes.entries()) {
    const width=b.half.x*2, height=b.half.y*2, x0=b.center.x-b.half.x, y0=b.center.y-b.half.y;
    const body=new Mesh(new BoxGeometry(width,height,b.half.z*2),bodyMaterial);
    body.name=b.name;body.position.set(b.center.x,b.center.y,b.center.z);root.add(body);
    for(const side of [-1,1]) {
      const face=b.center.z+side*b.half.z;
      // Recess-like dark seams separate broad armor cassettes and exposed ribs.
      const columns=i===0?2:i===1?3:2, rows=i===0?4:i===1?3:Math.max(1,Math.ceil(height/3.5));
      for(let c=0;c<columns;c++)for(let r=0;r<rows;r++){
        const cw=width/columns,rh=height/rows,x=x0+(c+.5)*cw,y=y0+(r+.5)*rh;
        const damaged=(c+r*3+i+index)%7===0;
        cassette(damaged?2:0,x,y,face+side*.025,cw-.20,rh-.20);
        // A missing outer cassette exposes short parallel cooling channels.
        if(damaged)for(let n=0;n<4;n++)block(1,x-cw*.28+n*cw*.18,y,face+side*.055,.075,rh*.64,.045);
        else {
          block(2,x,y-rh*.29,face+side*.057,cw*.66,.075,.025);
          block(1,x-cw*.31,y+rh*.28,face+side*.063,.09,.14,.025);
          block(1,x+cw*.31,y+rh*.28,face+side*.063,.09,.14,.025);
        }
      }
      // Raised load-bearing frames; an interrupted rib reads as repaired wreckage.
      for(let c=1;c<columns;c++)block(1,x0+c*width/columns,b.center.y,face+side*.05,.11,height-.16,S.faceRelief);
      for(let r=1;r<rows;r++)block(1,b.center.x,y0+r*height/rows,face+side*.05,width-.16,.11,S.faceRelief);
      // Large diagonal tension members distinguish load-bearing fragments from
      // tiled walls; the service spine and broken cassette spacing are asymmetric.
      if(i===0||i===1){
        const band=height/rows,sy=y0+(i===0?1:2)*band;
        brace(x0+.28,sy-band+.28,x0+width-.28,sy-.28,face+side*.06);
        block(2,x0+.34,b.center.y,face+side*.032,.34,height-.44,.06);
        for(let n=0;n<3;n++)block(3,x0+.34,y0+.60+n*.22,face+side*.068,.35,.09,.025);
      }
      for(const sign of [-1,1]){
        block(1,b.center.x+sign*(b.half.x-.09),b.center.y,face+side*.04,.16,height-.10,.08);
        block(1,b.center.x,b.center.y+sign*(b.half.y-.09),face+side*.04,width-.10,.16,.08);
      }
      // Restrained industrial ID bars, asymmetrical repair strap and broken paint.
      const sy=y0+height*.23;
      block(3,b.center.x,sy,face+side*.077,Math.min(width-.4,1.5),.11,.026);
      for(let n=0;n<3;n++)block(1,x0+.26+n*.14,y0+height*.72,face+side*.07,.06,.35,.03);
    }
  }
  const a=profile.aperture,l=a.x-W.apertureX,r=a.x+W.apertureX,b=a.y-W.apertureY,t=a.y+W.apertureY;
  // Continuous amber flight boundary on solid faces; cyan corner lamps identify
  // infrastructure without competing with the free-floating Energy Fragment.
  for(const [i,box] of profile.boxes.entries())for(const side of [-1,1]){
    const z=box.center.z+side*(box.half.z+.045);
    if(i<2){
      const x=i?r+.11:l-.11;
      block(3,x,a.y,z,.20,W.apertureY*2,.09);
      for(const y of [b+.35,t-.35])block(4,i?r+.30:l-.30,y,z,.12,.44,.09);
      for(let n=0;n<7;n++)block(2,x,a.y-W.apertureY+.23+n*.64,z+side*.046,.205,.18,.006);
    }else{
      const y=i===2?t+.11:b-.11;
      block(3,a.x,y,z,W.apertureX*2,.20,.09);
      for(const x of [l+.40,r-.40])block(4,x,i===2?t+.30:b-.30,z,.55,.10,.09);
    }
  }
  for(const [i,pieces] of batches.entries()){
    if(pieces.length){const flat=pieces.map(g=>g.index?g.toNonIndexed():g),mesh=new Mesh(mergeGeometries(flat),materials[i]);mesh.name=`salvage-detail-${i}`;root.add(mesh);for(let n=0;n<flat.length;n++)if(flat[n]!==pieces[n])flat[n]!.dispose();}
    else materials[i]!.dispose();
    for(const g of pieces)g.dispose();
  }
  const wires=new Group();wires.name='colliders';wires.visible=colliders;
  const wireMaterial=new LineBasicMaterial({color:0x69f4d3,depthTest:false});
  for(const box of profile.boxes){const g=new BoxGeometry(box.half.x*2,box.half.y*2,box.half.z*2),wire=new LineSegments(new EdgesGeometry(g),wireMaterial);g.dispose();wire.position.set(box.center.x,box.center.y,box.center.z);wires.add(wire);}
  root.add(wires);return root;
}
