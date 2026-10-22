import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Group, Scene, Vector3, Mesh, Points, Line } from 'three';
import { EngineVFX } from '../src/visuals/engine-vfx.ts';
import { ImpactVFX } from '../src/visuals/impact-vfx.ts';
import { SpaceBackground } from '../src/visuals/space-background.ts';
import { VISUALS, visualDelta, visualQuality } from '../src/visuals/settings.ts';
import { GameModel } from '../src/core/game-model.ts';

const quality = visualQuality(1280, 800, false, false);
// LF-normalized hashes measured from approved d3d3aaaaaf0c7af52e4043cf57c15899ce77147e.
// Keep snapshot tests runnable without a .git directory in the review archive.
const approvedFiles: Record<string, string> = {
  'src/config.ts': '99cabcb06c1061bb720c90690ace3bb40a48398821f5aa8bf849b0cff7a4f136',
  'src/core/ship.ts': 'db8d5b870ca9c480b5bc3e619d2222587c6eb26b96b1fa6232492c331d0309b0',
  'src/core/game-model.ts': '9c1b10a43bd24685b0096f8822152ad006182e6ca6b6071ce3106ca1f81d24d7',
  'src/core/obstacles.ts': '120040eb86e7b705d97c62c0f9807833fe1ab3d8a707f54e6019c9178c211de3',
  'src/core/random.ts': 'a6e88787c57b8d8b8fafe4306f0e34bda419e3f191fb0b61a4f757f2c14f5f07',
  'src/core/collision.ts': '5b3ed802c6e8382aca43a78061ba8e63b0153b087ea0159fc2339480ea7baa0b',
  'src/core/hazard-collision.ts': '5b0098f5fb08253bb79c276711d637c94d7a653092f78dfa5893ca10a442fa51',
  'src/core/hazard-profile.ts': '99a9d4b675bb79e3b30a3e36ed121c7727ad815820b3c7fafc59c6126b63f5e8',
  'src/input.ts': '9ed8415664e7b2c4590ed0d72428a213eca73dfd8681b822db160d43e881bcc8',
  'src/game-loop.ts': '4966a54fd82fe24e47281db0e6615d45a62569702d30c0baef2ff191382b652a',
  'src/assets/asset-manager.ts': '422a3ab0e0d180d659fdc08103edc00762f6fdd4bc611fe3ebe6111a054ebdcb',
};
const hash = (source: string) => createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');

test('VFX preserves approved movement, collision, spawning, input, loop and camera formulas', () => {
  for (const [file, approvedHash] of Object.entries(approvedFiles)) assert.equal(hash(readFileSync(file, 'utf8')), approvedHash, file);
  const newWorld = readFileSync('src/world.ts', 'utf8');
  const formulas = (source: string) => source.split(/\r?\n/).map(line => line.trim()).filter(line => /this\.camera\.|this\.cameraZ =|const blend =|this\.ship\.rotation\.[xz] =/.test(line));
  assert.equal(hash(formulas(newWorld).join('\n')), '78aff996126b05e6c9472d2c1ddf14b4f8ff223fcb2da103998cde42847d831c');
});

test('quality selects lower cost in both mobile orientations and honors reduced motion', () => {
  const portrait = visualQuality(390, 844, true, false);
  const landscape = visualQuality(844, 390, true, false);
  assert.deepEqual(portrait, landscape);
  assert.ok(portrait.stars.reduce((a, b) => a + b, 0) < quality.stars.reduce((a, b) => a + b, 0));
  assert.ok(portrait.impactParticles < quality.impactParticles);
  assert.equal(visualQuality(1280, 800, false, true).streaks, 0);
  assert.equal(visualDelta('PAUSED', 100), 0);
  assert.equal(visualDelta('GAME_OVER', 100), 0);
  assert.equal(visualDelta('GAME_OVER', 100, true), 0.1);
  for (const dt of [NaN, Infinity, -1]) assert.equal(visualDelta('PLAYING', dt), 0);
});

test('engine trails follow banked ports, freeze on pause and reuse buffers across restarts', () => {
  const scene = new Scene(), ship = new Group();
  scene.add(ship);
  const engines = new EngineVFX(scene, ship);
  const positions = engines.trails.geometry.getAttribute('position');
  const identity = positions.array;
  ship.position.set(2, 1, 0);
  ship.rotation.set(0.15, 0, -0.3);
  for (let i = 0; i < 30; i++) engines.update(1 / 60, 'PLAYING', 34, quality);
  const expected = new Vector3(-0.56, -0.21, 1.49).applyMatrix4(ship.matrixWorld);
  for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs((identity[axis]! + identity[axis + 3]!) / 2 - expected.getComponent(axis)) < 1e-6);
  const frozen = Array.from(identity);
  for (let i = 0; i < 10; i++) engines.update(0, 'PAUSED', 34, quality);
  assert.deepEqual(Array.from(identity), frozen);
  engines.update(0, 'GAME_OVER', 34, quality);
  assert.equal(engines.trails.visible, false);
  for (let run = 0; run < 20; run++) {
    engines.reset();
    assert.equal(engines.trails.visible, false);
    engines.update(1 / 30, 'PLAYING', 20, quality);
    assert.equal(engines.trails.geometry.getAttribute('position').array, identity);
    assert.equal(scene.getObjectsByProperty('name', 'engine-trails').length, 1);
    assert.ok(Array.from(identity).every(Number.isFinite));
  }
  engines.dispose();
});

test('trail length is stable at 30, 60 and 144 FPS without accumulated sample growth', () => {
  const lengths = [];
  for (const fps of [30, 60, 144]) {
    const scene = new Scene(), ship = new Group();
    scene.add(ship);
    const engines = new EngineVFX(scene, ship);
    for (let i = 0; i < fps; i++) engines.update(1 / fps, 'PLAYING', 34, quality);
    const positions = engines.trails.geometry.getAttribute('position');
    lengths.push(positions.getZ((VISUALS.trailSamples - 1) * 2) - positions.getZ(0));
    engines.dispose();
  }
  assert.ok(Math.max(...lengths) - Math.min(...lengths) < 0.26, String(lengths));
});

test('impact emits once per hitSerial, freezes, finishes after death and resets its bounded pool', () => {
  const impacts = new ImpactVFX(new Scene()), ship = new Vector3(1, 2, 0);
  const inspect = impacts as unknown as { emissions: number };
  const particles = impacts.root.getObjectByName('impact-particles') as Points;
  const identity = particles.geometry.getAttribute('position').array;
  for (let i = 0; i < 5; i++) impacts.update(1, ship, 3, 0, 1.6, 1, 1 / 60, quality);
  assert.equal(inspect.emissions, 1);
  const frozen = Array.from(identity), life = impacts.remaining;
  impacts.update(1, ship, 3, 0, 1.6, 1, 0, quality);
  assert.equal(impacts.remaining, life);
  assert.deepEqual(Array.from(identity), frozen);
  impacts.update(2, ship, 0, 0, 0, 2, 0.01, quality);
  assert.equal(inspect.emissions, 2);
  for (let i = 0; i < 8; i++) impacts.update(2, ship, 0, 0, 0, 2, visualDelta('GAME_OVER', 0.1, true), quality);
  assert.equal(impacts.remaining, 0);
  assert.equal(particles.visible, false);
  impacts.reset();
  assert.equal(inspect.emissions, 0);
  assert.equal(particles.geometry.getAttribute('position').array, identity);
  assert.equal(identity.length, VISUALS.impactParticles * 3);
  assert.ok(Array.from(identity).every(value => value === 0));
  impacts.dispose();
});

test('visual quality, history and bursts consume no gameplay randomness', () => {
  const a = new GameModel(), b = new GameModel();
  a.ready(); b.ready(); a.start(42); b.start(42);
  const background = new SpaceBackground(new Scene());
  for (let i = 0; i < 1200; i++) {
    a.step(1 / 120, { x: 0, y: 0 });
    background.update(a.distance, a.speed, visualQuality(390, 844, true, i % 2 === 0));
    b.step(1 / 120, { x: 0, y: 0 });
  }
  assert.deepEqual(a.field.hazards, b.field.hazards);
  assert.deepEqual(a.field.waves, b.field.waves);
  assert.equal(a.hull, b.hull);
  const second = new SpaceBackground(new Scene());
  background.update(123, 20, quality); second.update(123, 20, quality);
  for (let i = 0; i < 3; i++) {
    const firstLayer = background.root.getObjectByName(`star-layer-${i}`) as Points;
    const secondLayer = second.root.getObjectByName(`star-layer-${i}`) as Points;
    assert.deepEqual(firstLayer.geometry.getAttribute('position').array, secondLayer.geometry.getAttribute('position').array);
  }
  background.dispose(); second.dispose();
});

test('VFX teardown disposes each private geometry and material exactly once', () => {
  const scene = new Scene(), ship = new Group();
  scene.add(ship);
  const effects = [new EngineVFX(scene, ship), new ImpactVFX(scene), new SpaceBackground(scene)];
  const resources = new Set<import('three').BufferGeometry | import('three').Material>();
  scene.traverse(node => {
    if (!(node instanceof Mesh || node instanceof Points || node instanceof Line)) return;
    resources.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) resources.add(material);
  });
  const releases = new Map<unknown, number>();
  for (const resource of resources) resource.addEventListener('dispose', () => releases.set(resource, (releases.get(resource) ?? 0) + 1));
  for (const effect of effects) { effect.dispose(); effect.dispose(); }
  assert.equal(releases.size, resources.size);
  assert.ok([...releases.values()].every(count => count === 1));
  assert.equal(ship.children.length, 0);
  assert.equal(scene.children.length, 1);
});
