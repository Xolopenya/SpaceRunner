/** Explicit DEV experiment identity. The baseline director path is unchanged. */
export type FieldPolicy = 'baseline' | 'pressure';
export const FIELD_POLICIES = Object.freeze({
  baseline: Object.freeze({ name: 'baseline', version: 'director-v1' }),
  pressure: Object.freeze({ name: 'pressure', version: 'pressure-v1' }),
} as const);

export const PRESSURE_SETTINGS = Object.freeze({
  regularIntensity: .62, risingIntensity: .66, highIntensity: .74,
  progressionIntensity: .16, recoveryCells: 2, bootstrapCells: 3,
} as const);

export function fieldPolicy(value: string | null): FieldPolicy {
  if (value === null || value === 'baseline') return 'baseline';
  if (value === 'pressure') return 'pressure';
  throw new RangeError(`Unknown development field policy: ${value}`);
}
