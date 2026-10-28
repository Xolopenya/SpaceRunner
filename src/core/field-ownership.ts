import { CONFIG } from '../config.ts';
import { FIELD_LIMITS as F } from './field-settings.ts';
import { DIRECTOR_SETTINGS as S } from './field-director-settings.ts';
import type { PlannedHazard } from './field-types.ts';

/** Exact domain identity; IDs alone cannot authorize changed poses or provenance. */
export function sameHazard(a: PlannedHazard, b: PlannedHazard): boolean {
  if (!a || !b || !a.provenance || !b.provenance) return false;
  if (a === b) return true;
  const p = a.provenance, q = b.provenance, x = p.pattern, y = q.pattern;
  return a.id === b.id && a.ownerCell === b.ownerCell && a.localIndex === b.localIndex && a.anchorCell === b.anchorCell
    && a.passDistance === b.passDistance && a.x === b.x && a.y === b.y && a.radius === b.radius
    && a.kind === b.kind && a.visualVariant === b.visualVariant && a.collisionProfile === b.collisionProfile
    && a.spin === b.spin && a.phase === b.phase && a.orientation === b.orientation
    && (a.motion ? !!b.motion && a.motion.version === b.motion.version && a.motion.startTick === b.motion.startTick
      && a.motion.durationTicks === b.motion.durationTicks && a.motion.velocityX === b.motion.velocityX : !b.motion)
    && p.version === q.version && p.seed === q.seed && p.settingsKey === q.settingsKey
    && (x ? !!y && x.family === y.family && x.firstCell === y.firstCell && x.cellCount === y.cellCount
      && x.variation === y.variation && x.intensity === y.intensity && x.mirrorX === y.mirrorX && x.mirrorY === y.mirrorY
      && x.offsetX === y.offsetX && x.offsetY === y.offsetY : !y);
}

export interface OwnershipRecord {
  readonly token: string;
  readonly writer: string;
  readonly firstCell: number;
  readonly cellCount: number;
  readonly ids: readonly string[];
  readonly hazards: readonly PlannedHazard[];
  readonly state: 'pending' | 'committed' | 'omitted';
}
export type ReservationResult = { readonly status: 'reserved'; readonly token: string }
  | { readonly status: 'rejected'; readonly reason: 'INVALID_SPAN' | 'OWNERSHIP_CONFLICT' | 'FRONTIER' | 'CAPACITY' | 'DUPLICATE_ID' };

/** One monotonic writer frontier plus bounded full-span records, independent of visible hazards. */
export class OwnershipLedger {
  private generation = 0;
  private serial = 0;
  private frontierCell: number = S.firstCell;
  private retiredDistance = 0;
  private records: OwnershipRecord[] = [];
  get frontier(): number { return this.frontierCell; }
  snapshot(): readonly OwnershipRecord[] { return Object.freeze([...this.records]); }
  knownHazards(distance: number): readonly PlannedHazard[] {
    return Object.freeze(this.records.filter(r => r.state === 'committed').flatMap(r => r.hazards)
      .filter(h => distance <= h.passDistance + h.radius + CONFIG.hazards.despawnZ));
  }
  hasCompleteField(hazards: readonly PlannedHazard[], distance: number): boolean {
    for (const record of this.records) if (record.state === 'committed') for (const h of record.hazards) {
      if (distance <= h.passDistance + h.radius + CONFIG.hazards.despawnZ && !hazards.some(c => sameHazard(c, h))) return false;
    }
    return true;
  }
  reset(firstCell: number = S.firstCell): void {
    if (!Number.isInteger(firstCell) || firstCell < 0 || firstCell > F.maxCell) throw new RangeError('Invalid ledger frontier');
    this.generation++; this.serial = 0; this.frontierCell = firstCell; this.retiredDistance = 0; this.records = [];
  }
  reserve(writer: string, firstCell: number, cellCount: number, ids: readonly string[], hazards: readonly PlannedHazard[] = []): ReservationResult {
    if (!writer || writer.length > 512 || !Number.isInteger(firstCell) || firstCell < 0 || !Number.isInteger(cellCount)
      || cellCount < F.minCells || cellCount > F.maxCells || firstCell + cellCount - 1 > F.maxCell
      || ids.length > F.maxCandidates || ids.some(id => typeof id !== 'string' || !id.length || id.length > 256)
      || (hazards.length && (hazards.length !== ids.length || hazards.some((h, i) => h.id !== ids[i])))) return { status: 'rejected', reason: 'INVALID_SPAN' };
    if (this.records.some(r => r.state === 'pending' || (firstCell < r.firstCell + r.cellCount && firstCell + cellCount > r.firstCell))) return { status: 'rejected', reason: 'OWNERSHIP_CONFLICT' };
    if (firstCell !== this.frontierCell) return { status: 'rejected', reason: 'FRONTIER' };
    if (this.records.length >= S.maxOwnershipRecords) return { status: 'rejected', reason: 'CAPACITY' };
    const existing = new Set(this.records.flatMap(r => r.ids));
    if (new Set(ids).size !== ids.length || ids.some(id => existing.has(id))) return { status: 'rejected', reason: 'DUPLICATE_ID' };
    const token = `${this.generation}/${this.serial++}`;
    const copy = hazards.map(h => Object.freeze({ ...h, ...(h.motion ? { motion: Object.freeze({ ...h.motion }) } : {}), provenance: Object.freeze({ ...h.provenance,
      ...(h.provenance.pattern ? { pattern: Object.freeze({ ...h.provenance.pattern }) } : {}) }) }));
    this.records.push(Object.freeze({ token, writer, firstCell, cellCount, ids: Object.freeze([...ids]), hazards: Object.freeze(copy), state: 'pending' }));
    return { status: 'reserved', token };
  }
  cancel(token: string): boolean {
    const index = this.records.findIndex(r => r.token === token && r.state === 'pending');
    if (index < 0) return false;
    this.records.splice(index, 1); return true;
  }
  finalize(token: string, state: 'committed' | 'omitted'): boolean {
    const index = this.records.findIndex(r => r.token === token && r.state === 'pending');
    if (index < 0) return false;
    const record = this.records[index]!;
    this.records[index] = Object.freeze({ ...record, state }); this.frontierCell += record.cellCount; return true;
  }
  retire(distance: number): number {
    if (!Number.isFinite(distance) || distance < this.retiredDistance) throw new RangeError('Retirement distance must be monotonic');
    this.retiredDistance = distance;
    const before = this.records.length;
    this.records = this.records.filter(r => r.state === 'pending'
      || distance <= (r.firstCell + r.cellCount) * F.cellSize + CONFIG.hazards.maxRadius + CONFIG.hazards.despawnZ);
    return before - this.records.length;
  }
}
