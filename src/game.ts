import { GameModel } from './core/game-model.ts';
import type { GameState } from './core/game-model.ts';
import { GameLoop } from './game-loop.ts';
import { InputManager } from './input.ts';
import { HUD, element } from './ui.ts';
import { World } from './world.ts';
import { StandalonePlatform } from './services/platform.ts';
import type { PlatformAdapter } from './services/platform.ts';
import { AssetManager } from './assets/asset-manager.ts';
import type { ColliderDebugFactory } from './debug/types.ts';
import { AudioManager } from './audio/audio-manager.ts';
import { SoundPanel } from './audio/sound-panel.ts';

export class Game {
  readonly model: GameModel;
  readonly world: World;
  readonly audio = new AudioManager();
  private readonly soundPanel: SoundPanel;
  private readonly ui = new HUD();
  private readonly input: InputManager;
  private readonly loop: GameLoop;
  private readonly events = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private readonly platform: PlatformAdapter;
  private shownState: GameState = 'LOADING';
  private pauseReason = 'Your flight is paused.';
  private contextLost = false;
  private readonly assets: AssetManager;

  constructor(assets: AssetManager, platform: PlatformAdapter = new StandalonePlatform(), debugFactory?: ColliderDebugFactory, model: GameModel = new GameModel()) {
    this.model = model;
    this.assets = assets;
    this.platform = platform;
    const canvas = element<HTMLCanvasElement>('flight');
    canvas.tabIndex = 0;
    this.world = new World(canvas, assets, debugFactory);
    this.input = new InputManager(canvas, element('joystick'), () => this.model.state === 'PLAYING', () => this.togglePause());
    this.soundPanel = new SoundPanel(this.audio);
    const options = { signal: this.events.signal };
    element('launch').addEventListener('click', () => this.start(), options);
    element('replay').addEventListener('click', () => this.start(), options);
    element('pause').addEventListener('click', () => this.pause('Your flight is paused.', true), options);
    element('resume').addEventListener('click', () => this.resume(), options);
    window.addEventListener('blur', () => {
      this.pause('Window focus lost. Resume when you are ready.');
      this.audio.background();
    }, options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause('Flight paused while the page was hidden.');
        this.audio.background();
      }
    }, options);
    window.addEventListener('keydown', event => {
      if (event.code !== 'KeyM' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable]'))) return;
      event.preventDefault();
      this.audio.setSettings({ muted: !this.audio.settings.muted });
      this.audio.activate();
      this.soundPanel.update();
    }, options);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
      this.pause('Graphics context lost. Waiting for recovery…');
      this.audio.background();
      element<HTMLButtonElement>('resume').disabled = true;
    }, options);
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      element<HTMLButtonElement>('resume').disabled = false;
      this.pauseReason = 'Graphics restored. Resume when you are ready.';
      if (this.model.state === 'PAUSED') this.ui.showState(this.model, this.platform.scores.best, this.pauseReason);
    }, options);
    this.resizeObserver = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) this.world.resize(rect.width, rect.height);
    });
    this.resizeObserver.observe(element('game'));
    const rect = canvas.getBoundingClientRect();
    this.world.resize(rect.width, rect.height);
    this.world.reset();
    this.loop = new GameLoop(dt => this.model.step(dt, this.input.axis), dt => {
      this.syncState();
      this.audio.update(this.model);
      this.soundPanel.update();
      this.ui.update(this.model);
      this.world.render(this.model, dt);
    });
    this.model.ready();
    this.platform.ready();
    this.syncState();
    this.loop.start();
  }

  private start(): void {
    if (this.contextLost) return;
    const parameter = new URLSearchParams(window.location.search).get('seed');
    const parsed = parameter === null || parameter.trim() === '' ? NaN : Number(parameter);
    const seed = Number.isFinite(parsed) ? parsed >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.input.clear();
    this.audio.resetRun();
    this.model.start(seed);
    this.world.reset();
    this.syncState();
    this.audio.activate('launch');
  }

  private pause(reason: string, sound = false): void {
    this.input.clear();
    if (this.model.state !== 'PLAYING') return;
    this.pauseReason = reason;
    this.model.pause();
    this.syncState();
    if (sound) this.audio.activate('pause');
  }

  private resume(): void {
    if (this.contextLost || document.hidden) return;
    this.input.clear();
    this.model.resume();
    this.syncState();
    this.audio.activate('resume');
  }

  private togglePause(): void {
    if (this.model.state === 'PLAYING') this.pause('Your flight is paused.', true);
    else if (this.model.state === 'PAUSED') this.resume();
  }

  private syncState(): void {
    if (this.shownState === this.model.state) return;
    this.input.clear();
    if (this.model.state === 'GAME_OVER') this.platform.scores.record(this.model.score);
    this.platform.gameplayChanged(this.model.state === 'PLAYING');
    this.shownState = this.model.state;
    this.audio.update(this.model);
    this.ui.showState(this.model, this.platform.scores.best, this.pauseReason);
  }

  dispose(): void {
    this.loop.stop();
    (this.model as GameModel & { dispose?: () => void }).dispose?.();
    this.input.dispose();
    this.events.abort();
    this.soundPanel.dispose();
    this.audio.dispose();
    this.resizeObserver.disconnect();
    this.world.dispose();
    this.assets.dispose();
    this.platform.gameplayChanged(false);
  }
}
