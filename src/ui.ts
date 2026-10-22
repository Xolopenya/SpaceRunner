import { GameModel } from './core/game-model.ts';

export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing interface element: #${id}`);
  return node as T;
}

function text(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

export class HUD {
  private readonly game = element('game');
  private readonly distance = element('distance');
  private readonly hull = element('hull');
  private readonly hullPips = Array.from(this.hull.children);
  private readonly hint = element('flight-hint');
  private readonly damage = element('damage');
  private readonly telemetry = element('telemetry');

  showState(model: GameModel, best: number, pauseReason: string): void {
    const state = model.state;
    this.game.dataset.state = state;
    element('loading').hidden = state !== 'LOADING';
    element('menu').hidden = state !== 'MENU';
    element('paused').hidden = state !== 'PAUSED';
    element('game-over').hidden = state !== 'GAME_OVER';
    element('hud').hidden = state === 'MENU' || state === 'LOADING';
    element('pause').hidden = state !== 'PLAYING';
    text(element('menu-best'), best.toLocaleString('en-US'));
    text(element('final-score'), model.score.toLocaleString('en-US'));
    text(element('final-best'), best.toLocaleString('en-US'));
    text(element('pause-reason'), pauseReason);
    text(element('seed'), `ROUTE ${model.seed} · THREE HULL POINTS · ONE MORE TRY`);
    const focusId = { MENU: 'launch', PLAYING: 'flight', PAUSED: 'resume', GAME_OVER: 'replay', LOADING: 'loading' }[state];
    element(focusId).focus({ preventScroll: true });
  }

  update(model: GameModel): void {
    text(this.distance, model.score.toLocaleString('en-US'));
    this.hull.setAttribute('aria-valuenow', String(model.hull));
    this.hullPips.forEach((pip, index) => pip.classList.toggle('lost', index >= model.hull));
    this.hint.hidden = model.state !== 'PLAYING' || model.elapsed > 9;
    this.damage.hidden = model.state !== 'PLAYING' || model.invulnerability <= 0;
    this.game.dataset.hit = String(!this.damage.hidden);
    text(this.telemetry, model.state === 'MENU' ? 'SPACE KIT / KENNEY · CC0' : `${Math.round(model.speed)} M/S · ROUTE ${model.seed}`);
  }
}
