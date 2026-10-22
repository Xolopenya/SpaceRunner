import * as THREE from 'three';
import { Random } from '../core/random.ts';
import { ResourceOwner } from '../assets/resources.ts';
import { VISUALS } from './settings.ts';
import type { VisualQuality } from './settings.ts';

/** Single bounded burst; hitSerial is the only emission signal. */
export class ImpactVFX {
  readonly root = new THREE.Group();
  private readonly resources = new ResourceOwner();
  private readonly particles: THREE.Points;
  private readonly shield: THREE.Mesh;
  private readonly flash: THREE.Mesh;
  private readonly directions = new Float32Array(VISUALS.impactParticles * 3);
  private serial = 0;
  private life = 0;
  private emissions = 0;

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
    this.flash = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.61, 24), new THREE.MeshBasicMaterial({ color: 0xffba72, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.flash.name = 'impact-ring';
    this.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x6eddf1, wireframe: true, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shield.name = 'invulnerability-shimmer';
    this.shield.scale.set(1.6, 0.72, 1.5);
    this.root.add(this.particles, this.flash, this.shield);
    this.resources.track(this.root);
    scene.add(this.root);
    this.reset();
  }

  get remaining(): number { return this.life; }

  reset(): void {
    this.serial = this.emissions = this.life = 0;
    this.particles.visible = this.flash.visible = this.shield.visible = false;
    (this.particles.geometry.getAttribute('position').array as Float32Array).fill(0);
    this.particles.geometry.getAttribute('position').needsUpdate = true;
  }

  update(serial: number, ship: THREE.Vector3, velocityX: number, velocityY: number, invulnerability: number, elapsed: number, dt: number, quality: VisualQuality): void {
    if (serial !== this.serial) {
      if (serial > this.serial) {
        this.life = VISUALS.impactSeconds;
        this.emissions++;
        this.particles.position.copy(ship);
        this.flash.position.copy(ship);
        // Bias the burst against the steering direction without gameplay input.
        this.particles.rotation.set(velocityY * 0.025, -velocityX * 0.025, 0);
      }
      this.serial = serial;
    }
    this.life = Math.max(0, this.life - dt);
    const age = VISUALS.impactSeconds - this.life;
    const fade = this.life / VISUALS.impactSeconds;
    this.particles.visible = this.life > 0;
    this.particles.geometry.setDrawRange(0, quality.impactParticles);
    (this.particles.material as THREE.PointsMaterial).opacity = fade * fade;
    if (this.life > 0 && dt > 0) {
      const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const travel = age * (1 - age * 0.5);
      for (let i = 0; i < this.directions.length; i++) positions.array[i] = this.directions[i]! * travel;
      positions.needsUpdate = true;
    }
    this.flash.visible = age < 0.25 && this.life > 0;
    this.flash.scale.setScalar(1 + age * 6);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 0.25) * 0.45;
    this.shield.visible = invulnerability > 0;
    this.shield.position.copy(ship);
    (this.shield.material as THREE.MeshBasicMaterial).opacity = Math.min(1, invulnerability / 0.2) * (quality.reducedMotion ? 0.10 : 0.11 + Math.sin(elapsed * 7) * 0.025);
  }

  dispose(): void { this.root.removeFromParent(); this.resources.dispose(); }
}
