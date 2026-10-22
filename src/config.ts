export const CONFIG = {
  step: 1 / 120,
  maxFrameDelta: 0.1,
  bounds: { x: 6, y: 3.6 },
  ship: { radius: 0.42, maxSpeed: 8, acceleration: 32, braking: 25, hull: 3, invulnerability: 1.6 },
  flight: { initialSpeed: 20, maxSpeed: 34, rampSeconds: 120, warmupSeconds: 4 },
  hazards: { capacity: 72, spawnZ: -108, despawnZ: 8, maxRadius: 1.1 },
  waves: { firstSpacing: 66, minSpacing: 60, laneWidth: 4, safeHalfWidth: 1.5, capacity: 8, reactionSeconds: 0.45 },
  render: { maxPixelRatio: 1.75, mobilePixelRatio: 1.4, background: 0x050b19 },
} as const;

export function difficulty(seconds: number) {
  const progress = Math.min(1, Math.max(0, seconds / CONFIG.flight.rampSeconds));
  return {
    speed: CONFIG.flight.initialSpeed + (CONFIG.flight.maxSpeed - CONFIG.flight.initialSpeed) * progress,
    spacing: CONFIG.waves.firstSpacing + (CONFIG.waves.minSpacing - CONFIG.waves.firstSpacing) * progress,
    density: 0.52 + progress * 0.45,
    progress,
  };
}
