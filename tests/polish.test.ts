import test from 'node:test';
import assert from 'node:assert/strict';
import {WarpCorridor,ARENA_SIDES,WARP_OCCLUSION} from '../src/visuals/warp-corridor.ts';
import {APERTURE_NAMES,wreckProfile} from '../src/experiments/structure-variants/profile.ts';
import {SHIP_COLLIDER,BODY_COLLIDER} from '../src/core/ship-collider.ts';
import type {ShipColliderProfile} from '../src/core/ship-collider.ts';
import {ShipHazardCollision} from '../src/core/ship-hazard-collision.ts';
import {FragmentRun} from '../src/collectibles/run.ts';
import {FRAGMENT} from '../src/collectibles/settings.ts';
import {ReleaseModel} from '../src/release/model.ts';
import {CONFIG} from '../src/config.ts';
const oldParts=SHIP_COLLIDER.parts.map(p=>p.id==='body'?p:{...p,offsetX:Math.sign(p.offsetX)*1.02,offsetY:-.35,radius:.28});
const old:ShipColliderProfile={version:'historical-005B',parts:oldParts,axialExtent:.98,radialExtent:1.4,enclosingRadius:1.57};
function reward(r:FragmentRun,x:number,y:number){Object.assign(r.slots[0]!,{state:'active',proposal:{id:'calibration',x,y,passDistance:10}});return r;}

test('station exclusion uses each exact solid cross-section for all five accepted openings and all four sides',()=>{
 const w=new WarpCorridor();
 for(const [index]of APERTURE_NAMES.entries()){
  const h={kind:index+4,x:.3,y:-.2,z:-80,planned:{id:'accepted'}};w.updateOcclusion([h]);
  for(const [i,side]of ARENA_SIDES.entries()){
   const horizontal=Math.abs(side)===1,axis=horizontal?'x':'y',other=horizontal?'y':'x',edge=Math.sign(side)*(horizontal?6:3.6);
   const expected=wreckProfile(h).boxes.filter(b=>Math.abs(edge-h[axis]-b.center[axis])<=b.half[axis]);
   const u=w.sides[i]!.material.uniforms;assert.equal(u.exclusionCount!.value,expected.length);
   expected.forEach((b,j)=>assert.deepEqual(u.exclusions!.value[j].toArray(),[h[other]+b.center[other]-b.half[other],h[other]+b.center[other]+b.half[other],-(h.z+b.center.z+b.half.z),-(h.z+b.center.z-b.half.z)]));
  }
 }w.dispose();
});
test('corridor excludes committed rendered station pool only, preserving empty space, holes, pause and reset',()=>{
 const w=new WarpCorridor(),h={kind:7,x:0,y:0,z:-70,planned:{id:'one'}};
 const buffers=w.sides.map(s=>s.material.uniforms.exclusions!.value);
 w.updateOcclusion([{...h,planned:undefined},{...h,kind:0},{...h,z:20},{...h,z:-250}]);assert.ok(w.sides.every(s=>s.material.uniforms.exclusionCount!.value===0));
 w.updateOcclusion([h]);const frozen=JSON.stringify(w.sides.map(s=>s.material.uniforms));for(let i=0;i<100;i++)w.updateOcclusion([h]);assert.equal(JSON.stringify(w.sides.map(s=>s.material.uniforms)),frozen);
 // Upper aperture reaches the upper surface: its central opening must not get a full-height rectangular mask.
 const top=w.sides[3]!.material.uniforms,rects=top.exclusions!.value.slice(0,top.exclusionCount!.value);assert.ok(!rects.some((r:{x:number;y:number})=>r.x<0&&r.y>0));
 w.occlusion=false;w.updateOcclusion([h]);assert.ok(w.sides.every(s=>s.material.uniforms.exclusionCount!.value===0));
 w.occlusion=true;w.updateOcclusion(Array.from({length:20},()=>h));assert.ok(w.sides.every(s=>s.material.uniforms.exclusionCount!.value<=WARP_OCCLUSION.capacity));
 w.updateOcclusion([]);assert.ok(w.sides.every((s,i)=>s.material.uniforms.exclusionCount!.value===0&&s.material.uniforms.exclusions!.value===buffers[i]));w.dispose();
});
test('calibrated wing spheres preserve three parts and body, align the sloped wing plane and remove misleading upper/lower volume',()=>{
 const q=new ShipHazardCollision(),before=new ShipHazardCollision(old),body=new ShipHazardCollision(BODY_COLLIDER),h={kind:0,radius:.65,phase:0,spin:0};
 for(const p of SHIP_COLLIDER.parts.slice(1)){
  assert.equal(p.offsetY,-.30);assert.equal(p.offsetZ,.7);assert.equal(p.radius,.18);
  for(const sign of [-1,1]){
   const a={x:-p.offsetX,y:-(p.offsetY+sign*(p.radius+h.radius+.001)),z:1},b={...a,z:-2};
   assert.equal(body.hit(a,b,h,0,CONFIG.step),false);assert.equal(q.hit(a,b,h,0,CONFIG.step),false);assert.equal(before.hit(a,b,h,0,CONFIG.step),true);
  }
  const a={x:-(p.offsetX+Math.sign(p.offsetX)*(p.radius+h.radius-.001)),y:-p.offsetY,z:2},b={...a,z:-2};
  assert.equal(body.hit(a,b,h,0,CONFIG.step),false);assert.equal(q.hit(a,b,h,0,CONFIG.step),true);assert.equal(q.lastPart,p.id);
 }
 assert.deepEqual(SHIP_COLLIDER.parts[0],old.parts[0]);
});
test('pickup assistance .36 clears deterministic high-speed near tangencies, .34 still misses the 1.09 contact',()=>{
 for(const delta of [.2,4])for(const assist of [.26,.30,.32,.34,.36]){
  const r=reward(new FragmentRun(SHIP_COLLIDER,assist,FRAGMENT.wingPickupAssist),0,1.09);r.step(0,0,10-delta,0,0,10+delta,120);
  assert.equal(r.count,assist===.36?1:0);
 }
 for(const p of SHIP_COLLIDER.parts.slice(1))for(const epsilon of [-.001,.001]){
  const r=reward(new FragmentRun(SHIP_COLLIDER,FRAGMENT.pickupAssist,FRAGMENT.wingPickupAssist),p.offsetX+Math.sign(p.offsetX)*(.96+epsilon),p.offsetY);
  r.step(0,0,8,0,0,12,120);assert.equal(r.count,epsilon<0?1:0);r.step(0,0,8,0,0,12,121);assert.ok(r.count<=1);
 }
 assert.equal(FRAGMENT.magnetSeconds,.14);
});
test('normal and Phase2 production use independently compensated wings with single-event damage and pickup',()=>{
 for(const distance of [100,700])for(const p of SHIP_COLLIDER.parts.slice(1)){
  const m=new ReleaseModel();m.ready();m.start(42);m.field.update=()=>{};m.distance=distance;m.elapsed=120;
  assert.equal(m.fragments.pickupProfile,m.shipColliderProfile);assert.equal(m.fragments.wingPickupAssist,.10);
  Object.assign(m.fragments.slots[0]!,{state:'active',proposal:{id:'wing',x:p.offsetX+Math.sign(p.offsetX)*.90,y:p.offsetY,passDistance:distance-p.offsetZ}});
  m.step(CONFIG.step,{x:0,y:0});assert.equal(m.fragments.count,1);assert.equal(m.fragments.lastPickup.part,p.id);
  for(let i=0;i<20;i++)m.step(CONFIG.step,{x:0,y:0});assert.equal(m.fragments.count,1);assert.equal(m.hull,3);m.dispose();
 }
});
