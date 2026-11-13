import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, Group, Scene, InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { normalizeModel } from '../src/assets/asset-manager.ts';
import { MODEL_ASSETS } from '../src/assets/catalog.ts';
import { ResourceOwner } from '../src/assets/resources.ts';
import { HullDamage } from '../src/visuals/hull-damage.ts';
import { hullSections } from '../src/visuals/ship-surfaces.ts';
import { ShipDestruction } from '../src/visuals/ship-destruction.ts';
import { CollisionVFX } from '../src/visuals/collision-vfx.ts';
import { DestructionSequence } from '../src/feedback/destruction-sequence.ts';
import { presentationContact, collisionFamily } from '../src/feedback/collision-presentation.ts';
import { DAMAGE_FX as F } from '../src/feedback/visual-settings.ts';
import { visualQuality } from '../src/visuals/settings.ts';
import type { GameEventMap } from '../src/events/game-events.ts';

const bytes = readFileSync('public/assets/kenney-space/craft_speederA.glb');
const source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
const owner = new ResourceOwner(); owner.track(source); const template = normalizeModel(source, MODEL_ASSETS[0]);
after(() => owner.dispose());
const quality = visualQuality(1280, 800, false, false), mobile = visualQuality(390, 844, true, true);
const event: GameEventMap['obstacle.collision'] = { runId: 1, elapsed: 2, source: 'obstacle', damageApplied: true,
  obstacleKind: 0, obstacleId: 'actual-slot-id', position: { x: 0, y: 0, z: 0 }, obstaclePosition: { x: .2, y: .1, z: -.3 },
  velocity: { x: 0, y: 0 }, obstaclePose: { radius: .9, phase: .3, spin: .2, distance: 50 } };

test('actual GLB damage stages persist, are ordered by HP, reset, and never mutate cached assets', () => {
  const ship = new Group(), clone = template.clone(true); ship.add(clone);
  const originalMaterials = [...owner.materials], originalGeometry = [...owner.geometries].map(g => g.getAttribute('position').array.slice());
  const damage = new HullDamage(clone);
  assert.equal(damage.resources.materials.size, 5); // Four armor materials and one attached leak.
  clone.traverse(node => { if (node instanceof Mesh) assert.ok(!owner.materials.has(node.material as import('three').Material)); });
  for (const [hp, stage] of [[3, 0], [2, 1], [1, 2], [0, 3]]) {
    damage.setHP(hp!); for (let frame = 0; frame < 120; frame++) damage.update(frame / 60, quality);
    assert.equal(damage.stage, stage);
  }
  assert.ok(originalMaterials.every(m => !m.name.includes('damage')));
  [...owner.geometries].forEach((g, i) => assert.deepEqual(g.getAttribute('position').array, originalGeometry[i]));
  damage.reset(); assert.equal(damage.stage, 0); assert.equal(damage.root.visible, false);
  let releases = 0; damage.resources.materials.forEach(m => m.addEventListener('dispose', () => releases++));
  damage.dispose(); damage.dispose(); assert.equal(releases, 5); assert.equal(owner.materials.size, 4);
});

test('breakup partitions every original GLB triangle once and retains recognizable wing/engine sections', () => {
  let original = 0; template.traverse(n => { if (n instanceof Mesh) original += (n.geometry.index?.count ?? n.geometry.getAttribute('position').count) / 3; });
  const parts = hullSections(template.clone(true)); assert.equal(parts.length, 6);
  assert.equal(parts.reduce((sum, p) => sum + p.geometry.getAttribute('position').count / 3, 0), original);
  assert.ok(parts.some(p => p.name === 'port-wing' && p.center.x < -.55));
  assert.ok(parts.some(p => p.name === 'starboard-wing' && p.center.x > .55));
  for (const p of parts) { assert.equal(p.geometry.getAttribute('color').count, p.geometry.getAttribute('position').count); p.geometry.dispose(); }
});

test('sequence has one death/run, immediate contact, frozen pause/suspension, bounded results and skip', () => {
  for (const reduced of [false, true]) {
    const seq = new DestructionSequence(); assert.equal(seq.begin(1, reduced), true); assert.equal(seq.begin(1, reduced), false);
    assert.equal(seq.phase, 'contact'); seq.update('PAUSED', 10); seq.update('GAME_OVER', 10, true); assert.equal(seq.elapsed, 0);
    for (let i = 0; i < 500; i++) seq.update('GAME_OVER', 1 / 60);
    assert.equal(seq.active, false); assert.equal(seq.phase, 'results'); assert.equal(seq.elapsed, seq.duration);
    seq.reset(); seq.begin(2, reduced); seq.skip(); assert.equal(seq.phase, 'results'); assert.equal(seq.active, false);
    assert.equal(seq.begin(2, reduced), false); seq.reset(); assert.equal(seq.phase, 'idle');
  }
});

test('family selection is explicit for production rocks, industrial objects, stations and moving mines', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 6, 7, 8, 9].map(collisionFamily), ['rock', 'rock', 'metal', 'station', 'station', 'station', 'station', 'station', 'mine']);
  for (const kind of [0, 2, 4, 9]) {
    const context = { ...event, obstacleKind: kind }, saved = JSON.stringify(context), surface = presentationContact(context);
    assert.ok([...surface.point.toArray(), ...surface.normal.toArray()].every(Number.isFinite));
    assert.ok(Math.abs(surface.normal.length() - 1) < 1e-8); assert.equal(JSON.stringify(context), saved);
  }
});

test('accepted mine identity/pose is copied, pools exhaust safely, pause freezes and reset reuses GPU objects', () => {
  const scene = new Scene(), effects = new CollisionVFX(scene);
  const geometry = new Set(effects.resources.geometries), materials = new Set(effects.resources.materials);
  for (let i = 0; i < F.bursts; i++) assert.equal(effects.trigger({ ...event, obstacleKind: 9, obstacleId: `mine-${i}` }, quality), true);
  assert.deepEqual(effects.activeIdentities, ['mine-0', 'mine-1', 'mine-2']);
  assert.equal(effects.trigger(event, quality), false); assert.equal(effects.stats.skipped, 1);
  const pose = JSON.stringify(effects.root.toJSON()); effects.update(0, quality, 50); assert.equal(JSON.stringify(effects.root.toJSON()), pose);
  assert.equal(effects.trigger({ ...event, obstacleKind: 4 }, quality, true), true);
  for (let i = 0; i < 150; i++) effects.update(1 / 60, quality, 50);
  assert.equal(effects.activeCount, 0);
  for (let i = 0; i < 30; i++) { effects.reset(); effects.trigger({ ...event, obstacleKind: 2 }, mobile); effects.update(.02, mobile, 50); }
  assert.deepEqual(effects.resources.geometries, geometry); assert.deepEqual(effects.resources.materials, materials);
  let releases = 0; [...geometry, ...materials].forEach(r => r.addEventListener('dispose', () => releases++));
  let instanceReleases = 0;
  effects.root.traverse(node => { if (node instanceof InstancedMesh) node.addEventListener('dispose', () => instanceReleases++); });
  effects.dispose(); effects.dispose(); assert.equal(releases, geometry.size + materials.size); assert.equal(scene.children.length, 0);
  assert.equal(instanceReleases, F.bursts, 'Each mesh must release its own instance buffers exactly once');
});

test('actual hull becomes independent parts, intact ship is hidden, and all death resources dispose exactly once', () => {
  const scene = new Scene(), ship = new Group(), model = template.clone(true); ship.add(model); scene.add(ship);
  const death = new ShipDestruction(scene, model);
  assert.equal(death.trigger(event, ship, quality), true); assert.equal(death.trigger(event, ship, quality), false);
  for (let i = 0; i < 40; i++) death.sequence.update('GAME_OVER', 1 / 60);
  death.applyShipPose(ship); death.update(quality); assert.equal(ship.visible, false); assert.equal(death.explosions, 1);
  assert.equal(death.root.getObjectsByProperty('type', 'Mesh').filter(n => n.name.startsWith('ship-fragment:') && n.visible).length, 6);
  assert.equal((death.root.getObjectByName('ship-small-debris') as import('three').InstancedMesh).count, F.death.smallFragments);
  assert.equal(death.root.getObjectByName('ship-small-debris')!.visible, true);
  death.skip(); death.update(quality); assert.equal(death.root.visible, false); death.reset(); assert.equal(death.sequence.phase, 'idle');
  const resources = [...death.resources.geometries, ...death.resources.materials]; let releases = 0;
  let instanceReleases = 0;
  (death.root.getObjectByName('ship-small-debris') as InstancedMesh).addEventListener('dispose', () => instanceReleases++);
  resources.forEach(r => r.addEventListener('dispose', () => releases++)); death.dispose(); death.dispose(); assert.equal(releases, resources.length);
  assert.equal(instanceReleases, 1, 'Small ship debris releases instance buffers exactly once');
});

test('debris motion uses time, not frame count; mobile/reduced-motion keep a recognizable bounded effect', () => {
  const poses = [];
  for (const fps of [30, 60, 120]) {
    const effects = new CollisionVFX(new Scene()); effects.trigger(event, quality);
    for (let i = 0; i < fps / 2; i++) effects.update(1 / fps, quality, 50);
    const mesh = effects.root.getObjectByName('collision-debris') as import('three').InstancedMesh;
    poses.push([...mesh.instanceMatrix.array]); effects.dispose();
  }
  for (let i = 0; i < poses[0]!.length; i++) assert.ok(Math.abs(poses[0]![i]! - poses[2]![i]!) < 1e-5);
  const effects = new CollisionVFX(new Scene()); effects.trigger({ ...event, obstacleKind: 9 }, mobile);
  assert.equal((effects.root.getObjectByName('collision-debris') as import('three').InstancedMesh).count, F.mobileFragments);
  assert.equal(effects.activeCount, 1); effects.dispose();
});
