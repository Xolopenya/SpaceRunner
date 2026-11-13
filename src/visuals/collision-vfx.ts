import * as T from 'three';
import { ResourceOwner } from '../assets/resources.ts';
import { Random } from '../core/random.ts';
import type { GameEventMap } from '../events/game-events.ts';
import { presentationContact } from '../feedback/collision-presentation.ts';
import type { CollisionFamily } from '../feedback/collision-presentation.ts';
import { DAMAGE_FX as F } from '../feedback/visual-settings.ts';
import type { VisualQuality } from './settings.ts';
import { energyGlow } from './energy-glow.ts';

class Burst {
  readonly root = new T.Group();
  readonly debris: T.InstancedMesh;
  readonly particles: T.Points;
  readonly streaks: T.LineSegments;
  readonly ring: T.Mesh;
  readonly glow: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
  readonly velocities = new Float32Array(F.particles * 3);
  readonly pieces = new Float32Array(F.fragments * 9);
  readonly origin = new T.Vector3();
  age = Infinity;
  duration = 1;
  family: CollisionFamily = 'rock';
  identity?: string;
  startDistance = 0;
  major = false;
  radius = 1;
  constructor(rock: T.BufferGeometry, ring: T.RingGeometry, plane: T.PlaneGeometry) {
    this.debris = new T.InstancedMesh(rock, new T.MeshStandardMaterial({ color: 0xffffff, roughness: .86,
      metalness: .2, transparent: true, flatShading: true, depthWrite: false }), F.fragments);
    this.debris.name = 'collision-debris'; this.debris.frustumCulled = false;
    this.debris.instanceMatrix.setUsage(T.DynamicDrawUsage);
    for (let i = 0; i < F.fragments; i++) this.debris.setColorAt(i, new T.Color(0xffffff));
    const geometry = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(F.particles * 3), 3).setUsage(T.DynamicDrawUsage));
    this.particles = new T.Points(geometry, new T.PointsMaterial({ color: 0xc6b299, size: .09, transparent: true,
      depthWrite: false, opacity: 0 })); this.particles.frustumCulled = false;
    const lines = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(F.particles * 6), 3).setUsage(T.DynamicDrawUsage));
    this.streaks = new T.LineSegments(lines, new T.LineBasicMaterial({ color: 0xffd8ad, transparent: true, depthWrite: false,
      blending: T.AdditiveBlending })); this.streaks.frustumCulled = false;
    this.ring = new T.Mesh(ring, new T.MeshBasicMaterial({ color: 0x94eaff, transparent: true,
      depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    this.glow = new T.Mesh(plane, energyGlow()); this.root.add(this.debris, this.particles, this.streaks, this.ring, this.glow);
    this.root.visible = false;
  }
}

/** Three fixed burst slots; geometry/materials/attributes allocated at initialization.
 * Cosmetic directions use their own keyed Random, never the field's RNG. */
export class CollisionVFX {
  readonly root = new T.Group();
  readonly resources = new ResourceOwner();
  private readonly rock = new T.IcosahedronGeometry(1, 0);
  private readonly panel = new T.BoxGeometry(1, 1, 1);
  private readonly bursts: Burst[];
  private readonly scratch = new T.Object3D();
  private readonly color = new T.Color();
  private disposed = false;
  readonly stats = { triggered: 0, skipped: 0, peak: 0 };
  get activeCount(): number { return this.bursts.filter(b => b.age < b.duration).length; }
  get activeIdentities(): (string | undefined)[] { return this.bursts.filter(b => b.age < b.duration).map(b => b.identity); }
  warmPanels(enabled: boolean): void { for (const b of this.bursts) b.debris.geometry = enabled ? this.panel : this.rock; }
  constructor(scene: T.Scene) {
    this.root.name = 'collision-family-vfx';
    const ring = new T.RingGeometry(.94, 1, 40), plane = new T.PlaneGeometry(1, 1);
    this.bursts = Array.from({ length: F.bursts }, () => new Burst(this.rock, ring, plane));
    this.root.add(...this.bursts.map(b => b.root)); scene.add(this.root); this.resources.track(this.root);
    this.resources.geometries.add(this.panel);
  }
  trigger(event: GameEventMap['obstacle.collision'], quality: VisualQuality, major = false): boolean {
    if (this.disposed) return false;
    const burst = this.bursts.find(b => b.age >= b.duration) ?? this.bursts.find(b => !b.major && major);
    if (!burst) { this.stats.skipped++; return false; }
    const contact = presentationContact(event), family = contact.family, settings = F[family];
    burst.age = 0; burst.duration = settings.seconds; burst.family = family; burst.identity = event.obstacleId;
    burst.major = major; burst.startDistance = event.obstaclePose?.distance ?? 0;
    burst.radius = Math.min(1.5, event.obstaclePose?.radius ?? 1);
    burst.origin.copy(family === 'mine' || family === 'rock' ? event.obstaclePosition : contact.point);
    burst.root.position.copy(burst.origin); burst.root.visible = true;
    burst.debris.geometry = family === 'rock' ? this.rock : this.panel;
    burst.debris.count = quality.mobile || quality.reducedMotion ? F.mobileFragments : F.fragments;
    const count = quality.reducedMotion ? F.reducedParticles : quality.mobile ? F.mobileParticles : F.particles;
    burst.particles.geometry.setDrawRange(0, count); burst.streaks.geometry.setDrawRange(0, count * 2);
    const material = burst.debris.material as T.MeshStandardMaterial;
    material.emissive.setHex(family === 'mine' ? settings.light : 0); material.emissiveIntensity = family === 'mine' ? .9 : 0;
    (burst.particles.material as T.PointsMaterial).color.setHex(family === 'rock' ? settings.color : settings.light);
    (burst.particles.material as T.PointsMaterial).blending = family === 'rock' ? T.NormalBlending : T.AdditiveBlending;
    (burst.streaks.material as T.LineBasicMaterial).color.setHex(settings.light);
    (burst.ring.material as T.MeshBasicMaterial).color.setHex(settings.light);
    burst.glow.material.uniforms.tint!.value.setHex(settings.light);
    let seed = 2166136261; for (const c of `${event.runId}/${event.elapsed}/${event.obstacleId ?? event.obstacleKind}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    const random = new Random(seed >>> 0), direction = new T.Vector3();
    for (let i = 0; i < F.particles; i++) {
      direction.set(random.between(-1, 1), random.between(-1, 1), random.between(-.5, 1)).normalize();
      if (family === 'station' || family === 'metal') direction.addScaledVector(contact.normal, .8).normalize();
      direction.multiplyScalar(settings.speed * random.between(.5, 2)); direction.toArray(burst.velocities, i * 3);
    }
    for (let i = 0; i < F.fragments; i++) {
      const offset = i * 9;
      direction.fromArray(burst.velocities, i * 3).multiplyScalar(quality.reducedMotion ? .22 : 1);
      direction.toArray(burst.pieces, offset);
      burst.pieces[offset + 3] = random.between(-2, 2); burst.pieces[offset + 4] = random.between(-2, 2);
      burst.pieces[offset + 5] = random.between(-2, 2);
      burst.pieces[offset + 6] = settings.size * random.between(.5, 1.35) * (family === 'rock' ? burst.radius : 1);
      burst.pieces[offset + 7] = random.between(.6, 1.3); burst.pieces[offset + 8] = random.between(.4, 1.1);
      this.color.setHex(settings.color).multiplyScalar(random.between(.7, 1.35)); burst.debris.setColorAt(i, this.color);
    }
    burst.debris.instanceColor!.needsUpdate = true; this.updateBurst(burst, quality, 0);
    this.stats.triggered++; this.stats.peak = Math.max(this.stats.peak, this.activeCount); return true;
  }
  private updateBurst(b: Burst, quality: VisualQuality, distance: number): void {
    const age = b.age, t = Math.min(1, age / b.duration), travel = -Math.expm1(-F.drag * age) / F.drag;
    b.root.position.copy(b.origin); if (b.family === 'station' && b.startDistance) b.root.position.z += Math.max(0, distance - b.startDistance);
    const fade = (1 - t) ** 2;
    (b.debris.material as T.MeshStandardMaterial).opacity = Math.min(1, (1 - t) * 2);
    b.debris.visible = age < b.duration;
    for (let i = 0; i < b.debris.count; i++) {
      const k = i * 9, size = b.pieces[k + 6]!;
      this.scratch.position.set(b.pieces[k]! * travel, b.pieces[k + 1]! * travel, b.pieces[k + 2]! * travel);
      this.scratch.rotation.set(b.pieces[k + 3]! * age, b.pieces[k + 4]! * age, b.pieces[k + 5]! * age);
      this.scratch.scale.set(size, size * b.pieces[k + 7]!, size * (b.family === 'rock' ? b.pieces[k + 8]! : .12));
      this.scratch.updateMatrix(); b.debris.setMatrixAt(i, this.scratch.matrix);
    }
    b.debris.instanceMatrix.needsUpdate = true;
    const points = b.particles.geometry.getAttribute('position') as T.BufferAttribute;
    const lines = b.streaks.geometry.getAttribute('position') as T.BufferAttribute;
    const particleTravel = -Math.expm1(-F.particleDrag * age) / F.particleDrag * (quality.reducedMotion ? .3 : 1);
    for (let i = 0; i < F.particles; i++) {
      const k = i * 3, x = b.velocities[k]!, y = b.velocities[k + 1]!, z = b.velocities[k + 2]!;
      points.setXYZ(i, x * particleTravel, y * particleTravel, z * particleTravel);
      lines.setXYZ(i * 2, x * particleTravel, y * particleTravel, z * particleTravel);
      const tail = Math.max(0, particleTravel - .035); lines.setXYZ(i * 2 + 1, x * tail, y * tail, z * tail);
    }
    points.needsUpdate = lines.needsUpdate = true;
    b.particles.visible = age < b.duration; (b.particles.material as T.PointsMaterial).opacity = fade * .65;
    b.streaks.visible = b.family !== 'rock' && !quality.reducedMotion && age < F.sparkSeconds;
    (b.streaks.material as T.LineBasicMaterial).opacity = Math.max(0, 1 - age / F.sparkSeconds);
    b.ring.visible = b.family === 'mine' || age < F.flashSeconds;
    b.ring.scale.setScalar(b.family === 'mine' ? .2 + F.shockwaveRadius * (1 - Math.exp(-age * 5)) : .12 + age * 2.8);
    (b.ring.material as T.MeshBasicMaterial).opacity = b.family === 'mine' ? fade * .85 : Math.max(0, 1 - age / F.flashSeconds) * .75;
    b.glow.scale.setScalar(b.family === 'mine' ? 1.3 + age * 2.2 : .7 + age * .8);
    b.glow.material.uniforms.alpha!.value = (b.family === 'mine' ? fade * .45 : Math.max(0, 1 - age / F.flashSeconds) * .75) * (quality.reducedMotion ? .45 : 1);
  }
  update(dt: number, quality: VisualQuality, distance: number): void {
    if (this.disposed) return;
    for (const b of this.bursts) {
      if (b.age >= b.duration) { b.root.visible = false; continue; }
      b.age += dt; b.root.visible = b.age < b.duration;
      if (b.root.visible) this.updateBurst(b, quality, distance);
    }
  }
  cancel(): void { for (const b of this.bursts) { b.age = Infinity; b.root.visible = false; } }
  reset(): void { this.cancel(); this.stats.triggered = this.stats.skipped = this.stats.peak = 0; }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.cancel(); this.root.removeFromParent();
    for (const burst of this.bursts) burst.debris.dispose();
    this.resources.dispose();
  }
}
