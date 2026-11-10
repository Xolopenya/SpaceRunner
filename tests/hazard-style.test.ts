import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3, Group, Mesh, MeshBasicMaterial, Vector3} from 'three';
import {ResourceOwner} from '../src/assets/resources.ts';
import {ObjectReveal} from '../src/visuals/object-reveal.ts';
import {MineShell} from '../src/visuals/mine-shell.ts';
import {salvageStation} from '../src/visuals/salvage-station.ts';
import {PROFILES, WRECK} from '../src/experiments/structure-variants/profile.ts';
import {HAZARD_STYLE} from '../src/visuals/hazard-style.ts';

test('all station variants retain exact body bounds and every detail stays on solid XY with <=10cm face relief',()=>{
  for(const [index,p] of PROFILES.entries()){
    const root=salvageStation(index);root.updateMatrixWorld(true);
    for(const b of p.boxes){const bounds=new Box3().setFromObject(root.getObjectByName(b.name)!);
      assert.ok(bounds.getCenter(new Vector3()).distanceTo(new Vector3(b.center.x,b.center.y,b.center.z))<1e-6);
      assert.ok(bounds.getSize(new Vector3()).distanceTo(new Vector3(b.half.x*2,b.half.y*2,b.half.z*2))<1e-6);}
    root.traverse(n=>{if(!(n instanceof Mesh)||!n.name.startsWith('salvage-detail'))return;
      const vertices=n.geometry.getAttribute('position');
      for(let v=0;v<vertices.count;v++){
        const x=vertices.getX(v),y=vertices.getY(v),z=vertices.getZ(v);
        assert.ok(p.boxes.some(b=>Math.abs(x-b.center.x)<=b.half.x+2e-6&&Math.abs(y-b.center.y)<=b.half.y+2e-6&&Math.abs(z-b.center.z)<=b.half.z+HAZARD_STYLE.faceRelief+2e-6),`${p.name}: detail outside supported solid`);
        assert.ok(Math.abs(x-p.aperture.x)>=WRECK.apertureX-2e-6||Math.abs(y-p.aperture.y)>=WRECK.apertureY-2e-6,`${p.name}: detail obstructs aperture`);
      }
    });
    const owner=new ResourceOwner();owner.track(root);owner.dispose();
  }
});

test('technical mine armor fits the original unit collision sphere and pooled geometry disposes once',()=>{
  const shell=new MineShell(new Group()),owner=new ResourceOwner();let releases=0;
  shell.root.traverse(n=>{if(!(n instanceof Mesh))return;const p=n.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))<=1.000001);});
  owner.track(shell.root);const resources=[...owner.geometries,...owner.materials];for(const r of resources)r.addEventListener('dispose',()=>releases++);
  owner.dispose();owner.dispose();assert.equal(releases,resources.length);
});

test('mine phase emitters update the actual reveal material, pause by elapsed time, and suppress motion pulses',()=>{
  const shell=new MineShell(new Group()),reveal=new ObjectReveal(),target=reveal.register(shell.root,'mine');
  reveal.beginFrame(1);reveal.apply(target,'test',0,25);
  const color=()=>((shell.signals.material as MeshBasicMaterial).color.toArray());
  shell.update('waiting',1);const idle=color();shell.update('warning',1);const warning=color();
  shell.update('pursuit',1);const pursuit=color();assert.notDeepEqual(idle,warning);assert.notDeepEqual(warning,pursuit);
  shell.update('pursuit',1);assert.deepEqual(color(),pursuit);
  shell.update('warning',1,true);const reduced=color();shell.update('warning',1.17,true);assert.deepEqual(color(),reduced);
  reveal.beginFrame(.1);reveal.apply(target,'next',.1,25);shell.update('waiting',.1);assert.deepEqual(color(),idle);
  reveal.dispose();const owner=new ResourceOwner();owner.track(shell.root);owner.dispose();
});
