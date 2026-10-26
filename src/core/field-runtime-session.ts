import { CONFIG, difficulty } from '../config.ts';
import { FieldGenerator } from './field-generator.ts';
import { buildSection } from './field-section.ts';
import { beginValidation, beginKnownFieldValidation, beginNeutralKnownFieldValidation, beginRuntimeRootSearch, beginTrajectoryReplay, beginRuntimePublicationCheck, beginPublicationCheck } from './field-validator.ts';
import { VALIDATION_LIMITS as L } from './field-validator-types.ts';
import { DIRECTOR_SETTINGS as S } from './field-director-settings.ts';
import type { ValidationJob } from './field-validator.ts';
import type { ControlRun, TrajectoryResult, ValidationBudget, ValidationGeometry, ValidationMetrics, ValidationWitness } from './field-validator-types.ts';
import type { FieldTransaction, FieldValidationContext, PlannedHazard } from './field-types.ts';
import type { ScheduledSection } from './field-director.ts';
import type { OwnershipLedger } from './field-ownership.ts';

import type { SchedulerRoot, PlanningPhase, AttemptRecord, PlanningOutcome, PublicationObservation } from './field-scheduler.ts';
import { visibleAt } from './field-scheduler.ts';

/** One explicit DEV candidate, using the same coordinator and publication gate. */
export interface RuntimeCandidate {
  readonly transaction: FieldTransaction;
  readonly geometry: ValidationGeometry;
  readonly publicationPolicy?: 'root-aware-v1';
  /** A whole independently proposed source span, never a partial primary. */
  readonly fallback?: FieldTransaction;
  readonly generationReason?: string;
}

const rootCopy = (r: SchedulerRoot): SchedulerRoot => Object.freeze({
  player: Object.freeze({ x: r.player.x, y: r.player.y, vx: r.player.vx, vy: r.player.vy }),
  input: Object.freeze({ x: r.input.x, y: r.input.y }), elapsed: r.elapsed, distance: r.distance });
const zeroMetrics = (): ValidationMetrics => ({ propagations: 0, narrowQueries: 0, broadPhaseSkips: 0, clockSteps: 0,
  searchPropagations: 0, replayPropagations: 0, replayQueries: 0, peakFrontier: 0, peakExpansion: 0, searches: 0, replays: 0, planningTicks: 0 });
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

/** One pending runtime transaction. Only current observations are accepted.
 * Preparation uses historical state; the final independent replay runs to
 * completion from the ACTUAL root in one bounded synchronous publication call.
 */
export class RuntimePlanningSession {
  private readonly custom?: RuntimeCandidate;
  private readonly field: FieldGenerator;
  private readonly ledger: OwnershipLedger;
  private readonly section: ScheduledSection;
  private readonly replayMode: 'full' | 'culled';
  private readonly attempts: AttemptRecord[] = [];
  private readonly jobRecords: PlanningOutcome['jobs'][number][] = [];
  private readonly counts = zeroMetrics();
  private job?: ValidationJob;
  private lastMetrics = zeroMetrics();
  private token?: string;
  private currentPhase: PlanningPhase = 'validation';
  private tick = 0;
  private witness?: ValidationWitness;
  private result?: PlanningOutcome;
  private failure?: string;
  private readonly publicationChecks: PublicationObservation[] = [];
  private get rootAware(): boolean { return this.custom?.publicationPolicy === 'root-aware-v1'; }
  get phase(): PlanningPhase { return this.currentPhase; }
  get metrics(): Readonly<ValidationMetrics> { return { ...this.counts, planningTicks: this.tick }; }
  getResult(): PlanningOutcome | undefined { return this.result; }
  get preparedWitness(): ValidationWitness | undefined { return this.witness; }
  publicationDue(tick: number): boolean { return tick === S.publicationTicks || (this.rootAware && this.currentPhase === 'ready'); }
  cancel(): PlanningOutcome {
    if (this.result) return this.result;
    if (this.token) this.ledger.cancel(this.token);
    this.token = undefined;
    return this.finish('blocked', 'CANCELLED');
  }

  constructor(section: ScheduledSection, root: SchedulerRoot, committed: readonly PlannedHazard[], ledger: OwnershipLedger, replayMode: 'full' | 'culled' = 'culled', custom?: RuntimeCandidate) {
    this.custom = custom;
    this.section = Object.freeze({ ...section }); this.ledger = ledger;
    this.replayMode = replayMode;
    this.field = new FieldGenerator(section.seed);
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
    // The fixed publication call has its own unchanged per-tick budget. Never
    // spend a preparation chunk AND a final replay in the same tick.
    if (this.publicationDue(tick)) {
      if (this.currentPhase !== 'ready' || !this.witness) return this.finish('omitted-uncertified', this.failure ?? 'PLANNING_DEADLINE');
      const transaction = this.attempts.at(-1)!.transaction!;
      const context = { ...rootCopy(current), committed: visibleAt(committed, current.distance), candidate: transaction,
        ...(this.custom ? { reservedUntilDistance: transaction.endDistance } : {}) };
      const options = this.custom ? { geometry: this.custom.geometry } : {};
      const job = this.rootAware && transaction.hazards.some(h => this.custom!.geometry.validHazard(h))
        ? beginRuntimeRootSearch(this.witness, context, options)
        : this.replayMode === 'full' ? beginPublicationCheck(this.witness, context, options) : beginRuntimePublicationCheck(this.witness, context, options);
      this.setJob(job, 'publication');
      const checked = this.work(budget, 1);
      if (this.rootAware) this.publicationChecks.push(Object.freeze({ tick, context, witness: this.witness,
        result: checked ?? { decision: 'unfinished', reason: 'ACTUAL_REPLAY_BUDGET' } as const, metrics: Object.freeze({ ...job.metrics }) }));
      if (this.rootAware && (!checked || checked.decision === 'reject') && this.attempts.length < S.maxAttempts
        && this.counts.searches <= L.maxSearches && this.counts.replays < L.maxReplays - 1 && tick < S.publicationTicks) {
        this.attempts.at(-1)!.reason = checked ? `publication:${checked.reason}:${checked.detail ?? ''}` : 'ACTUAL_REPLAY_BUDGET';
        if (this.token) this.ledger.cancel(this.token); this.token = undefined; this.job = undefined; this.witness = undefined;
        this.startAttempt('ambient-fallback', current, committed); return undefined;
      }
      if (!checked) return this.finish('omitted-uncertified', 'ACTUAL_REPLAY_BUDGET');
      if (checked.decision === 'reject') return this.finish('omitted-uncertified', 'publication:' + checked.reason + ':' + (checked.detail ?? ''));
      if (this.counts.searches > L.maxSearches || this.counts.replays > L.maxReplays) return this.finish('omitted-uncertified', 'TRANSACTION_WORK_LIMIT');
      return this.finish(this.attempts.at(-1)!.kind === 'empty-fallback' ? 'omitted-certified' : 'committed', undefined, checked.witness);
    }
    if (this.job) {
      const checked = this.work(budget, tick);
      if (checked) this.handle(checked, current, committed);
    }
    if (this.counts.searches > L.maxSearches || this.counts.replays > L.maxReplays) this.fail('TRANSACTION_WORK_LIMIT');
    return undefined;
  }

  private work(budget: ValidationBudget, tick: number): TrajectoryResult | undefined {
    const job = this.job!, before = this.lastMetrics;
    job.advance(budget, tick); const after = job.metrics;
    for (const key of Object.keys(this.counts) as (keyof ValidationMetrics)[]) {
      if (key === 'planningTicks') continue;
      if (key === 'peakFrontier' || key === 'peakExpansion') this.counts[key] = Math.max(this.counts[key], after[key]);
      else this.counts[key] += after[key] - before[key];
    }
    this.lastMetrics = { ...after };
    const checked = job.getResult();
    if (checked) {
      this.jobRecords.push(Object.freeze({ phase: this.currentPhase, attempt: this.attempts.length - 1, metrics: after,
        decision: checked.decision, ...(checked.decision === 'reject' ? { reason: checked.reason } : {}) }));
      this.job = undefined;
    }
    return checked;
  }

  private setJob(job: ValidationJob, phase: PlanningPhase): void {
    this.job = job; this.currentPhase = phase; this.lastMetrics = { ...job.metrics };
    this.counts.clockSteps += job.metrics.clockSteps;
  }
  private startAttempt(kind: AttemptRecord['kind'], root: SchedulerRoot, committed: readonly PlannedHazard[]): void {
    const s = this.section;
    let transaction: FieldTransaction;
    if (kind === 'primary' && this.custom) transaction = this.custom.transaction;
    else if (kind === 'primary' && s.family !== 'ambient') {
      const p = buildSection(s, committed);
      if (!p.transaction) {
        const reason = 'GENERATION_REJECTED:' + p.rejection;
        this.attempts.push({ kind, identity: `${s.id}/${kind}`, reason });
        this.startAttempt('ambient-fallback', root, committed); return;
      }
      transaction = p.transaction;
    } else {
      const ambient = this.field.propose(s.firstCell, s.cellCount);
      transaction = kind === 'empty-fallback' ? Object.freeze({ ...ambient, hazards: Object.freeze([]) })
        : this.rootAware && kind === 'ambient-fallback' ? this.custom!.fallback ?? ambient : ambient;
    }
    const context: FieldValidationContext = { ...rootCopy(root), committed: Object.freeze([...committed]), candidate: transaction,
      ...(this.custom ? { reservedUntilDistance: transaction.endDistance } : {}) };
    const record: AttemptRecord = { kind, identity: `${s.id}/${kind}`, transaction, context };
    this.attempts.push(record);
    const structure = this.custom ? this.custom.geometry.inspect(transaction, committed) : this.field.inspect(transaction, committed);
    if (structure.status === 'invalid') {
      record.reason = 'STRUCTURAL_INVALID:' + structure.reason;
      if (this.rootAware && kind === 'primary') { this.startAttempt('ambient-fallback', root, committed); return; }
      if (this.custom) { this.fail(record.reason); return; }
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
      else this.setJob(beginTrajectoryReplay(context, controls, this.custom ? { geometry: this.custom.geometry } : {}), 'validation');
    } else this.setJob(this.rootAware ? (this.counts.searches >= L.maxSearches ? beginNeutralKnownFieldValidation : beginKnownFieldValidation)(context, { geometry: this.custom!.geometry })
      : beginValidation(context, this.custom ? { geometry: this.custom.geometry } : {}), 'validation');
  }
  private handle(checked: TrajectoryResult, current: SchedulerRoot, committed: readonly PlannedHazard[]): void {
    const record = this.attempts.at(-1)!;
    if (checked.decision === 'reject') {
      record.reason = `${this.currentPhase}:${checked.reason}:${checked.detail ?? ''}`;
      if (this.currentPhase === 'validation' && record.kind !== 'empty-fallback' && this.attempts.length < S.maxAttempts
        && this.tick < S.publicationTicks) {
        if (this.token) this.ledger.cancel(this.token); this.token = undefined;
        this.startAttempt(this.rootAware ? 'ambient-fallback' : 'empty-fallback', current, committed);
      } else this.fail(record.reason);
      return;
    }
    if (this.currentPhase === 'validation') {
      this.witness = checked.witness;
      if (record.kind === 'empty-fallback' || this.rootAware) this.currentPhase = 'ready';
      else this.setJob(beginTrajectoryReplay(checked.witness.context, checked.witness.controls, this.custom ? { geometry: this.custom.geometry } : {}), 'replay');
    } else if (this.currentPhase === 'replay') {
      if (checked.witness.hash !== this.witness?.hash) { this.fail('REPLAY_DISAGREEMENT'); return; }
      this.witness = checked.witness; this.currentPhase = 'ready';
    }
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
      attempts: Object.freeze(this.attempts.map(a => Object.freeze({ ...a }))), metrics: Object.freeze(this.metrics), jobs: Object.freeze([...this.jobRecords]),
      ...(this.rootAware ? { publicationChecks: Object.freeze([...this.publicationChecks]),
        ...(this.custom?.generationReason ? { generationReason: this.custom.generationReason } : {}) } : {}) });
    return this.result;
  }
}
