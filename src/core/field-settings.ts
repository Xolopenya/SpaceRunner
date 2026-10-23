/** Experimental B-1 settings. No production module imports this configuration. */
export const FIELD_LIMITS = Object.freeze({
  version: 'ambient-v1', cellSize: 24, minCells: 2, maxCells: 6,
  maxCandidates: 12, softActive: 24, hardActive: 32, allocatedProduction: 72,
  minRadius: 0.65, maxRadius: 1.1, maxSpin: 0.7,
  // Anchor keys must fit uint32; leave one neighboring anchor for ownership lookup.
  maxCell: 0xfffffffe,
} as const);

export interface FieldSettings {
  readonly halfX: number;
  readonly halfY: number;
  readonly depthJitter: number;
  readonly separation: number;
  readonly maxCandidates: number;
}

export const DEFAULT_FIELD_SETTINGS: Readonly<FieldSettings> = Object.freeze({
  halfX: 5.4, halfY: 3.15, depthJitter: 6, separation: 0.3, maxCandidates: 12,
});

export function fieldSettings(settings: Readonly<FieldSettings>): Readonly<FieldSettings> {
  if (!Number.isFinite(settings.halfX) || settings.halfX <= 0 || settings.halfX > 5.4
    || !Number.isFinite(settings.halfY) || settings.halfY <= 0 || settings.halfY > 3.15
    || !Number.isFinite(settings.depthJitter) || settings.depthJitter <= 0 || settings.depthJitter > 6
    || !Number.isFinite(settings.separation) || settings.separation < 0 || settings.separation > 0.3
    || !Number.isInteger(settings.maxCandidates) || settings.maxCandidates < 1 || settings.maxCandidates > FIELD_LIMITS.maxCandidates) {
    throw new RangeError('Invalid experimental field settings');
  }
  return Object.freeze({ halfX: settings.halfX, halfY: settings.halfY,
    depthJitter: settings.depthJitter, separation: settings.separation, maxCandidates: settings.maxCandidates });
}

/** Lossless identity, not a collision-prone hash. Changing settings changes IDs. */
export function fieldSettingsKey(settings: Readonly<FieldSettings>): string {
  return [settings.halfX, settings.halfY, settings.depthJitter, settings.separation, settings.maxCandidates].join(':');
}
