/** Cosmetic-only tuning. Never imported by gameplay, RNG or collision acceptance. */
export const DAMAGE_FX = {
  bursts: 3, fragments: 12, mobileFragments: 6, particles: 64, mobileParticles: 28,
  reducedParticles: 12, drag: 1.3, particleDrag: 2.4,
  rock: { seconds: 1.1, speed: 3.4, size: .36, color: 0x8a8178, light: 0xa69a86 },
  metal: { seconds: .85, speed: 4.0, size: .25, color: 0x718699, light: 0xffc782 },
  station: { seconds: .8, speed: 4.4, size: .17, color: 0x8293a0, light: 0xffd5a2 },
  mine: { seconds: 1.2, speed: 4.1, size: .18, color: 0x4bcde9, light: 0x9af5ff },
  shockwaveRadius: 3.4, flashSeconds: .14, sparkSeconds: .46,
  hull: { zoneRadius: .46, soot: .92, crack: 1.65, leaks: 12, mobileLeaks: 6 },
  death: { seconds: 2.05, reducedSeconds: .65, failure: .15, breakup: .50,
    reducedBreakup: .12, aftermath: 1.1, drift: 2.7, reducedDrift: .65, drag: .7,
    shockwaveRadius: 4.2, particles: 96, mobileParticles: 40, smallFragments: 12, mobileSmallFragments: 6 },
} as const;
