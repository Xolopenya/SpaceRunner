/** DEV only. Ship dynamics, forward speed, reaction, margins and budgets are inherited. */
export const MINE = Object.freeze({ version: 'moving-mine-v1', geometry: 'moving-mine-geometry-v1',
  motion: 'linear-crossing-v1', profile: 'moving-mine-sphere-v1', kind: 9, visualVariant: 11,
  radius: 1.35, startX: 6, slow: 1.5, moderate: 2, cellCount: 6, offset: 84,
  minimumOrdinary: 2, maximumOrdinary: 4, chance: .5,
} as const);
export const MINE_CONFIGURATIONS = Object.freeze(['slow-ltr', 'slow-rtl', 'moderate-ltr', 'moderate-rtl'] as const);
export const FAST_CONFIGURATIONS = Object.freeze(['fast-ltr', 'fast-rtl'] as const);
export const DIAGONAL_CONFIGURATIONS = Object.freeze(['diagonal-ltr-up', 'diagonal-ltr-down', 'diagonal-rtl-up', 'diagonal-rtl-down'] as const);
export const MOTION_POLICIES = Object.freeze(['baseline', 'fast', 'diagonal'] as const);
export type MineMotionPolicy = typeof MOTION_POLICIES[number];
export type MineConfiguration = typeof MINE_CONFIGURATIONS[number] | typeof FAST_CONFIGURATIONS[number] | typeof DIAGONAL_CONFIGURATIONS[number];
export const ALL_MINE_CONFIGURATIONS = Object.freeze([...MINE_CONFIGURATIONS, ...FAST_CONFIGURATIONS, ...DIAGONAL_CONFIGURATIONS]);
export function motionPolicy(value: string | null): MineMotionPolicy {
  if (value === null) return 'baseline';
  if (MOTION_POLICIES.includes(value as MineMotionPolicy)) return value as MineMotionPolicy;
  throw new RangeError('Unknown mine motion policy');
}
export function configurations(policy: MineMotionPolicy): readonly MineConfiguration[] {
  switch (policy) { case 'baseline': return MINE_CONFIGURATIONS; case 'fast': return FAST_CONFIGURATIONS; case 'diagonal': return DIAGONAL_CONFIGURATIONS; }
}
/** No ship-dependent targeting. Every path crosses the geometric field center. */
export function motionVector(configuration: MineConfiguration): Readonly<{ x: number; y: number }> {
  if (!ALL_MINE_CONFIGURATIONS.includes(configuration)) throw new RangeError('Unknown mine configuration');
  const speed = configuration.startsWith('slow') ? MINE.slow : configuration.startsWith('moderate') ? MINE.moderate : configuration.startsWith('fast') ? 3.5 : 3;
  return { x: configuration.includes('ltr') ? speed : -speed,
    y: configuration.startsWith('diagonal') ? (configuration.endsWith('up') ? 1.5 : -1.5) : 0 };
}
export function mineConfiguration(value: string | null): MineConfiguration | undefined {
  if (value === null) return undefined;
  if (ALL_MINE_CONFIGURATIONS.includes(value as MineConfiguration)) return value as MineConfiguration;
  throw new RangeError('Unknown mine configuration');
}
