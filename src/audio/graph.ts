import { AUDIO, masterGain } from './settings.ts';
import type { AudioSettings } from './settings.ts';
import { audioBuffer, musicSamples, noise, SOUNDS, soundSamples } from './synthesis.ts';
import type { Sound } from './synthesis.ts';

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
    this.filter.frequency.value = 350;
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
    smooth(this.harmonic.frequency, AUDIO.engine.harmonicHz + forward * 12 + steering * 5, at, 0.12);
    smooth(this.filter.frequency, 280 + forward * 280 + steering * 220, at, 0.10);
    smooth(this.rushGain.gain, AUDIO.engine.rush * (0.8 + forward * 0.25 + steering * 0.5), at, 0.10);
  }

  dispose(): void {
    this.bass.stop(); this.harmonic.stop(); this.rush.stop();
    for (const node of this.nodes) node.disconnect();
    this.rush.buffer = null;
  }
}

interface Voice { source: AudioBufferSourceNode; critical: boolean }

/** Native graph also used unchanged by OfflineAudioContext review captures. */
export class AudioGraph {
  readonly master: GainNode;
  readonly musicBus: GainNode;
  readonly sfxBus: GainNode;
  readonly engine: EngineAudio;
  readonly counts: Record<Sound, number> = { launch: 0, resume: 0, pause: 0, click: 0, impact: 0, destruction: 0, gameOver: 0 };
  readonly voices = new Set<Voice>();
  private readonly context: BaseAudioContext;
  private readonly buffers = new Map<Sound, AudioBuffer>();
  private readonly music: AudioBufferSourceNode;
  private readonly musicFilter: BiquadFilterNode;
  private readonly musicLevel: GainNode;
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
    this.music = context.createBufferSource();
    this.music.buffer = audioBuffer(context, musicSamples());
    this.music.loop = true;
    this.musicFilter = context.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 650;
    this.musicFilter.Q.value = 0.4;
    this.musicLevel = context.createGain();
    this.musicLevel.gain.value = 0;
    this.music.connect(this.musicFilter).connect(this.musicLevel).connect(this.musicBus);
    this.music.start();
    for (const kind of SOUNDS) this.buffers.set(kind, audioBuffer(context, [soundSamples(kind)]));
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
    smooth(this.musicLevel.gain, state === 'PLAYING' ? 0.85 : state === 'MENU' ? 0.5 : state === 'GAME_OVER' ? 0.32 : 0, at, 0.16);
    smooth(this.musicFilter.frequency, state === 'PLAYING' ? 1600 : 650, at, 0.3);
  }

  update(speed: number, vx: number, vy: number): void {
    if (this.state === 'PLAYING') this.engine.update(speed, vx, vy, this.context.currentTime);
  }

  play(kind: Sound, delay = 0): void {
    if (this.disposed) return;
    const critical = kind === 'destruction' || kind === 'gameOver';
    if (this.voices.size >= AUDIO.maxVoices) {
      const oldest = [...this.voices].find(voice => !voice.critical);
      if (!oldest) return;
      this.release(oldest, true);
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(kind)!;
    source.connect(this.sfxBus);
    const voice = { source, critical };
    this.voices.add(voice);
    this.counts[kind]++;
    source.onended = () => this.release(voice, false);
    source.start(this.context.currentTime + Math.max(0, delay));
  }

  private release(voice: Voice, stop: boolean): void {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop) voice.source.stop();
    voice.source.disconnect();
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
    this.music.stop();
    this.music.buffer = null;
    for (const node of [this.music, this.musicFilter, this.musicLevel, this.musicBus, this.sfxBus, this.master]) node.disconnect();
    this.buffers.clear();
  }
}
