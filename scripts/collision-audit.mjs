import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_ASSETS } from '../src/assets/catalog.ts';
import { normalizeModel } from '../src/assets/asset-manager.ts';
import { ResourceOwner } from '../src/assets/resources.ts';
import { CONFIG } from '../src/config.ts';
import { HAZARD_BOXES } from '../src/core/hazard-profile.ts';

const models = [];
for (const spec of MODEL_ASSETS) {
  const bytes = await readFile(new URL(`../public/assets/kenney-space/${spec.file}`, import.meta.url));
  const source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  const sourceBounds = new Box3().setFromObject(source);
  const model = normalizeModel(source, spec);
  const bounds = new Box3().setFromObject(model);
  const vertex = new Vector3();
  let radius = 0;
  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const positions = node.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) radius = Math.max(radius, vertex.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld).length());
  });
  const boxProfile = HAZARD_BOXES[MODEL_ASSETS.indexOf(spec) - 1];
  models.push({ id: spec.id, file: spec.file, sourceDimensions: sourceBounds.getSize(new Vector3()).toArray(), normalizedDimensions: bounds.getSize(new Vector3()).toArray(), center: bounds.getCenter(new Vector3()).toArray(), vertexRadius: radius, rootScale: model.scale.x, baselineSphereRadius: spec.id === 'ship' ? CONFIG.ship.radius : 1, calibratedBoxHalfExtents: boxProfile ?? null });
  const owner = new ResourceOwner();
  owner.track(model);
  owner.dispose();
}
const output = { coordinateSystem: '+X right, +Y up, forward -Z', note: 'Hazard dimensions at logical radius 1; multiply by generated radius 0.65–1.1. Ship dimensions include wings; its approved forgiving sphere remains unchanged.', models };
console.log(JSON.stringify(output, null, 2));
if (process.env.REVIEW_RESULT_DIR) {
  await mkdir(process.env.REVIEW_RESULT_DIR, { recursive: true });
  await writeFile(`${process.env.REVIEW_RESULT_DIR}/collision-measurements.json`, JSON.stringify(output, null, 2) + '\n');
}
