import { CONFIG, difficulty } from '../../src/config.ts';
import { RuntimeGameModel } from '../../src/debug/runtime-game-model.ts';
import { RuntimeObstacleField } from '../../src/debug/runtime-field.ts';
import { FlightPrediction } from '../../src/core/field-prediction.ts';
import { beginTrajectoryReplay } from '../../src/core/field-validator.ts';
import { Random } from '../../src/core/random.ts';
import type { FieldPolicy } from '../../src/core/field-policy.ts';
import type { Axis } from '../../src/core/ship.ts';
import type { PlannedHazard } from '../../src/core/field-types.ts';

export const PASSIVE_POLICIES = ['neutral', 'left', 'right', 'top', 'bottom', 'bottom-left', 'top-left',
  'bottom-right', 'top-right', 'horizontal', 'vertical', 'irregular'] as const;
export type PassivePolicy = typeof PASSIVE_POLICIES[number];

/** Predetermined history; no access to generated hazards or certificates. */
export function pressureInputs(seed: number, kind: PassivePolicy, ticks: number): readonly Axis[] {
  const rng = new Random(seed ^ 0x5a19), tape: Axis[] = [];
  let held = { x: 0, y: 0 }, remaining = 0;
  for (let t = 0; t < ticks; t++) {
    if (remaining-- <= 0) { held = { x: rng.next() < .5 ? -1 : 1, y: rng.next() < .5 ? -1 : 1 }; remaining = 30 + Math.floor(rng.next() * 180); }
    const x = kind.includes('left') || kind === 'left' ? -1 : kind.includes('right') || kind === 'right' ? 1 : 0;
    const y = kind.includes('bottom') || kind === 'bottom' ? -1 : kind.includes('top') || kind === 'top' ? 1 : 0;
    tape.push(Object.freeze(kind === 'horizontal' ? { x: Math.floor(t / 180) % 2 ? -1 : 1, y: 0 }
      : kind === 'vertical' ? { x: 0, y: Math.floor(t / 132) % 2 ? -1 : 1 }
        : kind === 'irregular' ? { ...held } : { x, y }));
  }
  return Object.freeze(tape);
}

export function pressureSimulation(options: { seed: number; policy: FieldPolicy; history: PassivePolicy; seconds?: number;
  late?: boolean; audit?: boolean; tape?: readonly Axis[] }) {
  const ticks = Math.round((options.seconds ?? 90) / CONFIG.step), initialElapsed = options.late ? 180 : 0;
  const initialDistance = options.late ? 5280 : 0;
  const tape = options.tape ?? pressureInputs(options.seed, options.history, ticks);
  const state = { x: 0, y: 0, vx: 0, vy: 0, elapsed: initialElapsed, distance: initialDistance };
  let input: Axis = { x: 0, y: 0 };
  const field = new RuntimeObstacleField(() => ({ player: state, input, elapsed: state.elapsed, distance: state.distance }), options.policy);
  field.reset(options.seed);
  // Same director/ledger with a documented late warm start; no past world invented.
  if (options.late) {
    const internals = field as unknown as { cursor: { firstCell: number }; director: { initial(cell: number): typeof internals.cursor } };
    const firstCell = Math.ceil((initialDistance + 128) / 24);
    internals.cursor = internals.director.initial(firstCell); field.ledger.reset(firstCell);
  }
  const prediction = new FlightPrediction(), geometry: (PlannedHazard & { publishedTick: number; publishedDistance: number })[] = [];
  const decisions: object[] = [], timings: { phase: string; ms: number; propagations: number; queries: number }[] = [], trace: object[] = [], inputRuns: { tick: number; ticks: number; input: Axis }[] = [];
  const threats = new Set<string>(), contacts = new Set<string>(), hitEvents: object[] = [];
  let nearbyFreeTicks = 0, axialFreeTicks = 0, freeStreak = 0, maxFreeTicks = 0;
  let firstThreat: number | undefined, firstContact: number | undefined, death: { seconds: number; distance: number } | undefined;
  let hull: number = CONFIG.ship.hull, immunity = 0, audits = 0, auditQueries = 0, peakKnown = 0, peakOwnership = 0;
  let previousOutcome = field.lastOutcome;
  for (let t = 0; t < ticks; t++) {
    const previous = { ...state }; input = tape[t]!;
    const last = inputRuns.at(-1);
    if (last && last.input.x === input.x && last.input.y === input.y) last.ticks++;
    else inputRuns.push({ tick: t, ticks: 1, input });
    prediction.step(state, input); immunity = Math.max(0, immunity - CONFIG.step);
    field.update(CONFIG.step, difficulty(state.elapsed).speed, state.distance, state.elapsed);
    if (field.fault) throw new Error(field.fault);
    const sample = field.samples.at(-1);
    if (field.pending || field.lastOutcome !== previousOutcome) if (sample) {
      if (sample.propagations > 3072 || sample.queries > 6144) throw new Error('Per-tick work budget exceeded');
      timings.push({ ...sample });
    }
    if (field.lastOutcome !== previousOutcome) {
      const o = field.lastOutcome!; previousOutcome = o;
      if (o.status === 'blocked') throw new Error(o.reason);
      const actual = o.status === 'committed' ? o.transaction!.hazards : [];
      geometry.push(...actual.map(h => ({ ...h, publishedTick: t + 1, publishedDistance: state.distance })));
      decisions.push({ tick: t + 1, elapsed: state.elapsed, distance: state.distance, section: o.section, status: o.status, reason: o.reason,
        proposed: o.attempts[0]?.transaction?.hazards ?? [], committed: actual, metrics: o.metrics,
        attempts: o.attempts.map(a => ({ kind: a.kind, reason: a.reason })),
        witness: o.witness?.hash, publicationRoot: o.witness?.context,
        controls: o.witness?.controls });
      if (options.audit && o.witness) {
        const job = beginTrajectoryReplay(o.witness.context, o.witness.controls);
        for (let tick = 1; !job.getResult() && tick <= 144; tick++) job.advance(undefined, tick);
        const checked = job.getResult();
        if (checked?.decision !== 'accept' || checked.witness.hash !== o.witness.hash) throw new Error('Independent full replay mismatch');
        audits++; auditQueries += job.metrics.narrowQueries;
      }
    }
    const known = field.ledger.knownHazards(state.distance);
    peakKnown = Math.max(peakKnown, known.length); peakOwnership = Math.max(peakOwnership, field.ledger.snapshot().length);
    // A threat is an actual calibrated CCD contact on a 1.5s zero-steering continuation,
    // including residual velocity. No geometry is invented, and the player is not steered.
    let nearby = false, axial = false;
    for (const h of known) {
      const dz = h.passDistance - state.distance;
      if (dz >= -8 && dz <= 10 + h.radius) {
        axial = true;
        if (Math.hypot(state.x - h.x, state.y - h.y, dz) <= 10 + h.radius) nearby = true;
      }
      if (dz >= -2 && dz <= difficulty(state.elapsed).speed * 1.5 + 2 && !threats.has(h.id) && t % 12 === 0) {
        const future = { ...state };
        for (let k = 0; k < 180; k++) {
          const before = { ...future }; prediction.step(future, { x: 0, y: 0 });
          if (prediction.hitGameplay(before, future, h)) { threats.add(h.id); firstThreat ??= (t + 1) * CONFIG.step; break; }
          if (future.distance > h.passDistance + 2) break;
        }
      }
      if (prediction.hitGameplay(previous, state, h)) {
        contacts.add(h.id); firstContact ??= (t + 1) * CONFIG.step;
        const slot = field.slots.find(s => s.planned?.id === h.id);
        if (!death && immunity === 0 && slot?.active) {
          hull--; immunity = CONFIG.ship.invulnerability; slot.active = false;
          hitEvents.push({ tick: t + 1, elapsed: state.elapsed, distance: state.distance, hull, id: h.id });
          if (hull === 0) death = { seconds: (t + 1) * CONFIG.step, distance: state.distance - initialDistance };
        }
      }
    }
    if (!nearby) nearbyFreeTicks++;
    if (!axial) axialFreeTicks++;
    // Long empty streak uses spatial proximity, not repeated threat detection.
    if (!nearby) maxFreeTicks = Math.max(maxFreeTicks, ++freeStreak); else freeStreak = 0;
    if (t % 24 === 0) trace.push({ tick: t + 1, ...state, input, hull, postDeath: !!death });
  }
  const inWindow = geometry.filter(h => h.passDistance >= initialDistance && h.passDistance < state.distance);
  const depths = [initialDistance, ...inWindow.map(h => h.passDistance).sort((a, b) => a - b), state.distance];
  field.pending?.cancel();
  return { seed: options.seed, policy: field.policy, history: options.history, band: options.late ? 'late' : 'early',
    initial: { elapsed: initialElapsed, distance: initialDistance, x: 0, y: 0, vx: 0, vy: 0 }, terminal: state,
    ticks, seconds: ticks * CONFIG.step, distance: state.distance - initialDistance, inputRuns, trace, decisions, geometry,
    publishedInWindow: inWindow.length, depthGaps: depths.slice(1).map((v, i) => v - depths[i]!),
    nearbyFreeSeconds: nearbyFreeTicks * CONFIG.step, axialFreeSeconds: axialFreeTicks * CONFIG.step,
    maxNearbyFreeSeconds: maxFreeTicks * CONFIG.step, threats: threats.size, uniqueContacts: contacts.size, firstThreat, firstContact,
    hitEvents, death, survival: death ?? { seconds: ticks * CONFIG.step, distance: state.distance - initialDistance },
    audits, auditQueries, peakKnown, peakOwnership, timings };
}

/** Verify the research hull/clock/geometry prefix against the real, unmodified model. */
export function checkActualModel(run: ReturnType<typeof pressureSimulation>, tape: readonly Axis[]): void {
  if (run.band !== 'early') throw new Error('Real model check expects ordinary start');
  const m = new RuntimeGameModel(run.policy.name); m.ready(); m.start(run.seed);
  const events: object[] = [];
  let lastOutcome = m.field.lastOutcome;
  for (let t = 0; t < run.ticks && m.state === 'PLAYING'; t++) {
    const serial = m.hitSerial; m.step(CONFIG.step, tape[t]!);
    if (m.field.lastOutcome !== lastOutcome) {
      lastOutcome = m.field.lastOutcome;
      const expected = run.decisions.find(d => (d as { tick: number }).tick === t + 1) as { status: string; witness?: string; committed: PlannedHazard[] } | undefined;
      if (!expected || expected.status !== lastOutcome!.status || expected.witness !== lastOutcome!.witness?.hash
        || JSON.stringify(expected.committed) !== JSON.stringify(lastOutcome!.status === 'committed' ? lastOutcome!.transaction!.hazards : [])) throw new Error('Actual model publication prefix differs');
    }
    if (serial !== m.hitSerial) events.push({ tick: t + 1, elapsed: m.elapsed, distance: m.distance, hull: m.hull,
      id: (run.hitEvents[events.length] as { id: string }).id });
  }
  if (JSON.stringify(events) !== JSON.stringify(run.hitEvents)) throw new Error('Actual model damage prefix differs');
  if (Math.abs(m.elapsed - (run.death?.seconds ?? run.seconds)) > 1e-8) throw new Error('Actual model survival differs');
  m.dispose();
}
