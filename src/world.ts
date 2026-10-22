import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { GameModel } from './core/game-model.ts';
import { AssetManager } from './assets/asset-manager.ts';
import { HAZARD_MODELS, hazardVariant } from './assets/catalog.ts';
import { ResourceOwner } from './assets/resources.ts';
import { hazardOrientation } from './core/hazard-profile.ts';
import type { ColliderDebugFactory, ColliderDebugView } from './debug/types.ts';
import { SpaceBackground } from './visuals/space-background.ts';
import { EngineVFX } from './visuals/engine-vfx.ts';
import { ImpactVFX } from './visuals/impact-vfx.ts';
import { visualDelta, visualQuality } from './visuals/settings.ts';

function cornerGuide(): THREE.LineSegments {
  const points: THREE.Vector3[] = [];
  for (const x of [-7.1, 7.1]) for (const y of [-4.6, 4.6]) {
    points.push(new THREE.Vector3(x, y, 0), new THREE.Vector3(x - Math.sign(x) * 1.2, y, 0));
    points.push(new THREE.Vector3(x, y, 0), new THREE.Vector3(x, y - Math.sign(y) * 1.2, 0));
  }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x376583, transparent: true, opacity: 0.055 }));
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
  private readonly ship = new THREE.Group();
  private readonly hazards: THREE.Group[] = [];
  private readonly frames: THREE.LineSegments[] = [];
  private readonly angles = { x: 0, y: 0, z: 0 };
  private readonly collisionDebug?: ColliderDebugView;
  private readonly background: SpaceBackground;
  private readonly engines: EngineVFX;
  private readonly impacts: ImpactVFX;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly coarsePointer = window.matchMedia('(pointer: coarse)');
  private quality = visualQuality(1280, 800, false, false);
  private width = 1280;
  private height = 800;
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

    this.ship.add(assets.clone('ship'));
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

    // Track only World-owned resources BEFORE attaching independently owned VFX
    // and debugger roots. Imported models are borrowed from AssetManager.
    this.resources.track(this.scene, assets.resources);
    this.background = new SpaceBackground(this.scene);
    this.engines = new EngineVFX(this.scene, this.ship);
    this.impacts = new ImpactVFX(this.scene);
    this.collisionDebug = debugFactory?.(this.scene);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.quality = visualQuality(width, height, this.coarsePointer.matches, this.reducedMotion.matches);
    this.background.setQuality(this.quality, width / height);
    const cap = this.quality.mobile ? CONFIG.render.mobilePixelRatio : CONFIG.render.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.cameraZ = Math.max(13, 7 / Math.tan(THREE.MathUtils.degToRad(29)) / this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.engines.reset();
    this.impacts.reset();
    this.ship.rotation.set(0, 0, 0);
    this.camera.position.set(0, 2.4, this.cameraZ);
  }

  render(model: GameModel, dt: number): void {
    if (this.disposed) return;
    if (this.quality.reducedMotion !== this.reducedMotion.matches || this.quality.mobile !== (this.coarsePointer.matches || Math.min(this.width, this.height) < 600)) this.resize(this.width, this.height);
    const blend = 1 - Math.exp(-dt * 8);
    this.ship.position.set(model.ship.x, model.ship.y, 0);
    this.ship.rotation.z = THREE.MathUtils.lerp(this.ship.rotation.z, -model.ship.vx * 0.045, blend);
    this.ship.rotation.x = THREE.MathUtils.lerp(this.ship.rotation.x, model.ship.vy * 0.025, blend);
    // A thin low-intensity shimmer replaces whole-ship strobing.
    this.ship.visible = true;

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
    this.background.update(model.distance, model.speed, this.quality);
    this.engines.update(visualDelta(model.state, dt), model.state, model.speed, this.quality);
    this.impacts.update(model.hitSerial, this.ship.position, model.ship.vx, model.ship.vy, model.state === 'GAME_OVER' ? 0 : model.invulnerability, model.elapsed, visualDelta(model.state, dt, true), this.quality);
    const shake = model.state === 'PLAYING' ? this.impacts.remaining * 0.08 : 0;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, model.ship.x * 0.12, blend) + Math.sin(model.elapsed * 80) * shake;
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 2.4 + model.ship.y * 0.12, blend);
    this.camera.position.z = this.cameraZ;
    this.camera.lookAt(0, 0, -28);
    this.collisionDebug?.update(model);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.collisionDebug?.dispose();
    this.background.dispose();
    this.engines.dispose();
    this.impacts.dispose();
    this.resources.dispose();
    this.renderer.dispose();
  }
}
