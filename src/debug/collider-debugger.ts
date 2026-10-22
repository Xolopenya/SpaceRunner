import { BoxGeometry, EdgesGeometry, Group, LineBasicMaterial, LineSegments, SphereGeometry, WireframeGeometry } from 'three';
import type { Scene } from 'three';
import { CONFIG } from '../config.ts';
import { ResourceOwner } from '../assets/resources.ts';
import { HAZARD_MODELS } from '../assets/catalog.ts';
import { HAZARD_BOXES, hazardOrientation, hazardVariant } from '../core/hazard-profile.ts';
import type { GameModel } from '../core/game-model.ts';
import type { ColliderDebugView } from './types.ts';

/** Imported dynamically only under import.meta.env.DEV. No production geometry. */
export class ColliderDebugger implements ColliderDebugView {
  private readonly root = new Group();
  private readonly player: LineSegments;
  private readonly hazards: Group[] = [];
  private readonly resources = new ResourceOwner();
  private readonly angles = { x: 0, y: 0, z: 0 };
  private readonly info = document.createElement('aside');
  private lastInfoTime = -1;
  private disposed = false;

  constructor(scene: Scene) {
    this.root.name = 'collision-debug-root';
    const sphereSource = new SphereGeometry(1, 16, 10);
    const sphere = new WireframeGeometry(sphereSource);
    sphereSource.dispose();
    const boxSource = new BoxGeometry(2, 2, 2);
    const box = new EdgesGeometry(boxSource);
    boxSource.dispose();
    const material = (color: number, opacity: number) => new LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
    const sphereMaterial = material(0xffb66e, 0.35);
    const boxMaterial = material(0x69f4d3, 0.9);
    this.player = new LineSegments(sphere, material(0xff83d1, 0.95));
    this.player.name = 'collider-player';
    this.player.scale.setScalar(CONFIG.ship.radius);
    this.root.add(this.player);
    for (let i = 0; i < CONFIG.hazards.capacity; i++) {
      const group = new Group();
      group.name = `collider-hazard-${i}`;
      group.add(new LineSegments(sphere, sphereMaterial), new LineSegments(box, boxMaterial));
      group.visible = false;
      this.hazards.push(group);
      this.root.add(group);
    }
    this.root.renderOrder = 10;
    this.resources.track(this.root);
    scene.add(this.root);
    this.info.id = 'collider-debug-info';
    this.info.setAttribute('aria-label', 'Developer collision diagnostics');
    Object.assign(this.info.style, { position: 'absolute', zIndex: '5', left: '20px', bottom: '46px', maxWidth: 'min(460px, 90%)', padding: '10px 12px', background: '#050b19e8', border: '1px solid #586b82', borderRadius: '6px', color: '#d2deed', font: '10px/1.6 monospace', whiteSpace: 'pre-line', pointerEvents: 'none' });
    document.getElementById('game')!.append(this.info);
  }

  update(model: GameModel): void {
    if (this.disposed) return;
    this.player.position.set(model.ship.x, model.ship.y, 0);
    let count = 0;
    let closest = Infinity;
    let closestIndex = -1;
    for (let i = 0; i < this.hazards.length; i++) {
      const hazard = model.field.hazards[i]!;
      const group = this.hazards[i]!;
      group.visible = hazard.active;
      if (!hazard.active) continue;
      count++;
      const variant = hazardVariant(hazard.kind, hazard.phase);
      const bounds = HAZARD_BOXES[variant];
      group.position.set(hazard.x, hazard.y, hazard.z);
      group.scale.setScalar(hazard.radius);
      hazardOrientation(hazard, model.elapsed, this.angles);
      group.rotation.set(this.angles.x, this.angles.y, this.angles.z);
      const wireBox = group.children[1]!;
      wireBox.visible = !!bounds;
      if (bounds) wireBox.scale.set(bounds.x, bounds.y, bounds.z);
      group.userData.shape = bounds ? 'sphere-and-box' : 'sphere';
      group.userData.modelId = HAZARD_MODELS[variant];
      if (Math.abs(hazard.z) < closest) {
        closest = Math.abs(hazard.z);
        closestIndex = i;
      }
    }
    // Text is developer-only and throttled; wire transforms update every render.
    const now = performance.now();
    if (now - this.lastInfoTime >= 250 || this.lastInfoTime < 0) {
      this.lastInfoTime = now;
      let detail = 'No active hazards';
      if (closestIndex >= 0) {
        const hazard = model.field.hazards[closestIndex]!;
        detail = `${HAZARD_MODELS[hazardVariant(hazard.kind, hazard.phase)]} · r=${hazard.radius.toFixed(2)}\ncenter (${hazard.x.toFixed(2)}, ${hazard.y.toFixed(2)}, ${hazard.z.toFixed(2)})`;
      }
      this.info.textContent = `COLLIDERS · ${count} active · player sphere r=${CONFIG.ship.radius}\nPink: player · amber: outer sphere · mint: calibrated box\nBox variants require BOTH bounds; sphere variants use amber.\nContinuous sweep + bounded rotation tolerance.\n${detail}`;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.resources.dispose();
    this.info.remove();
  }
}
