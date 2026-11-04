import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, MathUtils, Vector3 } from 'three';
import { CAMERA, CAMERA_MODES, FlightCamera } from '../src/camera/flight-camera.ts';
import { ReleaseModel } from '../src/release/model.ts';
import { fragmentInput } from './fixtures/fragment-flight.ts';

const make = () => {
  const camera = new PerspectiveCamera(58, 1, .1, 260), rig = new FlightCamera(camera);
  rig.resize(1280, 800); rig.reset(); return { camera, rig };
};
const near = (a: number, b: number) => assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);

test('baseline is operation-for-operation identical to 004B across frames, resets, shake and aspects', () => {
  const {camera,rig} = make(), old = new PerspectiveCamera(58,1,.1,260);
  for (const [width,height] of [[1280,800],[390,844],[844,390],[1920,1080]]) {
    old.aspect=width!/height!;const z=Math.max(13,7/Math.tan(MathUtils.degToRad(29))/old.aspect);
    old.updateProjectionMatrix();old.position.set(0,2.4,z);rig.resize(width!,height!);rig.reset();
    for(let i=0;i<1000;i++) {
      const dt=[1/30,1/60,1/144,0,.1][i%5]!, x=Math.sin(i*.07)*6,y=Math.cos(i*.05)*3.6,elapsed=i/120,shake=i%100<10?.018:0;
      const blend=1-Math.exp(-dt*8);
      old.position.x=MathUtils.lerp(old.position.x,x*.12,blend)+Math.sin(elapsed*80)*shake;
      old.position.y=MathUtils.lerp(old.position.y,2.4+y*.12,blend);old.position.z=z;old.lookAt(0,0,-28);
      rig.update(x,y,elapsed,shake,dt);
      assert.deepEqual(camera.position.toArray(),old.position.toArray());
      assert.deepEqual(camera.quaternion.toArray(),old.quaternion.toArray());
      assert.deepEqual(camera.projectionMatrix.toArray(),old.projectionMatrix.toArray());
    }
  }
});

test('chase translates both endpoints coherently, without yaw, pitch, bank or dt-dependent lag', () => {
  for(const mode of ['full-chase','hybrid-chase'] as const) {
    const {camera,rig}=make();rig.setMode(mode);rig.update(0,0,0,0,1/60);
    const direction=camera.getWorldDirection(new Vector3()), factor=mode==='full-chase'?1:.8;
    for(const dt of [0,1/30,1/60,1/144])for(let i=0;i<400;i++) {
      const x=Math.sin(i)*6,y=Math.cos(i)*3.6;rig.update(x,y,4,.01,dt);
      near(camera.position.x,x*factor+Math.sin(320)*.01);near(camera.position.y,2.4+y*factor);
      assert.ok(camera.getWorldDirection(new Vector3()).distanceTo(direction)<1e-14);
    }
    assert.equal(CAMERA.hybridFollowX,.8);assert.equal(CAMERA.hybridFollowY,.8);
  }
});

test('switching 10000 times reaches exact selected pose with no drift; reset retains policy', () => {
  const {camera,rig}=make();
  for(let i=0;i<10000;i++) {rig.setMode(CAMERA_MODES[i%3]!);rig.update(6,-3.6,0,0,1/60);}
  rig.setMode('full-chase');rig.update(6,-3.6,0,0,1/60);assert.deepEqual(camera.position.toArray(),[6,-1.2000000000000002,13]);
  rig.reset();assert.equal(rig.mode,'full-chase');rig.update(0,0,0,0,0);assert.deepEqual(camera.position.toArray(),[0,2.4,13]);
  rig.update(6,3.6,0,0,0);rig.setMode('baseline');rig.update(6,3.6,0,0,0);
  assert.deepEqual(camera.position.toArray(),[6*.12,2.4+3.6*.12,13]);
  assert.throws(()=>rig.setMode('bad' as never),RangeError);
});

test('resize preserves matched FOV, clipping and portrait/landscape rear distance for all modes', () => {
  for(const mode of CAMERA_MODES)for(const [w,h] of [[1280,800],[390,844],[844,390]]) {
    const {camera,rig}=make();rig.setMode(mode);rig.resize(w!,h!);rig.update(6,3.6,0,0,1/60);
    assert.equal(camera.fov,58);assert.equal(camera.near,.1);assert.equal(camera.far,260);
    near(camera.aspect,w!/h!);near(camera.position.z,Math.max(13,7/Math.tan(MathUtils.degToRad(29))/(w!/h!)));
  }
});

test('matched 1500m fragment history, collisions, Phase2, pause/restart are invariant across camera policies', () => {
  const models=CAMERA_MODES.map(()=>{const m=new ReleaseModel();m.ready();m.start(42);return m;}), rigs=CAMERA_MODES.map(mode=>{const{rig}=make();rig.setMode(mode);return rig;});
  let ticks=0;
  const state=(m:ReleaseModel)=>({state:m.state,distance:m.distance,elapsed:m.elapsed,speed:m.speed,phase:m.phase,hull:m.hull,hit:m.hitSerial,invulnerability:m.invulnerability,ship:m.ship,hazards:m.field.hazards,publications:m.field.publicationTrace,fragments:m.fragments.active,count:m.fragments.count,pickup:m.fragments.lastPickup,contact:m.lastShipContact});
  while(models[0]!.distance<1500&&models[0]!.state==='PLAYING') {
    const input=fragmentInput(models[0]!,models[0]!.fragments.active[0]);
    models.forEach((m,i)=>{m.step(1/120,input);if(ticks%43===0)rigs[i]!.setMode(CAMERA_MODES[(i+ticks)%3]!);rigs[i]!.update(m.ship.x,m.ship.y,m.elapsed,0,[1/30,1/60,1/144][i]!);});
    if(ticks%120===0)for(const m of models.slice(1))assert.deepEqual(state(m),state(models[0]!));
    ticks++;
  }
  assert.ok(models[0]!.distance>=1500);assert.equal(models[0]!.phase,2);assert.ok(models[0]!.fragments.count>0);
  for(const m of models.slice(1))assert.deepEqual(state(m),state(models[0]!));
  models.forEach((m,i)=>{m.pause();const before=m.distance;for(let n=0;n<100;n++){m.step(1/120,{x:1,y:1});rigs[i]!.update(m.ship.x,m.ship.y,m.elapsed,0,1/60);}assert.equal(m.distance,before);m.resume();m.state='GAME_OVER';m.start(42);rigs[i]!.reset();assert.equal(m.fragments.count,0);assert.equal(m.distance,0);m.dispose();});
});
