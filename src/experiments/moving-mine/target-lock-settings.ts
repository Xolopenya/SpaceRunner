/** DEV only. Geometry, ship physics and planning budgets are inherited verbatim. */
export const TARGET_LOCK = Object.freeze({ version: 'target-lock-v1', geometry: 'target-lock-geometry-v1',
  acquisitionTicks: 96, attackSpeed: 4, minimumWarningTicks: 120, minimumTravel: 2,
  speeds: Object.freeze([3,4,5]), warningTicks: Object.freeze([96,120,144]),
} as const);
export interface TargetLockTuning { readonly attackSpeed: number; readonly minimumWarningTicks: number }
export const DEFAULT_TARGET_TUNING: Readonly<TargetLockTuning> = Object.freeze({ attackSpeed: TARGET_LOCK.attackSpeed, minimumWarningTicks: TARGET_LOCK.minimumWarningTicks });
