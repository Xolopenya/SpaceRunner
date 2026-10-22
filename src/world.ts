import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { GameModel } from './core/game-model.ts';
import { Random } from './core/random.ts';
import { AssetManager } from './assets/asset-manager.ts';
import { HAZARD_MODELS, hazardVariant } from './assets/catalog.ts';
import { ResourceOwner } from './assets/resources.ts';
import { hazardOrientation } from './core/hazard-profile.ts';
import type { ColliderDebugFactory, ColliderDebugView } from './debug/types.ts';

function cornerGuide(): THREE.LineSegments {
  const points: THREE.Vector3[] = [];
  for (const x of [-7.1, 7.1]) for (const y of [-4.6, 4.6]) {
    points.push(new THREE.Vector3(x, y, 0), new THREE.Vector3(x - Math.sign(x) * 1.2, y, 0));
    points.push(new THREE.Vector3(x, y, 0), new THREE.Vector3(x, y - Math.sign(y) * 1.2, 0));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x376583, transparent: true, opacity: 0.11 }));
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
  private readonly ship = new THREE.Group();
  private readonly flames: THREE.Mesh[] = [];
  private readonly hazards: THREE.Group[] = [];
  private readonly frames: THREE.LineSegments[] = [];
  private readonly angles = { x: 0, y: 0, z: 0 };
  private readonly collisionDebug?: ColliderDebugView;
  private readonly stars: THREE.Points;
  private readonly originalStars: Float32Array;
  private readonly burst: THREE.Points;
  private readonly burstDirections: Float32Array;
  private hitSerial = 0;
  private burstLife = 0;
  private cameraZ = 14;
  private disposed = false;
  private readonly resources = new ResourceOwner();

  constructor(canvas: HTMLCanvasElement, assets: AssetManager, debugFactory?: ColliderDebugFactory) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(CONFIG.render.background);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.Fog(CONFIG.render.background, 70, 190);
    this.scene.add(new THREE.HemisphereLight(0xadcfff, 0x333354, 2.6));
    const key = new THREE.DirectionalLight(0xffdfbf, 3.2);
    key.position.set(-12, 18, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5ae2ff, 2);
    rim.position.set(10, -4, -8);
    this.scene.add(rim);

    this.createShip(assets);
    this.scene.add(this.ship);

    // Every slot borrows five rigid model clones; no loading/allocation on spawn.
    for (let i = 0; i < CONFIG.hazards.capacity; i++) {
      const group = new THREE.Group();
      for (const id of HAZARD_MODELS) group.add(assets.clone(id));
      group.visible = false;
      this.hazards.push(group);
      this.scene.add(group);
    }
    for (let i = 0; i < 9; i++) {
      const frame = cornerGuide();
      frame.name = `environment-corner-guide-${i}`;
      this.frames.push(frame);
      this.scene.add(frame);
    }

    const random = new Random(23987);
    this.originalStars = new Float32Array(1100 * 3);
    for (let i = 0; i < this.originalStars.length; i += 3) {
      this.originalStars[i] = random.between(-95, 95);
      this.originalStars[i + 1] = random.between(-65, 65);
      this.originalStars[i + 2] = random.between(-190, 12);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(this.originalStars.slice(), 3));
    this.stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xb8cee8, size: 0.12, transparent: true, opacity: 0.8, sizeAttenuation: true }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    const planet = new THREE.Mesh(new THREE.SphereGeometry(17, 28, 20), new THREE.MeshStandardMaterial({ color: 0x233251, roughness: 1 }));
    planet.position.set(37, 19, -132);
    const ring = new THREE.Mesh(new THREE.RingGeometry(21, 21.5, 80), new THREE.MeshBasicMaterial({ color: 0x627b99, side: THREE.DoubleSide, transparent: true, opacity: 0.34 }));
    ring.rotation.set(0.8, 0.25, -0.35);
    planet.add(ring);
    this.scene.add(planet);

    this.burstDirections = new Float32Array(36 * 3);
    for (let i = 0; i < this.burstDirections.length; i++) this.burstDirections[i] = random.between(-1, 1) * 8;
    const burstGeometry = new THREE.BufferGeometry();
    burstGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.burstDirections.length), 3));
    this.burst = new THREE.Points(burstGeometry, new THREE.PointsMaterial({ color: 0xffae74, size: 0.12, transparent: true, opacity: 0, depthWrite: false }));
    this.burst.frustumCulled = false;
    this.scene.add(this.burst);
    this.resources.track(this.scene, assets.resources);
    this.collisionDebug = debugFactory?.(this.scene);
  }

  private createShip(assets: AssetManager): void {
    this.ship.add(assets.clone('ship'));
    const mint = new THREE.MeshBasicMaterial({ color: 0x70ffe0 });
    for (const x of [-0.56, 0.56]) {
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), mint);
      glow.position.set(x, -0.21, 1.48);
      this.ship.add(glow);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 8), new THREE.MeshBasicMaterial({ color: 0x57e8ef, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, -0.21, 1.95);
      this.flames.push(flame);
      this.ship.add(flame);
    }
  }

  resize(width: number, height: number): void {
    const cap = width < 700 ? CONFIG.render.mobilePixelRatio : CONFIG.render.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.cameraZ = Math.max(13, 7 / Math.tan(THREE.MathUtils.degToRad(29)) / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.hitSerial = 0;
    this.burstLife = 0;
    this.ship.rotation.set(0, 0, 0);
    this.camera.position.set(0, 2.4, this.cameraZ);
  }

  render(model: GameModel, dt: number): void {
    if (this.disposed) return;
    const blend = 1 - Math.exp(-dt * 8);
    this.ship.position.set(model.ship.x, model.ship.y, 0);
    this.ship.rotation.z = THREE.MathUtils.lerp(this.ship.rotation.z, -model.ship.vx * 0.045, blend);
    this.ship.rotation.x = THREE.MathUtils.lerp(this.ship.rotation.x, model.ship.vy * 0.025, blend);
    this.ship.visible = model.invulnerability <= 0 || Math.floor(model.elapsed * 12) % 2 === 0;
    for (const flame of this.flames) flame.scale.y = 0.85 + Math.sin(model.elapsed * 30) * 0.15;

    for (let i = 0; i < model.field.hazards.length; i++) {
      const hazard = model.field.hazards[i]!;
      const group = this.hazards[i]!;
      group.visible = hazard.active;
      if (!hazard.active) continue;
      group.position.set(hazard.x, hazard.y, hazard.z);
      group.scale.setScalar(hazard.radius);
      hazardOrientation(hazard, model.elapsed, this.angles);
      group.rotation.set(this.angles.x, this.angles.y, this.angles.z);
      const variant = hazardVariant(hazard.kind, hazard.phase);
      for (let j = 0; j < group.children.length; j++) group.children[j]!.visible = j === variant;
    }
    for (let i = 0; i < this.frames.length; i++) this.frames[i]!.position.z = -i * 18 + model.distance % 18 - 5;
    const positions = this.stars.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 2; i < this.originalStars.length; i += 3) {
      positions.array[i] = ((this.originalStars[i]! + model.distance * 0.65 + 190) % 202) - 190;
    }
    positions.needsUpdate = true;

    if (model.hitSerial !== this.hitSerial) {
      this.hitSerial = model.hitSerial;
      this.burstLife = 0.55;
      this.burst.position.copy(this.ship.position);
    }
    if (model.state === 'PLAYING' || model.state === 'GAME_OVER') this.burstLife = Math.max(0, this.burstLife - dt);
    const burstMaterial = this.burst.material as THREE.PointsMaterial;
    burstMaterial.opacity = this.burstLife / 0.55;
    this.burst.visible = this.burstLife > 0;
    if (this.burst.visible) {
      const particles = this.burst.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.burstDirections.length; i++) particles.array[i] = this.burstDirections[i]! * (0.55 - this.burstLife);
      particles.needsUpdate = true;
    }
    const shake = model.state === 'PLAYING' ? this.burstLife * 0.08 : 0;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, model.ship.x * 0.12, blend) + Math.sin(model.elapsed * 80) * shake;
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 2.4 + model.ship.y * 0.12, blend);
    this.camera.position.z = this.cameraZ;
    this.camera.lookAt(0, 0, -28);
    this.collisionDebug?.update(model);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.collisionDebug?.dispose();
    this.resources.dispose();
    this.renderer.dispose();
  }
}
