import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManager, normalizeModel } from '../src/assets/asset-manager.ts';
import { MODEL_ASSETS, hazardVariant } from '../src/assets/catalog.ts';
import { ResourceOwner } from '../src/assets/resources.ts';

function fixture(): Group {
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 1, 3), new MeshStandardMaterial());
  mesh.position.set(2, 1, 1.5);
  root.add(mesh);
  return root;
}

test('concurrent requests share one load; clones share resources but independent transforms', async () => {
  let calls = 0;
  const source = fixture();
  const manager = new AssetManager('./', async () => { calls++; return source; });
  const a = manager.load('ship');
  assert.equal(a, manager.load('ship'));
  await a;
  const first = manager.clone('ship');
  const second = manager.clone('ship');
  first.position.x = 9;
  assert.equal(second.position.x, 0);
  const meshA = first.getObjectByProperty('isMesh', true) as Mesh;
  const meshB = second.getObjectByProperty('isMesh', true) as Mesh;
  assert.equal(meshA.geometry, meshB.geometry);
  assert.equal(meshA.material, meshB.material);
  assert.equal(calls, 1);
  let geometryDisposals = 0;
  meshA.geometry.addEventListener('dispose', () => geometryDisposals++);
  manager.dispose();
  manager.dispose();
  assert.equal(geometryDisposals, 1);
  assert.throws(() => manager.clone('ship'), /disposed/);
});

test('failed loads report the file and can be retried', async () => {
  let calls = 0;
  const manager = new AssetManager('./', async () => {
    if (++calls === 1) throw new Error('network failure');
    return fixture();
  });
  await assert.rejects(manager.load('meteor'), /meteor.glb.*network failure/);
  await manager.load('meteor');
  assert.equal(calls, 2);
  manager.dispose();
});

test('loads completing after disposal release their resources instead of reviving cache', async () => {
  let finish!: (model: Group) => void;
  const manager = new AssetManager('./', () => new Promise(resolve => { finish = resolve; }));
  const pending = manager.load('meteor');
  manager.dispose();
  const source = fixture();
  let disposals = 0;
  (source.children[0] as Mesh).geometry.addEventListener('dispose', () => disposals++);
  finish(source);
  await assert.rejects(pending, /cancelled/);
  assert.equal(disposals, 1);
});

test('world resource collection excludes borrowed model resources', () => {
  const model = fixture();
  const assets = new ResourceOwner();
  assets.track(model);
  const scene = new Group();
  scene.add(model.clone(true), fixture());
  const world = new ResourceOwner();
  world.track(scene, assets);
  assert.equal(world.geometries.size, 1);
  assert.equal(world.materials.size, 1);
  assert.notEqual([...world.geometries][0], [...assets.geometries][0]);
  world.dispose();
  assets.dispose();
});

test('every shipped GLB is self-contained, rigid, licensed and normalizes to its intended proxy', async () => {
  const license = await readFile(new URL('../public/assets/kenney-space/LICENSE.txt', import.meta.url), 'utf8');
  assert.match(license, /Creative Commons Zero, CC0/);
  for (const spec of MODEL_ASSETS) {
    const bytes = await readFile(new URL(`../public/assets/kenney-space/${spec.file}`, import.meta.url));
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(json.asset.version, '2.0');
    assert.equal(json.images?.length ?? 0, 0);
    assert.equal(json.skins?.length ?? 0, 0);
    assert.equal(json.animations?.length ?? 0, 0);
    assert.ok(json.buffers.every((buffer: { uri?: string }) => !buffer.uri));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const normalized = normalizeModel(gltf.scene, spec);
    const box = new Box3().setFromObject(normalized);
    assert.ok(box.getCenter(new Vector3()).length() < 1e-5, spec.id);
    if ('width' in spec) assert.ok(Math.abs(box.getSize(new Vector3()).x - spec.width) < 1e-5);
    else {
      let radius = 0;
      const vertex = new Vector3();
      normalized.traverse(node => {
        if (!(node instanceof Mesh)) return;
        const positions = node.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) radius = Math.max(radius, vertex.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).length());
      });
      assert.ok(Math.abs(radius - 1) < 1e-5, spec.id);
    }
    const owner = new ResourceOwner();
    owner.track(normalized);
    owner.dispose();
  }
});

test('all five visual variants are reachable without changing seeded gameplay', () => {
  assert.deepEqual([hazardVariant(0, 0), hazardVariant(1, 0), hazardVariant(1, 4), hazardVariant(2, 0), hazardVariant(2, 4)], [0, 1, 2, 3, 4]);
});
