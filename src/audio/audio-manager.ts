import { AudioGraph } from './graph.ts';
import { AudioSettingsStorage, normalizeSettings } from './settings.ts';
import type { AudioSettings } from './settings.ts';
import type { Sound } from './synthesis.ts';
import type { GameState } from '../core/game-model.ts';
import type { SoundCue } from '../feedback/settings.ts';
import type { GameEvent } from '../events/game-events.ts';
import { AudioPressure } from './pressure.ts';
import { AUDIO } from './settings.ts';
import { POLISH } from '../feedback/polish-settings.ts';

export interface AudioFrame {
  readonly state: GameState; readonly speed: number;
  readonly ship: { readonly vx: number; readonly vy: number };
  readonly distance?: number; readonly elapsed?: number; readonly field?: unknown;
  readonly hull?: number;
}
export interface AudioDestruction { readonly active: boolean; readonly elapsed: number; readonly breakupAt: number }
export type AudioStatus = 'locked' | 'running' | 'muted' | 'blocked' | 'unavailable' | 'suspended' | 'disposed';
type ContextFactory = () => AudioContext;

/** The sole context owner. Game submits read-only frames; audio never steps it. */
export class AudioManager {
  private readonly preferences: AudioSettingsStorage;
  private readonly createContext: ContextFactory;
  private context?: AudioContext;
  private graph?: AudioGraph;
  private pending?: Promise<void>;
  private disposed = false;
  private foreground = true;
  private unavailable = false;
  private blocked = false;
  private generation = 0;
  private frame?: AudioFrame;
  readonly pressure = new AudioPressure();
  private variation = 0;
  private damagedHP = 3;
  private nextMalfunction = Infinity;
  private deathElapsed?: number;

  constructor(preferences = new AudioSettingsStorage(), createContext: ContextFactory = () => new AudioContext({ latencyHint: 'interactive' })) {
    this.preferences = preferences;
    this.createContext = createContext;
  }

  get settings(): Readonly<AudioSettings> { return this.preferences.settings; }

  get status(): AudioStatus {
    if (this.disposed) return 'disposed';
    if (this.unavailable) return 'unavailable';
    if (this.settings.muted) return 'muted';
    if (this.blocked) return 'blocked';
    if (!this.context) return 'locked';
    return this.context.state === 'running' && this.foreground && this.graph ? 'running' : 'suspended';
  }

  /** Must be called directly from a genuine Launch/Resume/settings gesture. */
  unlock(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.foreground = true;
    if (this.settings.muted) return Promise.resolve();
    if (this.pending) return this.pending;
    if (!this.context) {
      try { this.context = this.createContext(); }
      catch { this.unavailable = true; return Promise.resolve(); }
    }
    this.unavailable = false;
    const context = this.context, generation = this.generation;
    let resume: Promise<void>;
    try { resume = context.resume(); }
    catch { this.blocked = true; return Promise.resolve(); }
    const request = resume.then(() => {
      if (this.disposed || generation !== this.generation || !this.foreground) return;
      if (context.state !== 'running') { this.blocked = true; return; }
      try {
        this.graph ??= new AudioGraph(context, this.preferences.settings);
        this.blocked = false;
        this.graph.settings(this.preferences.settings);
        if (this.frame) this.update(this.frame);
      } catch {
        this.disable();
      }
    }).catch(() => { if (!this.disposed && generation === this.generation) this.blocked = true; }).finally(() => {
      if (this.pending === request) this.pending = undefined;
    });
    this.pending = request;
    return request;
  }

  setSettings(patch: Partial<AudioSettings>): void {
    this.preferences.save(normalizeSettings({ ...this.settings, ...patch }));
    if(this.settings.muted) this.clearFeedback();
    try { if (this.foreground) this.graph?.settings(this.preferences.settings); }
    catch { this.disable(); }
  }

  update(frame: AudioFrame, destruction?: AudioDestruction): void {
    if (this.disposed) return;
    this.frame = frame;
    const graph = this.graph;
    try {
      graph?.setState(frame.state);
      const pacing=this.pressure.update(frame.distance ?? 0,frame.field);
      graph?.setPacing(pacing);
      if(frame.state==='PLAYING' && (frame.elapsed ?? 0)>=this.nextMalfunction) {
        this.playCue({ variants:['crackle'],gain:this.damagedHP===1 ? .65 : .35,rate:[.97,1.03] });
        this.nextMalfunction=(frame.elapsed ?? 0)+(this.damagedHP===1 ? AUDIO.damage.criticalInterval : AUDIO.damage.damagedInterval);
      }
      // Thresholds belong to the already-running visual sequence. No timer,
      // scheduled fatal queue or independent elapsed clock exists in audio.
      if(destruction && this.deathElapsed!==undefined) {
        if(destruction.active) {
          const previous=this.deathElapsed, now=destruction.elapsed;
          if(previous<destruction.breakupAt && now>=destruction.breakupAt) this.play('rupture');
          for(const offset of POLISH.death.secondary) if(previous<destruction.breakupAt+offset && now>=destruction.breakupAt+offset) this.play('secondary');
          this.deathElapsed=now;
        } else this.deathElapsed=undefined; // Skip/results discard unplayed phases.
      }
      if (graph && this.status === 'running') graph.update(frame.speed, frame.ship.vx, frame.ship.vy);
    } catch { this.disable(); }
  }

  play(kind: Sound, delay = 0): void {
    try { if (this.status === 'running') this.graph?.play(kind, delay); }
    catch { this.disable(); }
  }

  /** Variation is presentation-only and supplied by the caller, never gameplay RNG.
   * Locked/muted requests are discarded immediately, without a deferred queue. */
  playCue(cue: SoundCue, variation?: number): void {
    const supplied=variation!==undefined;
    variation ??= (this.variation++ * .61803398875 + .23) % 1;
    const value = Number.isFinite(variation) ? Math.max(0, Math.min(1, variation)) : .5;
    const kind = cue.variants[Math.min(cue.variants.length - 1, Math.floor(value * cue.variants.length))];
    if (!kind) return;
    const rate = Math.max(.5, Math.min(2, cue.rate[0] + (cue.rate[1] - cue.rate[0]) * value));
    const gain = Math.max(0, Math.min(1, cue.gain)) * (supplied ? 1 : 1-.035*Math.sin(value*Math.PI));
    if (!Number.isFinite(rate) || !Number.isFinite(gain)) return;
    try { if (this.status === 'running') this.graph?.play(kind, 0, { rate, gain }); }
    catch { this.disable(); }
  }

  activate(kind: Sound = 'click'): void {
    const generation = this.generation, state = this.frame?.state;
    void this.unlock().then(() => {
      if (generation === this.generation && state === this.frame?.state) this.play(kind);
    });
  }

  resetRun(): void {
    this.generation++;
    this.pending = undefined;
    this.pressure.reset(); this.damagedHP=3; this.nextMalfunction=Infinity; this.deathElapsed=undefined;
    try { this.graph?.resetRun(); } catch { this.disable(); }
  }

  observe(event: GameEvent): void {
    if(event.type==='run.started') { this.pressure.reset(); this.damagedHP=3; this.nextMalfunction=Infinity; this.deathElapsed=undefined; }
    if(event.type==='player.damage' && event.payload.currentHP>0) {
      this.damagedHP=event.payload.currentHP;
      this.nextMalfunction=event.payload.elapsed+(this.damagedHP===1 ? AUDIO.damage.criticalInterval : AUDIO.damage.damagedInterval);
    }
    if(event.type==='player.destroyed') { this.nextMalfunction=Infinity; this.deathElapsed=0; }
  }

  clearFeedback(): void { try { this.graph?.clearVoices(); } catch { this.disable(); } }

  background(): void {
    this.foreground = false;
    this.generation++;
    this.pending = undefined;
    try {
      this.graph?.silence();
      if (this.context && this.context.state !== 'closed') void this.context.suspend().catch(() => {});
    } catch { this.disable(); }
  }

  private disable(): void {
    this.unavailable = true;
    this.generation++;
    this.pending = undefined;
    const graph = this.graph, context = this.context;
    this.graph = undefined;
    this.context = undefined;
    try { graph?.dispose(); } catch { /* Closing also releases a partial graph. */ }
    try { if (context && context.state !== 'closed') void context.close().catch(() => {}); } catch { /* Silent fallback. */ }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.pending = undefined;
    try { this.graph?.dispose(); } catch { /* Context close releases native nodes. */ }
    this.graph = undefined;
    this.frame = undefined;
    try { if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {}); } catch { /* Disposal cannot break game teardown. */ }
  }
}
