import { Group, LineBasicMaterial, LineSegments, SphereGeometry, WireframeGeometry } from 'three';
import type { Scene } from 'three';
import { ResourceOwner } from '../../assets/resources.ts';
import { publicationElapsed } from '../../visuals/object-reveal.ts';
import type { ObjectReveal, RevealTarget } from '../../visuals/object-reveal.ts';
import { CONFIG } from '../../config.ts';
import type { GameModel } from '../../core/game-model.ts';
import type { RuntimeObstacleField } from '../../debug/runtime-field.ts';
import type { ColliderDebugView } from '../../debug/types.ts';
import { APERTURE_NAMES, PROFILES, isWreck } from './profile.ts';
import type { Aperture, StructureMode } from './profile.ts';

/** Presentation-only replacement; collision profiles remain in profile.ts. */
export {salvageStation as wreckModel} from '../../visuals/salvage-station.ts';
import {salvageStation as wreckModel} from '../../visuals/salvage-station.ts';

export class StructureVariantsView implements ColliderDebugView {
  readonly root = new Group();
  readonly resources = new ResourceOwner();
  private readonly instances: Group[] = [];
  private slots: readonly Group[] = [];
  private readonly player: LineSegments;
  private readonly info = document.createElement('aside');
  private readonly aperture: Aperture;
  private readonly mode: StructureMode;
  private disposed = false;
  private reveal?:ObjectReveal;
  private readonly revealTargets:RevealTarget[]=[];
  constructor(scene: Scene, aperture: Aperture, mode: StructureMode, colliders: boolean) {
    this.aperture = aperture; this.mode = mode; this.root.name = 'structure-variants-dev-root';
    const templates = APERTURE_NAMES.map((_, i) => wreckModel(i, colliders));
    for (let i = 0; i < 8; i++) { const group = new Group(); for (const t of templates) group.add(i ? t.clone(true) : t); this.root.add(group); this.instances.push(group); }
    const sphere = new SphereGeometry(CONFIG.ship.radius, 12, 8);
    this.player = new LineSegments(new WireframeGeometry(sphere), new LineBasicMaterial({ color: 0xff83d1, depthTest: false })); sphere.dispose(); this.player.visible = colliders;
    scene.add(this.root, this.player); this.resources.track(this.root); this.resources.track(this.player);
    this.info.id = 'structure-variants-debug-info';
    Object.assign(this.info.style, { position: 'absolute', left: '12px', bottom: '42px', maxWidth: '94%', zIndex: '5', color: '#e5ecee',
      background: '#07111ee8', padding: '7px 10px', font: '11px/1.5 monospace', whiteSpace: 'pre-line', pointerEvents: 'none' });
    document.getElementById('game')!.append(this.info);
  }
  setReveal(reveal:ObjectReveal):void {this.reveal=reveal;for(const group of this.instances)this.revealTargets.push(reveal.register(group,'station'));}
  bind(slots: readonly Group[]): void { this.slots = slots; }
  update(model: GameModel): void {
    if (this.disposed) return;
    let count = 0, ordinary = 0;
    for (const [i, h] of (model.field as RuntimeObstacleField).slots.entries()) {
      if (!isWreck(h)) { if (h.active) ordinary++; continue; }
      if (this.slots[i]) this.slots[i]!.visible = false;
      if (!h.planned || h.z > CONFIG.hazards.despawnZ) continue;
      const group = this.instances[count++]; if (!group) continue;
      group.visible = true; group.position.set(h.x, h.y, h.z);
      const target=this.revealTargets[count-1];if(target&&this.reveal)this.reveal.apply(target,h.planned.id,target.id===h.planned.id?target.birth:publicationElapsed(model,h.planned.id),-h.z);
      for (let variant = 0; variant < 5; variant++) group.children[variant]!.visible = variant === h.kind - 4;
    }
    for (let i = count; i < 8; i++) this.instances[i]!.visible = false;
    this.player.position.set(model.ship.x, model.ship.y, 0);
    const p = PROFILES[APERTURE_NAMES.indexOf(this.aperture)]!.aperture;
    this.info.textContent = `DEV v2 · ${this.mode.toUpperCase()} · APERTURE ${this.aperture.toUpperCase()}\nFixed hull (0,0) · opening (${p.x}, ${p.y}) · 5.6 × 4.4\n${count} structures / ${ordinary} ordinary hazards · 4 boxes per structure`;
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.root.removeFromParent(); this.player.removeFromParent(); this.info.remove(); this.resources.dispose(); this.slots = []; }
}
