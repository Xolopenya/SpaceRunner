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
import type { ReactionEvent } from './feedback/orchestrator.ts';
import type { FeedbackPreset } from './feedback/settings.ts';
import { CameraImpulse } from './feedback/camera-impulse.ts';
import type { GameEventMap } from './events/game-events.ts';
import { HullDamage } from './visuals/hull-damage.ts';
import { CollisionVFX } from './visuals/collision-vfx.ts';
import { ShipDestruction } from './visuals/ship-destruction.ts';
import { FEEDBACK } from './feedback/settings.ts';

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
  private readonly cameraImpulse = new CameraImpulse();
  readonly hullDamage: HullDamage;
  readonly destruction: ShipDestruction;
  readonly collisionEffects: CollisionVFX;
  presentationSuspended = false;
  private breakupImpulse = false;
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

    const hullModel = assets.clone('ship');
    this.ship.add(hullModel);
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
    this.hullDamage = new HullDamage(hullModel);
    this.destruction = new ShipDestruction(this.scene, hullModel);
    this.collisionEffects = new CollisionVFX(this.scene);
    this.boundaries = new ArenaBoundaries(this.scene);
    this.boundaries.setMode('fragmented-warp');
    this.flightCamera.setMode('hybrid-chase');
    this.background = new SpaceBackground(this.scene);
    this.engines = new EngineVFX(this.scene, this.ship);
    this.impacts = new ImpactVFX(this.scene);
    this.fragments = new FragmentView(this.scene, this.reveal);
    this.collisionDebug = debugFactory?.(this.scene);
    this.collisionDebug?.setReveal?.(this.reveal);
    this.warmFeedback();
  }

  /** Upload pools in one cleared backing-store pixel during loading. Using the
   * real framebuffer preserves its color-space shader variants. No gameplay facts
   * are synthesized; restore all state before the browser can present a frame. */
  private warmFeedback(): void {
    const roots = [this.hullDamage.root, this.destruction.root, this.collisionEffects.root, this.impacts.root, this.engines.trails];
    const visibility = new Map<THREE.Object3D, boolean>(), opacity = new Map<THREE.Material, number>();
    for (const child of this.scene.children) { visibility.set(child, child.visible); if (!(child instanceof THREE.Light) && child !== this.ship && !roots.includes(child as typeof roots[number])) child.visible = false; }
    for (const root of roots) root.traverse(node => {
      if (!visibility.has(node)) visibility.set(node, node.visible); node.visible = true;
      if (node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line) {
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!opacity.has(material)) opacity.set(material, material.opacity); material.opacity = 0;
        }
      }
    });
    const viewport = this.renderer.getViewport(new THREE.Vector4()), scissor = this.renderer.getScissor(new THREE.Vector4());
    const scissorTest = this.renderer.getScissorTest();
    const warmCamera = this.flightCamera;
    warmCamera.reset(); warmCamera.update(0, 0, 0, 0, 0);
    try {
      this.renderer.setViewport(0, 0, 1, 1); this.renderer.setScissor(0, 0, 1, 1); this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.camera);
      this.collisionEffects.warmPanels(true); this.renderer.render(this.scene, this.camera);
    } finally {
      this.collisionEffects.warmPanels(false); this.renderer.setViewport(viewport); this.renderer.setScissor(scissor); this.renderer.setScissorTest(scissorTest);
      this.renderer.clear();
      for (const [node, value] of visibility) node.visible = value;
      for (const [material, value] of opacity) material.opacity = value;
    }
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
    this.boundaries.warp.updateOcclusion([]);
    this.engines.reset();
    this.impacts.reset();
    this.fragments.reset();
    this.ship.rotation.set(0, 0, 0);
    this.flightCamera.reset();
    this.cameraImpulse.reset();
    this.hullDamage.reset(); this.destruction.reset(); this.collisionEffects.reset(); this.breakupImpulse = false;
  }

  feedback(event: ReactionEvent, preset: FeedbackPreset): void {
    if (this.disposed) return;
    if (event.type === 'collectible.collected') this.fragments.trigger(event.payload, preset);
    else {
      this.hullDamage.setHP(event.type === 'player.damage' ? event.payload.currentHP : 0,
        event.payload.obstaclePosition.x - event.payload.position.x);
      this.impacts.trigger(event.payload.position, event.payload.velocity.x, event.payload.velocity.y, preset, true);
      if (event.type === 'player.destroyed') this.destruction.trigger(event.payload, this.ship, this.quality);
      this.cameraImpulse.trigger(preset);
    }
  }

  collisionFeedback(event: GameEventMap['obstacle.collision']): void {
    if (!this.disposed) this.collisionEffects.trigger(event, this.quality, this.destruction.sequence.active);
  }

  clearFeedback(): void {
    this.impacts.cancel();
    this.fragments.cancel();
    this.cameraImpulse.reset();
    this.collisionEffects.cancel();
  }

  render(model: GameModel, dt: number): void {
    if (this.disposed) return;
    if (this.quality.reducedMotion !== this.reducedMotion.matches || this.quality.mobile !== (this.coarsePointer.matches || Math.min(this.width, this.height) < 600)) this.resize(this.width, this.height);
    const presentationDt = this.presentationSuspended ? 0 : dt;
    this.destruction.sequence.update(model.state, presentationDt);
    const blend = 1 - Math.exp(-dt * 8);
    this.ship.position.set(model.ship.x, model.ship.y, 0);
    this.ship.rotation.z = THREE.MathUtils.lerp(this.ship.rotation.z, -model.ship.vx * 0.045, blend);
    this.ship.rotation.x = THREE.MathUtils.lerp(this.ship.rotation.x, model.ship.vy * 0.025, blend);
    // A thin low-intensity shimmer replaces whole-ship strobing.
    this.ship.visible = true;
    this.destruction.applyShipPose(this.ship);
    this.hullDamage.setHP(model.hull);
    this.hullDamage.update(model.elapsed + this.destruction.sequence.elapsed, this.quality, this.destruction.overload);

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
    this.boundaries.update(model.ship.x, model.ship.y, model.distance, this.quality.reducedMotion, model.field.hazards);
    this.boundaries.warp.updateOcclusion(model.field.hazards);
    this.background.update(model.distance + Math.min(1.1, this.destruction.sequence.elapsed) * model.speed * .12, model.speed, this.quality);
    this.fragments.update(model, this.quality.reducedMotion);
    this.engines.update(visualDelta(model.state, presentationDt, this.destruction.sequence.active), model.state, model.speed, this.quality,
      model.state === 'GAME_OVER' ? this.destruction.enginePower : this.hullDamage.enginePower(this.quality.reducedMotion),
      this.destruction.sequence.active && !this.destruction.sequence.broken);
    this.impacts.update(this.ship.position, model.state === 'GAME_OVER' ? 0 : model.invulnerability, model.elapsed, visualDelta(model.state, presentationDt, true), this.quality);
    this.collisionEffects.update(visualDelta(model.state, presentationDt, true), this.quality, model.distance);
    this.destruction.update(this.quality);
    if (this.destruction.sequence.active && this.destruction.sequence.broken && !this.breakupImpulse) { this.breakupImpulse = true; this.cameraImpulse.trigger(FEEDBACK.destroyed); }
    this.cameraImpulse.update(model.state, presentationDt);
    // Hybrid/Full Chase reconstruct both endpoints; the historical DEV baseline
    // has an accumulating recurrence, so it deliberately receives no impulse.
    const shake = (model.state === 'PLAYING' || model.state === 'PAUSED' || this.destruction.sequence.active) && !this.quality.reducedMotion && this.flightCamera.mode !== 'baseline' ? this.cameraImpulse.amplitude : 0;
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
    this.hullDamage.dispose(); this.destruction.dispose(); this.collisionEffects.dispose();
    this.resources.dispose();
    this.renderer.dispose();
  }
}
