import { BufferGeometry, Material, Mesh, Line, Points, Texture } from 'three';
import type { Object3D } from 'three';

/** One owner per lifetime; clones borrow resources and must never dispose them. */
export class ResourceOwner {
  readonly geometries = new Set<BufferGeometry>();
  readonly materials = new Set<Material>();
  readonly textures = new Set<Texture>();

  track(root: Object3D, borrowed?: ResourceOwner): void {
    root.traverse(node => {
      if (!(node instanceof Mesh || node instanceof Line || node instanceof Points)) return;
      if (!borrowed?.geometries.has(node.geometry)) this.geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (borrowed?.materials.has(material)) continue;
        this.materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof Texture && !borrowed?.textures.has(value)) this.textures.add(value);
        }
      }
    });
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) {
      texture.dispose();
      const data: unknown = texture.source.data;
      if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) data.close();
    }
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
  }
}
