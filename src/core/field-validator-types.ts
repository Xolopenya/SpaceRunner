import type { FieldValidationContext, FieldTransaction, PlannedHazard, StructuralResult } from './field-types.ts';
import type { FlightPrediction, FlightState } from './field-prediction.ts';

export const VALIDATION_LIMITS = Object.freeze({
  version: 'trajectory-v1', step: 1 / 120, macroTicks: 24, reactionTicks: 54,
  horizonTicks: 1800, beamWidth: 16, positionBin: .25, velocityBin: .5, representatives: 2,
  margin: .15, terminalTail: 16, propagationsPerTick: 4096, queriesPerTick: 8192,
  deadlineTicks: 144, maxHazards: 32, maxSearches: 2, maxReplays: 4,
  goalColumns: 7, goalRows: 5, goalDepthSpan: 4, goalClearance: .1,
  brakingTicks: 39, // ceil((8/25)/(1/120)); actual neutral Ship steps, never a velocity reset
  defaultPropagationsPerTick: 3072, defaultQueriesPerTick: 6144, // hard ceilings remain4096/8192
} as const);

export interface ValidationOptions {
  readonly margin?: number;
  /** Deliberately overlapping R fixtures ONLY. Normal API always uses B-1 inspection. */
  readonly structuralPolicy?: 'generator' | 'synthetic-fixture';
  /** Explicit, versioned DEV geometry; omitted preserves trajectory-v1 byte identities. */
  readonly geometry?: ValidationGeometry;
}
export interface ValidationGeometry {
  readonly version: string;
  validHazard(hazard: PlannedHazard): boolean;
  inspect(candidate: FieldTransaction, committed: readonly PlannedHazard[]): StructuralResult;
  queryCost(hazard: PlannedHazard): number;
  /** Conservative axial half-extent of the actual static profile. */
  axialExtent(hazard: PlannedHazard): number;
  prediction(): FlightPrediction;
  goals(hazard: PlannedHazard): readonly { x: number; y: number }[];
}
export interface ControlRun { readonly ticks: number; readonly input: { readonly x: number; readonly y: number } }
export interface ValidationWitness {
  readonly version: string;
  readonly geometryVersion?: string;
  readonly context: FieldValidationContext;
  readonly margin: number;
  readonly structuralPolicy: 'generator' | 'synthetic-fixture';
  readonly reservedUntilDistance: number;
  readonly controls: readonly ControlRun[];
  readonly terminal: Readonly<FlightState>;
  readonly hash: string;
}
export type ValidationFailure = 'STRUCTURAL_INVALID' | 'COLLISION_FOUND' | 'NO_WITNESS_FOUND'
  | 'INSUFFICIENT_REACTION_DISTANCE' | 'HORIZON_EXCEEDED' | 'COMPUTATION_BUDGET_EXCEEDED'
  | 'STALE_PUBLICATION_STATE' | 'UNKNOWN_PROFILE' | 'EXISTING_FIELD_UNCERTIFIED'
  | 'INVALID_TERMINAL_STATE' | 'REPLAY_DISAGREEMENT';
export interface ValidationMetrics {
  propagations: number; narrowQueries: number; broadPhaseSkips: number; clockSteps: number;
  searchPropagations: number; replayPropagations: number; replayQueries: number;
  peakFrontier: number; peakExpansion: number; searches: number; replays: number; planningTicks: number;
}
export type TrajectoryResult =
  | { readonly decision: 'accept'; readonly witness: ValidationWitness }
  | { readonly decision: 'reject'; readonly reason: ValidationFailure; readonly detail?: string };
export interface ValidationBudget { readonly propagations: number; readonly narrowQueries: number }
