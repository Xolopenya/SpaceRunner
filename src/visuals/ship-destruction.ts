import * as T from 'three';
import { hullSections } from './ship-surfaces.ts';
import { energyGlow } from './energy-glow.ts';
import { ResourceOwner } from '../assets/resources.ts';
import { DestructionSequence } from '../feedback/destruction-sequence.ts';
import { DAMAGE_FX as F } from '../feedback/visual-settings.ts';
import type { CollisionContext } from '../events/game-events.ts';
import type { VisualQuality } from './settings.ts';
import { Random } from '../core/random.ts';

/** Once-built sections of the actual speeder GLB. All motion is presentation-only. */
export class ShipDestruction {
  readonly root = new T.Group();
  readonly sequence = new DestructionSequence();
  readonly resources = new ResourceOwner();
  private readonly pieces: { mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>; center: T.Vector3; velocity: T.Vector3; spin: T.Vector3 }[];
  private readonly core: T.Mesh<T.IcosahedronGeometry, T.MeshBasicMaterial>;
  private readonly cloud: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
  private readonly wave: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
  private readonly sparks: T.Points;
  private readonly smallDebris: T.InstancedMesh<T.BoxGeometry, T.MeshStandardMaterial>;
  private readonly scratch = new T.Object3D();
  private readonly directions = new Float32Array(F.death.particles * 3);
  private readonly origin = new T.Vector3();
  private readonly bank = new T.Quaternion();
  private reduced = false;
  private disposed = false;
  explosions = 0;
  constructor(scene: T.Scene, model: T.Object3D) {
    this.root.name = 'ship-destruction';
    const random = new Random(0xfee001b);
    this.pieces = hullSections(model).map((part, i) => {
      const mesh = new T.Mesh(part.geometry, new T.MeshStandardMaterial({ vertexColors: true, color: 0xb5bdc7,
        roughness: .85, metalness: .3, transparent: true, depthWrite: false, side: T.DoubleSide }));
      mesh.name = `ship-fragment:${part.name}`; this.root.add(mesh);
      return { mesh, center: part.center, velocity: new T.Vector3(part.center.x * 1.3 + random.between(-.4, .4),
        random.between(-.6, .8), part.center.z * .5 + random.between(-.2, .7)),
        spin: new T.Vector3(random.between(-1, 1), random.between(-1, 1), (i % 2 ? 1 : -1) * random.between(.5, 1.3)) };
    });
    this.core = new T.Mesh(new T.IcosahedronGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xcdf8ff,
      transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    this.cloud = new T.Mesh(new T.PlaneGeometry(1, 1), energyGlow());
    this.wave = new T.Mesh(new T.RingGeometry(.95, 1, 56), new T.MeshBasicMaterial({ color: 0x62d7f2,
      side: T.DoubleSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    this.sparks = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(this.directions.length), 3).setUsage(T.DynamicDrawUsage)),
      new T.PointsMaterial({ color: 0x96ecff, size: .10, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    this.sparks.frustumCulled = false;
    this.smallDebris = new T.InstancedMesh(new T.BoxGeometry(.18, .055, .26),
      new T.MeshStandardMaterial({ color: 0xffffff, roughness: .86, metalness: .2, flatShading: true,
        transparent: true, depthWrite: false }), F.death.smallFragments);
    this.smallDebris.name = 'ship-small-debris'; this.smallDebris.frustumCulled = false;
    this.smallDebris.instanceMatrix.setUsage(T.DynamicDrawUsage);
    for (let i = 0; i < F.death.smallFragments; i++) this.smallDebris.setColorAt(i, new T.Color(i % 4 ? 0x91a4b6 : 0xc39255));
    for (let i = 0; i < F.death.particles; i++) new T.Vector3(random.between(-1, 1), random.between(-1, 1), random.between(-.7, 1)).normalize()
      .multiplyScalar(random.between(2, 8)).toArray(this.directions, i * 3);
    this.root.add(this.core, this.cloud, this.wave, this.sparks, this.smallDebris); scene.add(this.root); this.resources.track(this.root); this.reset();
  }
  trigger(event: CollisionContext, ship: T.Group, quality: VisualQuality): boolean {
    if (this.disposed || !this.sequence.begin(event.runId, quality.reducedMotion)) return false;
    this.origin.copy(event.position); this.bank.copy(ship.quaternion); this.reduced = quality.reducedMotion;
    this.explosions++; this.root.visible = true; this.update(quality); return true;
  }
  get overload(): number { return this.sequence.active && !this.sequence.broken ? (this.reduced ? .15 : .25 + .15 * Math.sin(this.sequence.elapsed * 22) ** 2) : 0; }
  get enginePower(): number { return this.sequence.active ? Math.max(0, 1 - this.sequence.elapsed / this.sequence.breakupAt) : 0; }
  applyShipPose(ship: T.Group): void {
    if (this.sequence.phase === 'idle') return;
    const t = Math.min(this.sequence.breakupAt, this.sequence.elapsed), strength = this.reduced ? 0 : 1;
    ship.position.copy(this.origin); ship.position.y -= t * t * .35 * strength;
    ship.quaternion.copy(this.bank); ship.rotateX(t * .38 * strength); ship.rotateZ(t * -.52 * strength);
    ship.visible = !this.sequence.broken;
    this.root.position.copy(ship.position); this.root.quaternion.copy(ship.quaternion);
  }
  update(quality: VisualQuality): void {
    if (this.disposed) return;
    this.root.visible = this.sequence.active;
    if (!this.sequence.active) return;
    const elapsed = this.sequence.elapsed, age = Math.max(0, elapsed - this.sequence.breakupAt), broken = this.sequence.broken;
    const fade = Math.max(0, 1 - age / (this.sequence.duration - this.sequence.breakupAt));
    const travel = -Math.expm1(-F.death.drag * age) / F.death.drag * (this.reduced ? F.death.reducedDrift : F.death.drift);
    for (const p of this.pieces) {
      p.mesh.visible = broken; p.mesh.position.copy(p.center).addScaledVector(p.velocity, travel);
      p.mesh.rotation.set(p.spin.x * age, p.spin.y * age, p.spin.z * age);
      p.mesh.material.opacity = Math.min(1, fade * 2);
    }
    this.core.visible = broken && age < .36;
    this.core.scale.setScalar(.22 + age * (this.reduced ? 1.5 : 3.7));
    this.core.material.opacity = Math.max(0, 1 - age / .36) * (this.reduced ? .35 : .85);
    this.cloud.visible = broken; this.cloud.scale.setScalar(2.1 + age * 3.4);
    this.cloud.material.uniforms.alpha!.value = fade * fade * (this.reduced ? .16 : .48);
    this.wave.visible = broken; this.wave.scale.setScalar(.2 + F.death.shockwaveRadius * (1 - Math.exp(-age * 3)) * (this.reduced ? .5 : 1));
    this.wave.material.opacity = fade * fade * .7;
    this.sparks.visible = broken; this.sparks.geometry.setDrawRange(0, quality.mobile || quality.reducedMotion ? F.death.mobileParticles : F.death.particles);
    const attr = this.sparks.geometry.getAttribute('position') as T.BufferAttribute;
    const sparkTravel = -Math.expm1(-age * 1.5) / 1.5 * (this.reduced ? .3 : 1);
    for (let i = 0; i < F.death.particles; i++) attr.setXYZ(i, this.directions[i * 3]! * sparkTravel,
      this.directions[i * 3 + 1]! * sparkTravel, this.directions[i * 3 + 2]! * sparkTravel);
    attr.needsUpdate = true; (this.sparks.material as T.PointsMaterial).opacity = fade * .9;
    this.smallDebris.visible = broken;
    this.smallDebris.count = quality.mobile || quality.reducedMotion ? F.death.mobileSmallFragments : F.death.smallFragments;
    for (let i = 0; i < this.smallDebris.count; i++) {
      this.scratch.position.set(this.directions[i * 3]! * sparkTravel * .72,
        this.directions[i * 3 + 1]! * sparkTravel * .72, this.directions[i * 3 + 2]! * sparkTravel * .72);
      this.scratch.rotation.set(i * .47 + age * 1.6, i * .83 + age * 2.1, age * 1.3);
      this.scratch.scale.setScalar(.6 + (i % 3) * .3); this.scratch.updateMatrix();
      this.smallDebris.setMatrixAt(i, this.scratch.matrix);
    }
    this.smallDebris.instanceMatrix.needsUpdate = true; this.smallDebris.material.opacity = fade * fade;
  }
  skip(): void { this.sequence.skip(); this.root.visible = false; }
  reset(): void { this.sequence.reset(); this.root.visible = false; this.explosions = 0; }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.reset(); this.root.removeFromParent();
    this.smallDebris.dispose(); this.resources.dispose();
  }
}
