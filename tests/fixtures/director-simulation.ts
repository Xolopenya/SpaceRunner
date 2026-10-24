import { CONFIG } from '../../src/config.ts';
import { DifficultyDirector } from '../../src/core/field-director.ts';
import { DIRECTOR_SETTINGS as S } from '../../src/core/field-director-settings.ts';
import { OwnershipLedger } from '../../src/core/field-ownership.ts';
import { PlanningSession, forecastPublication, visibleAt } from '../../src/core/field-scheduler.ts';
import { FlightPrediction } from '../../src/core/field-prediction.ts';
import { witnessHash } from '../../src/core/field-validator.ts';
import type { PlanningOutcome, SchedulerRoot, PlanningPhase } from '../../src/core/field-scheduler.ts';
import type { ControlRun } from '../../src/core/field-validator-types.ts';
import type { ValidationBudget } from '../../src/core/field-validator-types.ts';
import type { PlannedHazard } from '../../src/core/field-types.ts';
import type { Axis } from '../../src/core/ship.ts';

/** Diagnostic controller only. Actual Ship integrates every input; no endpoint assignment. */
export class InputTape {
  private runs: readonly ControlRun[] = [];
  private index = 0;
  private left = 0;
  replace(runs: readonly ControlRun[]): void { this.runs = runs; this.index = 0; this.left = runs[0]?.ticks ?? 0; }
  next(): Readonly<Axis> {
    while (!this.left && this.index < this.runs.length) { this.index++; this.left = this.runs[this.index]?.ticks ?? 0; }
    const input = this.runs[this.index]?.input ?? { x: 0, y: 0 }; if (this.left) this.left--; return input;
  }
  preview(ticks: number): readonly ControlRun[] {
    const copy = new InputTape(); copy.runs = this.runs; copy.index = this.index; copy.left = this.left;
    const result: { ticks: number; input: Readonly<Axis> }[] = [];
    for (let i = 0; i < ticks; i++) {
      const input = copy.next(), last = result.at(-1);
      if (last && last.input.x === input.x && last.input.y === input.y) last.ticks++;
      else result.push({ ticks: 1, input });
    }
    return result;
  }
}
export interface SimulationOptions {
  readonly seed: number;
  readonly sections: number;
  readonly firstCell?: number;
  readonly elapsed?: number;
  readonly policy?: 'witness' | 'neutral' | 'boundary' | 'periodic';
  readonly forecast?: 'policy' | 'held';
  readonly budget?: ValidationBudget;
  readonly onPreparation?: (ms: number) => void;
  readonly onChunk?: (value: { ms: number; phase: PlanningPhase | 'commit'; tick: number; propagations: number; queries: number }) => void;
}

export function simulateSchedule(options: SimulationOptions) {
  const director = new DifficultyDirector(options.seed), firstCell = options.firstCell ?? S.firstCell;
  let cursor = director.initial(firstCell), committed: readonly PlannedHazard[] = [], input: Readonly<Axis> = { x: 0, y: 0 };
  const ledger = new OwnershipLedger(); ledger.reset(firstCell);
  const state = { x: 0, y: 0, vx: 0, vy: 0, elapsed: options.elapsed ?? 0, distance: firstCell === S.firstCell ? 0 : firstCell * 24 - S.planningLead };
  const initial = { ...state }, prediction = new FlightPrediction(), tape = new InputTape(), outcomes: PlanningOutcome[] = [];
  const hazards: PlannedHazard[] = [], trace: { distance: number; x: number; y: number; vx: number; vy: number; elapsed: number }[] = [];
  let session: PlanningSession | undefined, age = 0, peakRecords = 0, peakHazards = 0, contacts = 0, steps = 0, endDistance = state.distance;
  let marginContacts = 0, gameplayContacts = 0, firstGameplayContact: number | undefined;
  let xTravel = 0, yTravel = 0, turns = 0, lastX = 0, lastY = 0, turnX = state.x, turnY = state.y, steeringTicks = 0;
  let visibilityEntries = 0, visibilityMoving = 0;
  let pendingVisibility: PlannedHazard[] = [];
  const policy = options.policy ?? 'witness';
  const policyInput = (tick: number): Readonly<Axis> => policy === 'boundary' ? { x: 1, y: 1 }
    : policy === 'periodic' ? { x: Math.sin(tick / 120 * .8), y: Math.cos(tick / 120 * .6) * .6 } : { x: 0, y: 0 };
  const root = (): SchedulerRoot => ({ player: state, input, elapsed: state.elapsed, distance: state.distance });
  const limit = options.sections * 2000 + 10000;
  while (steps < limit) {
    if (!session && outcomes.length < options.sections && (outcomes.length === 0 || cursor.firstCell * 24 - state.distance <= S.planningLead)) {
      const decision = director.next(cursor); cursor = decision.next; endDistance = decision.section.endDistance;
      const before = performance.now();
      const forecast = policy === 'witness' ? tape.preview(S.publicationTicks)
        : Array.from({ length: S.publicationTicks }, (_, tick) => ({ ticks: 1, input: policyInput(steps + tick) }));
      session = new PlanningSession(decision.section, root(), committed, ledger,
        options.forecast === 'held' ? undefined : forecastPublication(root(), forecast));
      options.onPreparation?.(performance.now() - before); age = 0;
      if (session.getResult()?.status === 'blocked') { outcomes.push(session.getResult()!); break; }
    }
    const previous = { ...state }; input = policy === 'witness' ? tape.next() : policyInput(steps); prediction.step(state, input); steps++;
    xTravel += Math.abs(state.x - previous.x); yTravel += Math.abs(state.y - previous.y);
    if (input.x || input.y) steeringTicks++;
    const sx = Math.abs(state.vx) > .3 ? Math.sign(state.vx) : 0, sy = Math.abs(state.vy) > .3 ? Math.sign(state.vy) : 0;
    if (sx && lastX && sx !== lastX && Math.abs(state.x - turnX) > .75) { turns++; turnX = state.x; }
    if (sy && lastY && sy !== lastY && Math.abs(state.y - turnY) > .75) { turns++; turnY = state.y; }
    if (sx) lastX = sx; if (sy) lastY = sy;
    pendingVisibility = pendingVisibility.filter(h => {
      if (h.passDistance - state.distance > -CONFIG.hazards.spawnZ) return true;
      visibilityEntries++; if (Math.hypot(state.vx, state.vy) > 1) visibilityMoving++; return false;
    });
    for (const h of committed) {
      const extent = h.radius + CONFIG.ship.radius + .15;
      if (h.passDistance + extent < previous.distance || h.passDistance - extent > state.distance) continue;
      const marginHit = prediction.hit(previous, state, h, .15), gameplayHit = prediction.hitGameplay(previous, state, h);
      if (marginHit || gameplayHit) contacts++;
      if (marginHit) marginContacts++;
      if (gameplayHit) { gameplayContacts++; firstGameplayContact ??= state.distance; }
    }
    committed = visibleAt(committed, state.distance); ledger.retire(state.distance);
    peakRecords = Math.max(peakRecords, ledger.snapshot().length); peakHazards = Math.max(peakHazards, committed.length);
    if (steps % 24 === 0) trace.push({ ...state });
    if (session) {
      const before = session.metrics, phase = session.phase, started = performance.now();
      session.advance(root(), committed, ++age, options.budget);
      const after = session.metrics;
      options.onChunk?.({ ms: performance.now() - started, phase: age === S.publicationTicks && (phase === 'ready' || phase === 'failed') ? 'commit' : phase, tick: age,
        propagations: after.propagations - before.propagations, queries: after.narrowQueries - before.narrowQueries });
      const outcome = session.getResult();
      if (outcome) {
        outcomes.push(outcome);
        if (outcome.witness) {
          if (outcome.status === 'committed') {
            committed = [...committed, ...outcome.transaction!.hazards]; hazards.push(...outcome.transaction!.hazards);
            for (const h of outcome.transaction!.hazards) {
              if (h.passDistance - state.distance > -CONFIG.hazards.spawnZ) pendingVisibility.push(h);
              else { visibilityEntries++; if (Math.hypot(state.vx, state.vy) > 1) visibilityMoving++; }
            }
          }
          if (policy === 'witness') tape.replace(outcome.witness.controls);
        }
        session = undefined;
      }
    }
    if (outcomes.length === options.sections && !session && state.distance > endDistance + 20 && !committed.length) break;
  }
  if (steps === limit) throw new Error('Bounded research schedule did not finish');
  const identity = outcomes.map(o => ({ section: o.section, status: o.status, reason: o.reason,
    candidates: o.attempts.map(a => a.transaction), witness: o.witness?.hash }));
  return { seed: options.seed, policy, initial, terminal: { ...state }, steps, seconds: steps * CONFIG.step, distance: state.distance - initial.distance,
    sections: outcomes, hazards, contacts, marginContacts, gameplayContacts, firstGameplayContact, peakRecords, peakHazards,
    motion: { xTravel, yTravel, turns, steeringSeconds: steeringTicks * CONFIG.step,
      note: 'Physical120Hz motion; turns require velocity sign change and>.75 excursion. Not a count of human decisions.' },
    visibility: { nominalApproach: -CONFIG.hazards.spawnZ, entries: visibilityEntries, movingEntries: visibilityMoving,
      note: 'Existing108-unit spawn approach as a nominal threshold only; actual frustum/fog/legibility are untested.' },
    remainingRecords: ledger.snapshot().length, trace, hash: witnessHash(identity) };
}
