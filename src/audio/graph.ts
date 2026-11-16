import { AUDIO, masterGain } from './settings.ts';
import type { AudioSettings } from './settings.ts';
import { audioBuffer, noise, SOUNDS, soundSamples } from './synthesis.ts';
import type { Sound } from './synthesis.ts';
import { AdaptiveScore } from './score.ts';
import type { PacingState } from '../core/field-director.ts';
import { CollisionSamples } from './samples.ts';
import {SAMPLED_AUDIO} from './sample-settings.ts';

export function smooth(parameter: AudioParam, target: number, at: number, seconds: number = AUDIO.rampSeconds): void {
  parameter.cancelScheduledValues(at);
  parameter.setTargetAtTime(target, at, seconds);
}

class EngineAudio {
  readonly output: GainNode;
  private readonly bass: OscillatorNode;
  private readonly harmonic: OscillatorNode;
  private readonly rush: AudioBufferSourceNode;
  private readonly filter: BiquadFilterNode;
  private readonly rushGain: GainNode;
  private readonly nodes: AudioNode[];
  private lastUpdate = -1;

  constructor(context: BaseAudioContext, destination: AudioNode) {
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);
    this.bass = context.createOscillator();
    this.bass.type = 'sine';
    this.bass.frequency.value = AUDIO.engine.bassHz;
    const bassLevel = context.createGain();
    bassLevel.gain.value = AUDIO.engine.body;
    this.bass.connect(bassLevel).connect(this.output);
    this.harmonic = context.createOscillator();
    this.harmonic.type = 'triangle';
    this.harmonic.frequency.value = AUDIO.engine.harmonicHz;
    const harmonicLevel = context.createGain();
    harmonicLevel.gain.value = AUDIO.engine.harmonic;
    this.harmonic.connect(harmonicLevel).connect(this.output);
    this.rush = context.createBufferSource();
    this.rush.buffer = audioBuffer(context, [noise()]);
    this.rush.loop = true;
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 650;
    this.filter.Q.value = 0.5;
    this.rushGain = context.createGain();
    this.rushGain.gain.value = AUDIO.engine.rush;
    this.rush.connect(this.filter).connect(this.rushGain).connect(this.output);
    this.nodes = [this.output, this.bass, this.harmonic, this.rush, this.filter, this.rushGain, bassLevel, harmonicLevel];
    this.bass.start(); this.harmonic.start(); this.rush.start();
  }

  update(speed: number, vx: number, vy: number, at: number): void {
    if (at - this.lastUpdate < AUDIO.engine.updateSeconds) return;
    this.lastUpdate = at;
    const forward = Math.min(1, Math.max(0, (speed - 20) / 14));
    const steering = Math.min(1, Math.hypot(vx, vy) / 8);
    smooth(this.bass.frequency, AUDIO.engine.bassHz + forward * 8 + steering * 3, at, 0.12);
    smooth(this.harmonic.frequency, AUDIO.engine.harmonicHz + forward * 32 + steering * 19, at, 0.12);
    smooth(this.filter.frequency, 600 + forward * 600 + steering * 700, at, 0.10);
    smooth(this.rushGain.gain, AUDIO.engine.rush * (0.65 + forward * 0.35 + steering * 0.55), at, 0.10);
  }

  dispose(): void {
    this.bass.stop(); this.harmonic.stop(); this.rush.stop();
    for (const node of this.nodes) node.disconnect();
    this.rush.buffer = null;
  }
}

interface Voice { source: AudioBufferSourceNode; priority: number; gain?: GainNode; panner?:StereoPannerNode }
const priority = (kind: Sound): number => kind === 'destruction' || kind === 'rupture' || kind === 'secondary' || kind === 'gameOver' ? 3
  : /^(impact|rock|metal|station|mine)/.test(kind) ? 2 : kind.startsWith('pickup') ? 1 : 0;

/** Native graph also used unchanged by OfflineAudioContext review captures. */
export class AudioGraph {
  readonly master: GainNode;
  readonly musicBus: GainNode;
  readonly sfxBus: GainNode;
  readonly engine: EngineAudio;
  readonly counts = Object.fromEntries(SOUNDS.map(kind=>[kind,0])) as Record<Sound,number>;
  readonly voices = new Set<Voice>();
  private readonly context: BaseAudioContext;
  private readonly buffers = new Map<Sound, AudioBuffer>();
  readonly music: AudioBufferSourceNode;
  readonly musicFilter: BiquadFilterNode;
  readonly musicLevel: GainNode;
  readonly score: AdaptiveScore;
  readonly samples:CollisionSamples;
  private state = 'LOADING';
  private disposed = false;

  constructor(context: BaseAudioContext, settings: AudioSettings) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.musicBus = context.createGain();
    this.sfxBus = context.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(context.destination);
    this.engine = new EngineAudio(context, this.sfxBus);
    this.score = new AdaptiveScore(context,this.musicBus);
    this.music = this.score.sources[0]!;
    this.musicFilter = this.score.filter;
    this.musicLevel = this.score.level;
    for (const kind of SOUNDS) this.buffers.set(kind, audioBuffer(context, [soundSamples(kind)]));
    this.samples=new CollisionSamples(context,this.buffers);
    this.settings(settings);
  }

  settings(settings: AudioSettings, at = this.context.currentTime): void {
    smooth(this.master.gain, masterGain(settings), at);
    smooth(this.musicBus.gain, settings.music, at);
    smooth(this.sfxBus.gain, settings.sfx, at);
  }

  setState(state: string, at = this.context.currentTime): void {
    if (this.disposed || this.state === state) return;
    this.state = state;
    if (state === 'PAUSED') this.clearVoices();
    smooth(this.engine.output.gain, state === 'PLAYING' ? 0.9 : 0, at, state === 'GAME_OVER' ? 0.15 : 0.04);
    this.score.setState(state,at);
  }

  setPacing(pacing: PacingState, at = this.context.currentTime): void { this.score.setPacing(pacing,at); }
  resetRun(): void { this.clearVoices(); this.score.reset(this.context.currentTime); }

  update(speed: number, vx: number, vy: number): void {
    if (this.state === 'PLAYING') this.engine.update(speed, vx, vy, this.context.currentTime);
  }

  play(kind: Sound, delay = 0, options?: { readonly rate: number; readonly gain: number; readonly pan?:number }): void {
    if (this.disposed) return;
    const rank = priority(kind);
    if (this.voices.size >= AUDIO.maxVoices) {
      const oldest = [...this.voices].find(voice => voice.priority < 3 && voice.priority <= rank);
      if (!oldest) return;
      this.release(oldest, true);
    }
    const source = this.context.createBufferSource();
    source.buffer = this.samples.get(kind)??this.buffers.get(kind)!;
    if (options) source.playbackRate.value = options.rate;
    const gain = options && options.gain !== 1 ? this.context.createGain() : undefined;
    const panner=options?.pan&&typeof this.context.createStereoPanner==='function'?this.context.createStereoPanner():undefined;
    if(panner)panner.pan.value=Math.max(-SAMPLED_AUDIO.minePan,Math.min(SAMPLED_AUDIO.minePan,options!.pan!));
    const destination=panner??this.sfxBus;if(panner)panner.connect(this.sfxBus);
    if (gain) { gain.gain.value = options!.gain; source.connect(gain).connect(destination); }
    else source.connect(destination);
    const voice = { source, priority: rank, gain, panner };
    this.voices.add(voice);
    this.counts[kind]++;
    // Retain the established diagnostic counters as family totals.
    if(rank===2 && kind!=='impact') this.counts.impact++;
    if(kind==='pickup2' || kind==='pickup3') this.counts.pickup++;
    if(rank>=2 && kind!=='gameOver') this.score.duckFor(rank===3,this.context.currentTime+Math.max(0,delay));
    source.onended = () => this.release(voice, false);
    source.start(this.context.currentTime + Math.max(0, delay));
  }

  private release(voice: Voice, stop: boolean): void {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect();
    voice.gain?.disconnect();
    voice.panner?.disconnect();
    voice.source.buffer = null;
  }

  clearVoices(): void { for (const voice of this.voices) this.release(voice, true); }

  silence(): void {
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.value = 0;
    this.clearVoices();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearVoices();
    this.engine.dispose();
    this.score.dispose();
    this.samples.dispose();
    for (const node of [this.musicBus, this.sfxBus, this.master]) node.disconnect();
    this.buffers.clear();
  }
}
