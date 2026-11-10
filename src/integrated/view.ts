import { Group } from 'three';
import { MineShell } from '../visuals/mine-shell.ts';
import type { Scene } from 'three';
import { ResourceOwner } from '../assets/resources.ts';
import type { GameModel } from '../core/game-model.ts';
import { releaseView } from '../release/model.ts';
import type { MineAssetManager } from '../experiments/moving-mine/assets.ts';
import { publicationElapsed } from '../visuals/object-reveal.ts';
import type { ObjectReveal, RevealTarget } from '../visuals/object-reveal.ts';
import { MINE } from '../experiments/moving-mine/settings.ts';
import { isMine } from '../experiments/moving-mine/motion.ts';
import type { IntegratedModel } from './model.ts';

/** Borrowed licensed core with pooled technical armor and phase emitters. */
export class IntegratedView {
  readonly root = new Group();
  private readonly flow: ReturnType<typeof releaseView>;
  private readonly resources = new ResourceOwner();
  private readonly mine = new Group();
  private readonly shell: MineShell;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private slots: readonly Group[] = [];
  private reveal?:ObjectReveal;
  private revealTarget?:RevealTarget;
  constructor(scene: Scene, assets: MineAssetManager) {
    this.flow = releaseView(scene);
    this.shell = new MineShell(assets.cloneMine()); this.mine.add(this.shell.root);
    this.mine.name = 'integrated-adaptive-mine'; this.mine.scale.setScalar(MINE.radius);
    this.root.add(this.mine); scene.add(this.root); this.resources.track(this.root, assets.resources);
  }
  setReveal(reveal:ObjectReveal):void {this.reveal=reveal;this.flow.setReveal(reveal);this.revealTarget=reveal.register(this.mine,'mine');}
  bind(slots: readonly Group[]): void { this.slots = slots; this.flow.bind(slots); }
  update(base: GameModel): void {
    this.flow.update(base); this.mine.visible = false;
    const model = base as IntegratedModel;
    for (let i = 0; i < model.field.slots.length; i++) {
      const h = model.field.slots[i]!; if (!isMine(h)) continue;
      if (this.slots[i]) this.slots[i]!.visible = false;
      if (h.active && (this.reveal?.mode==='seamless'||model.homing.current?.phase !== 'waiting')) {
        this.mine.visible = true; this.mine.position.set(h.x, h.y, h.z);
        const target=this.revealTarget;if(target&&this.reveal&&h.planned)this.reveal.apply(target,h.planned.id,target.id===h.planned.id?target.birth:publicationElapsed(model,h.planned.id),-h.z);
        this.shell.update(model.homing.current?.phase ?? 'waiting', model.elapsed, this.reducedMotion.matches);
      }
    }
  }
  dispose(): void { this.flow.dispose(); this.root.removeFromParent(); this.resources.dispose(); this.slots = []; }
}
