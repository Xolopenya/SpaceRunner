import type { World } from '../world.ts';
import type { BoundaryMode } from '../visuals/warp-corridor.ts';
import type { RevealMode } from '../visuals/reveal-settings.ts';

/** DEV-only presentation switches. No simulation imports or state writes. */
export class VisualComparison {
  private readonly root = document.createElement('aside');
  private readonly events = new AbortController();
  constructor(world: World, params: URLSearchParams) {
    let boundaries: BoundaryMode = params.get('boundaries') === 'legacy' ? 'legacy' : 'warp';
    let reveal: RevealMode = params.get('reveal') === 'legacy' ? 'legacy' : 'seamless';
    this.root.id = 'visual-comparison';
    this.root.style.cssText = 'position:absolute;bottom:46px;left:12px;z-index:6;padding:8px;background:#07111eec;color:#b8dfe8;font:11px monospace;max-width:calc(100% - 24px)';
    const label = document.createElement('div');label.textContent = 'DEV · VISUAL COMPARISON';this.root.append(label);
    const buttons: HTMLButtonElement[] = [];
    const update = () => {
      world.setVisualModes(boundaries, reveal);
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.boundaries === boundaries || button.dataset.reveal === reveal));
    };
    for (const [kind, values] of [['boundaries', ['legacy', 'warp']], ['reveal', ['legacy', 'seamless']]] as const) {
      const row = document.createElement('div');row.append(`${kind}: `);
      for (const value of values) {
        const button = document.createElement('button');button.textContent = value;button.dataset[kind] = value;
        button.style.cssText = 'padding:7px 10px;margin:3px;border:1px solid #4b7d8c;background:#142b3a;color:#d2eef4;min-height:32px';
        button.addEventListener('click', () => { if (kind === 'boundaries') boundaries = value as BoundaryMode;else reveal = value as RevealMode;update(); }, { signal: this.events.signal });
        buttons.push(button);row.append(button);
      }
      this.root.append(row);
    }
    const occlusion=document.createElement('button');occlusion.textContent='station occlusion';
    occlusion.style.cssText='padding:7px 10px;margin:3px;background:#142b3a;color:#d2eef4;border:1px solid #4b7d8c';
    const syncOcclusion=()=>occlusion.setAttribute('aria-pressed',String(world.boundaries.warp.occlusion));
    occlusion.addEventListener('click',()=>{world.boundaries.warp.occlusion=!world.boundaries.warp.occlusion;syncOcclusion();},{signal:this.events.signal});
    this.root.append(occlusion);syncOcclusion();
    document.getElementById('game')!.append(this.root);update();
  }
  dispose(): void { this.events.abort();this.root.remove(); }
}
