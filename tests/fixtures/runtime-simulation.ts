import { CONFIG } from '../../src/config.ts';
import { DifficultyDirector } from '../../src/core/field-director.ts';
import { OwnershipLedger } from '../../src/core/field-ownership.ts';
import { RuntimePlanningSession } from '../../src/core/field-runtime-session.ts';
import { FlightPrediction } from '../../src/core/field-prediction.ts';
import { visibleAt, PlanningSession, forecastPublication } from '../../src/core/field-scheduler.ts';
import { witnessHash, beginTrajectoryReplay, beginPublicationCheck } from '../../src/core/field-validator.ts';
import { Random } from '../../src/core/random.ts';
import type { Axis } from '../../src/core/ship.ts';
import type { PlanningOutcome, SchedulerRoot } from '../../src/core/field-scheduler.ts';
import type { PlannedHazard } from '../../src/core/field-types.ts';
import type { ValidationWitness } from '../../src/core/field-validator-types.ts';

export const INPUT_HISTORIES = ['neutral', 'horizontal', 'vertical', 'rapid', 'irregular', 'late-change',
  'diagonal', 'boundary', 'approach-reversal', 'abandoned-witness', 'keyboard', 'touch'] as const;
export type InputHistory = typeof INPUT_HISTORIES[number];

/** DRIVER ONLY. The planning API receives no tape, callback, future root or policy. */
export function recordedInputs(seed: number, kind: InputHistory, ticks: number): readonly Readonly<Axis>[] {
  const rng = new Random(seed), tape: Axis[] = []; let left = 0, held: Axis = { x: 0, y: 0 };
  for (let t = 0; t < ticks; t++) {
    if (!left--) { held = { x: rng.next() < .5 ? -1 : 1, y: rng.next() < .5 ? -1 : 1 }; left = 9 + Math.floor(rng.next() * 97); }
    const sign = (period: number) => Math.floor(t / period) % 2 ? -1 : 1;
    const a = kind === 'neutral' ? { x: 0, y: 0 } : kind === 'horizontal' ? { x: sign(180), y: 0 }
      : kind === 'vertical' ? { x: 0, y: sign(132) } : kind === 'rapid' ? { x: sign(24), y: sign(48) }
      : kind === 'irregular' ? held : kind === 'late-change' ? { x: t % 144 >= 138 ? -1 : 1, y: sign(144) }
      : kind === 'diagonal' ? { x: sign(156), y: sign(156) } : kind === 'boundary' ? { x: 1, y: 1 }
      : kind === 'approach-reversal' ? { x: sign(300), y: sign(420) }
      : kind === 'abandoned-witness' ? { x: Math.sin(t / 49), y: Math.cos(t / 83) }
      : kind === 'keyboard' ? { x: [1, 0, -1, 0][Math.floor(t / 66) % 4]!, y: [0, 1, 0, -1][Math.floor(t / 66) % 4]! }
      : { x: Math.sin(t / 87) * (.3 + .7 * Math.abs(Math.cos(t / 173))), y: Math.cos(t / 119) * .7 };
    tape.push(Object.freeze({ ...a }));
  }
  return Object.freeze(tape);
}

export interface RuntimeSimulationOptions {
  seed: number; sections: number; history: InputHistory; firstCell?: number; elapsed?: number;
  audit?: boolean; replayMode?: 'full' | 'culled';
  coordinator?: 'actual' | 'b4-held' | 'b4-oracle'; recordInputs?: boolean;
  onChunk?: (value: { ms: number; tick: number; phase: string; propagations: number; queries: number }) => void;
}

export function simulateRuntime(options: RuntimeSimulationOptions) {
  const firstCell = options.firstCell ?? 4, director = new DifficultyDirector(options.seed), ledger = new OwnershipLedger();
  ledger.reset(firstCell); let cursor = director.initial(firstCell), committed: readonly PlannedHazard[] = [];
  const state = { x: 0, y: 0, vx: 0, vy: 0, elapsed: options.elapsed ?? 0, distance: firstCell === 4 ? 0 : firstCell * 24 - 128 };
  const initial = { ...state }, prediction = new FlightPrediction(), outcomes: PlanningOutcome[] = [], hazards: PlannedHazard[] = [];
  const limit = options.sections * 2000 + 10000, tape = recordedInputs(options.seed ^ 0x5a19, options.history, limit);
  let input: Readonly<Axis> = { x: 0, y: 0 }, session: RuntimePlanningSession | PlanningSession | undefined, age = 0, steps = 0, end = 0;
  const inputRuns: { ticks: number; input: Readonly<Axis> }[] = [];
  let contacts = 0, marginContacts = 0, audits = 0, auditQueries = 0, peakHazards = 0, peakRecords = 0, firstOpportunity: number | undefined;
  const contactIds = new Set<string>(); let firstActualContact: number | undefined;
  let xTravel = 0, yTravel = 0, inputChanges = 0, nearbyEmpty = 0, actualGateMs = 0;
  let xReversals=0,yReversals=0,lastX=0,lastY=0,turnX=state.x,turnY=state.y,steeringTicks=0;
  let prepared: ValidationWitness | undefined;
  const chunks: { ms: number; tick: number; phase: string; propagations: number; queries: number }[] = [], preparations: number[] = [];
  const trace: { x: number; y: number; vx: number; vy: number; elapsed: number; distance: number; input: Readonly<Axis> }[] = [];
  const root = (): SchedulerRoot => ({ player: state, elapsed: state.elapsed, distance: state.distance, input });
  while (steps < limit) {
    if (!session && outcomes.length < options.sections && (!outcomes.length || cursor.firstCell * 24 - state.distance <= 128)) {
      const d = director.next(cursor); cursor = d.next; end = d.section.endDistance;
      const start = performance.now();
      if (!options.coordinator || options.coordinator === 'actual') session = new RuntimePlanningSession(d.section, root(), committed, ledger, options.replayMode);
      else {
        // Explicit historical ORACLE COMPARISON ONLY. Never passed to runtime.
        const forecast = options.coordinator === 'b4-oracle' ? forecastPublication(root(), tape.slice(steps, steps + 144).map(input => ({ ticks: 1, input }))) : undefined;
        session = new PlanningSession(d.section, root(), committed, ledger, forecast);
      }
      preparations.push(performance.now() - start); age = 0;
      if (session.getResult()?.status === 'blocked') throw new Error(session.getResult()!.reason);
    }
    const previous = { ...state }, old = input;
    // A formerly followed witness can be abandoned. Only the DRIVER sees controls.
    input = options.history === 'abandoned-witness' && steps < 720 && outcomes.at(-1)?.witness
      ? witnessInput(outcomes.at(-1)!.witness!, state.elapsed) : tape[steps]!;
    if (input.x !== old.x || input.y !== old.y) inputChanges++;
    if (options.recordInputs) {
      const last = inputRuns.at(-1);
      if (last && last.input.x === input.x && last.input.y === input.y) last.ticks++;
      else inputRuns.push({ ticks: 1, input });
    }
    prediction.step(state, input); steps++;
    xTravel += Math.abs(state.x - previous.x); yTravel += Math.abs(state.y - previous.y);
    if(input.x||input.y)steeringTicks++;
    const sx=Math.abs(state.vx)>.3?Math.sign(state.vx):0,sy=Math.abs(state.vy)>.3?Math.sign(state.vy):0;
    if(sx&&lastX&&sx!==lastX&&Math.abs(state.x-turnX)>.75){xReversals++;turnX=state.x;}
    if(sy&&lastY&&sy!==lastY&&Math.abs(state.y-turnY)>.75){yReversals++;turnY=state.y;}
    if(sx)lastX=sx;if(sy)lastY=sy;
    if (!committed.some(h => Math.abs(h.passDistance - state.distance) <= 10 + h.radius)) nearbyEmpty++;
    for (const h of committed) {
      const radius = h.radius + CONFIG.ship.radius + .15;
      if (h.passDistance + radius < previous.distance || h.passDistance - radius > state.distance) continue;
      firstOpportunity ??= state.distance;
      if (prediction.hitGameplay(previous, state, h)) { contacts++; contactIds.add(h.id); firstActualContact ??= state.distance; }
      if (prediction.hit(previous, state, h, .15)) marginContacts++;
    }
    committed = visibleAt(committed, state.distance); ledger.retire(state.distance);
    peakHazards = Math.max(peakHazards, committed.length); peakRecords = Math.max(peakRecords, ledger.snapshot().length);
    if (steps % 24 === 0) trace.push({ ...state, input });
    if (session) {
      if (age === 143 && session instanceof RuntimePlanningSession) prepared = session.preparedWitness;
      const before = session.metrics, phase = age === 143 ? 'actual-gate' : session.phase, started = performance.now();
      const outcome = session.advance(root(), committed, ++age);
      const ms = performance.now() - started, after = session.metrics;
      const chunk = { ms, tick: age, phase, propagations: after.propagations - before.propagations, queries: after.narrowQueries - before.narrowQueries };
      chunks.push(chunk); options.onChunk?.(chunk); if (phase === 'actual-gate') actualGateMs += ms;
      if (outcome) {
        if (outcome.witness) {
          if (options.audit) {
            const job = beginTrajectoryReplay(outcome.witness.context, outcome.witness.controls);
            for (let tick = 1; !job.getResult() && tick <= 144; tick++) job.advance(undefined, tick);
            const checked = job.getResult();
            if (checked?.decision !== 'accept' || checked.witness.hash !== outcome.witness.hash) throw new Error('Full independent replay mismatch');
            if (prepared) {
              const plain = beginPublicationCheck(prepared, outcome.witness.context);
              for (let tick = 1; !plain.getResult() && tick <= 144; tick++) plain.advance(undefined, tick);
              const result = plain.getResult();
              if (result?.decision !== 'accept' || result.witness.hash !== outcome.witness.hash) throw new Error('Unculled publication mismatch');
            }
            audits++; auditQueries += job.metrics.narrowQueries;
          }
          if (outcome.status === 'committed') { committed = [...committed, ...outcome.transaction!.hazards]; hazards.push(...outcome.transaction!.hazards); }
        }
        outcomes.push(outcome); session = undefined; prepared = undefined;
      }
    }
    if (outcomes.length === options.sections && !session && state.distance > end + 20 && !committed.length) break;
  }
  if (steps === limit) throw new Error('Runtime simulation bound reached');
  return { seed: options.seed, history: options.history, initial, terminal: { ...state }, steps, seconds: steps * CONFIG.step,
    distance: state.distance - initial.distance, outcomes, hazards, chunks, preparations, contacts, marginContacts, audits, auditQueries,
    peakHazards, peakRecords, remainingRecords: ledger.snapshot().length, firstOpportunity, firstActualContact, uniqueContactHazards: contactIds.size, xTravel, yTravel, inputChanges,
    nearbyEmptySeconds: nearbyEmpty * CONFIG.step, actualGateMs, trace, inputRuns,xReversals,yReversals,steeringSeconds:steeringTicks*CONFIG.step,
    hash: witnessHash(outcomes.map(o => ({ section: o.section, status: o.status, reason: o.reason, witness: o.witness?.hash }))) };
}

function witnessInput(w: ValidationWitness, elapsed: number): Readonly<Axis> {
  let tick = Math.round((elapsed - w.context.elapsed) / CONFIG.step);
  for (const run of w.controls) { if (tick < run.ticks) return run.input; tick -= run.ticks; }
  return { x: 0, y: 0 };
}
