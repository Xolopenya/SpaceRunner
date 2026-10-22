import { AUDIO } from './settings.ts';

export type Sound = 'launch' | 'resume' | 'pause' | 'click' | 'impact' | 'destruction' | 'gameOver';
export const SOUNDS: readonly Sound[] = ['launch', 'resume', 'pause', 'click', 'impact', 'destruction', 'gameOver'];
const TAU = Math.PI * 2;
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Original deterministic synthesis. Never touches the game's random source. */
export function noise(seconds = 2, sampleRate: number = AUDIO.sampleRate): Float32Array {
  const output = new Float32Array(Math.ceil(seconds * sampleRate));
  let seed = 71883, previous = 0;
  for (let i = 0; i < output.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    previous = previous * 0.88 + (seed / 2147483648 - 1) * 0.12;
    const edge = Math.min(1, i / (sampleRate * 0.01), (output.length - 1 - i) / (sampleRate * 0.01));
    output[i] = previous * edge;
  }
  return output;
}

export function soundSamples(kind: Sound, sampleRate: number = AUDIO.sampleRate): Float32Array {
  const seconds = kind === 'destruction' ? 1.3 : kind === 'impact' ? 0.55 : kind === 'gameOver' ? 0.9 : 0.18;
  const output = new Float32Array(Math.ceil(seconds * sampleRate));
  let seed = 92347, low = 0;
  for (let i = 0; i < output.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    low = low * 0.8 + white * 0.2;
    const attack = Math.min(1, t / 0.004);
    let value = 0;
    if (kind === 'impact' || kind === 'destruction') {
      const final = kind === 'destruction';
      const decay = Math.exp(-t * (final ? 4.5 : 12));
      const body = Math.sin(TAU * ((final ? 76 : 112) * t - (final ? 19 : 70) * t * t));
      const metal = Math.sin(TAU * 327 * t) * Math.sin(TAU * 419 * t) * Math.exp(-t * 23);
      // A delayed, quiet two-partial shield resonance belongs to this one hit.
      const shield = final ? 0 : (Math.sin(TAU * 440 * t) + Math.sin(TAU * 660 * t)) * (1 - Math.exp(-t * 24)) * Math.exp(-t * 9) * 0.013;
      value = attack * (body * (final ? 0.23 : 0.17) * decay + low * 0.24 * decay + metal * 0.027 + shield);
    } else if (kind === 'gameOver') {
      for (let note = 0; note < 3; note++) {
        const age = t - note * 0.19;
        if (age >= 0) value += Math.sin(TAU * frequency([62, 57, 50][note]!) * age) * Math.min(1, age / 0.018) * Math.exp(-age * 8) * 0.055;
      }
    } else if (kind === 'click') value = attack * (low * 0.11 + Math.sin(TAU * 310 * t) * 0.018) * Math.exp(-t * 42);
    else {
      const upward = kind !== 'pause';
      const base = kind === 'launch' ? 294 : 330;
      const phase = TAU * (base * t + (upward ? 650 : -420) * t * t);
      value = attack * (Math.sin(phase) * 0.045 + Math.sin(phase * 1.5) * 0.018 + low * 0.02) * Math.exp(-t * 21);
    }
    output[i] = value * Math.min(1, (output.length - 1 - i) / (sampleRate * 0.025));
  }
  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  // Six simultaneous voices plus continuous layers retain explicit headroom.
  if (peak > AUDIO.voicePeak) for (let i = 0; i < output.length; i++) output[i]! *= AUDIO.voicePeak / peak;
  return output;
}

/** Dm9 → Bbmaj7 → Fmaj7 → Cadd9. Crossfaded voicings, no random melody. */
export function musicSamples(sampleRate: number = AUDIO.sampleRate): [Float32Array, Float32Array] {
  const length = Math.round(AUDIO.musicSeconds * sampleRate);
  const left = new Float32Array(length), right = new Float32Array(length);
  const chords = [[50, 57, 60, 64], [46, 53, 57, 62], [41, 48, 52, 57], [48, 55, 60, 62]];
  for (let chord = 0; chord < chords.length; chord++) {
    const notes = chords[chord]!;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const age = (t - chord * 4 + AUDIO.musicSeconds) % AUDIO.musicSeconds;
      if (age >= 4.8) continue;
      const envelope = Math.min(1, age / 0.8) * Math.min(1, (4.8 - age) / 0.8);
      let l = 0, r = 0;
      for (let voice = 0; voice < notes.length; voice++) {
        const hz = frequency(notes[voice]!);
        const level = voice === 0 ? 0.025 : 0.017;
        l += Math.sin(TAU * hz * 0.9993 * age) * level;
        r += Math.sin(TAU * hz * 1.0007 * age) * level;
      }
      const beat = age % 1;
      const accent = Math.sin(TAU * frequency(notes[Math.floor(age) % 4]! + 12) * beat) * Math.min(1, beat / 0.03) * Math.exp(-beat * 9) * 0.010;
      left[i]! += (l + accent) * envelope * AUDIO.musicAmplitude;
      right[i]! += (r + accent * 0.65) * envelope * AUDIO.musicAmplitude;
    }
  }
  return [left, right];
}

export function audioBuffer(context: BaseAudioContext, channels: readonly Float32Array[]): AudioBuffer {
  const buffer = context.createBuffer(channels.length, channels[0]!.length, AUDIO.sampleRate);
  channels.forEach((data, index) => { buffer.getChannelData(index).set(data); });
  return buffer;
}
