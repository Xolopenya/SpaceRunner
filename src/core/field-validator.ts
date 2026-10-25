import { CONFIG, difficulty } from '../config.ts';
import { FieldGenerator } from './field-generator.ts';
import { FlightPrediction } from './field-prediction.ts';
import { hazardVariant } from './hazard-profile.ts';
import { VALIDATION_LIMITS as L } from './field-validator-types.ts';
import { FIELD_LIMITS } from './field-settings.ts';
import type { FieldValidationContext, PlannedHazard } from './field-types.ts';
import type { FlightState } from './field-prediction.ts';
import type { ControlRun, TrajectoryResult, ValidationBudget, ValidationFailure, ValidationGeometry, ValidationMetrics, ValidationOptions, ValidationWitness } from './field-validator-types.ts';

type Rejection = Extract<TrajectoryResult, { decision: 'reject' }>;
type Operation = 'propagation' | 'query' | { readonly queries: number };
type Work<T> = Generator<Operation, T, void>;
/** Outward numerical guard only: never shrink either collision envelope.
 * Static-center conservative axial bounds and monotonic forward travel are required.
 */
export function runtimeAxialDisjoint(h: Pick<PlannedHazard, 'passDistance' | 'radius'>, from: number, to: number, margin: number): boolean {
  const guard = 1e-9 + 8 * Number.EPSILON * Math.max(1, Math.abs(h.passDistance), Math.abs(from), Math.abs(to));
  const extent = h.radius + CONFIG.ship.radius + margin + guard;
  return h.passDistance + extent < from || h.passDistance - extent > to;
}
interface Prepared {
  geometry?: ValidationGeometry;
  context: FieldValidationContext; hazards: readonly PlannedHazard[]; margin: number;
  policy: 'generator' | 'synthetic-fixture'; targetTick: number; controlEndTick: number; reserved: number;
  times: Float64Array; distances: Float64Array;
}
interface Node { state: FlightState; parent?: Node; run: ControlRun; tick: number; action: number; changes: number; score: number; serial: number }
interface Path { controls: readonly ControlRun[]; terminal: FlightState }
const ACTIONS = Object.freeze([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 },
  { x: 0, y: 1 }, { x: -1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 1, y: 1 }].map(action => Object.freeze(action)));
const PROFILES = ['sphere-v1', 'sphere-v1', 'half-meteor-v1', 'barrel-v1', 'generator-v1'];
const reject = (reason: ValidationFailure, detail?: string): Rejection => ({ decision: 'reject', reason, ...(detail ? { detail } : {}) });
const initial = (context: FieldValidationContext): FlightState => ({ ...context.player, elapsed: context.elapsed, distance: context.distance });
const neutral = (input: ControlRun['input']): boolean => input.x === 0 && input.y === 0;
const sameInput = (a: ControlRun['input'], b: ControlRun['input']): boolean => a.x === b.x && a.y === b.y;
const validInput = (input: ControlRun['input']): boolean => !!input && Number.isFinite(input.x) && Number.isFinite(input.y) && Math.abs(input.x) <= 1 && Math.abs(input.y) <= 1;
const counters = (): ValidationMetrics => ({ propagations: 0, narrowQueries: 0, broadPhaseSkips: 0, clockSteps: 0,
  searchPropagations: 0, replayPropagations: 0, replayQueries: 0, peakFrontier: 0, peakExpansion: 0, searches: 0, replays: 0, planningTicks: 0 });

/** Bounded deep copy: inputs have already passed finite/count/string checks. */
function snapshot(context: FieldValidationContext): FieldValidationContext {
  const provenance = (p: FieldValidationContext['candidate']['provenance']) => Object.freeze({ ...p,
    ...(p.pattern ? { pattern: Object.freeze({ ...p.pattern }) } : {}) });
  const copyHazard = (h: PlannedHazard) => Object.freeze({ ...h, provenance: provenance(h.provenance) });
  return Object.freeze({ ...context, player: Object.freeze({ ...context.player }), input: Object.freeze({ ...context.input }),
    committed: Object.freeze(context.committed.map(copyHazard)), candidate: Object.freeze({ ...context.candidate,
      provenance: provenance(context.candidate.provenance), hazards: Object.freeze(context.candidate.hazards.map(copyHazard)) }) });
}

function prepare(raw: FieldValidationContext, options: ValidationOptions, metrics: ValidationMetrics): Prepared | Rejection {
  if (!raw || !raw.player || !raw.input || !raw.candidate || !raw.candidate.provenance
    || !Array.isArray(raw.committed) || !Array.isArray(raw.candidate.hazards)) return reject('STRUCTURAL_INVALID', 'missing context data');
  const margin = options.margin ?? L.margin, policy = options.structuralPolicy ?? 'generator';
  const root = initial(raw);
  if (![root.x, root.y, root.vx, root.vy, root.elapsed, root.distance].every(Number.isFinite) || root.elapsed < 0 || root.elapsed > 1e9 || root.distance < 0 || root.distance > 1e11
    || Math.abs(root.x) > CONFIG.bounds.x || Math.abs(root.y) > CONFIG.bounds.y || Math.hypot(root.vx, root.vy) > CONFIG.ship.maxSpeed + 1e-12
    || !validInput(raw.input) || !Number.isFinite(margin) || margin < 0 || margin > 1
    || (policy !== 'generator' && policy !== 'synthetic-fixture')
    || raw.committed.length + raw.candidate.hazards.length > L.maxHazards) return reject('STRUCTURAL_INVALID', 'root/settings/count');
  const all = [...raw.committed, ...raw.candidate.hazards], ids = new Set<string>();
  for (const h of all) {
    const extended = !!h && !!options.geometry?.validHazard(h);
    if (!h || !h.provenance || ![h.x, h.y, h.passDistance, h.radius, h.phase, h.spin].every(Number.isFinite)
      || (!extended && (h.radius < .65 || h.radius > 1.1 || !Number.isInteger(h.kind) || h.kind < 0 || h.kind > 2))
      || h.phase < 0 || h.phase >= Math.PI * 2 || Math.abs(h.spin) > .7
      || typeof h.id !== 'string' || !h.id.length || h.id.length > 256 || ids.has(h.id)
      || typeof h.provenance.version !== 'string' || h.provenance.version.length > 128
      || typeof h.provenance.settingsKey !== 'string' || h.provenance.settingsKey.length > 128) return reject('STRUCTURAL_INVALID', 'hazard metadata/duplicate');
    if (!extended && (h.orientation !== 'euler-xyz-v1' || h.visualVariant !== hazardVariant(h.kind, h.phase)
      || h.collisionProfile !== PROFILES[h.visualVariant])) return reject('UNKNOWN_PROFILE', h.id);
    const cost = options.geometry?.queryCost(h) ?? 1;
    if (!Number.isInteger(cost) || cost < 1 || cost > 4) return reject('UNKNOWN_PROFILE', 'primitive accounting');
    const axial = options.geometry?.axialExtent(h) ?? h.radius;
    if (!Number.isFinite(axial) || axial <= 0 || axial > h.radius) return reject('UNKNOWN_PROFILE', 'axial bound');
    ids.add(h.id);
  }
  if (policy === 'generator') {
    try {
      const values = raw.candidate.provenance.settingsKey.split(':').map(Number);
      if (values.length !== 5) return reject('STRUCTURAL_INVALID', 'settings identity');
      const generator = new FieldGenerator(raw.candidate.provenance.seed, { halfX: values[0]!, halfY: values[1]!,
        depthJitter: values[2]!, separation: values[3]!, maxCandidates: values[4]! });
      const structure = options.geometry ? options.geometry.inspect(raw.candidate, raw.committed) : generator.inspect(raw.candidate, raw.committed);
      if (structure.status === 'invalid') return reject('STRUCTURAL_INVALID', structure.reason);
    } catch { return reject('STRUCTURAL_INVALID', 'generator settings'); }
  }
  const context = snapshot(raw), hazards = [...context.committed, ...context.candidate.hazards];
  let time = context.elapsed, distance = context.distance, lastCenter = distance, lastExit = distance;
  for (const h of hazards) { lastCenter = Math.max(lastCenter, h.passDistance); lastExit = Math.max(lastExit, h.passDistance + (options.geometry?.axialExtent(h) ?? h.radius) + CONFIG.ship.radius + margin); }
  let reserved = 0, targetTick = 0, controlEndTick = 0;
  const times = new Float64Array(L.horizonTicks + 1), distances = new Float64Array(L.horizonTicks + 1);
  times[0] = time; distances[0] = distance;
  for (let tick = 1; tick <= L.horizonTicks; tick++) {
    time += CONFIG.step; distance += difficulty(time).speed * CONFIG.step; metrics.clockSteps++;
    times[tick] = time; distances[tick] = distance;
    if (tick === L.reactionTicks) {
      const minimum = Math.max(lastCenter, distance) + L.terminalTail;
      reserved = context.reservedUntilDistance ?? minimum;
      if (!Number.isFinite(reserved) || reserved < minimum) return reject('INVALID_TERMINAL_STATE', 'insufficient reserved tail');
    }
    if (!controlEndTick && tick >= L.reactionTicks && distance > lastExit) {
      controlEndTick = tick; targetTick = tick + L.brakingTicks;
      if (targetTick > L.horizonTicks) return reject('HORIZON_EXCEEDED', 'braking continuation');
    }
    if (targetTick && tick === targetTick) break;
  }
  if (!targetTick || !controlEndTick || controlEndTick > targetTick) return reject('HORIZON_EXCEEDED');
  if (distance + CONFIG.hazards.maxRadius + CONFIG.ship.radius + margin > reserved) return reject('INVALID_TERMINAL_STATE', 'tail boundary clearance');
  return { context, hazards, margin, policy, targetTick, controlEndTick, reserved, times, distances, geometry: options.geometry };
}

/** Each yield is a pre-operation request; advance never exceeds either budget. */
function* simulate(state: FlightState, input: ControlRun['input'], ticks: number, p: Prepared,
  metrics: ValidationMetrics, broadPhase: boolean, prediction: FlightPrediction, startTick = 0, replayAxialCull = false): Work<{ id: string; step: number } | undefined> {
  const previous = { ...state };
  for (let tick = 0; tick < ticks; tick++) {
    yield 'propagation';
    previous.x = state.x; previous.y = state.y; previous.vx = state.vx; previous.vy = state.vy;
    previous.elapsed = state.elapsed; previous.distance = state.distance;
    if (broadPhase) prediction.stepAt(state, input, p.times[startTick + tick + 1]!, p.distances[startTick + tick + 1]!);
    else prediction.step(state, input); // replay independently recomputes its own clock
    if (broadPhase) metrics.searchPropagations++; else metrics.replayPropagations++;
    for (const h of p.hazards) {
      const radius = p.geometry?.axialExtent(h) ?? h.radius;
      const extent = radius + CONFIG.ship.radius + p.margin;
      if (replayAxialCull ? runtimeAxialDisjoint(p.geometry ? { passDistance: h.passDistance, radius } : h, previous.distance, state.distance, p.margin)
        : broadPhase && (h.passDistance + extent < previous.distance || h.passDistance - extent > state.distance)) {
        metrics.broadPhaseSkips++; continue;
      }
      const cost = p.geometry?.queryCost(h) ?? 1;
      yield cost === 1 ? 'query' : { queries: cost };
      if (!broadPhase) metrics.replayQueries += cost;
      if (prediction.hit(previous, state, h, p.margin)) return { id: h.id, step: tick + 1 };
      if (!broadPhase) {
        yield cost === 1 ? 'query' : { queries: cost }; metrics.replayQueries += cost;
        if (prediction.hitGameplay(previous, state, h)) return { id: h.id, step: tick + 1 };
      }
    }
  }
  return undefined;
}

function compact(runs: readonly ControlRun[]): readonly ControlRun[] {
  const result: { ticks: number; input: { x: number; y: number } }[] = [];
  for (const run of runs) {
    if (!run.ticks) continue;
    const last = result.at(-1);
    if (last && sameInput(last.input, run.input)) last.ticks += run.ticks;
    else result.push({ ticks: run.ticks, input: { ...run.input } });
  }
  return Object.freeze(result.map(run => Object.freeze({ ...run, input: Object.freeze(run.input) })));
}

/** Coarse lookahead GOALS ONLY. Never snap a state or use this screen for acceptance. */
function goalsFor(p: Prepared, distance: number): readonly { x: number; y: number }[] {
  const future = p.hazards.filter(h => h.passDistance + h.radius + CONFIG.ship.radius + p.margin >= distance);
  if (!future.length) return [{ x: 0, y: 0 }];
  const depth = Math.min(...future.map(h => h.passDistance));
  const near = future.filter(h => h.passDistance <= depth + L.goalDepthSpan);
  const goals: { x: number; y: number }[] = p.geometry ? near.flatMap(h => p.geometry!.goals(h)) : [];
  for (let column = 0; column < L.goalColumns; column++) for (let row = 0; row < L.goalRows; row++) {
    const x = -CONFIG.bounds.x + column * 2 * CONFIG.bounds.x / (L.goalColumns - 1);
    const y = -CONFIG.bounds.y + row * 2 * CONFIG.bounds.y / (L.goalRows - 1);
    if (near.every(h => Math.hypot(x - h.x, y - h.y) > h.radius + CONFIG.ship.radius + p.margin + L.goalClearance)) goals.push({ x, y });
  }
  return goals;
}

function ranking(state: FlightState, changes: number, goals: readonly { x: number; y: number }[]): number {
  let targetCost = Infinity;
  for (const goal of goals) targetCost = Math.min(targetCost, (state.x + state.vx * .25 - goal.x) ** 2 + (state.y + state.vy * .25 - goal.y) ** 2);
  if (!Number.isFinite(targetCost)) targetCost = 0;
  return targetCost + changes * .001 + (state.vx ** 2 + state.vy ** 2) * .00001
    + (state.x ** 2 + state.y ** 2) * .00001;
}

function* search(p: Prepared, metrics: ValidationMetrics): Work<Path | Rejection> {
  if (++metrics.searches > L.maxSearches) return reject('COMPUTATION_BUDGET_EXCEEDED', 'search limit');
  const prediction = p.geometry?.prediction() ?? new FlightPrediction(), root = initial(p.context);
  const prefixHit = yield* simulate(root, p.context.input, L.reactionTicks, p, metrics, true, prediction);
  if (prefixHit) return reject('INSUFFICIENT_REACTION_DISTANCE', prefixHit.id);
  let serial = 0, tick = L.reactionTicks;
  let frontier: Node[] = [{ state: root, run: { ticks: L.reactionTicks, input: p.context.input }, tick, action: -1,
    changes: 0, score: 0, serial: serial++ }];
  metrics.peakFrontier = Math.max(metrics.peakFrontier, 1);
  while (tick < p.controlEndTick) {
    const ticks = Math.min(L.macroTicks, p.controlEndTick - tick), expansion: Node[] = [];
    const goals = goalsFor(p, frontier[0]!.state.distance);
    for (const parent of frontier) for (let action = 0; action < ACTIONS.length; action++) {
      const input = ACTIONS[action]!, state = { ...parent.state };
      const hit = yield* simulate(state, input, ticks, p, metrics, true, prediction, parent.tick);
      if (hit) continue;
      const changes = parent.changes + (sameInput(parent.run.input, input) ? 0 : 1);
      expansion.push({ state, parent, run: { ticks, input }, tick: tick + ticks, action, changes,
        score: ranking(state, changes, goals), serial: serial++ });
    }
    metrics.peakExpansion = Math.max(metrics.peakExpansion, expansion.length);
    expansion.sort((a, b) => a.score - b.score || a.serial - b.serial);
    const bins = new Map<string, number>(); frontier = [];
    for (const node of expansion) {
      const s = node.state;
      const key = `${Math.floor(s.x / L.positionBin)},${Math.floor(s.y / L.positionBin)},${Math.floor(s.vx / L.velocityBin)},${Math.floor(s.vy / L.velocityBin)}`;
      const count = bins.get(key) ?? 0;
      if (count === L.representatives) continue;
      bins.set(key, count + 1); frontier.push(node);
      if (frontier.length === L.beamWidth) break;
    }
    metrics.peakFrontier = Math.max(metrics.peakFrontier, frontier.length);
    if (!frontier.length) return reject('NO_WITNESS_FOUND');
    tick += ticks;
  }
  for (const node of frontier) {
    const terminal = { ...node.state }, tailTicks = p.targetTick - node.tick;
    const hit = yield* simulate(terminal, ACTIONS[0]!, tailTicks, p, metrics, true, prediction, node.tick);
    if (hit || terminal.vx !== 0 || terminal.vy !== 0) continue;
    const runs: ControlRun[] = [];
    let cursor: Node | undefined = node;
    while (cursor) { runs.push(cursor.run); cursor = cursor.parent; }
    runs.reverse(); runs.push({ ticks: tailTicks, input: ACTIONS[0]! });
    return { controls: compact(runs), terminal };
  }
  return reject('INVALID_TERMINAL_STATE');
}

/** Noncryptographic reproduction hash. Never used as a substitute for replay. */
export function witnessHash(value: unknown): string {
  let hash = 2166136261;
  const serialized = JSON.stringify(value);
  for (let i = 0; i < serialized.length; i++) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function* replay(p: Prepared, controls: readonly ControlRun[], metrics: ValidationMetrics, axialCull = false): Work<TrajectoryResult> {
  if (++metrics.replays > L.maxReplays) return reject('COMPUTATION_BUDGET_EXCEEDED', 'replay limit');
  if (controls.length > L.horizonTicks || controls.some(run => !Number.isInteger(run.ticks) || run.ticks <= 0 || !validInput(run.input))
    || controls.reduce((sum, run) => sum + run.ticks, 0) !== p.targetTick) return reject('INVALID_TERMINAL_STATE', 'control duration');
  const state = initial(p.context), prediction = p.geometry?.prediction() ?? new FlightPrediction();
  let tick = 0;
  for (const run of controls) {
    if ((tick < L.reactionTicks && !sameInput(run.input, p.context.input)) || (tick + run.ticks > p.controlEndTick && !neutral(run.input))) {
      return reject('INVALID_TERMINAL_STATE', 'reaction or braking controls');
    }
    // Fresh integration, independent of search states/clock/safe flags. The runtime
    // gate may skip only strict axial disjointness of the enclosing swept sphere.
    const hit = yield* simulate(state, run.input, run.ticks, p, metrics, false, prediction, 0, axialCull);
    if (hit) return reject('COLLISION_FOUND', `${hit.id}@${tick + hit.step}`);
    tick += run.ticks;
  }
  if (state.vx !== 0 || state.vy !== 0 || Math.abs(state.x) > CONFIG.bounds.x || Math.abs(state.y) > CONFIG.bounds.y
    || state.distance + CONFIG.hazards.maxRadius + CONFIG.ship.radius + p.margin > p.reserved) return reject('INVALID_TERMINAL_STATE');
  const record = { version: L.version, context: p.context, margin: p.margin, structuralPolicy: p.policy,
    ...(p.geometry ? { geometryVersion: p.geometry.version } : {}),
    reservedUntilDistance: p.reserved, controls: compact(controls), terminal: Object.freeze({ ...state }) };
  return { decision: 'accept', witness: Object.freeze({ ...record, hash: witnessHash(record) }) };
}

function* validation(union: Prepared, options: ValidationOptions, metrics: ValidationMetrics): Work<TrajectoryResult> {
  // A complete encounter was checked above. The committed-only analysis uses a
  // normal empty ambient header; partial encounters remain structurally invalid.
  const baseProvenance = union.context.candidate.provenance.pattern || union.geometry ? { version: FIELD_LIMITS.version,
    seed: union.context.candidate.provenance.seed, settingsKey: union.context.candidate.provenance.settingsKey } : union.context.candidate.provenance;
  const base = prepare({ ...union.context, candidate: { ...union.context.candidate, provenance: baseProvenance, hazards: [] } }, options, metrics);
  if ('decision' in base) return reject('EXISTING_FIELD_UNCERTIFIED', base.reason);
  const basePath = yield* search(base, metrics);
  if ('decision' in basePath) return reject('EXISTING_FIELD_UNCERTIFIED', basePath.reason);
  const baseReplay = yield* replay(base, basePath.controls, metrics);
  if (baseReplay.decision === 'reject') return reject('REPLAY_DISAGREEMENT', baseReplay.reason);
  if (!union.context.candidate.hazards.length) return baseReplay;
  const path = yield* search(union, metrics);
  if ('decision' in path) return path;
  const checked = yield* replay(union, path.controls, metrics);
  if (checked.decision === 'reject') return reject('REPLAY_DISAGREEMENT', checked.reason);
  if (JSON.stringify(checked.witness.terminal) !== JSON.stringify(path.terminal)) return reject('REPLAY_DISAGREEMENT', 'terminal state');
  return checked;
}

/** One advance call is one distinct logical planning tick, not a wall-time timeout. */
export class ValidationJob {
  private readonly counts: ValidationMetrics;
  private readonly iterator: Work<TrajectoryResult>;
  private pending: IteratorResult<Operation, TrajectoryResult> | undefined;
  private result: TrajectoryResult | undefined;
  private tick = 0;

  constructor(build: (metrics: ValidationMetrics) => Work<TrajectoryResult>, metrics = counters()) {
    this.counts = metrics; this.iterator = build(this.counts);
  }
  get metrics(): Readonly<ValidationMetrics> { return { ...this.counts }; }
  getResult(): TrajectoryResult | undefined { return this.result; }

  advance(budget: ValidationBudget = { propagations: L.defaultPropagationsPerTick, narrowQueries: L.defaultQueriesPerTick }, planningTick = this.tick + 1): TrajectoryResult | undefined {
    if (this.result) return this.result;
    if (!Number.isInteger(planningTick) || planningTick <= this.tick || !Number.isInteger(budget.propagations)
      || !Number.isInteger(budget.narrowQueries) || budget.propagations < 0 || budget.narrowQueries < 0
      || budget.propagations > L.propagationsPerTick || budget.narrowQueries > L.queriesPerTick) throw new RangeError('Invalid planning tick/work budget');
    this.tick = planningTick; this.counts.planningTicks = planningTick;
    if (planningTick > L.deadlineTicks) return this.finish(reject('COMPUTATION_BUDGET_EXCEEDED', 'deadline'));
    let propagations = 0, queries = 0;
    this.pending ??= this.iterator.next();
    while (!this.pending.done) {
      if (this.pending.value === 'propagation') {
        if (propagations === budget.propagations) break;
        propagations++; this.counts.propagations++;
      } else {
        const cost = this.pending.value === 'query' ? 1 : this.pending.value.queries;
        // A compound query is atomic: reserve ALL its primitive work in this
        // call, never charge some boxes to a previous tick and execute them now.
        if (queries + cost > budget.narrowQueries) break;
        queries += cost; this.counts.narrowQueries += cost;
      }
      this.pending = this.iterator.next();
    }
    if (this.pending.done) return this.finish(this.pending.value);
    if (planningTick === L.deadlineTicks) return this.finish(reject('COMPUTATION_BUDGET_EXCEEDED', 'deadline'));
    return undefined;
  }

  private finish(result: TrajectoryResult): TrajectoryResult {
    this.result = Object.freeze(result);
    this.iterator.return(this.result); this.pending = undefined;
    return this.result;
  }
}

export function beginValidation(context: FieldValidationContext, options: ValidationOptions = {}): ValidationJob {
  // Snapshot at begin, not at first advance: caller cannot change a queued root.
  options = Object.freeze({ ...options });
  const metrics = counters(), checked = prepare(context, options, metrics);
  return new ValidationJob(metrics => 'decision' in checked ? (function* () { return checked; })()
    : validation(checked, options, metrics), metrics);
}

export function beginTrajectoryReplay(context: FieldValidationContext, controls: readonly ControlRun[], options: ValidationOptions = {}): ValidationJob {
  if (!Array.isArray(controls) || controls.length > L.horizonTicks || controls.some(run => !run || !validInput(run.input))) {
    return new ValidationJob(function* () { return reject('INVALID_TERMINAL_STATE', 'control count/input'); });
  }
  const metrics = counters(), p = prepare(context, options, metrics);
  const copy = controls.map(run => ({ ticks: run.ticks, input: { ...run.input } }));
  return new ValidationJob(metrics => 'decision' in p ? (function* () { return p; })() : replay(p, copy, metrics), metrics);
}

export function beginPublicationCheck(witness: ValidationWitness, current: FieldValidationContext, options: ValidationOptions = {}): ValidationJob {
  return publicationCheck(witness, current, options, false);
}

/** Actual-state runtime gate. Caller must finish this job and atomically commit
 * in the SAME synchronous tick; unfinished work never carries publication proof.
 * Historical full-query replay remains unchanged and is the differential oracle.
 */
export function beginRuntimePublicationCheck(witness: ValidationWitness, current: FieldValidationContext, options: ValidationOptions = {}): ValidationJob {
  if (witness.margin !== L.margin || witness.structuralPolicy !== 'generator') {
    return new ValidationJob(function* () { return reject('STALE_PUBLICATION_STATE', 'runtime requires normal policy and approved margin'); });
  }
  return publicationCheck(witness, current, options, true);
}

function publicationCheck(witness: ValidationWitness, current: FieldValidationContext, options: ValidationOptions, axialCull: boolean): ValidationJob {
  if (witness.controls.length > L.horizonTicks || witness.controls.some(run => !Number.isInteger(run.ticks) || run.ticks <= 0 || run.ticks > L.horizonTicks || !validInput(run.input))) {
    return new ValidationJob(function* () { return reject('STALE_PUBLICATION_STATE', 'invalid witness controls'); });
  }
  witness = Object.freeze({ ...witness, context: snapshot(witness.context), controls: compact(witness.controls) });
  const metrics = counters(), p = prepare(current, { ...options, margin: witness.margin }, metrics);
  return new ValidationJob(function* (metrics) {
    if ('decision' in p) return reject('STALE_PUBLICATION_STATE', p.reason);
    if (witness.version !== L.version || witness.structuralPolicy !== p.policy || witness.geometryVersion !== p.geometry?.version
      || p.context.elapsed < witness.context.elapsed || p.context.elapsed - witness.context.elapsed > L.deadlineTicks * CONFIG.step + 1e-9
      || p.context.distance < witness.context.distance
      || JSON.stringify(p.context.candidate) !== JSON.stringify(witness.context.candidate)
      || p.context.candidate.hazards.some(h => h.passDistance - h.radius - CONFIG.ship.radius - p.margin <= p.context.distance)) {
      return reject('STALE_PUBLICATION_STATE', 'identity/deadline/warning');
    }
    const runs: ControlRun[] = [];
    let runIndex = 0, remaining = witness.controls[0]?.ticks ?? 0;
    for (let tick = 0; tick < p.targetTick; tick++) {
      while (remaining === 0 && runIndex < witness.controls.length) { runIndex++; remaining = witness.controls[runIndex]?.ticks ?? 0; }
      const oldInput = witness.controls[runIndex]?.input ?? ACTIONS[0]!;
      const input = tick < L.reactionTicks ? p.context.input : tick >= p.controlEndTick ? ACTIONS[0]! : oldInput;
      runs.push({ ticks: 1, input }); if (remaining) remaining--;
    }
    const result = yield* replay(p, compact(runs), metrics, axialCull);
    return result.decision === 'accept' ? result : reject('STALE_PUBLICATION_STATE', result.reason + ':' + (result.detail ?? ''));
  }, metrics);
}
