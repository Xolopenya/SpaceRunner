import * as THREE from 'three';
import { Random } from '../core/random.ts';
import { ResourceOwner } from '../assets/resources.ts';
import { VISUALS } from './settings.ts';
import type { VisualQuality } from './settings.ts';

/** Stable, separately seeded scenery; all buffers exist for the World lifetime. */
export class SpaceBackground {
  readonly root = new THREE.Group();
  private readonly resources = new ResourceOwner();
  private readonly layers: THREE.Points[] = [];
  private readonly originals: Float32Array[] = [];
  private readonly streaks: THREE.LineSegments;
  private readonly streakOriginals = new Float32Array(VISUALS.streaks * 3);
  private readonly nebula: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.root.name = 'space-background';
    const random = new Random(VISUALS.seed);
    for (let layer = 0; layer < VISUALS.stars.length; layer++) {
      const source = new Float32Array(VISUALS.stars[layer]! * 3);
      for (let i = 0; i < source.length; i += 3) {
        const edge = layer === 2;
        source[i] = edge ? (random.next() < 0.5 ? -1 : 1) * random.between(10, 44) : random.between(-110, 110);
        source[i + 1] = random.between(-65, 65);
        source[i + 2] = random.between(-200, 60);
      }
      this.originals.push(source);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(source.slice(), 3).setUsage(THREE.DynamicDrawUsage));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: [0x7890bc, 0xb4d1ef, 0xa4d9ee][layer], size: [0.14, 0.16, 0.10][layer], transparent: true, opacity: [0.55, 0.78, 0.38][layer], depthWrite: false, fog: false }));
      points.name = `star-layer-${layer}`;
      points.frustumCulled = false;
      this.layers.push(points);
      this.root.add(points);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VISUALS.streaks * 6), 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < this.streakOriginals.length; i += 3) {
      this.streakOriginals[i] = (random.next() < 0.5 ? -1 : 1) * random.between(11, 24);
      this.streakOriginals[i + 1] = random.between(-15, 15);
      this.streakOriginals[i + 2] = random.between(-100, 60);
    }
    this.streaks = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x75a9d5, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.streaks.name = 'edge-speed-streaks';
    this.streaks.frustumCulled = false;
    this.root.add(this.streaks);

    // One low-frequency, opaque sky shader; no downloaded textures or postprocess.
    this.nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { aspect: { value: 1 }, strength: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy, 0.9999, 1.0);}',
      fragmentShader: `varying vec2 vUv; uniform float aspect; uniform float strength;
        void main(){
          vec2 p=(vUv-0.5)*vec2(min(aspect,2.0),1.0);
          float cloud=exp(-dot((p-vec2(-0.44,0.17))*vec2(1.8,3.3),(p-vec2(-0.44,0.17))*vec2(1.8,3.3)));
          float veil=exp(-dot((p-vec2(0.46,0.29))*vec2(2.4,4.0),(p-vec2(0.46,0.29))*vec2(2.4,4.0)));
          float wisps=0.78+0.22*sin(p.x*12.0+p.y*8.0+sin(p.y*14.0));
          vec3 color=vec3(0.008,0.016,0.038)+strength*(vec3(0.038,0.026,0.093)*cloud*wisps+vec3(0.012,0.047,0.075)*veil);
          gl_FragColor=vec4(color,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.nebula.name = 'procedural-nebula';
    this.nebula.frustumCulled = false;
    this.nebula.renderOrder = -100;
    this.root.add(this.nebula);

    const planet = new THREE.Mesh(new THREE.SphereGeometry(17, 28, 20), new THREE.MeshStandardMaterial({ color: 0x344063, roughness: 1 }));
    planet.name = 'distant-planet';
    planet.position.set(42, 23, -132);
    const ring = new THREE.Mesh(new THREE.RingGeometry(21, 23, 80), new THREE.MeshBasicMaterial({ color: 0x8491bd, side: THREE.DoubleSide, transparent: true, opacity: 0.24, depthWrite: false }));
    ring.rotation.set(1.05, 0.25, -0.35);
    planet.add(ring);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(17.35, 28, 20), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
      fragmentShader: `varying vec3 n; varying vec3 v;
        void main(){
          float rim=pow(1.0-max(0.0,dot(normalize(n),normalize(v))),3.0);
          gl_FragColor=vec4(0.22,0.39,0.72,rim*0.28);
          #include <colorspace_fragment>
        }`,
    }));
    planet.add(atmosphere);
    this.root.add(planet);
    this.resources.track(this.root);
    scene.add(this.root);
  }

  setQuality(quality: VisualQuality, aspect: number): void {
    this.layers.forEach((points, index) => points.geometry.setDrawRange(0, quality.stars[index]!));
    this.streaks.geometry.setDrawRange(0, quality.streaks * 2);
    this.streaks.visible = quality.streaks > 0;
    const material = this.nebula.material as THREE.ShaderMaterial;
    material.uniforms.aspect!.value = aspect;
    material.uniforms.strength!.value = quality.mobile ? 0.8 : 1;
  }

  update(distance: number, speed: number, quality: VisualQuality): void {
    for (let layer = 0; layer < this.layers.length; layer++) {
      const attribute = this.layers[layer]!.geometry.getAttribute('position') as THREE.BufferAttribute;
      const source = this.originals[layer]!;
      // Wrap planes are beyond the camera/fog; x/y patterns never get rerolled.
      const motion = VISUALS.starMotion[layer]! * (quality.reducedMotion && layer > 0 ? 0.35 : 1);
      for (let i = 2; i < quality.stars[layer]! * 3; i += 3) attribute.array[i] = ((source[i]! + distance * motion + 200) % 260) - 200;
      attribute.needsUpdate = true;
    }
    const positions = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const intensity = Math.min(1, Math.max(0, (speed - 16) / 18));
    for (let i = 0; i < quality.streaks; i++) {
      const source = i * 3, target = i * 6;
      const z = ((this.streakOriginals[source + 2]! + distance * 1.3 + 100) % 160) - 100;
      positions.array[target] = positions.array[target + 3] = this.streakOriginals[source]!;
      positions.array[target + 1] = positions.array[target + 4] = this.streakOriginals[source + 1]!;
      positions.array[target + 2] = z;
      positions.array[target + 5] = z + 0.8 + intensity * 2.4;
    }
    (this.streaks.material as THREE.LineBasicMaterial).opacity = 0.07 + intensity * 0.13;
    positions.needsUpdate = true;
  }

  dispose(): void { this.root.removeFromParent(); this.resources.dispose(); }
}
