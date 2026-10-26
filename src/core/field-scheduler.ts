import { CONFIG, difficulty } from '../config.ts';
import { FieldGenerator } from './field-generator.ts';
import { buildSection } from './field-section.ts';
import { FlightPrediction } from './field-prediction.ts';
import { beginValidation, beginTrajectoryReplay, beginPublicationCheck } from './field-validator.ts';
import { VALIDATION_LIMITS as L } from './field-validator-types.ts';
import { DIRECTOR_SETTINGS as S } from './field-director-settings.ts';
import { sameHazard } from './field-ownership.ts';
import type { ValidationJob } from './field-validator.ts';
import type { ControlRun, TrajectoryResult, ValidationBudget, ValidationMetrics, ValidationWitness } from './field-validator-types.ts';
import type { FieldTransaction, FieldValidationContext, PlannedHazard } from './field-types.ts';
import type { ScheduledSection } from './field-director.ts';
import type { OwnershipLedger } from './field-ownership.ts';

export type SchedulerRoot = Pick<FieldValidationContext, 'player' | 'input' | 'elapsed' | 'distance'>;
export type PlanningPhase = 'validation' | 'replay' | 'publication' | 'ready' | 'failed' | 'done';
export interface AttemptRecord {
  readonly kind: 'primary' | 'ambient-fallback' | 'empty-fallback';
  readonly identity: string;
  readonly transaction?: FieldTransaction;
  readonly context?: FieldValidationContext;
  reason?: string;
}
export interface PlanningOutcome {
  readonly status: 'committed' | 'omitted-certified' | 'omitted-uncertified' | 'blocked';
  readonly section: ScheduledSection;
  readonly reason?: string;
  readonly transaction?: FieldTransaction;
  readonly witness?: ValidationWitness;
  readonly attempts: readonly AttemptRecord[];
  readonly metrics: Readonly<ValidationMetrics>;
  readonly jobs: readonly { phase: PlanningPhase; attempt: number; metrics: Readonly<ValidationMetrics>; decision: string; reason?: string }[];
  readonly publicationChecks?: readonly PublicationObservation[];
  readonly generationReason?: string;
}
export interface PublicationObservation {
  readonly tick: number;
  readonly context: FieldValidationContext;
  readonly witness: ValidationWitness;
  readonly result: TrajectoryResult | { readonly decision: 'unfinished'; readonly reason: 'ACTUAL_REPLAY_BUDGET' };
  readonly metrics: Readonly<ValidationMetrics>;
}
const rootCopy = (r: SchedulerRoot): SchedulerRoot => Object.freeze({
  player: Object.freeze({ x: r.player.x, y: r.player.y, vx: r.player.vx, vy: r.player.vy }),
  input: Object.freeze({ x: r.input.x, y: r.input.y }), elapsed: r.elapsed, distance: r.distance });
const zeroMetrics = (): ValidationMetrics => ({ propagations: 0, narrowQueries: 0, broadPhaseSkips: 0, clockSteps: 0,
  searchPropagations: 0, replayPropagations: 0, replayQueries: 0, peakFrontier: 0, peakExpansion: 0, searches: 0, replays: 0, planningTicks: 0 });
export const visibleAt = (hazards: readonly PlannedHazard[], distance: number): readonly PlannedHazard[] =>
  hazards.filter(h => distance <= h.passDistance + h.radius + CONFIG.hazards.despawnZ);

/** Prediction is NOT a safety decision. Commit requires equality with the actual future root. */
export function forecastPublication(root: SchedulerRoot, inputs?: readonly ControlRun[]): SchedulerRoot {
  if (inputs && (inputs.length > L.horizonTicks || inputs.some(r => !Number.isInteger(r.ticks) || r.ticks < 1 || r.ticks > L.horizonTicks
    || !Number.isFinite(r.input.x) || !Number.isFinite(r.input.y) || Math.abs(r.input.x) > 1 || Math.abs(r.input.y) > 1))) throw new RangeError('Invalid bounded forecast controls');
  const state = { ...root.player, elapsed: root.elapsed, distance: root.distance }, prediction = new FlightPrediction();
  let run = 0, left = inputs?.[0]?.ticks ?? 0, input = root.input;
  for (let tick = 0; tick < S.publicationTicks; tick++) {
    while (inputs && left === 0 && run < inputs.length) { run++; left = inputs[run]?.ticks ?? 0; }
    input = inputs ? inputs[run]?.input ?? { x: 0, y: 0 } : root.input;
    prediction.step(state, input); if (left) left--;
  }
  return rootCopy({ player: state, input, elapsed: state.elapsed, distance: state.distance });
}
function neutralControls(c: FieldValidationContext): readonly ControlRun[] | undefined {
  let elapsed = c.elapsed, distance = c.distance, end = 0;
  const exit = Math.max(c.distance, ...c.committed.map(h => h.passDistance + h.radius + CONFIG.ship.radius + L.margin));
  for (let tick = 1; tick <= L.horizonTicks; tick++) {
    elapsed += CONFIG.step; distance += difficulty(elapsed).speed * CONFIG.step;
    if (!end && tick >= L.reactionTicks && distance > exit) end = tick + L.brakingTicks;
    if (end && tick === end) return [{ ticks: L.reactionTicks, input: c.input }, { ticks: end - L.reactionTicks, input: { x: 0, y: 0 } }];
  }
  return undefined;
}

/** Isolated one-slot coordinator. It returns data; it never mutates a player or live field.
 * The caller supplies its COMPLETE known field. A forecast may be replaced by a
 * research policy prediction, but is always checked against the actual commit root.
 */
export class PlanningSession {
  private readonly field: FieldGenerator;
  private readonly ledger: OwnershipLedger;
  private readonly section: ScheduledSection;
  private readonly target: SchedulerRoot;
  private readonly attempts: AttemptRecord[] = [];
  private readonly jobRecords: PlanningOutcome['jobs'][number][] = [];
  private readonly counts = zeroMetrics();
  private job?: ValidationJob;
  private lastMetrics = zeroMetrics();
  private token?: string;
  private currentPhase: PlanningPhase = 'validation';
  private tick = 0;
  private witness?: ValidationWitness;
  private publishedWitness?: ValidationWitness;
  private result?: PlanningOutcome;
  private failure?: string;
  get phase(): PlanningPhase { return this.currentPhase; }
  get metrics(): Readonly<ValidationMetrics> { return { ...this.counts, planningTicks: this.tick }; }
  getResult(): PlanningOutcome | undefined { return this.result; }
  cancel(): PlanningOutcome {
    if (this.result) return this.result;
    if (this.token) this.ledger.cancel(this.token);
    this.token = undefined;
    return this.finish('blocked', 'CANCELLED');
  }

  constructor(section: ScheduledSection, root: SchedulerRoot, committed: readonly PlannedHazard[], ledger: OwnershipLedger,
    publicationRoot?: SchedulerRoot) {
    this.section = Object.freeze({ ...section }); this.ledger = ledger;
    this.field = new FieldGenerator(section.seed);
    const expected = forecastPublication(root); this.target = rootCopy(publicationRoot ?? expected);
    if (this.target.elapsed !== expected.elapsed || this.target.distance !== expected.distance) throw new RangeError('Publication forecast must use the exact144-step clock');
    if (committed.length > L.maxHazards) { this.finish('blocked', 'CAPACITY'); return; }
    if (!this.completeKnownField(committed, root.distance)) { this.finish('blocked', 'INCOMPLETE_KNOWN_FIELD'); return; }
    this.startAttempt('primary', root, committed);
  }

  advance(current: SchedulerRoot, committed: readonly PlannedHazard[], tick: number,
    budget: ValidationBudget = { propagations: L.defaultPropagationsPerTick, narrowQueries: L.defaultQueriesPerTick }): PlanningOutcome | undefined {
    if (this.result) return this.result;
    if (!Number.isInteger(tick) || tick <= this.tick || tick < 1) throw new RangeError('Planning ticks must increase');
    // One job only per call: all phases/fallbacks share this budget and deadline.
    if (!Number.isInteger(budget.propagations) || budget.propagations < 0 || budget.propagations > L.defaultPropagationsPerTick
      || !Number.isInteger(budget.narrowQueries) || budget.narrowQueries < 0 || budget.narrowQueries > L.defaultQueriesPerTick) throw new RangeError('Coordinator budget exceeds approved defaults');
    this.tick = tick;
    if (tick > S.publicationTicks) return this.finish('omitted-uncertified', 'MISSED_PUBLICATION_TICK');
    if (committed.length > L.maxHazards) this.fail('CAPACITY');
    else if (!this.completeKnownField(committed, current.distance)) this.fail('INCOMPLETE_KNOWN_FIELD');
    if (this.job) {
      const before = this.lastMetrics; this.job.advance(budget, tick); const after = this.job.metrics;
      for (const key of Object.keys(this.counts) as (keyof ValidationMetrics)[]) {
        if (key === 'planningTicks') continue;
        if (key === 'peakFrontier' || key === 'peakExpansion') this.counts[key] = Math.max(this.counts[key], after[key]);
        else this.counts[key] += after[key] - before[key];
      }
      this.lastMetrics = { ...after };
      const checked = this.job.getResult();
      if (checked) {
        this.jobRecords.push(Object.freeze({ phase: this.currentPhase, attempt: this.attempts.length - 1, metrics: after,
          decision: checked.decision, ...(checked.decision === 'reject' ? { reason: checked.reason } : {}) }));
        this.job = undefined;
        this.handle(checked, current, committed);
      }
    }
    if (this.counts.searches > L.maxSearches || this.counts.replays > L.maxReplays) this.fail('TRANSACTION_WORK_LIMIT');
    if (tick === S.publicationTicks) {
      if (this.currentPhase !== 'ready' || !this.publishedWitness) return this.finish('omitted-uncertified', this.failure ?? 'PLANNING_DEADLINE');
      const actual = rootCopy(current), expectedField = this.publishedWitness.context.committed;
      if (JSON.stringify(actual) !== JSON.stringify(this.target)) return this.finish('omitted-uncertified', 'PUBLICATION_ROOT_CHANGED');
      const actualField = visibleAt(committed, actual.distance);
      if (actualField.length !== expectedField.length || actualField.some((h, i) => !sameHazard(h, expectedField[i]!))) return this.finish('omitted-uncertified', 'COMMITTED_FIELD_CHANGED');
      const kind = this.attempts.at(-1)!.kind;
      return this.finish(kind === 'empty-fallback' ? 'omitted-certified' : 'committed', undefined, this.publishedWitness);
    }
    return undefined;
  }

  private setJob(job: ValidationJob, phase: PlanningPhase): void {
    this.job = job; this.currentPhase = phase; this.lastMetrics = { ...job.metrics };
    this.counts.clockSteps += job.metrics.clockSteps;
  }
  private startAttempt(kind: AttemptRecord['kind'], root: SchedulerRoot, committed: readonly PlannedHazard[]): void {
    const s = this.section;
    let transaction: FieldTransaction;
    if (kind === 'primary' && s.family !== 'ambient') {
      const p = buildSection(s, committed);
      if (!p.transaction) {
        const reason = 'GENERATION_REJECTED:' + p.rejection;
        this.attempts.push({ kind, identity: `${s.id}/${kind}`, reason });
        this.startAttempt('ambient-fallback', root, committed); return;
      }
      transaction = p.transaction;
    } else {
      const ambient = this.field.propose(s.firstCell, s.cellCount);
      transaction = kind === 'empty-fallback' ? Object.freeze({ ...ambient, hazards: Object.freeze([]) }) : ambient;
    }
    const context: FieldValidationContext = { ...rootCopy(root), committed: Object.freeze([...committed]), candidate: transaction };
    const record: AttemptRecord = { kind, identity: `${s.id}/${kind}`, transaction, context };
    this.attempts.push(record);
    const structure = this.field.inspect(transaction, committed);
    if (structure.status === 'invalid') {
      record.reason = 'STRUCTURAL_INVALID:' + structure.reason;
      if (kind === 'primary') this.startAttempt(structure.reason === 'capacity' ? 'empty-fallback' : 'ambient-fallback', root, committed);
      else this.fail(record.reason);
      return;
    }
    const reservation = this.ledger.reserve(record.identity, s.firstCell, s.cellCount, transaction.hazards.map(h => h.id), transaction.hazards);
    if (reservation.status === 'rejected') {
      record.reason = reservation.reason; this.finish('blocked', reservation.reason); return;
    }
    this.token = reservation.token;
    if (kind === 'empty-fallback') {
      const controls = neutralControls(context);
      if (!controls) this.fail('FALLBACK_HORIZON');
      else this.setJob(beginTrajectoryReplay(context, controls), 'validation');
    } else this.setJob(beginValidation(context), 'validation');
  }
  private handle(checked: TrajectoryResult, current: SchedulerRoot, committed: readonly PlannedHazard[]): void {
    const record = this.attempts.at(-1)!;
    if (checked.decision === 'reject') {
      record.reason = `${this.currentPhase}:${checked.reason}:${checked.detail ?? ''}`;
      if (this.currentPhase === 'validation' && record.kind !== 'empty-fallback' && this.attempts.length < S.maxAttempts
        && this.tick < S.publicationTicks) {
        if (this.token) this.ledger.cancel(this.token); this.token = undefined;
        this.startAttempt('empty-fallback', current, committed);
      } else this.fail(record.reason);
      return;
    }
    if (this.currentPhase === 'validation') {
      this.witness = checked.witness;
      if (record.kind === 'empty-fallback') this.preparePublication(committed);
      else this.setJob(beginTrajectoryReplay(checked.witness.context, checked.witness.controls), 'replay');
    } else if (this.currentPhase === 'replay') {
      if (checked.witness.hash !== this.witness?.hash) { this.fail('REPLAY_DISAGREEMENT'); return; }
      this.preparePublication(committed);
    } else if (this.currentPhase === 'publication') {
      this.publishedWitness = checked.witness; this.currentPhase = 'ready';
    }
  }
  private preparePublication(committed: readonly PlannedHazard[]): void {
    const transaction = this.attempts.at(-1)!.transaction!;
    // Replaces the old certificate atomically ONLY after the entire union is
    // replayed from the actual matched publication root into a NEW empty tail.
    const context = { ...this.target, committed: visibleAt(committed, this.target.distance), candidate: transaction };
    this.setJob(beginPublicationCheck(this.witness!, context), 'publication');
  }
  private completeKnownField(committed: readonly PlannedHazard[], distance: number): boolean {
    return this.ledger.hasCompleteField(committed, distance);
  }
  private fail(reason: string): void { this.failure = reason; this.currentPhase = 'failed'; this.job = undefined; }
  private finish(status: PlanningOutcome['status'], reason?: string, witness?: ValidationWitness): PlanningOutcome {
    if (status === 'committed' || status === 'omitted-certified') {
      if (!this.token || !this.ledger.finalize(this.token, status === 'committed' ? 'committed' : 'omitted')) {
        status = 'blocked'; reason = 'STALE_OWNERSHIP'; witness = undefined;
      }
    } else if (status !== 'blocked') {
      if (this.token) this.ledger.cancel(this.token);
      const reservation = this.ledger.reserve(`${this.section.id}/uncertified-omission`, this.section.firstCell, this.section.cellCount, []);
      if (reservation.status === 'reserved') this.ledger.finalize(reservation.token, 'omitted');
      else { status = 'blocked'; reason = reservation.reason; }
    }
    this.currentPhase = 'done'; this.job = undefined;
    this.result = Object.freeze({ status, section: this.section, ...(reason ? { reason } : {}),
      ...(witness ? { transaction: witness.context.candidate, witness } : {}),
      attempts: Object.freeze(this.attempts.map(a => Object.freeze({ ...a }))), metrics: Object.freeze(this.metrics), jobs: Object.freeze([...this.jobRecords]) });
    return this.result;
  }
}
