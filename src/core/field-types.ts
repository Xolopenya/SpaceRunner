export type FieldProfile = 'sphere-v1' | 'half-meteor-v1' | 'barrel-v1' | 'generator-v1';

export interface FieldProvenance {
  readonly version: string;
  readonly seed: number;
  readonly settingsKey: string;
}

/** Logical data only. z at time t is currentDistance - passDistance. */
export interface PlannedHazard {
  readonly id: string;
  readonly ownerCell: number;
  readonly localIndex: number;
  readonly anchorCell: number;
  readonly passDistance: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly kind: number;
  readonly visualVariant: number;
  readonly collisionProfile: FieldProfile;
  readonly spin: number;
  readonly phase: number;
  /** Pose uses the existing hazardOrientation at absolute simulation time. */
  readonly orientation: 'euler-xyz-v1';
  readonly provenance: Readonly<FieldProvenance>;
}

export interface FieldTransaction {
  readonly firstCell: number;
  readonly cellCount: number;
  readonly startDistance: number;
  readonly endDistance: number;
  readonly provenance: Readonly<FieldProvenance>;
  readonly hazards: readonly PlannedHazard[];
}

export type StructuralReason = 'transaction' | 'capacity' | 'provenance' | 'metadata' | 'bounds' | 'ownership' | 'duplicate' | 'separation';
export type StructuralResult =
  | { readonly status: 'valid'; readonly candidateCount: number; readonly totalCount: number; readonly aboveSoftLimit: boolean }
  | { readonly status: 'invalid'; readonly reason: StructuralReason };

/** B-2 contract only. No implementation, scheduling or invocation in B-1. */
export interface FieldValidationContext {
  readonly player: { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number };
  readonly input: { readonly x: number; readonly y: number };
  readonly elapsed: number;
  readonly distance: number;
  readonly committed: readonly PlannedHazard[];
  readonly candidate: FieldTransaction;
}

export type FieldValidationDecision =
  | { readonly decision: 'accept' }
  | { readonly decision: 'reject'; readonly reason: string };

export interface FieldValidator {
  validate(context: FieldValidationContext): FieldValidationDecision;
}
