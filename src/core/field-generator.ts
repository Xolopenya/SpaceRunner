import { Random } from './random.ts';
import { hazardVariant } from './hazard-profile.ts';
import { DEFAULT_FIELD_SETTINGS, FIELD_LIMITS, fieldSettings, fieldSettingsKey } from './field-settings.ts';
import type { FieldSettings } from './field-settings.ts';
import type { FieldProfile, FieldProvenance, FieldTransaction, PlannedHazard, StructuralReason, StructuralResult } from './field-types.ts';

const PROFILES: readonly FieldProfile[] = ['sphere-v1', 'sphere-v1', 'half-meteor-v1', 'barrel-v1', 'generator-v1'];

/** Explicit uint32 avalanche; version and purpose tags are part of the v1 contract. */
function mix(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function stream(seed: number, anchor: number, purpose: number): Random {
  return new Random(mix(mix(seed ^ 0x41b10001) ^ mix(anchor) ^ purpose));
}

function validCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell <= FIELD_LIMITS.maxCell;
}

function validSpan(first: number, count: number): boolean {
  return validCell(first) && Number.isInteger(count) && count >= FIELD_LIMITS.minCells
    && count <= FIELD_LIMITS.maxCells && validCell(first + count - 1);
}

function sameProvenance(a: FieldProvenance, b: FieldProvenance): boolean {
  return a.version === b.version && a.seed === b.seed && a.settingsKey === b.settingsKey;
}

function identifier(provenance: FieldProvenance, owner: number, local: number): string {
  return `${provenance.version}/${provenance.seed}/${provenance.settingsKey}/${owner}/${local}`;
}

/** Isolated random-access proposal builder. No retained cells, frontier, pool or live-world writes. */
export class FieldGenerator {
  readonly settings: Readonly<FieldSettings>;
  private provenance!: Readonly<FieldProvenance>;

  constructor(seed: number, settings: Readonly<FieldSettings> = DEFAULT_FIELD_SETTINGS) {
    this.settings = fieldSettings(settings);
    this.reset(seed);
  }

  reset(seed: number): void {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be uint32');
    this.provenance = Object.freeze({ version: FIELD_LIMITS.version, seed, settingsKey: fieldSettingsKey(this.settings) });
  }

  propose(firstCell: number, cellCount: number): FieldTransaction {
    if (!validSpan(firstCell, cellCount)) throw new RangeError('Transaction must own 2–6 legal cells');
    const hazards: PlannedHazard[] = [];
    for (let owner = firstCell; owner < firstCell + cellCount; owner++) {
      // A depth anchor can fall into its own cell or the previous one. Inspect
      // both keys; half-open ownership admits each point exactly once.
      for (let local = 0; local < 2; local++) {
        const anchor = owner + local;
        const depth = stream(this.provenance.seed, anchor, 0xd3e17).between(-this.settings.depthJitter, this.settings.depthJitter);
        const passDistance = anchor * FIELD_LIMITS.cellSize + depth;
        if (Math.floor(passDistance / FIELD_LIMITS.cellSize) !== owner) continue;
        if (hazards.length === this.settings.maxCandidates) throw new RangeError('Candidate count exceeds configured limit');
        const random = stream(this.provenance.seed, anchor, 0x905e);
        const x = random.between(-this.settings.halfX, this.settings.halfX);
        const y = random.between(-this.settings.halfY, this.settings.halfY);
        const radius = random.between(FIELD_LIMITS.minRadius, FIELD_LIMITS.maxRadius);
        const kind = Math.floor(random.next() * 3);
        const spin = random.between(-FIELD_LIMITS.maxSpin, FIELD_LIMITS.maxSpin);
        const phase = random.between(0, Math.PI * 2);
        const visualVariant = hazardVariant(kind, phase);
        hazards.push(Object.freeze({ id: identifier(this.provenance, owner, local), ownerCell: owner,
          localIndex: local, anchorCell: anchor, passDistance, x, y, radius, kind, spin, phase, visualVariant,
          collisionProfile: PROFILES[visualVariant]!, orientation: 'euler-xyz-v1', provenance: this.provenance }));
      }
    }
    return Object.freeze({ firstCell, cellCount, startDistance: firstCell * FIELD_LIMITS.cellSize,
      endDistance: (firstCell + cellCount) * FIELD_LIMITS.cellSize, provenance: this.provenance, hazards: Object.freeze(hazards) });
  }

  /** Structural admission only; NEVER a reachability certificate or publication. */
  inspect(transaction: FieldTransaction, committed: readonly PlannedHazard[] = []): StructuralResult {
    const invalid = (reason: StructuralReason): StructuralResult => ({ status: 'invalid', reason });
    const { firstCell, cellCount, startDistance, endDistance, hazards } = transaction;
    if (!validSpan(firstCell, cellCount) || startDistance !== firstCell * FIELD_LIMITS.cellSize
      || endDistance !== (firstCell + cellCount) * FIELD_LIMITS.cellSize) return invalid('transaction');
    if (hazards.length > this.settings.maxCandidates || committed.length + hazards.length > FIELD_LIMITS.hardActive) return invalid('capacity');
    if (!sameProvenance(transaction.provenance, this.provenance)) return invalid('provenance');
    const all = [...committed, ...hazards]; // length checked before allocation, at most32
    const ids = new Set<string>();
    const anchors = new Set<number>();
    for (let i = 0; i < all.length; i++) {
      const hazard = all[i]!;
      if (!sameProvenance(hazard.provenance, this.provenance)) return invalid('provenance');
      if (![hazard.x, hazard.y, hazard.passDistance, hazard.radius, hazard.spin, hazard.phase].every(Number.isFinite)
        || !Number.isInteger(hazard.kind) || hazard.kind < 0 || hazard.kind > 2
        || hazard.visualVariant !== hazardVariant(hazard.kind, hazard.phase)
        || hazard.collisionProfile !== PROFILES[hazard.visualVariant] || hazard.orientation !== 'euler-xyz-v1'
        || hazard.phase < 0 || hazard.phase >= Math.PI * 2 || Math.abs(hazard.spin) > FIELD_LIMITS.maxSpin) return invalid('metadata');
      if (Math.abs(hazard.x) > this.settings.halfX || Math.abs(hazard.y) > this.settings.halfY
        || hazard.radius < FIELD_LIMITS.minRadius || hazard.radius > FIELD_LIMITS.maxRadius) return invalid('bounds');
      if (!validCell(hazard.ownerCell) || Math.floor(hazard.passDistance / FIELD_LIMITS.cellSize) !== hazard.ownerCell
        || (hazard.localIndex !== 0 && hazard.localIndex !== 1) || hazard.anchorCell !== hazard.ownerCell + hazard.localIndex) return invalid('ownership');
      if (hazard.id !== identifier(hazard.provenance, hazard.ownerCell, hazard.localIndex)) return invalid('metadata');
      if (ids.has(hazard.id) || anchors.has(hazard.anchorCell)) return invalid('duplicate');
      ids.add(hazard.id);
      anchors.add(hazard.anchorCell);
      const inside = hazard.ownerCell >= firstCell && hazard.ownerCell < firstCell + cellCount;
      if (inside !== (i >= committed.length)) return invalid('ownership');
      for (let j = 0; j < i; j++) {
        const other = all[j]!;
        if (Math.hypot(hazard.x - other.x, hazard.y - other.y, hazard.passDistance - other.passDistance)
          < hazard.radius + other.radius + this.settings.separation) return invalid('separation');
      }
    }
    return { status: 'valid', candidateCount: hazards.length, totalCount: all.length, aboveSoftLimit: all.length > FIELD_LIMITS.softActive };
  }
}
