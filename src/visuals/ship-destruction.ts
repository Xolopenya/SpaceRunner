import * as T from 'three';
import { hullSections } from './ship-surfaces.ts';
import { energySurface, energySparks } from './energy-materials.ts';
import { POLISH as P } from '../feedback/polish-settings.ts';
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
  private readonly core: T.Mesh<T.SphereGeometry, T.ShaderMaterial>;
  private readonly cloud: T.Mesh<T.SphereGeometry, T.ShaderMaterial>;
  private readonly wave: T.Mesh<T.SphereGeometry, T.ShaderMaterial>;
  private readonly secondary: T.Mesh<T.SphereGeometry, T.ShaderMaterial>[];
  private readonly arcs: T.LineSegments<T.BufferGeometry, T.LineBasicMaterial>;
  private readonly hullMaterial: T.MeshStandardMaterial;
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
    this.hullMaterial = new T.MeshStandardMaterial({ vertexColors: true, color: 0xb5bdc7,
      roughness: .85, metalness: .3, transparent: true, depthWrite: false, side: T.DoubleSide });
    // Dark heat-scorched reverse faces avoid painted hollow interiors. Original
    // triangle boundaries remain open; this is material treatment, not sealed caps.
    this.hullMaterial.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb=vec3(.055,.065,.075);');
    };
    this.hullMaterial.customProgramCacheKey = () => 'charred-hull-interior-v1';
    this.pieces = hullSections(model).map((part, i) => {
      const mesh = new T.Mesh(part.geometry, this.hullMaterial);
      mesh.name = `ship-fragment:${part.name}`; this.root.add(mesh);
      return { mesh, center: part.center, velocity: new T.Vector3(part.center.x * 1.3 + random.between(-.4, .4),
        part.center.y * .8 + random.between(-.7, .7), part.center.z * .6 + random.between(-.5, .7)),
        spin: new T.Vector3(random.between(-1, 1), random.between(-1, 1), (i % 2 ? 1 : -1) * random.between(.5, 1.3)) };
    });
    const sphere = new T.SphereGeometry(1, 32, 20);
    this.core = new T.Mesh(sphere, energySurface('core', 0xff772a, 0xffdfa1));
    this.cloud = new T.Mesh(sphere, energySurface('haze', 0x305475, 0xcf804b));
    this.wave = new T.Mesh(sphere, energySurface('wave', 0x48bddc, 0xffd195));
    this.secondary = P.death.secondary.map(() => new T.Mesh(sphere, energySurface('core', 0xee8c45, 0xbcefff)));
    this.secondary.forEach((mesh, i) => { mesh.name = `secondary-failure:${i}`; this.root.add(mesh); });
    this.arcs = new T.LineSegments(new T.BufferGeometry().setAttribute('position',
      new T.BufferAttribute(new Float32Array(P.death.arcSegments * 6), 3).setUsage(T.DynamicDrawUsage)),
      new T.LineBasicMaterial({ color: 0xa2edff, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    this.arcs.name = 'system-failure-arcs'; this.arcs.frustumCulled = false;
    const sparks = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(this.directions.length), 3).setUsage(T.DynamicDrawUsage));
    this.sparks = new T.Points(sparks, energySparks(sparks, F.death.particles, 0x99e7ff, .10));
    this.sparks.frustumCulled = false;
    this.smallDebris = new T.InstancedMesh(new T.BoxGeometry(.18, .055, .26),
      new T.MeshStandardMaterial({ color: 0xffffff, roughness: .86, metalness: .2, flatShading: true,
        transparent: true, depthWrite: false }), F.death.smallFragments);
    this.smallDebris.name = 'ship-small-debris'; this.smallDebris.frustumCulled = false;
    this.smallDebris.instanceMatrix.setUsage(T.DynamicDrawUsage);
    for (let i = 0; i < F.death.smallFragments; i++) this.smallDebris.setColorAt(i, new T.Color(i % 4 ? 0x91a4b6 : 0xc39255));
    for (let i = 0; i < F.death.particles; i++) new T.Vector3(random.between(-1, 1), random.between(-1, 1), random.between(-.7, 1)).normalize()
      .multiplyScalar(random.between(2, 8)).toArray(this.directions, i * 3);
    this.root.add(this.core, this.cloud, this.wave, this.sparks, this.smallDebris, this.arcs); scene.add(this.root); this.resources.track(this.root); this.reset();
  }
  trigger(event: CollisionContext, ship: T.Group, quality: VisualQuality): boolean {
    if (this.disposed || !this.sequence.begin(event.runId, quality.reducedMotion)) return false;
    this.origin.copy(event.position); this.bank.copy(ship.quaternion); this.reduced = quality.reducedMotion;
    this.explosions++; this.root.visible = true; this.update(quality); return true;
  }
  get overload(): number { return this.sequence.active && !this.sequence.broken ? (this.reduced ? .15 : .20 + .15 * (1 - Math.exp(-this.sequence.elapsed * 6))) : 0; }
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

    }
    this.hullMaterial.opacity = Math.min(1, fade * 2);
    this.hullMaterial.emissive.setHex(0xc65d27); this.hullMaterial.emissiveIntensity = broken ? Math.exp(-age * 4) * P.death.heat : 0;
    this.core.visible = broken && age < .55;
    const size = .24 + 1.05 * (1 - Math.exp(-age * 15));
    this.core.position.set(0, .15, .4);
    this.core.scale.set(size, size * 1.15, size * 1.1); this.core.rotation.set(.25, age * .4, -.2);
    this.core.material.uniforms.age!.value = age;
    this.core.material.uniforms.alpha!.value = Math.exp(-age / P.death.flash) * (this.reduced ? .45 : 3.2);
    this.cloud.visible = broken; this.cloud.scale.set(1.4 + age * 1.8, .8 + age, 1.3 + age * 1.6);
    this.cloud.material.uniforms.age!.value = age; this.cloud.material.uniforms.alpha!.value = fade * fade * (this.reduced ? .10 : .35);
    this.wave.visible = broken;
    const radius = .15 + F.death.shockwaveRadius * (1 - Math.exp(-age * 4)) * (this.reduced ? .5 : 1);
    this.wave.scale.set(radius, radius * .62, radius * .87); this.wave.rotation.set(.2, -.3, .12);
    this.wave.material.uniforms.age!.value = age;
    this.wave.material.uniforms.alpha!.value = Math.max(0, 1 - age / P.death.wave) ** 1.8 * (this.reduced ? .45 : 1.6);
    this.secondary.forEach((mesh, i) => {
      const t = age - P.death.secondary[i]!;
      mesh.visible = broken && t > 0 && t < .30 && i < (this.reduced ? 1 : quality.mobile ? 2 : 3);
      mesh.position.copy(this.pieces[i === 2 ? 3 : i]!.mesh.position);
      mesh.scale.setScalar(.16 + Math.max(0, t) * 1.9);
      mesh.material.uniforms.age!.value = Math.max(0, t);
      mesh.material.uniforms.alpha!.value = Math.max(0, 1 - Math.max(0, t) / .30) ** 2 * (this.reduced ? .2 : .9);
    });
    this.arcs.visible = !this.reduced && (!broken || age < .34);
    this.arcs.material.opacity = broken ? Math.max(0, 1 - age / .34) * .8 : .35 + Math.min(.5, elapsed);
    if (this.arcs.visible) {
      const attr = this.arcs.geometry.getAttribute('position') as T.BufferAttribute;
      for (let i = 0; i < P.death.arcSegments; i++) {
        const lane = Math.floor(i / 6), t = (i % 6) / 6;
        for (let end = 0; end < 2; end++) {
          const u = t + end / 6, side = lane % 2 ? -1 : 1;
          if (broken) {
            const p = this.pieces[lane]!, reach = .5 + age * 4;
            attr.setXYZ(i * 2 + end, p.mesh.position.x + p.velocity.x * u * reach + Math.sin(u * 30 + lane) * .055,
              p.mesh.position.y + (.6 + lane * .12) * u * reach + Math.cos(u * 27 + lane) * .05,
              p.mesh.position.z + p.velocity.z * u * reach);
          } else attr.setXYZ(i * 2 + end, side * (.56 * (1 - u) + .04 * Math.sin(u * 40 + lane)),
              -.12 + u * .32 + Math.sin(u * 29 + lane) * .04,
              1.35 - u * (lane < 2 ? 1.6 : .8) + Math.sin(elapsed * 8 + lane) * .035);
        }
      }
      attr.needsUpdate = true;
    }
    this.sparks.visible = broken; this.sparks.geometry.setDrawRange(0, quality.mobile || quality.reducedMotion ? F.death.mobileParticles : F.death.particles);
    const attr = this.sparks.geometry.getAttribute('position') as T.BufferAttribute;
    const sparkTravel = -Math.expm1(-age * 1.5) / 1.5 * (this.reduced ? .3 : 1);
    for (let i = 0; i < this.sparks.geometry.drawRange.count; i++) attr.setXYZ(i, this.directions[i * 3]! * sparkTravel,
      this.directions[i * 3 + 1]! * sparkTravel, this.directions[i * 3 + 2]! * sparkTravel);
    attr.needsUpdate = true; (this.sparks.material as T.ShaderMaterial).uniforms.alpha!.value = fade * .9;
    (this.sparks.material as T.ShaderMaterial).uniforms.age!.value = age;
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
