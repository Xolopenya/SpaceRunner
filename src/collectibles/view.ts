import * as THREE from 'three';
import { ResourceOwner } from '../assets/resources.ts';
import type { GameModel } from '../core/game-model.ts';
import { FRAGMENT as S } from './settings.ts';
import { fragmentsOf } from './state.ts';

/** Fixed mesh pool; three shared geometries, three shared materials, no textures. */
export class FragmentView {
  readonly root = new THREE.Group();
  private readonly resources = new ResourceOwner();
  private readonly meshes: THREE.Group[] = [];
  private readonly burst: THREE.Mesh;
  private serial = 0;
  private burstAt = -1;
  private disposed = false;
  constructor(scene: THREE.Scene) {
    this.root.name = 'energy-fragments';
    const crystal = new THREE.OctahedronGeometry(.34);
    crystal.scale(1, 1.35, 1);
    const core = new THREE.OctahedronGeometry(.14);
    const ring = new THREE.TorusGeometry(.51, .025, 4, 16);
    const shell = new THREE.MeshBasicMaterial({ color: 0x1deed8, transparent: true, opacity: .64, depthWrite: false });
    const light = new THREE.MeshBasicMaterial({ color: 0xd6ffff });
    const halo = new THREE.MeshBasicMaterial({ color: 0x46ffe6, transparent: true, opacity: .7, depthWrite: false });
    for (let i = 0; i < S.capacity; i++) {
      const group = new THREE.Group(); group.name = `energy-fragment-${i}`;
      group.add(new THREE.Mesh(crystal, shell), new THREE.Mesh(core, light), new THREE.Mesh(ring, halo));
      group.visible = false; this.root.add(group); this.meshes.push(group);
    }
    this.burst = new THREE.Mesh(ring, halo.clone()); this.burst.visible = false; this.root.add(this.burst);
    scene.add(this.root); this.resources.track(this.root);
  }
  reset(): void {
    this.serial = 0; this.burstAt = -1;
    for (const mesh of this.meshes) mesh.visible = false;
    this.burst.visible = false;
  }
  update(model: GameModel, reducedMotion: boolean): void {
    if (this.disposed) return;
    const run = fragmentsOf(model);
    this.root.visible = !!run;
    if (!run) return;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i]!, slot = run.slots[i]!, p = slot.proposal;
      const age=model.elapsed-run.lastPickup.elapsed;
      const attracting=slot.state==='collected'&&run.lastPickup.assisted&&run.lastPickup.slot===i&&age>=0&&age<S.magnetSeconds;
      mesh.visible = (slot.state === 'active' && !!p)||!!attracting;
      if(attracting){
        const t=reducedMotion?1:1-(1-age/S.magnetSeconds)**2;
        mesh.position.set(THREE.MathUtils.lerp(run.lastPickup.x,model.ship.x,t),THREE.MathUtils.lerp(run.lastPickup.y,model.ship.y,t),
          ((run.lastPickup.z??0)+model.distance-run.lastPickup.distance)*(1-t));
        mesh.scale.setScalar(1-t*.65);continue;
      }
      mesh.scale.setScalar(1);
      if (!mesh.visible || !p) continue;
      mesh.position.set(p.x, p.y, model.distance - p.passDistance);
      const time = reducedMotion ? 0 : model.elapsed;
      mesh.rotation.set(.18, time * .65 + i, .12);
      mesh.children[0]!.scale.setScalar(1 + .07 * Math.sin(time * 3 + i));
      mesh.children[2]!.rotation.y = -mesh.rotation.y;
    }
    if (run.count < this.serial) this.reset();
    if (run.count > this.serial) {
      this.burstAt = run.lastPickup.elapsed+(run.lastPickup.assisted?S.magnetSeconds:0);
      this.burst.position.set(run.lastPickup.x, run.lastPickup.y, 0);
    }
    this.serial = run.count;
    const age = model.elapsed - this.burstAt;
    if(run.lastPickup.assisted&&age>=-S.magnetSeconds&&age<S.burstSeconds)this.burst.position.set(model.ship.x,model.ship.y,0);
    this.burst.visible = this.burstAt >= 0 && age >= 0 && age < S.burstSeconds;
    if (this.burst.visible) {
      this.burst.scale.setScalar(1 + age * (reducedMotion ? 1 : 5));
      (this.burst.material as THREE.MeshBasicMaterial).opacity = .85 * (1 - age / S.burstSeconds);
    }
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.root.removeFromParent(); this.resources.dispose(); }
}
