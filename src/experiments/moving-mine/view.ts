import { Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, SphereGeometry, WireframeGeometry } from 'three';
import type { Scene } from 'three';
import { ResourceOwner } from '../../assets/resources.ts';
import type { GameModel } from '../../core/game-model.ts';
import { MixedFlowView } from '../mixed-flow/view.ts';
import { isMine } from './motion.ts';
import { MINE } from './settings.ts';
import type { MineAssetManager } from './assets.ts';
import type { MovingMineGameModel } from './model.ts';

export class MovingMineView {
  readonly resources = new ResourceOwner();
  readonly root = new Group();
  private readonly flow: MixedFlowView;
  private slots: readonly Group[] = [];
  private readonly mine = new Group();
  private readonly info = document.createElement('aside');
  constructor(scene: Scene, assets: MineAssetManager, colliders: boolean) {
    this.flow = new MixedFlowView(scene, colliders);
    document.getElementById('mixed-flow-debug-info')!.hidden = true;
    this.mine.add(assets.cloneMine());
    const lamp = new Mesh(new SphereGeometry(.14, 8, 6), new MeshBasicMaterial({ color: 0xff3412 }));
    lamp.position.set(0, .15, .72); lamp.name = 'mine-warning'; this.mine.add(lamp);
    if (colliders) {
      const sphere = new SphereGeometry(1, 16, 12);
      this.mine.add(new LineSegments(new WireframeGeometry(sphere), new LineBasicMaterial({ color: 0xffc157, depthTest: false }))); sphere.dispose();
    }
    this.mine.scale.setScalar(MINE.radius); this.mine.name = 'moving-space-mine'; this.root.add(this.mine); scene.add(this.root);
    this.resources.track(this.root, assets.resources);
    this.info.id = 'moving-mine-info'; Object.assign(this.info.style, { position: 'absolute', left: '12px', bottom: '42px', zIndex: '5',
      color: '#e5ecee', background: '#07111ee8', padding: '6px 9px', font: '11px/1.4 monospace', whiteSpace: 'pre-line', pointerEvents: 'none' });
    document.getElementById('game')!.append(this.info);
  }
  bind(slots: readonly Group[]): void { this.slots = slots; this.flow.bind(slots); }
  update(base: GameModel): void {
    const m = base as MovingMineGameModel; this.flow.update(m); this.mine.visible = false;
    for (const [i, h] of m.field.slots.entries()) if (isMine(h)) {
      if (this.slots[i]) this.slots[i]!.visible = false;
      if (h.active) { this.mine.visible = true; this.mine.position.set(h.x, h.y, h.z); }
    }
    const proposals = m.field.events.filter(e => e.selectedFamily === 'moving-mine'), publications = proposals.filter(e => e.ids.some(id => id.startsWith(MINE.version)));
    this.info.textContent = `DEV MOVING MINE · ${m.motionPolicy} · ${Math.floor(m.distance)}m\nRecent mines proposed ${proposals.length} / published ${publications.length} / omitted ${proposals.length - publications.length}\n${m.field.fault ?? '120Hz · single contact hazard · asteroid field'}`;
  }
  dispose(): void { this.flow.dispose(); this.root.removeFromParent(); this.resources.dispose(); this.info.remove(); this.slots = []; }
}
