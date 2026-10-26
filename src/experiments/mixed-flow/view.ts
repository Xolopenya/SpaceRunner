import type { Group, Scene } from 'three';
import type { GameModel } from '../../core/game-model.ts';
import { StructureVariantsView } from '../structure-variants/view.ts';
import { isWreck } from '../structure-variants/profile.ts';
import type { MixedFlowGameModel } from './model.ts';
import { MIXED_FLOW } from './settings.ts';

/** Original renderer/profiles reused verbatim; only DEV diagnostics are replaced. */
export class MixedFlowView {
  private readonly wrecks: StructureVariantsView;
  private readonly info = document.createElement('aside');
  private readonly text = document.createElement('div');
  private readonly button = document.createElement('button');
  private model?: MixedFlowGameModel;
  private readonly export = () => {
    if (!this.model) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.model.field.exportDiagnosticTrace(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `space-runner-${MIXED_FLOW.version}-trace.json`; a.click(); URL.revokeObjectURL(url);
  };
  constructor(scene: Scene, colliders: boolean) {
    this.wrecks = new StructureVariantsView(scene, 'center', 'mixed', colliders);
    document.getElementById('structure-variants-debug-info')!.hidden = true;
    this.info.id = 'mixed-flow-debug-info';
    Object.assign(this.info.style, { position: 'absolute', left: '12px', bottom: '42px', maxWidth: '94%', zIndex: '5', color: '#e5ecee',
      background: '#07111ee8', padding: '7px 10px', font: '11px/1.4 monospace', whiteSpace: 'pre-line', overflowWrap: 'anywhere', pointerEvents: 'none' });
    this.button.id = 'mixed-flow-export'; this.button.textContent = 'Export recent trace'; this.button.style.pointerEvents = 'auto';
    this.button.addEventListener('click', this.export); this.info.append(this.text, this.button); document.getElementById('game')!.append(this.info);
  }
  get resources() { return this.wrecks.resources; }
  bind(slots: readonly Group[]): void { this.wrecks.bind(slots); }
  update(base: GameModel): void {
    const m = this.model = base as MixedFlowGameModel, f = m.field; this.wrecks.update(m);
    const active = f.slots.filter(h => h.active), large = active.filter(isWreck).length;
    let family: string | undefined, aperture: string | undefined;
    for (let i = f.events.length - 1; i >= 0; i--) { const e = f.events[i]!; if (e.status === 'committed') { family ??= e.family; aperture ??= e.aperture; } if (family && aperture) break; }
    this.text.textContent = `DEV ${MIXED_FLOW.version} · ${m.forcedAperture ? 'TEST OVERRIDE ' + m.forcedAperture.toUpperCase() : 'AUTO APERTURES'} · ${Math.floor(m.distance)}m\n`
      + `Sections scheduled ${f.scheduled} / committed ${f.committed} / omitted ${f.omitted}\n`
      + `Active ordinary ${active.length - large} / structures ${large} · pending ${f.pending ? 1 : 0}\n`
      + `Last encounter ${family ?? 'none'} / aperture ${aperture ?? 'none'}\n`
      + `Last rejection ${f.lastRejection?.split(':').slice(0, 3).join(':') ?? 'none'}\nFault ${f.fault ?? 'none'}`;
  }
  dispose(): void { this.button.removeEventListener('click', this.export); this.info.remove(); this.wrecks.dispose(); this.model = undefined; }
}
