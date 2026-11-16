import { VISUALS } from '../visuals/settings.ts';
import { FRAGMENT } from '../collectibles/settings.ts';
import type { Sound } from '../audio/synthesis.ts';
import {SAMPLED_AUDIO} from '../audio/sample-settings.ts';

export interface SoundCue {
  readonly variants: readonly Sound[];
  readonly gain: number;
  readonly rate: readonly [number, number];
  readonly pan?:number;
}
export interface FeedbackPreset {
  readonly priority: 1 | 2 | 3;
  readonly contactSeconds: number;
  readonly duration: number;
  readonly recoverySeconds: number;
  readonly intensity: number;
  readonly flash: number;
  readonly camera: number;
  readonly sound: SoundCue;
}
const cue = (sound: Sound): SoundCue => ({ variants: [sound], gain: 1, rate: [1, 1] });
export const COLLISION_SOUNDS: readonly SoundCue[] = [
  {variants:['rock1','rock2','rock3'],gain:1,rate:[.975,1.025]},
  {variants:['metal1','metal2','metal3'],gain:.95,rate:[.98,1.02]},
  {variants:['station1','station2','station3'],gain:1,rate:[.98,1.02]},
  {variants:['mine1','mine2','mine3'],gain:1,rate:[.98,1.02]},
];
export const collisionSound = (kind: number,offsetX=0): SoundCue => {
  const cue=COLLISION_SOUNDS[kind===9 ? 3 : kind>=3 && kind<9 ? 2 : kind<2 ? 0 : 1]!;
  const limit=kind===9?SAMPLED_AUDIO.minePan:SAMPLED_AUDIO.hullPan;
  return offsetX?{...cue,pan:Math.max(-limit,Math.min(limit,offsetX*SAMPLED_AUDIO.panScale))}:cue;
};
export const FEEDBACK = {
  maxActiveReactions: 2,
  pickup: { priority: 1, contactSeconds: .06, duration: FRAGMENT.burstSeconds,
    recoverySeconds: .12, intensity: 1, flash: .85, camera: 0, sound: {variants:['pickup','pickup2','pickup3'],gain:1,rate:[.99,1.01]} },
  damage: { priority: 2, contactSeconds: .08, duration: VISUALS.impactSeconds,
    recoverySeconds: .18, intensity: 1, flash: .45, camera: .035, sound: cue('impact') },
  destroyed: { priority: 3, contactSeconds: .10, duration: VISUALS.impactSeconds,
    recoverySeconds: .20, intensity: 1.1, flash: .50, camera: .045, sound: cue('destruction') },
  gameOverDelay: .55,
  impact: { flashSeconds: .25, expansion: 6, velocityBias: .025 },
} as const satisfies { maxActiveReactions: number; pickup: FeedbackPreset; damage: FeedbackPreset;
  destroyed: FeedbackPreset; gameOverDelay: number; impact: { flashSeconds: number; expansion: number; velocityBias: number } };
