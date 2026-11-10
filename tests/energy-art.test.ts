import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ResourceOwner} from '../src/assets/resources.ts';
import {Group, Mesh} from 'three';
import {shardResources} from '../src/collectibles/shard-model.ts';
import {FRAGMENT} from '../src/collectibles/settings.ts';

test('contained shard stays within the existing visual envelope even at peak pulse, below 300 triangles and three draws',()=>{
  const s=shardResources(),root=new Group();let triangles=0;
  for(const [g,m,pulse] of [[s.core,s.energy,1.07],[s.frame,s.metal,1],[s.ring,s.halo,1]] as const){
    root.add(new Mesh(g,m));const p=g.getAttribute('position');
    for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))*pulse<=FRAGMENT.visualRadius);
    triangles+=(g.index?.count??p.count)/3;
  }
  assert.ok(triangles<=300);assert.equal(root.children.length,3);
  assert.equal(s.energy.transparent,false);assert.equal(s.energy.depthWrite,true);
  assert.equal(s.core.getAttribute('color'),undefined);
  assert.equal(s.frame.getAttribute('color'),undefined);
  const owner=new ResourceOwner();owner.track(root);let disposed=0;
  for(const r of [...owner.geometries,...owner.materials])r.addEventListener('dispose',()=>disposed++);
  owner.dispose();owner.dispose();assert.equal(disposed,6);
});
