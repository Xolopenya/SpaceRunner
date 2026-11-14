import type { Store } from '../services/storage.ts';

export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }

export const AUDIO = {
  key: 'space-runner.audio.v1',
  defaults: { master: 0.65, music: 0.35, sfx: 0.75, muted: false },
  headroom: 0.7,
  sampleRate: 22050,
  musicSampleRate: 11025,
  musicSeconds: 64,
  maxVoices: 6,
  voicePeak: 0.14,
  rampSeconds: 0.025,
  engine: { bassHz: 54, harmonicHz: 162.3, body: 0.105, harmonic: 0.024, rush: 0.085, updateSeconds: 0.04 },
  music: { fadeSeconds: .65, regular: [.90,.36,.08], rising: [.90,.72,.40], high: [.82,.88,.90], recovery: [1,.16,.02] },
  damage: { damagedInterval: 8.5, criticalInterval: 4.6 },
} as const;

export function normalizeSettings(value: unknown): AudioSettings {
  const data = value && typeof value === 'object' ? value as Partial<AudioSettings> : {};
  const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  return { master: volume(data.master, AUDIO.defaults.master), music: volume(data.music, AUDIO.defaults.music), sfx: volume(data.sfx, AUDIO.defaults.sfx), muted: typeof data.muted === 'boolean' ? data.muted : AUDIO.defaults.muted };
}

export function masterGain(settings: AudioSettings): number { return settings.muted ? 0 : settings.master * AUDIO.headroom; }

/** Preferences only; best scores and AudioContext state are independent. */
export class AudioSettingsStorage {
  settings: AudioSettings;
  private readonly storage: () => Store;

  constructor(storage: () => Store = () => window.localStorage) {
    this.storage = storage;
    let saved: unknown;
    try { saved = JSON.parse(storage().getItem(AUDIO.key) ?? 'null'); } catch { /* Silent session defaults. */ }
    this.settings = normalizeSettings(saved);
  }

  save(settings: AudioSettings): void {
    this.settings = normalizeSettings(settings);
    try { this.storage().setItem(AUDIO.key, JSON.stringify(this.settings)); } catch { /* Keep session preferences. */ }
  }
}
