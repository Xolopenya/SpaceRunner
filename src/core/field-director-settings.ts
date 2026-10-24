import { VALIDATION_LIMITS } from './field-validator-types.ts';

/** Isolated B-4 policy. Never imported by the playable game. */
export const DIRECTOR_SETTINGS = Object.freeze({
  version: 'director-v1', firstCell: 6, progressionDistance: 6000, policyPrecision: 1e12,
  minIntensity: .05, maxIntensity: .92, patternChanceStart: .25, patternChanceEnd: .65,
  planningLead: 128, publicationTicks: VALIDATION_LIMITS.deadlineTicks,
  maxOwnershipRecords: 16, maxAttempts: 2,
  coverageInset: .03,
} as const);
