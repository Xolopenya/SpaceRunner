import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Object3D,PerspectiveCamera,Vector3} from 'three';
import {PickupGuidance} from '../src/collectibles/guidance.ts';
import {FragmentRun} from '../src/collectibles/run.ts';
import {SHIP_COLLIDER} from '../src/core/ship-collider.ts';
import {FRAGMENT} from '../src/collectibles/settings.ts';
import {FlightCamera} from '../src/camera/flight-camera.ts';
import type {GameModel} from '../src/core/game-model.ts';

function fixture(x=0,y=0,depth=20) {
 const run=new FragmentRun(SHIP_COLLIDER,FRAGMENT.pickupAssist,FRAGMENT.wingPickupAssist);
 run.slots[0]!.state='active';run.slots[0]!.proposal={id:'fixture',section:6,anchor:'fixture',situation:'debris',x,y,passDistance:depth};
 const frame={state:'PLAYING',ship:{x:0,y:0,vx:0,vy:0},distance:0,elapsed:2,fragments:run,field:{hazards:[] as any[]}};
 const camera=new PerspectiveCamera(58,1.6,.1,260),follow=new FlightCamera(camera);follow.setMode('hybrid-chase');follow.resize(1280,800);follow.reset();follow.update(0,0,2,0,0);
 const scene=new Scene(),ship=new Object3D(),guide=new PickupGuidance(scene);
 const update=()=>guide.update(frame as unknown as GameModel,ship,camera,1280,800);
 return{frame,run,camera,follow,ship,guide,update};
}

test('guide current alignment uses actual body/wing assists, not the shard visual radius',()=>{
 for(const part of SHIP_COLLIDER.parts) {
  const r=part.radius+FRAGMENT.pickupRadius+FRAGMENT.pickupAssist+(part.id==='body'?0:FRAGMENT.wingPickupAssist);
  const h=fixture(part.offsetX,part.offsetY+r-.01);h.update();assert.equal(h.guide.diagnostics.aligned,true,part.id);
  h.run.slots[0]!.proposal={...h.run.slots[0]!.proposal!,y:part.offsetY+r+.02};h.update();
  if(part.id==='body')assert.equal(h.guide.diagnostics.aligned,false);
  h.guide.dispose();
 }
});

test('marker is at actual target depth and parallel beams ignore bank beyond their short wing connector',()=>{
 const h=fixture(0,0,32);h.update();h.guide.root.updateMatrixWorld(true);
 const point=h.guide.marker.mesh.getWorldPosition(new Vector3());assert.deepEqual(point.toArray(),[0,0,-32]);
 assert.deepEqual(point.clone().project(h.camera).toArray(),new Vector3(0,0,-32).project(h.camera).toArray());
 const before=h.guide.beam.geometry.getAttribute('finish').array.slice();h.ship.rotation.z=.35;h.ship.rotation.x=.1;h.update();
 assert.deepEqual(h.guide.beam.geometry.getAttribute('finish').array,before);
 assert.notEqual(h.guide.beam.geometry.getAttribute('position').getY(0),SHIP_COLLIDER.parts[1]!.offsetY);
 assert.equal(h.guide.marker.mesh.position.z,-32);h.guide.dispose();
});

test('opaque obstacle suppresses target marker; read-only guidance does not alter any gameplay facts',()=>{
 const h=fixture();h.frame.field.hazards.push({active:true,x:0,y:.6,z:-10,radius:2,kind:0,spin:0,phase:0});
 const before=JSON.stringify(h.frame);h.update();assert.equal(JSON.stringify(h.frame),before);
 assert.equal(h.guide.marker.mesh.visible,false);assert.equal(h.guide.diagnostics.aligned,false);h.guide.dispose();
});

test('pause/toggle/restart and disposal preserve fixed geometry and clear stale target',()=>{
 const h=fixture();h.update();const geometry=h.guide.beam.geometry,marker=h.guide.marker.geometry;
 const before=geometry.getAttribute('position').array.slice();h.frame.state='PAUSED';h.ship.rotation.z=.6;h.update();
 assert.deepEqual(geometry.getAttribute('position').array,before);
 h.guide.enabled=false;h.update();assert.equal(h.guide.root.visible,false);
 h.run.reset();h.guide.reset();h.frame.state='PLAYING';h.guide.enabled=true;h.update();assert.equal(h.guide.diagnostics.target,undefined);
 assert.equal(geometry,h.guide.beam.geometry);assert.equal(marker,h.guide.marker.geometry);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);h.guide.dispose();h.guide.dispose();assert.equal(disposed,1);
});
