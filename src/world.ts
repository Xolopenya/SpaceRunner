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
import { FragmentView } from './collectibles/view.ts';
import { ArenaBoundaries } from './visuals/arena-boundaries.ts';
import { ObjectReveal, publicationElapsed } from './visuals/object-reveal.ts';
import type { RevealTarget } from './visuals/object-reveal.ts';
import type { RevealMode } from './visuals/reveal-settings.ts';
import type { BoundaryMode } from './visuals/warp-corridor.ts';
import { CAMERA, FlightCamera } from './camera/flight-camera.ts';

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  readonly flightCamera = new FlightCamera(this.camera);
  private readonly ship = new THREE.Group();
  readonly hazards: THREE.Group[] = [];
  readonly boundaries: ArenaBoundaries;
  readonly reveal = new ObjectReveal();
  private readonly hazardReveal: RevealTarget[] = [];
  private readonly angles = { x: 0, y: 0, z: 0 };
  private readonly collisionDebug?: ColliderDebugView;
  private readonly background: SpaceBackground;
  private readonly engines: EngineVFX;
  private readonly impacts: ImpactVFX;
  private readonly fragments: FragmentView;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly coarsePointer = window.matchMedia('(pointer: coarse)');
  private quality = visualQuality(1280, 800, false, false);
  private width = 1280;
  private height = 800;
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
      this.hazardReveal.push(this.reveal.register(group,'debris'));
      this.scene.add(group);
    }
    // Track only World-owned resources BEFORE attaching independently owned VFX
    // and debugger roots. Imported models are borrowed from AssetManager.
    this.resources.track(this.scene, assets.resources);
    this.boundaries = new ArenaBoundaries(this.scene);
    this.boundaries.setMode('warp');
    this.flightCamera.setMode('hybrid-chase');
    this.background = new SpaceBackground(this.scene);
    this.engines = new EngineVFX(this.scene, this.ship);
    this.impacts = new ImpactVFX(this.scene);
    this.fragments = new FragmentView(this.scene, this.reveal);
    this.collisionDebug = debugFactory?.(this.scene);
    this.collisionDebug?.setReveal?.(this.reveal);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.quality = visualQuality(width, height, this.coarsePointer.matches, this.reducedMotion.matches);
    this.background.setQuality(this.quality, width / height);
    const cap = this.quality.mobile ? CONFIG.render.mobilePixelRatio : CONFIG.render.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(width, height, false);
    this.flightCamera.resize(width, height);
  }

  setVisualModes(boundaries: BoundaryMode, reveal: RevealMode): void { this.boundaries.setMode(boundaries);this.reveal.setMode(reveal); }

  reset(): void {
    this.reveal.reset();
    this.boundaries.reset();
    this.engines.reset();
    this.impacts.reset();
    this.fragments.reset();
    this.ship.rotation.set(0, 0, 0);
    this.flightCamera.reset();
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

    this.reveal.beginFrame(model.elapsed);
    for (let i = 0; i < model.field.hazards.length; i++) {
      const hazard = model.field.hazards[i]!;
      const group = this.hazards[i]!;
      const target=this.hazardReveal[i]!,id=(hazard as typeof hazard & {planned?:{id:string}}).planned?.id;
      this.reveal.apply(target,hazard.active?id:undefined,target.id===id?target.birth:id?publicationElapsed(model,id):model.elapsed,-hazard.z);
      group.visible = hazard.active;
      if (!hazard.active) continue;
      group.position.set(hazard.x, hazard.y, hazard.z);
      group.scale.setScalar(hazard.radius);
      hazardOrientation(hazard, model.elapsed, this.angles);
      group.rotation.set(this.angles.x, this.angles.y, this.angles.z);
      const variant = hazardVariant(hazard.kind, hazard.phase);
      for (let j = 0; j < group.children.length; j++) group.children[j]!.visible = j === variant;
    }
    this.boundaries.update(model.ship.x, model.ship.y, model.distance, this.quality.reducedMotion);
    this.background.update(model.distance, model.speed, this.quality);
    this.fragments.update(model, this.quality.reducedMotion);
    this.engines.update(visualDelta(model.state, dt), model.state, model.speed, this.quality);
    this.impacts.update(model.hitSerial, this.ship.position, model.ship.vx, model.ship.vy, model.state === 'GAME_OVER' ? 0 : model.invulnerability, model.elapsed, visualDelta(model.state, dt, true), this.quality);
    const shake = model.state === 'PLAYING' ? this.impacts.remaining * 0.08 : 0;
    this.flightCamera.update(model.ship.x, model.ship.y, model.elapsed, shake, dt);
    this.collisionDebug?.update(model);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reveal.dispose();
    this.collisionDebug?.dispose();
    this.boundaries.dispose();
    this.background.dispose();
    this.engines.dispose();
    this.impacts.dispose();
    this.fragments.dispose();
    this.resources.dispose();
    this.renderer.dispose();
  }
}
