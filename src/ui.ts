import { RELEASE } from './release/settings.ts';
import { GameModel } from './core/game-model.ts';
import { fragmentsOf } from './collectibles/state.ts';

export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing interface element: #${id}`);
  return node as T;
}

function text(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

function score(node: HTMLElement, value: number): void {
  const formatted = value.toLocaleString('en-US');
  text(node, formatted);
  const size = formatted.length > 12 ? 'very-long' : formatted.length > 6 ? 'long' : 'normal';
  if (node.dataset.size !== size) node.dataset.size = size;
}

export class HUD {
  private readonly game = element('game');
  private readonly distance = element('distance');
  private readonly energy = element('energy-count');
  private readonly energyBlock = element('energy-block');
  private readonly pausedScore = element('paused-score');
  private readonly hull = element('hull');
  private readonly hullPips = Array.from(this.hull.children);
  private readonly pausedHull = element('paused-hull');
  private readonly pausedPips = Array.from(this.pausedHull.children);
  private readonly hullCount = element('hull-count');
  private readonly pausedHullCount = element('paused-hull-count');
  private readonly hint = element('flight-hint');
  private readonly damage = element('damage');
  private readonly telemetry = element('telemetry');
  private phaseAt=0;
  private phaseShown=1;
  private lastScore = -1;
  private lastHull = -1;
  private lastSpeed = -1;
  private lastHit = false;

  showState(model: GameModel, best: number, pauseReason: string): void {
    const state = model.state;
    this.game.dataset.state = state;
    element('loading').hidden = state !== 'LOADING';
    element('menu').hidden = state !== 'MENU';
    element('paused').hidden = state !== 'PAUSED';
    element('game-over').hidden = state !== 'GAME_OVER';
    element('hud').hidden = state !== 'PLAYING';
    element('pause').hidden = state !== 'PLAYING';
    this.telemetry.hidden = state !== 'PLAYING';
    score(element('menu-best'), best);
    score(element('final-score'), model.score);
    score(element('final-best'), best);
    text(element('final-energy'), String(fragmentsOf(model)?.count ?? 0).padStart(2, '0'));
    text(element('pause-reason'), pauseReason);
    text(element('seed'), `Route ${model.seed}`);
    const focusId = { MENU: 'launch', PLAYING: 'flight', PAUSED: 'resume', GAME_OVER: 'replay', LOADING: 'loading' }[state];
    element(focusId).focus({ preventScroll: true });
  }

  update(model: GameModel): void {
    const fragments = fragmentsOf(model), pickupAt = fragments?.lastPickup.elapsed ?? -1;
    text(this.energy, String(fragments?.count ?? 0).padStart(2, '0'));
    this.energyBlock.dataset.pulse = String(pickupAt >= 0 && model.elapsed - pickupAt < .42);
    const phase='phase' in model ? Number(model.phase) : 1;
    if(phase===1){this.phaseShown=1;this.phaseAt=0;}
    if(phase===2&&this.phaseShown===1){this.phaseShown=2;this.phaseAt=model.elapsed;}
    element('phase-label').textContent=phase===2?'PHASE 2 / DANGEROUS SECTOR':'PHASE 1 / NORMAL FLIGHT';
    element('phase-label').dataset.speed=String(model.speed);
    element('phase-label').dataset.gap=String(phase===1?RELEASE.phase1ExtraCells*RELEASE.cellSize:0);
    element('phase-notice').textContent='PHASE 2 / DANGEROUS SECTOR / SPEED +'+Math.round((RELEASE.phase2SpeedMultiplier-1)*100)+'% / RECOVERY GAP -'+RELEASE.phase1ExtraCells*RELEASE.cellSize;
    element('phase-notice').hidden=phase!==2||model.elapsed-this.phaseAt>3;

    if (this.lastScore !== model.score) {
      this.lastScore = model.score;
      score(this.distance, model.score);
      score(this.pausedScore, model.score);
    }
    if (this.lastHull !== model.hull) {
      this.lastHull = model.hull;
      for (const meter of [this.hull, this.pausedHull]) {
        meter.setAttribute('aria-valuenow', String(model.hull));
        meter.setAttribute('aria-valuetext', `${model.hull} of 3 hull points`);
        meter.closest<HTMLElement>('.hull-block')!.dataset.critical = String(model.hull <= 1);
      }
      for (const pips of [this.hullPips, this.pausedPips]) pips.forEach((pip, index) => pip.classList.toggle('lost', index >= model.hull));
      text(this.hullCount, String(model.hull));
      text(this.pausedHullCount, String(model.hull));
    }
    const hintHidden = model.state !== 'PLAYING' || model.elapsed > 9;
    const damageHidden = model.state !== 'PLAYING' || model.invulnerability <= 0;
    if (this.hint.hidden !== hintHidden) this.hint.hidden = hintHidden;
    if (this.damage.hidden !== damageHidden) this.damage.hidden = damageHidden;
    const hit = !this.damage.hidden;
    if (this.lastHit !== hit) { this.lastHit = hit; this.game.dataset.hit = String(hit); }
    const speed = Math.round(model.speed);
    if (this.lastSpeed !== speed) { this.lastSpeed = speed; text(this.telemetry, `${speed} m/s`); }
  }
}
