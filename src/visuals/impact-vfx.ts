import * as THREE from 'three';
import { Random } from '../core/random.ts';
import { ResourceOwner } from '../assets/resources.ts';
import { VISUALS } from './settings.ts';
import type { VisualQuality } from './settings.ts';
import { FEEDBACK } from '../feedback/settings.ts';
import type { FeedbackPreset } from '../feedback/settings.ts';
import { protectionMaterial } from './energy-materials.ts';
import { POLISH as P } from '../feedback/polish-settings.ts';
import type { EventPosition } from '../events/game-events.ts';

/** One reusable burst, explicitly triggered by the feedback coordinator. */
export class ImpactVFX {
  readonly root = new THREE.Group();
  private readonly resources = new ResourceOwner();
  private readonly particles: THREE.Points;
  private readonly shield: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly flash: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private age = 10;
  private readonly inverse = new THREE.Quaternion();
  private readonly incoming = new THREE.Vector3(0, 0, 1);
  private readonly directions = new Float32Array(VISUALS.impactParticles * 3);
  private life = 0;
  private emissions = 0;
  private preset: FeedbackPreset = FEEDBACK.damage;
  private surfaceOnly = false;

  constructor(scene: THREE.Scene) {
    this.root.name = 'impact-vfx';
    const random = new Random(VISUALS.seed + 1);
    const colors = new Float32Array(VISUALS.impactParticles * 3);
    for (let i = 0; i < VISUALS.impactParticles; i++) {
      const angle = random.between(0, Math.PI * 2), radial = random.between(3, 9);
      this.directions[i * 3] = Math.cos(angle) * radial;
      this.directions[i * 3 + 1] = Math.sin(angle) * radial;
      this.directions[i * 3 + 2] = random.between(1, 7);
      colors.set([1, random.between(0.35, 0.7), 0.12], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.directions.length), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.particles.name = 'impact-particles';
    this.particles.frustumCulled = false;
    const field = new THREE.SphereGeometry(1, 32, 20);
    this.flash = new THREE.Mesh(field, protectionMaterial());
    this.flash.name = 'impact-ring';
    this.shield = new THREE.Mesh(field, protectionMaterial());
    this.shield.name = 'invulnerability-shimmer';
    this.shield.scale.set(...P.field.scale); this.flash.scale.copy(this.shield.scale);
    this.root.add(this.particles, this.flash, this.shield);
    this.resources.track(this.root);
    scene.add(this.root);
    this.reset();
  }

  get remaining(): number { return this.life; }

  reset(): void {
    this.emissions = this.life = 0; this.age = 10;
    this.particles.visible = this.flash.visible = this.shield.visible = false;
    (this.particles.geometry.getAttribute('position').array as Float32Array).fill(0);
    this.particles.geometry.getAttribute('position').needsUpdate = true;
  }

  trigger(position: EventPosition, velocityX: number, velocityY: number, preset: FeedbackPreset, surfaceOnly = false, incoming?: EventPosition): void {
    this.preset = preset; this.age = 0;
    this.incoming.set(incoming?.x ?? 0, incoming?.y ?? 0, incoming?.z ?? 1).normalize();
    this.surfaceOnly = surfaceOnly;
    this.life = preset.duration;
    this.emissions++;
    this.particles.position.set(position.x, position.y, position.z);
    this.flash.position.copy(this.particles.position);
    (this.particles.geometry.getAttribute('position').array as Float32Array).fill(0);
    this.particles.geometry.getAttribute('position').needsUpdate = true;
    this.particles.rotation.set(velocityY * FEEDBACK.impact.velocityBias, -velocityX * FEEDBACK.impact.velocityBias, 0);
  }

  cancel(): void { this.life = 0; this.particles.visible = this.flash.visible = false; }

  update(ship: THREE.Vector3, invulnerability: number, elapsed: number, dt: number, quality: VisualQuality, orientation?: THREE.Quaternion): void {
    this.age += dt;
    this.life = Math.max(0, this.life - dt);
    const age = this.preset.duration - this.life;
    const fade = this.life / this.preset.duration;
    this.particles.visible = this.life > 0 && !this.surfaceOnly;
    this.particles.geometry.setDrawRange(0, quality.impactParticles);
    (this.particles.material as THREE.PointsMaterial).opacity = Math.min(1, fade * fade * this.preset.intensity);
    if (this.life > 0 && dt > 0 && !this.surfaceOnly) {
      const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const travel = age * (1 - age * 0.5);
      for (let i = 0; i < this.directions.length; i++) positions.array[i] = this.directions[i]! * travel;
      positions.needsUpdate = true;
    }
    const direction = this.shield.material.uniforms.direction!.value as THREE.Vector3;
    direction.copy(this.incoming);
    if (orientation) { this.shield.quaternion.copy(orientation); direction.applyQuaternion(this.inverse.copy(orientation).invert()); }
    // Project the reference incoming direction onto the visible rear hemisphere;
    // the event is not a precise swept contact normal.
    direction.z = Math.abs(direction.z) * .3 + .5; direction.normalize();
    this.shield.position.copy(ship);
    const reduced = quality.reducedMotion ? 1 : 0;
    this.shield.visible = invulnerability > 0;
    const uniforms = this.shield.material.uniforms;
    uniforms.age!.value = this.age; uniforms.time!.value = elapsed; uniforms.reduced!.value = reduced;
    uniforms.alpha!.value = Math.min(1, this.age / P.field.attack) * Math.min(1, invulnerability / P.field.release)
      * (P.field.sustain + (P.field.burst - P.field.sustain) * Math.exp(-this.age * 8)) * (reduced ? .6 : 1);
    // Nonfatal impact is localized in the field itself; fatal contact has a short
    // partial energy response without implying invulnerability after GAME_OVER.
    this.flash.visible = this.life > 0 && this.age < P.field.impact && (this.preset.priority === 3 || !this.surfaceOnly);
    this.flash.position.copy(ship); this.flash.quaternion.copy(this.shield.quaternion);
    this.flash.material.uniforms.age!.value = this.age;
    this.flash.material.uniforms.direction!.value.copy(direction);
    this.flash.material.uniforms.time!.value = elapsed;
    this.flash.material.uniforms.reduced!.value = reduced;
    this.flash.material.uniforms.alpha!.value = Math.max(0, 1 - this.age / P.field.impact) * (reduced ? .5 : 1.6);

  }

  dispose(): void { this.root.removeFromParent(); this.resources.dispose(); }
}
