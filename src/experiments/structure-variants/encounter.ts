import { FieldGenerator } from '../../core/field-generator.ts';
import { FIELD_LIMITS as F, DEFAULT_FIELD_SETTINGS, fieldSettingsKey } from '../../core/field-settings.ts';
import type { FieldTransaction, PlannedHazard, StructuralResult } from '../../core/field-types.ts';
import type { ValidationGeometry } from '../../core/field-validator-types.ts';
import type { RuntimeEncounterSource } from '../../debug/runtime-field.ts';
import { WRECK as W, APERTURE_NAMES, isWreck, wreckProfile, WreckPrediction } from './profile.ts';
import type { Aperture, StructureMode } from './profile.ts';

const settingsKey = fieldSettingsKey(DEFAULT_FIELD_SETTINGS);
export function wreckTransaction(seed: number, firstCell = 4, aperture: Aperture = 'center', mode: StructureMode = 'isolated'): FieldTransaction {
  const ambient = new FieldGenerator(seed).propose(firstCell, W.cellCount), index = APERTURE_NAMES.indexOf(aperture);
  if (index < 0 || !['isolated', 'mixed'].includes(mode)) throw new RangeError('Unknown wreck request');
  const provenance = Object.freeze({ version: `structure-${mode}-v2`, seed, settingsKey });
  const passDistance = firstCell * F.cellSize + W.centerOffset, ownerCell = Math.floor(passDistance / F.cellSize);
  const structure: PlannedHazard = Object.freeze({ id: `${provenance.version}/${seed}/${firstCell}/${aperture}`, ownerCell, anchorCell: ownerCell, localIndex: 0,
    passDistance, x: 0, y: 0, radius: W.radius, kind: index + 4, visualVariant: index + 6, spin: 0, phase: 0,
    collisionProfile: W.profile, orientation: 'euler-xyz-v1', provenance });
  // Original ambient producer, original IDs/profiles/poses. Exactly two interior
  // anchor keys, at24±6 and96±6, leave30+ units clear around the structure center.
  const neighbors = mode === 'mixed' ? ambient.hazards.filter(h => h.anchorCell === firstCell + 1 || h.anchorCell === firstCell + 4) : [];
  if (mode === 'mixed' && neighbors.length !== 2) throw new Error('Incomplete mixed anchors');
  return Object.freeze({ ...ambient, provenance, hazards: Object.freeze([structure, ...neighbors]) });
}
function canonical(h: PlannedHazard): boolean {
  if (!h?.provenance || !isWreck(h)) return false;
  const parts = h.id.split('/'), mode = h.provenance.version === 'structure-mixed-v2' ? 'mixed' : 'isolated';
  try {
    const expected = wreckTransaction(h.provenance.seed, Number(parts[2]), APERTURE_NAMES[h.kind - 4]!, mode).hazards[0]!;
    return parts.length === 4 && Object.keys(expected).every(k => k === 'provenance'
      ? h.provenance.version === expected.provenance.version && h.provenance.seed === expected.provenance.seed && h.provenance.settingsKey === settingsKey && !h.provenance.pattern
      : h[k as keyof PlannedHazard] === expected[k as keyof PlannedHazard]);
  } catch { return false; }
}
export const WRECK_GEOMETRY: ValidationGeometry = Object.freeze({
  version: W.contract, validHazard: canonical, prediction: () => new WreckPrediction(),
  queryCost: (h: PlannedHazard) => isWreck(h) ? 4 : 1,
  axialExtent: (h: PlannedHazard) => isWreck(h) ? W.axial : h.radius,
  goals: (h: PlannedHazard) => isWreck(h) ? [wreckProfile(h).aperture] : [],
  goalsAt(hazards: readonly PlannedHazard[], distance: number) {
    const frames = hazards.filter(isWreck).sort((a, b) => a.passDistance - b.passDistance);
    const next = frames.find(h => h.passDistance + W.radius + .57 >= distance) ?? frames.at(-1);
    return next ? [wreckProfile(next).aperture] : [{ x: 0, y: 0 }];
  },
  inspect(candidate: FieldTransaction, committed: readonly PlannedHazard[]): StructuralResult {
    const invalid = (reason: 'capacity' | 'metadata' | 'incomplete' | 'ownership' | 'separation'): StructuralResult => ({ status: 'invalid', reason });
    const all = [...committed, ...candidate.hazards], cost = (hs: readonly PlannedHazard[]) => hs.reduce((n, h) => n + (isWreck(h) ? 4 : 1), 0);
    if (cost(all) > F.hardActive || cost(candidate.hazards) > F.maxCandidates) return invalid('capacity');
    if (all.filter(isWreck).some(h => !canonical(h))) return invalid('metadata');
    const custom = ['structure-isolated-v2', 'structure-mixed-v2'].includes(candidate.provenance.version), generator = new FieldGenerator(candidate.provenance.seed);
    if (custom) {
      const h = candidate.hazards[0]; if (!h || !isWreck(h)) return invalid('incomplete');
      const expected = wreckTransaction(candidate.provenance.seed, candidate.firstCell, APERTURE_NAMES[h.kind - 4]!, candidate.provenance.version === 'structure-mixed-v2' ? 'mixed' : 'isolated');
      if (JSON.stringify(candidate) !== JSON.stringify(expected)) return invalid('incomplete');
    } else if (candidate.hazards.some(isWreck)) return invalid('metadata');
    const header = generator.propose(candidate.firstCell, candidate.cellCount);
    const small = generator.inspect(custom ? { ...header, hazards: candidate.hazards.filter(h => !isWreck(h)) } : candidate, committed.filter(h => !isWreck(h)));
    if (small.status === 'invalid') return small;
    const ids = new Set<string>();
    for (const [i, h] of all.entries()) {
      if (ids.has(h.id)) return invalid('metadata'); ids.add(h.id);
      if (!isWreck(h)) continue;
      if (h.provenance.seed !== candidate.provenance.seed) return invalid('metadata');
      const first = Number(h.id.split('/')[2]);
      if (i < committed.length && first < candidate.firstCell + candidate.cellCount && first + W.cellCount > candidate.firstCell) return invalid('ownership');
      for (const other of all) if (other !== h && Math.hypot(h.x - other.x, h.y - other.y, h.passDistance - other.passDistance)
        < h.radius + other.radius + DEFAULT_FIELD_SETTINGS.separation) return invalid('separation');
    }
    return { status: 'valid', candidateCount: cost(candidate.hazards), totalCount: cost(all), aboveSoftLimit: cost(all) > F.softActive };
  },
});
export function wreckSource(aperture: Aperture, mode: StructureMode): RuntimeEncounterSource {
  const version = `structure-${mode}-v2` as const;
  return Object.freeze<RuntimeEncounterSource>({ version,
    next(seed, cursor) { const firstCell = cursor.firstCell, cellCount = W.cellCount;
      return { section: Object.freeze({ id: `${version}/${seed}/${cursor.index}/${aperture}`, version, seed, index: cursor.index, firstCell, cellCount,
        startDistance: firstCell * F.cellSize, endDistance: (firstCell + cellCount) * F.cellSize, pacing: 'regular', family: 'ambient', progress: 0,
        intensity: 0, encounterProbability: 1, densityTarget: mode === 'mixed' ? 3 / 144 : 1 / 144, variation: APERTURE_NAMES.indexOf(aperture), placement: 'free' }),
        next: Object.freeze({ ...cursor, index: cursor.index + 1, firstCell: firstCell + cellCount, previous: 'regular' }) }; },
    candidate(section) { return { transaction: wreckTransaction(section.seed, section.firstCell, aperture, mode), geometry: WRECK_GEOMETRY }; },
  });
}
