import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_ASSETS } from './catalog.ts';
import type { ModelId, ModelSpec } from './catalog.ts';
import { ResourceOwner } from './resources.ts';

type LoadModel = (url: string) => Promise<Group>;
export type LoadProgress = (completed: number, total: number, label: string) => void;

export function normalizeModel(source: Group, spec: ModelSpec): Group {
  const oriented = new Group();
  oriented.add(source);
  oriented.rotation.y = spec.rotationY;
  oriented.updateMatrixWorld(true);
  const box = new Box3().setFromObject(oriented);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  if (box.isEmpty() || size.length() <= 0) throw new Error(`Empty model: ${spec.file}`);
  let radius = 0;
  const vertex = new Vector3();
  oriented.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const positions = node.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
      radius = Math.max(radius, vertex.distanceTo(center));
    }
    // Original files are fully metallic but have no environment map. Keep their
    // authored colors; adjust these shared runtime materials once for readability.
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material instanceof MeshStandardMaterial) {
        material.metalness = Math.min(material.metalness, 0.3);
        material.roughness = 0.72;
      }
    }
  });
  oriented.position.copy(center).negate();
  const root = new Group();
  root.name = `asset:${spec.id}`;
  root.userData.modelId = spec.id;
  root.add(oriented);
  root.scale.setScalar('width' in spec ? spec.width / size.x : 1 / radius);
  root.updateMatrixWorld(true);
  return root;
}

export class AssetManager {
  readonly resources = new ResourceOwner();
  private readonly pending = new Map<ModelId, Promise<Group>>();
  private readonly templates = new Map<ModelId, Group>();
  private readonly loadModel: LoadModel;
  private readonly base: string;
  private disposed = false;
  requests = 0;

  constructor(base = './', loadModel?: LoadModel) {
    const loader = new GLTFLoader();
    this.loadModel = loadModel ?? (async url => (await loader.loadAsync(url)).scene);
    this.base = base;
  }

  load(id: ModelId): Promise<Group> {
    if (this.disposed) return Promise.reject(new Error('Asset manager is disposed'));
    const cached = this.pending.get(id);
    if (cached) return cached;
    const spec = MODEL_ASSETS.find(item => item.id === id)!;
    this.requests++;
    const pending = this.loadModel(`${this.base}assets/kenney-space/${spec.file}`).then(source => {
      const owner = new ResourceOwner();
      owner.track(source);
      if (this.disposed) {
        owner.dispose();
        throw new Error(`Load cancelled: ${spec.file}`);
      }
      this.resources.track(source);
      const template = normalizeModel(source, spec);
      this.templates.set(id, template);
      return template;
    }).catch((error: unknown) => {
      this.pending.delete(id);
      throw new Error(`Unable to load ${spec.file}: ${error instanceof Error ? error.message : String(error)}`);
    });
    this.pending.set(id, pending);
    return pending;
  }

  async preload(progress: LoadProgress = () => {}): Promise<void> {
    let completed = 0;
    const results = await Promise.allSettled(MODEL_ASSETS.map(async spec => {
      await this.load(spec.id);
      progress(++completed, MODEL_ASSETS.length, spec.label);
    }));
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason as unknown);
    if (errors.length) throw new AggregateError(errors, 'Required flight models could not load. Check the local asset files and retry.');
  }

  clone(id: ModelId): Group {
    if (this.disposed) throw new Error('Asset manager is disposed');
    const template = this.templates.get(id);
    if (!template) throw new Error(`Model not preloaded: ${id}`);
    // All selected GLBs are rigid, unskinned, texture-free meshes. Deep node
    // cloning shares geometries/materials, while transforms remain independent.
    return template.clone(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.templates.clear();
    this.pending.clear();
    this.resources.dispose();
  }
}
