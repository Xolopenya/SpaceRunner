import { CONFIG } from '../config.ts';
import { ObstacleField } from '../core/obstacles.ts';
import { DifficultyDirector } from '../core/field-director.ts';
import { DIRECTOR_SETTINGS as S } from '../core/field-director-settings.ts';
import { OwnershipLedger, sameHazard } from '../core/field-ownership.ts';
import { RuntimePlanningSession } from '../core/field-runtime-session.ts';
import type { DirectorCursor } from '../core/field-director.ts';
import type { Hazard } from '../core/obstacles.ts';
import type { PlannedHazard } from '../core/field-types.ts';
import type { PlanningOutcome, SchedulerRoot } from '../core/field-scheduler.ts';
import type { ValidationWitness } from '../core/field-validator-types.ts';
import { FIELD_POLICIES } from '../core/field-policy.ts';
import type { FieldPolicy } from '../core/field-policy.ts';

export const RUNTIME_SETTINGS = Object.freeze({ firstCell: 4, eventLimit: 64, sampleLimit: 2048 });
interface RuntimeSlot extends Hazard { planned?: PlannedHazard }
export interface RuntimeEvent {
  policy: FieldPolicy; version: string;
  index: number; family: string; pacing: string; status: string; reason?: string; count: number;
  distance: number; elapsed: number; x: number; y: number; vx: number; vy: number;
  input: { x: number; y: number }; warning?: number; witness?: string; ids: readonly string[];
}

/** Dev-only adapter over the SAME72 records consumed by GameModel and World.
 * Logical geometry survives damage/render despawn until its independent expiry.
 */
export class RuntimeObstacleField extends ObstacleField {
  readonly policy: typeof FIELD_POLICIES[FieldPolicy];
  readonly ledger = new OwnershipLedger();
  readonly slots: RuntimeSlot[] = this.hazards;
  readonly events: RuntimeEvent[] = [];
  readonly samples: { phase: string; ms: number; propagations: number; queries: number }[] = [];
  lastOutcome?: PlanningOutcome;
  certificate?: ValidationWitness;
  pending?: RuntimePlanningSession;
  fault?: string;
  planningTicks = 0;
  scheduled = 0;
  committed = 0;
  omitted = 0;
  preparationMs = 0;
  schedulerMs = 0;
  maxChunkMs = 0;
  firstPublication?: number;
  firstOpportunity?: number;
  private director = new DifficultyDirector(1);
  private cursor: DirectorCursor = this.director.initial(RUNTIME_SETTINGS.firstCell);
  private age = 0;
  private readonly observe: () => SchedulerRoot;

  constructor(observe: () => SchedulerRoot, policy: FieldPolicy = 'baseline') {
    super(); this.observe = observe; this.policy = FIELD_POLICIES[policy];
  }

  override reset(seed: number): void {
    this.pending?.cancel(); this.pending = undefined; super.reset(seed);
    this.director = new DifficultyDirector(seed, this.policy.name); this.cursor = this.director.initial(RUNTIME_SETTINGS.firstCell);
    this.ledger.reset(RUNTIME_SETTINGS.firstCell);
    for (const slot of this.slots) slot.planned = undefined;
    this.events.length = this.samples.length = 0; this.lastOutcome = undefined; this.certificate = undefined; this.fault = undefined;
    this.planningTicks = this.scheduled = this.committed = this.omitted = this.age = 0;
    this.preparationMs = this.schedulerMs = this.maxChunkMs = 0; this.firstPublication = this.firstOpportunity = undefined;
  }

  override update(_dt: number, _speed: number, distance: number, elapsed: number): void {
    for (const slot of this.slots) {
      const h = slot.planned;
      if (!h) { if (slot.active) this.fault = 'UNKNOWN_POOL_HAZARD'; continue; }
      if (slot.x !== h.x || slot.y !== h.y || slot.radius !== h.radius || slot.kind !== h.kind || slot.phase !== h.phase || slot.spin !== h.spin) this.fault = 'CHANGED_POOL_GEOMETRY';
      slot.z = distance - h.passDistance;
      if (slot.z > CONFIG.hazards.despawnZ) slot.active = false;
      if (distance > h.passDistance + h.radius + CONFIG.hazards.despawnZ) { slot.active = false; slot.planned = undefined; }
      if (Math.abs(slot.z) <= h.radius + CONFIG.ship.radius + .15) this.firstOpportunity ??= elapsed;
    }
    this.ledger.retire(distance);
    const known = this.ledger.knownHazards(distance), represented = this.slots.filter(s => s.planned);
    if (represented.length !== known.length || new Set(represented.map(s => s.planned!.id)).size !== represented.length
      || represented.some(s => !known.some(h => sameHazard(s.planned!, h)))) this.fault = 'INCOMPLETE_POOL_FIELD';
    if (this.fault) { this.pending?.cancel(); this.pending = undefined; return; }
    const root = this.observe();
    if (!this.pending && (!this.scheduled || this.cursor.firstCell * 24 - distance <= S.planningLead)) {
      const decision = this.director.next(this.cursor); this.cursor = decision.next; this.scheduled++;
      const started = performance.now(); this.pending = new RuntimePlanningSession(decision.section, root, known, this.ledger);
      const ms = performance.now() - started; this.preparationMs += ms; this.schedulerMs += ms; this.age = 0;
      if (this.pending.getResult()?.status === 'blocked') { this.fault = this.pending.getResult()!.reason; this.pending = undefined; return; }
    }
    const pending = this.pending;
    if (!pending) return;
    // Preflight ALL slots before a session may finalize source ownership. With
    // <=32 logical records and72 slots this always has >=12 spare unless corrupt.
    const free = this.age === S.publicationTicks - 1 ? this.slots.filter(s => !s.planned && !s.active) : [];
    if (this.age === S.publicationTicks - 1 && free.length < 12) { this.fault = 'POOL_CAPACITY'; pending.cancel(); this.pending = undefined; return; }
    const phase = this.age === S.publicationTicks - 1 ? 'actual-gate' : pending.phase, before = pending.metrics, start = performance.now();
    const outcome = pending.advance(root, known, ++this.age), ms = performance.now() - start, after = pending.metrics;
    this.schedulerMs += ms; this.maxChunkMs = Math.max(this.maxChunkMs, ms); this.planningTicks++;
    if (this.samples.length === RUNTIME_SETTINGS.sampleLimit) this.samples.shift();
    this.samples.push({ phase, ms, propagations: after.propagations - before.propagations, queries: after.narrowQueries - before.narrowQueries });
    if (!outcome) return;
    this.lastOutcome = outcome;
    if (outcome.witness) this.certificate = outcome.witness;
    if (outcome.status === 'committed') {
      // No await, event callback, renderer call or partial-capacity fallback
      // exists between actual-state replay and this complete atomic admission.
      for (const [i,h] of outcome.transaction!.hazards.entries()) Object.assign(free[i]!, {
        planned: h, active: true, x: h.x, y: h.y, z: distance - h.passDistance, radius: h.radius, kind: h.kind, spin: h.spin, phase: h.phase });
      this.committed++; this.firstPublication ??= elapsed;
    } else if (outcome.status === 'blocked') this.fault = outcome.reason;
    else this.omitted++;
    const ids = outcome.status === 'committed' ? outcome.transaction!.hazards.map(h => h.id) : [];
    const warning = outcome.status === 'committed' && ids.length ? Math.min(...outcome.transaction!.hazards.map(h => h.passDistance-h.radius-CONFIG.ship.radius-.15))-distance : undefined;
    if (this.events.length === RUNTIME_SETTINGS.eventLimit) this.events.shift();
    this.events.push({ policy: this.policy.name, version: this.policy.version, index: outcome.section.index, family: outcome.section.family, pacing: outcome.section.pacing, status: outcome.status,
      reason: outcome.reason, count: ids.length, distance, elapsed, ...root.player, input: { ...root.input }, warning, witness: outcome.witness?.hash, ids });
    this.pending = undefined;
  }
}
