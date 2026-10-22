import * as THREE from 'three';
import { ResourceOwner } from '../assets/resources.ts';
import { VISUALS } from './settings.ts';
import type { VisualQuality } from './settings.ts';

export class EngineVFX {
  readonly root = new THREE.Group();
  readonly trails: THREE.Mesh;
  private readonly resources = new ResourceOwner();
  private readonly glow: THREE.ShaderMaterial;
  private readonly flames: THREE.Mesh[] = [];
  private readonly history = new Float32Array(2 * VISUALS.trailSamples * 3);
  private readonly previous = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly anchors = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly width = new THREE.Vector3();
  private accumulator = 0;
  private initialized = false;
  private time = 0;
  private power = 0;
  private readonly ship: THREE.Group;

  constructor(scene: THREE.Scene, ship: THREE.Group) {
    this.ship = ship;
    this.root.name = 'engine-vfx';
    this.glow = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { power: { value: 0.25 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `varying vec2 vUv; uniform float power; void main(){
        float r=length(vUv-0.5)*2.0;
        float halo=pow(max(0.0,1.0-r),2.5);
        float core=1.0-smoothstep(0.12,0.36,r);
        gl_FragColor=vec4(mix(vec3(0.04,0.65,1.0),vec3(0.72,1.0,1.0),core), (halo*0.5+core*0.7)*power);
        #include <colorspace_fragment>
      }`,
    });
    const glowGeometry = new THREE.PlaneGeometry(0.78, 0.78);
    const flameGeometry = new THREE.ConeGeometry(0.13, 1.05, 8);
    const flameMaterial = new THREE.MeshBasicMaterial({ color: 0x64e9ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const x of [-0.56, 0.56]) {
      const core = new THREE.Mesh(glowGeometry, this.glow);
      core.position.set(x, -0.21, 1.49);
      this.root.add(core);
      const flame = new THREE.Mesh(flameGeometry, flameMaterial);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, -0.21, 1.9);
      this.flames.push(flame);
      this.root.add(flame);
    }
    this.ship.add(this.root);
    const geometry = new THREE.BufferGeometry();
    const count = 2 * VISUALS.trailSamples * 2;
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const colors = new Float32Array(count * 3);
    const indices: number[] = [];
    for (let engine = 0; engine < 2; engine++) for (let i = 0; i < VISUALS.trailSamples; i++) {
      const vertex = (engine * VISUALS.trailSamples + i) * 2;
      const fade = Math.pow(1 - i / (VISUALS.trailSamples - 1), 1.6);
      for (let side = 0; side < 2; side++) {
        colors[(vertex + side) * 3] = 0.10 * fade;
        colors[(vertex + side) * 3 + 1] = 0.68 * fade;
        colors[(vertex + side) * 3 + 2] = fade;
      }
      if (i < VISUALS.trailSamples - 1) indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
    }
    geometry.setIndex(indices);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.trails = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.48, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.trails.name = 'engine-trails';
    this.trails.frustumCulled = false;
    scene.add(this.trails);
    this.resources.track(this.root);
    this.resources.track(this.trails);
  }

  reset(): void {
    this.initialized = false;
    this.history.fill(0);
    this.accumulator = this.time = this.power = 0;
    this.trails.visible = false;
  }

  update(dt: number, state: string, speed: number, quality: VisualQuality): void {
    this.ship.updateMatrixWorld(true);
    for (let engine = 0; engine < 2; engine++) this.anchors[engine]!.set(engine === 0 ? -0.56 : 0.56, -0.21, 1.49).applyMatrix4(this.ship.matrixWorld);
    if (!this.initialized) {
      for (let engine = 0; engine < 2; engine++) {
        const anchor = this.anchors[engine]!;
        this.previous[engine]!.copy(anchor);
        for (let i = 0; i < VISUALS.trailSamples; i++) anchor.toArray(this.history, (engine * VISUALS.trailSamples + i) * 3);
      }
      this.initialized = true;
    }
    if (dt > 0) {
      this.time += dt;
      this.power += ((state === 'PLAYING' ? 1 : 0) - this.power) * (1 - Math.exp(-dt * 10));
      const prior = this.accumulator;
      this.accumulator += dt;
      let sampleTime = VISUALS.trailStep - prior;
      while (this.accumulator >= VISUALS.trailStep) {
        for (let engine = 0; engine < 2; engine++) {
          const offset = engine * VISUALS.trailSamples * 3;
          this.history.copyWithin(offset + 3, offset, offset + (VISUALS.trailSamples - 1) * 3);
          for (let i = 1; i < VISUALS.trailSamples; i++) this.history[offset + i * 3 + 2]! += speed * VISUALS.trailStep * 0.65;
          const a = this.previous[engine]!, b = this.anchors[engine]!;
          const fraction = Math.min(1, sampleTime / dt);
          this.history[offset] = a.x + (b.x - a.x) * fraction;
          this.history[offset + 1] = a.y + (b.y - a.y) * fraction;
          this.history[offset + 2] = a.z + (b.z - a.z) * fraction;
        }
        this.accumulator -= VISUALS.trailStep;
        sampleTime += VISUALS.trailStep;
      }
      for (let engine = 0; engine < 2; engine++) this.previous[engine]!.copy(this.anchors[engine]!);
      this.width.set(1, 0, 0).transformDirection(this.ship.matrixWorld);
      const attribute = this.trails.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let engine = 0; engine < 2; engine++) for (let i = 0; i < VISUALS.trailSamples; i++) {
        const source = (engine * VISUALS.trailSamples + i) * 3;
        const width = 0.09 * (1 - i / VISUALS.trailSamples) * (quality.reducedMotion ? 0.7 : 1);
        for (let side = 0; side < 2; side++) {
          const target = (engine * VISUALS.trailSamples * 2 + i * 2 + side) * 3;
          const sign = side === 0 ? -1 : 1;
          const anchor = this.anchors[engine]!;
          attribute.array[target] = (i === 0 ? anchor.x : this.history[source]!) + this.width.x * width * sign;
          attribute.array[target + 1] = (i === 0 ? anchor.y : this.history[source + 1]!) + this.width.y * width * sign;
          attribute.array[target + 2] = (i === 0 ? anchor.z : this.history[source + 2]!) + this.width.z * width * sign;
        }
      }
      attribute.needsUpdate = true;
    }
    const active = state === 'PLAYING' || state === 'PAUSED';
    const pulse = quality.reducedMotion ? 1 : 0.96 + Math.sin(this.time * 18) * 0.04;
    this.glow.uniforms.power!.value = active ? (0.55 + this.power * 0.4) * pulse : state === 'MENU' ? 0.32 : 0;
    this.flames.forEach(flame => { flame.visible = active; flame.scale.y = (0.7 + speed / 70) * pulse; });
    this.trails.visible = active && this.time > 0;
    (this.trails.material as THREE.MeshBasicMaterial).opacity = this.power * (quality.reducedMotion ? 0.20 : 0.48);
  }

  dispose(): void { this.root.removeFromParent(); this.trails.removeFromParent(); this.resources.dispose(); }
}
