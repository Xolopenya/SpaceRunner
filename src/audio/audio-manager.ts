import { AudioGraph } from './graph.ts';
import { AudioSettingsStorage, normalizeSettings } from './settings.ts';
import type { AudioSettings } from './settings.ts';
import type { Sound } from './synthesis.ts';
import type { GameState } from '../core/game-model.ts';

export interface AudioFrame {
  readonly state: GameState; readonly speed: number;
  readonly ship: { readonly vx: number; readonly vy: number };
  readonly hitSerial: number; readonly hull: number;
}
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
  private serial = 0;
  private frame?: AudioFrame;

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
        if (this.frame) { this.graph.setState(this.frame.state); this.graph.update(this.frame.speed, this.frame.ship.vx, this.frame.ship.vy); }
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
    try { if (this.foreground) this.graph?.settings(this.preferences.settings); }
    catch { this.disable(); }
  }

  update(frame: AudioFrame): void {
    if (this.disposed) return;
    this.frame = frame;
    const hit = frame.hitSerial > this.serial;
    const restart = frame.hitSerial < this.serial;
    this.serial = frame.hitSerial; // Consume while locked/muted; never replay stale hits.
    const graph = this.graph;
    try {
      if (restart) graph?.clearVoices();
      graph?.setState(frame.state);
      if (!graph || this.status !== 'running') return;
      graph.update(frame.speed, frame.ship.vx, frame.ship.vy);
      if (hit) {
        if (frame.hull <= 0) { graph.play('destruction'); graph.play('gameOver', 0.55); }
        else graph.play('impact');
      }
    } catch { this.disable(); }
  }

  play(kind: Sound): void {
    try { if (this.status === 'running') this.graph?.play(kind); }
    catch { this.disable(); }
  }

  activate(kind: Sound = 'click'): void {
    const generation = this.generation, state = this.frame?.state;
    void this.unlock().then(() => {
      if (generation === this.generation && state === this.frame?.state) this.play(kind);
    });
  }

  resetRun(): void {
    this.serial = 0;
    try { this.graph?.clearVoices(); } catch { this.disable(); }
  }

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
