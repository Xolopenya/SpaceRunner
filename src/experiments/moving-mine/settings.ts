/** DEV only. Ship dynamics, forward speed, reaction, margins and budgets are inherited. */
export const MINE = Object.freeze({ version: 'moving-mine-v1', geometry: 'moving-mine-geometry-v1',
  motion: 'linear-crossing-v1', profile: 'moving-mine-sphere-v1', kind: 9, visualVariant: 11,
  radius: 1.35, startX: 6, slow: 1.5, moderate: 2, cellCount: 6, offset: 84,
  minimumOrdinary: 2, maximumOrdinary: 4, chance: .5,
} as const);
export const MINE_CONFIGURATIONS = Object.freeze(['slow-ltr', 'slow-rtl', 'moderate-ltr', 'moderate-rtl'] as const);
export type MineConfiguration = typeof MINE_CONFIGURATIONS[number];
export function mineConfiguration(value: string | null): MineConfiguration | undefined {
  if (value === null) return undefined;
  if (MINE_CONFIGURATIONS.includes(value as MineConfiguration)) return value as MineConfiguration;
  throw new RangeError('Unknown mine configuration');
}
