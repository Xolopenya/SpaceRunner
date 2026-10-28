import { Group, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetManager, normalizeModel } from '../../assets/asset-manager.ts';
import { MODEL_ASSETS } from '../../assets/catalog.ts';

/** Existing GLTF normalization, cache and one-owner resource lifetime; DEV URL only. */
export class MineAssetManager extends AssetManager {
  private mine?: Promise<Group>;
  private template?: Group;
  private closed = false;
  loadMine(load = async () => (await new GLTFLoader().loadAsync(new URL('./space-mine.glb', import.meta.url).href)).scene): Promise<Group> {
    if (this.closed) return Promise.reject(new Error('Mine assets disposed'));
    return this.mine ??= load().then(source => {
      this.resources.track(source);
      if (this.closed) { this.resources.dispose(); throw new Error('Mine load cancelled'); }
      const template = normalizeModel(source, MODEL_ASSETS[1]);
      template.name = 'asset:space-mine';
      template.userData.modelId = 'space-mine';
      template.traverse(node => {
        if (!(node instanceof Mesh)) return;
        for (const m of Array.isArray(node.material) ? node.material : [node.material]) if (m instanceof MeshStandardMaterial) {
          if (m.name === 'dark') m.color.setHex(0x34434c);
          if (m.name === 'orange') { m.color.setHex(0xb63816); m.emissive.setHex(0xff2806); m.emissiveIntensity = .55; }
          m.metalness = .25; m.roughness = .72;
        }
      });
      return this.template = template;
    });
  }
  cloneMine(): Group { if (this.closed || !this.template) throw new Error('Mine unavailable'); return this.template.clone(true); }
  override dispose(): void { this.closed = true; this.template = undefined; this.mine = undefined; super.dispose(); }
}
