/** Rendering-only tuning. Never read by movement, collision or the spawner. */
export const VISUALS = {
  seed: 23987,
  stars: [780, 280, 64],
  mobileStars: [420, 140, 24],
  starMotion: [0.08, 0.36, 1.15],
  streaks: 28,
  mobileStreaks: 10,
  trailSamples: 24,
  trailStep: 1 / 90,
  impactParticles: 48,
  mobileImpactParticles: 24,
  impactSeconds: 0.55,
} as const;

export interface VisualQuality {
  mobile: boolean;
  reducedMotion: boolean;
  stars: readonly number[];
  streaks: number;
  impactParticles: number;
}

export function visualQuality(width: number, height: number, coarse: boolean, reducedMotion: boolean): VisualQuality {
  const mobile = coarse || Math.min(width, height) < 600;
  return {
    mobile, reducedMotion,
    stars: mobile ? VISUALS.mobileStars : VISUALS.stars,
    streaks: reducedMotion ? 0 : mobile ? VISUALS.mobileStreaks : VISUALS.streaks,
    impactParticles: reducedMotion ? 12 : mobile ? VISUALS.mobileImpactParticles : VISUALS.impactParticles,
  };
}

export function visualDelta(state: string, dt: number, finishImpact = false): number {
  return state === 'PLAYING' || (finishImpact && state === 'GAME_OVER')
    ? Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0)) : 0;
}
