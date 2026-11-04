export type FieldProfile = 'sphere-v1' | 'half-meteor-v1' | 'barrel-v1' | 'generator-v1' | 'bulkhead-compound-v1' | 'wreck-frame-compound-v2' | 'moving-mine-sphere-v1';

/** DEV linear XY motion. Depth remains passDistance; phases use absolute120Hz ticks. */
export interface LinearCrossingMotion {
  readonly version: 'linear-crossing-v1';
  readonly startTick: number;
  readonly durationTicks: number;
  readonly velocityX: number;
  /** Omitted by the original horizontal records, preserving their exact identity. */
  readonly velocityY?: number;
}

/** Observed, not forecast. Copied at the synchronous publication event. */
export interface TargetCapture {
  readonly tick: number; readonly elapsed: number; readonly distance: number;
  readonly x: number; readonly y: number; readonly vx: number; readonly vy: number;
  readonly inputX: number; readonly inputY: number;
}
export interface TargetLockMotion {
  readonly version: 'target-lock-v1';
  readonly startTick: number; readonly durationTicks: number;
  readonly velocityX: number; readonly velocityY: number;
  readonly acquisitionStartTick: number; readonly passTick: number;
  readonly minimumWarningTicks: number; readonly attackSpeed: number;
  readonly targetX: number; readonly targetY: number;
  readonly originChoice: 0 | 1;
  readonly capture: Readonly<TargetCapture>;
}
/** Feedback controller metadata is immutable; its future pose is NOT stored here. */
export interface AdaptiveHomingMotion {
  readonly release?: true;
  readonly version: 'adaptive-homing-v1';
  readonly startTick: number; readonly durationTicks: number;
  readonly velocityX: number; readonly velocityY: number;
  readonly warningTick: number; readonly passTick: number;
  readonly maxSpeed: number; readonly maxAcceleration: number; readonly responsiveness: number;
  readonly preset: 'soft' | 'balanced' | 'aggressive';
  readonly capture: Readonly<TargetCapture>;
}
export interface AdaptiveMineState {
  readonly id: string; readonly tick: number;
  readonly x: number; readonly y: number; readonly vx: number; readonly vy: number;
  readonly ax: number; readonly ay: number; readonly targetX: number; readonly targetY: number;
  readonly phase: 'waiting' | 'warning' | 'pursuit' | 'coast';
}
export type HazardMotion = LinearCrossingMotion | TargetLockMotion | AdaptiveHomingMotion;

export type PatternFamily = 'scattered' | 'narrowing' | 'alternating' | 'vertical-weave';
export interface PatternSource {
  readonly family: PatternFamily;
  readonly firstCell: number;
  readonly cellCount: number;
  readonly variation: number;
  readonly intensity: number;
  readonly mirrorX: boolean;
  readonly mirrorY: boolean;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface FieldProvenance {
  readonly version: string;
  readonly seed: number;
  readonly settingsKey: string;
  /** Present only for the explicit encounter-v1 schema; ambient-v1 stays byte-identical. */
  readonly pattern?: Readonly<PatternSource>;
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
  readonly motion?: Readonly<HazardMotion>;
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

export type StructuralReason = 'transaction' | 'capacity' | 'provenance' | 'metadata' | 'bounds' | 'ownership' | 'duplicate' | 'separation' | 'incomplete';
export type StructuralResult =
  | { readonly status: 'valid'; readonly candidateCount: number; readonly totalCount: number; readonly aboveSoftLimit: boolean }
  | { readonly status: 'invalid'; readonly reason: StructuralReason };

/** Isolated planning input. Caller supplies all relevant known hazards. */
export interface FieldValidationContext {
  readonly release?: true;
  /** Actual current feedback state for the single committed adaptive mine. */
  readonly homing?: Readonly<AdaptiveMineState>;
  readonly player: { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number };
  readonly input: { readonly x: number; readonly y: number };
  readonly elapsed: number;
  readonly distance: number;
  readonly committed: readonly PlannedHazard[];
  readonly candidate: FieldTransaction;
  /** Exclusive future-content reservation; omitted means the minimum inferred tail. */
  readonly reservedUntilDistance?: number;
}

export type FieldValidationDecision =
  | { readonly decision: 'accept' }
  | { readonly decision: 'reject'; readonly reason: string };

export interface FieldValidator {
  validate(context: FieldValidationContext): FieldValidationDecision;
}
