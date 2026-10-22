import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Euler, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sweptSphereBoxHit, sweptSphereHit, sweptSphereInterval } from '../src/core/collision.ts';
import { HazardCollision } from '../src/core/hazard-collision.ts';
import { HAZARD_BOXES, hazardOrientation, inverseRotate } from '../src/core/hazard-profile.ts';
import { Random } from '../src/core/random.ts';
import { MODEL_ASSETS, HAZARD_MODELS } from '../src/assets/catalog.ts';
import { normalizeModel } from '../src/assets/asset-manager.ts';
import { ResourceOwner } from '../src/assets/resources.ts';
import { CONFIG } from '../src/config.ts';
import { GameModel } from '../src/core/game-model.ts';

test('sphere-box CCD catches fast transit, stationary overlap, tangency and face contact', () => {
  const half = { x: 0.6, y: 0.4, z: 0.8 };
  assert.equal(sweptSphereBoxHit({ x: 0, y: 0, z: -100 }, { x: 0, y: 0, z: 100 }, half, 0.42), true);
  assert.equal(sweptSphereBoxHit({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, half, 0.42), true);
  assert.equal(sweptSphereBoxHit({ x: 0, y: 0.82, z: -5 }, { x: 0, y: 0.82, z: 5 }, half, 0.42), true);
  assert.equal(sweptSphereBoxHit({ x: 0, y: 0.82001, z: -5 }, { x: 0, y: 0.82001, z: 5 }, half, 0.42), false);
});

test('rounded box corners reject false hits from a simply expanded-AABB slab test', () => {
  const half = { x: 1, y: 1, z: 1 };
  assert.equal(sweptSphereBoxHit({ x: 1.19, y: 1.19, z: -3 }, { x: 1.19, y: 1.19, z: 3 }, half, 0.2), false);
  const tangent = 1 + 0.2 / Math.sqrt(2);
  assert.equal(sweptSphereBoxHit({ x: tangent, y: tangent, z: -3 }, { x: tangent, y: tangent, z: 3 }, half, 0.2), true);
});

test('outer sphere and box must overlap during the SAME part of the sweep', () => {
  const from = { x: 0, y: 0, z: -4 }, to = { x: 0, y: 0, z: 4 };
  const range = new Float64Array(2);
  assert.equal(sweptSphereInterval(from, to, 1, range), true);
  assert.ok(Math.abs(range[0]! - 0.375) < 1e-12);
  assert.ok(Math.abs(range[1]! - 0.625) < 1e-12);
  const half = { x: 1, y: 1, z: 0.1 };
  assert.equal(sweptSphereBoxHit(from, to, half, 0.1, 0, 0.3), false);
  assert.equal(sweptSphereBoxHit(from, to, half, 0.1, range[0], range[1]), true);
  assert.equal(sweptSphereInterval({ x: 2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 1, range), false);
});

test('calibration removes measured half-meteor, barrel and generator empty-space hits', () => {
  const query = new HazardCollision();
  const fixtures = [
    { kind: 1, phase: Math.PI * 2, y: 1.1, x: 0 },
    { kind: 2, phase: 0, y: 0, x: 1.2 },
    { kind: 2, phase: Math.PI * 2, y: 1, x: 0 },
  ];
  for (const fixture of fixtures) {
    const from = { x: fixture.x, y: fixture.y, z: -3 }, to = { ...from, z: 3 };
    assert.equal(sweptSphereHit(from, to, 1 + CONFIG.ship.radius), true);
    assert.equal(query.hit(from, to, { ...fixture, spin: 0, radius: 1 }, 2, CONFIG.step), false);
    assert.equal(query.hit({ x: 0, y: 0, z: -3 }, { x: 0, y: 0, z: 3 }, { ...fixture, spin: 0, radius: 1 }, 2, CONFIG.step), true);
  }
});

test('inverse XYZ orientation matches Three.js matrices for arbitrary poses', () => {
  const random = new Random(51);
  for (let index = 0; index < 500; index++) {
    const angles = { x: random.between(-20, 20), y: random.between(-20, 20), z: random.between(-20, 20) };
    const point = { x: random.between(-3, 3), y: random.between(-3, 3), z: random.between(-3, 3) };
    const result = { x: 0, y: 0, z: 0 };
    inverseRotate(point, angles, result);
    const expected = new Vector3(point.x, point.y, point.z).applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(angles.x, angles.y, angles.z, 'XYZ')).invert());
    assert.ok(expected.distanceTo(new Vector3(result.x, result.y, result.z)) < 1e-11);
  }
});

test('calibrated collisions stay inside the approved sphere envelope for 10,000 sweeps', () => {
  const random = new Random(347);
  const query = new HazardCollision();
  let removed = 0;
  for (let index = 0; index < 10_000; index++) {
    const from = { x: random.between(-2, 2), y: random.between(-2, 2), z: random.between(-5, 5) };
    const to = { x: random.between(-2, 2), y: random.between(-2, 2), z: random.between(-5, 5) };
    const hazard = { kind: index % 3, phase: random.between(0, Math.PI * 2), spin: random.between(-0.7, 0.7), radius: random.between(0.65, 1.1) };
    const oldHit = sweptSphereHit(from, to, hazard.radius + CONFIG.ship.radius);
    const newHit = query.hit(from, to, hazard, 120, 0.1);
    assert.ok(!newHit || oldHit, `expanded envelope at sample ${index}`);
    if (index % 3 === 0 || (index % 3 === 1 && hazard.phase < Math.PI)) assert.equal(newHit, oldHit);
    if (oldHit && !newHit) removed++;
  }
  assert.ok(removed > 0);
});

test('rotating box sweep conservatively catches sampled contacts across the full step', () => {
  const random = new Random(604);
  const query = new HazardCollision();
  let contacts = 0;
  for (let index = 0; index < 600; index++) {
    const variant = 2 + index % 3;
    const bounds = HAZARD_BOXES[variant]!;
    const hazard = { kind: variant === 2 ? 1 : 2, phase: variant === 3 ? random.between(0, Math.PI - 0.01) : random.between(Math.PI, 2 * Math.PI), spin: random.between(-0.7, 0.7), radius: random.between(0.65, 1.1) };
    const from = { x: random.between(-1.4, 1.4), y: random.between(-1.4, 1.4), z: -4 };
    const to = { x: random.between(-1.4, 1.4), y: random.between(-1.4, 1.4), z: 4 };
    const elapsed = random.between(1, 120), dt = 0.1;
    let sampledContact = false;
    for (let sample = 0; sample <= 128; sample++) {
      const t = sample / 128;
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
      const angles = { x: 0, y: 0, z: 0 }, local = { x: 0, y: 0, z: 0 };
      hazardOrientation(hazard, elapsed - dt + dt * t, angles);
      inverseRotate(point, angles, local);
      const dx = Math.max(0, Math.abs(local.x) - bounds.x * hazard.radius);
      const dy = Math.max(0, Math.abs(local.y) - bounds.y * hazard.radius);
      const dz = Math.max(0, Math.abs(local.z) - bounds.z * hazard.radius);
      if (Math.hypot(point.x, point.y, point.z) <= hazard.radius + CONFIG.ship.radius && Math.hypot(dx, dy, dz) <= CONFIG.ship.radius) { sampledContact = true; break; }
    }
    if (sampledContact) {
      contacts++;
      assert.equal(query.hit(from, to, hazard, elapsed, dt), true, `missed rotating contact ${index}`);
    }
  }
  assert.ok(contacts > 100);
});

test('profile dimensions match the actual normalized GLB bounds within outward rounding', async () => {
  for (let index = 2; index < HAZARD_MODELS.length; index++) {
    const spec = MODEL_ASSETS.find(model => model.id === HAZARD_MODELS[index])!;
    const bytes = await readFile(new URL(`../public/assets/kenney-space/${spec.file}`, import.meta.url));
    const source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    const model = normalizeModel(source, spec);
    const actual = new Box3().setFromObject(model).getSize(new Vector3()).multiplyScalar(0.5);
    const profile = HAZARD_BOXES[index]!;
    for (const axis of ['x', 'y', 'z'] as const) {
      assert.ok(profile[axis] >= actual[axis]);
      assert.ok(profile[axis] - actual[axis] < 1e-6);
    }
    const resources = new ResourceOwner(); resources.track(model); resources.dispose();
  }
});

test('box collisions at maximum forward speed remove one hull and keep invulnerability', () => {
  for (const fixture of [{ kind: 1, phase: Math.PI * 2 }, { kind: 2, phase: 0 }, { kind: 2, phase: Math.PI * 2 }]) {
    const model = new GameModel(); model.ready(); model.start(42); model.elapsed = 120;
    Object.assign(model.field.hazards[0]!, { ...fixture, active: true, x: 0, y: 0, z: -1.6, radius: 0.65, spin: 0 });
    model.step(0.1, { x: 0, y: 0 });
    assert.equal(model.hull, 2);
    assert.equal(model.hitSerial, 1);
    assert.ok(model.invulnerability > 0);
    Object.assign(model.field.hazards[1]!, { ...fixture, active: true, x: 0, y: 0, z: -1.6, radius: 0.65, spin: 0 });
    model.step(0.1, { x: 0, y: 0 });
    assert.equal(model.hull, 2);
    assert.equal(model.hitSerial, 1);
  }
});
