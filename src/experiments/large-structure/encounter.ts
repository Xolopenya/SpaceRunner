import { FieldGenerator } from '../../core/field-generator.ts';
import { FIELD_LIMITS as F, DEFAULT_FIELD_SETTINGS, fieldSettingsKey } from '../../core/field-settings.ts';
import type { FieldTransaction, PlannedHazard, StructuralResult } from '../../core/field-types.ts';
import type { ValidationGeometry } from '../../core/field-validator-types.ts';
import type { RuntimeEncounterSource } from '../../debug/runtime-field.ts';
import { BULKHEAD as B, BulkheadPrediction, isBulkhead } from './profile.ts';

export const APERTURES = Object.freeze({
  center: Object.freeze({ x: 0, y: 0 }), left: Object.freeze({ x: -3, y: 0 }), right: Object.freeze({ x: 3, y: 0 }),
  upper: Object.freeze({ x: 0, y: 1.9 }), lower: Object.freeze({ x: 0, y: -1.9 }),
});
export type Aperture = keyof typeof APERTURES;
export const APERTURE_NAMES = Object.freeze(Object.keys(APERTURES) as Aperture[]);
const settingsKey = fieldSettingsKey(DEFAULT_FIELD_SETTINGS);

export function apertureSelector(value: string | null): Aperture | undefined {
  if (value === null) return undefined;
  if (Object.hasOwn(APERTURES, value)) return value as Aperture;
  throw new RangeError(`Unknown bulkhead aperture: ${value}`);
}

export function structureTransaction(seed: number, firstCell = 4, aperture: Aperture = 'center'): FieldTransaction {
  // Reuse the original strict uint32/span validation, not a synthetic-fixture policy.
  new FieldGenerator(seed).propose(firstCell, B.cellCount);
  if (!Object.hasOwn(APERTURES, aperture)) throw new RangeError('Unknown aperture');
  const provenance = Object.freeze({ version: B.encounterVersion, seed, settingsKey });
  const passDistance = firstCell * F.cellSize + B.centerOffset, ownerCell = Math.floor(passDistance / F.cellSize);
  const h: PlannedHazard = Object.freeze({
    id: `${B.encounterVersion}/${seed}/${firstCell}/${aperture}`, ownerCell, anchorCell: ownerCell, localIndex: 0,
    passDistance, ...APERTURES[aperture], radius: B.radius, kind: 3, visualVariant: 5,
    spin: 0, phase: 0, collisionProfile: B.version, orientation: 'euler-xyz-v1', provenance,
  });
  return Object.freeze({ firstCell, cellCount: B.cellCount, startDistance: firstCell * F.cellSize,
    endDistance: (firstCell + B.cellCount) * F.cellSize, provenance, hazards: Object.freeze([h]) });
}

function canonical(h: PlannedHazard): boolean {
  if (!h || !h.provenance || !isBulkhead(h) || h.provenance.version !== B.encounterVersion) return false;
  const parts = h.id.split('/'), first = Number(parts[2]), aperture = parts[3] as Aperture;
  if (parts.length !== 4 || !Object.hasOwn(APERTURES, aperture)) return false;
  try {
    const expected = structureTransaction(h.provenance.seed, first, aperture).hazards[0]!;
    return Object.keys(expected).every(key => key === 'provenance'
      ? h.provenance.version === expected.provenance.version && h.provenance.seed === expected.provenance.seed && h.provenance.settingsKey === settingsKey && h.provenance.pattern === undefined
      : h[key as keyof PlannedHazard] === expected[key as keyof PlannedHazard]);
  } catch { return false; }
}

export const BULKHEAD_GEOMETRY: ValidationGeometry = Object.freeze({
  version: 'bulkhead-size-contract-v1', validHazard: canonical,
  queryCost: (h: PlannedHazard) => isBulkhead(h) ? B.primitiveCount : 1,
  axialExtent: (h: PlannedHazard) => isBulkhead(h) ? B.halfZ : h.radius,
  prediction: () => new BulkheadPrediction(),
  goals: (h: PlannedHazard) => isBulkhead(h) ? [{ x: h.x, y: h.y }] : [],
  inspect(candidate: FieldTransaction, committed: readonly PlannedHazard[]): StructuralResult {
    const invalid = (reason: 'metadata' | 'incomplete' | 'ownership' | 'separation' | 'capacity' | 'provenance'): StructuralResult => ({ status: 'invalid', reason });
    const all = [...committed, ...candidate.hazards];
    const cost = (hs: readonly PlannedHazard[]) => hs.reduce((n, h) => n + (isBulkhead(h) ? 4 : 1), 0);
    if (cost(candidate.hazards) > F.maxCandidates || cost(all) > F.hardActive) return invalid('capacity');
    const structures = all.filter(isBulkhead);
    if (structures.some(h => !canonical(h))) return invalid('metadata');
    const custom = candidate.provenance.version === B.encounterVersion;
    if (custom && (candidate.hazards.length !== 1 || !isBulkhead(candidate.hazards[0]!))) return invalid('incomplete');
    if (!custom && candidate.hazards.some(isBulkhead)) return invalid('provenance');
    if (custom) {
      const h = candidate.hazards[0]!, variant = h.id.split('/')[3] as Aperture;
      const expected = structureTransaction(candidate.provenance.seed, candidate.firstCell, variant);
      if (JSON.stringify(candidate) !== JSON.stringify(expected)) return invalid('metadata');
    }
    const generator = new FieldGenerator(candidate.provenance.seed);
    const ambient = generator.propose(candidate.firstCell, candidate.cellCount);
    const inspected = generator.inspect(custom ? { ...ambient, hazards: [] } : candidate, committed.filter(h => !isBulkhead(h)));
    if (inspected.status === 'invalid') return inspected;
    const ids = new Set<string>();
    for (const [i, h] of all.entries()) {
      if (ids.has(h.id)) return invalid('metadata'); ids.add(h.id);
      if (isBulkhead(h)) {
        if (h.provenance.seed !== candidate.provenance.seed) return invalid('provenance');
        const first = Number(h.id.split('/')[2]);
        const overlaps = first < candidate.firstCell + candidate.cellCount && first + B.cellCount > candidate.firstCell;
        if (i < committed.length && overlaps) return invalid('ownership');
        // Radius is a conservative bound, so separation cannot hide an ambient object in a pier or opening.
        for (const other of all) if (other !== h && Math.hypot(h.x - other.x, h.y - other.y, h.passDistance - other.passDistance) < h.radius + other.radius + DEFAULT_FIELD_SETTINGS.separation) return invalid('separation');
      }
    }
    return { status: 'valid', candidateCount: cost(candidate.hazards), totalCount: cost(all), aboveSoftLimit: cost(all) > F.softActive };
  },
});

/** One encounter, six cells including recovery; no ambient filling or density changes. */
export function structureSource(selected?: Aperture): RuntimeEncounterSource {
  return Object.freeze<RuntimeEncounterSource>({ version: B.encounterVersion,
    next(seed, cursor) {
      const firstCell = cursor.firstCell, cellCount = B.cellCount;
      const variant = selected ?? APERTURE_NAMES[(cursor.index + seed % APERTURE_NAMES.length) % APERTURE_NAMES.length]!;
      return { section: Object.freeze({ id: `${B.encounterVersion}/${seed}/${cursor.index}/${variant}`, version: B.encounterVersion,
        seed, index: cursor.index, firstCell, cellCount, startDistance: firstCell * 24, endDistance: (firstCell + cellCount) * 24,
        pacing: 'regular', family: 'ambient', progress: 0, intensity: 0, encounterProbability: 1, densityTarget: 1 / 144,
        variation: APERTURE_NAMES.indexOf(variant), placement: 'free' }),
        next: Object.freeze({ ...cursor, index: cursor.index + 1, firstCell: firstCell + cellCount, previous: 'regular' }) };
    },
    candidate(section) { return { transaction: structureTransaction(section.seed, section.firstCell, APERTURE_NAMES[section.variation]!), geometry: BULKHEAD_GEOMETRY }; },
  });
}
