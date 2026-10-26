import { CONFIG } from '../../config.ts';
import { Random } from '../../core/random.ts';
import { DifficultyDirector } from '../../core/field-director.ts';
import { FieldGenerator } from '../../core/field-generator.ts';
import { PatternGenerator } from '../../core/field-patterns.ts';
import { buildSection } from '../../core/field-section.ts';
import { PATTERN_RULES } from '../../core/field-pattern-source.ts';
import { FIELD_LIMITS as F } from '../../core/field-settings.ts';
import type { DirectorCursor, ScheduledSection } from '../../core/field-director.ts';
import type { ValidationGeometry } from '../../core/field-validator-types.ts';
import type { FieldTransaction, PlannedHazard, StructuralResult } from '../../core/field-types.ts';
import type { RuntimeEncounterSource } from '../../debug/runtime-field.ts';
import { APERTURE_NAMES, WRECK, isWreck, wreckProfile } from '../structure-variants/profile.ts';
import type { Aperture } from '../structure-variants/profile.ts';
import { wreckTransaction, WRECK_GEOMETRY } from '../structure-variants/encounter.ts';
import { MIXED_FLOW as S } from './settings.ts';

interface FlowCursor extends DirectorCursor { readonly flow?: { readonly ordinary: number; readonly apertureMask: number; readonly lastAperture: number } }
function random(seed: number, cursor: DirectorCursor, purpose: string): Random {
  let h = 2166136261; for (const c of `${S.version}/${seed}/${cursor.index}/${cursor.firstCell}/${purpose}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return new Random(h >>> 0);
}
export const FLOW_GEOMETRY: ValidationGeometry = Object.freeze({ ...WRECK_GEOMETRY, version: S.geometry,
  inspect(candidate: FieldTransaction, committed: readonly PlannedHazard[]): StructuralResult {
    if (!candidate.hazards.length) return { status: 'invalid', reason: 'incomplete' };
    if (candidate.hazards.some(isWreck)) return WRECK_GEOMETRY.inspect(candidate, committed);
    // A complete original producer transaction plus one OWNED empty tail cell.
    // No member is removed and no source can subsequently occupy that runway.
    const count = candidate.cellCount - S.ownedTailCells;
    if (count < F.minCells || candidate.cellCount > F.maxCells || candidate.endDistance !== (candidate.firstCell + candidate.cellCount) * F.cellSize) return { status: 'invalid', reason: 'ownership' };
    const payload = { ...candidate, cellCount: count, endDistance: (candidate.firstCell + count) * F.cellSize };
    const source = candidate.provenance.pattern;
    const expected = source ? new PatternGenerator(candidate.provenance.seed).propose({ ...source }).transaction
      : new FieldGenerator(candidate.provenance.seed).propose(candidate.firstCell, count);
    if (!expected || JSON.stringify(payload) !== JSON.stringify(expected)) return { status: 'invalid', reason: 'incomplete' };
    return WRECK_GEOMETRY.inspect(payload, committed);
  },
  goalsAt(hazards: readonly PlannedHazard[], distance: number) {
    const next = hazards.filter(h => isWreck(h) && h.passDistance + WRECK.radius + CONFIG.ship.radius + .15 >= distance)
      .sort((a, b) => a.passDistance - b.passDistance)[0];
    return next ? [wreckProfile(next).aperture] : undefined;
  },
});

/** Reuses director pacing/family cooldown/corner coverage and the original producers.
 * Only a small seeded content overlay adds occasional six-cell wrecks and a
 * shuffled aperture bag. Cursor carries all bounded history, reset is stateless.
 */
export function mixedFlowSource(forcedAperture?: Aperture): RuntimeEncounterSource {
  return Object.freeze<RuntimeEncounterSource>({ version: S.version, diagnostics: true,
    next(seed, raw) {
      const cursor = raw as FlowCursor, history = cursor.flow ?? { ordinary: 0, apertureMask: 31, lastAperture: -1 };
      const base = new DifficultyDirector(seed).next(cursor);
      const structure = history.ordinary >= S.minimumOrdinarySections && (history.ordinary >= S.maximumOrdinarySections
        || random(seed, cursor, 'structure').next() < S.structureChance);
      let aperture: Aperture | undefined, mask = history.apertureMask, last = history.lastAperture;
      if (structure) {
        const available = APERTURE_NAMES.map((_, i) => i).filter(i => ((mask || 31) & (1 << i)) && i !== last);
        const index = forcedAperture === undefined ? available[Math.floor(random(seed, cursor, 'aperture').next() * available.length)]! : APERTURE_NAMES.indexOf(forcedAperture);
        aperture = APERTURE_NAMES[index]!; mask = (mask || 31) & ~(1 << index); last = index;
      }
      const family = structure ? 'ambient' : base.section.family;
      const contentCells = family === 'ambient' ? S.ambientCells + +(base.section.pacing === 'regular' && random(seed, cursor, 'span').next() < .35) : PATTERN_RULES[family].minCells;
      const cellCount = structure ? WRECK.cellCount : contentCells + S.ownedTailCells;
      const intensity = base.section.pacing === 'high' ? S.highIntensity : base.section.pacing === 'rising' ? S.risingIntensity : S.regularIntensity;
      const encounter = structure ? 'station-wreck' : family;
      const section: ScheduledSection = Object.freeze({ ...base.section, version: S.version,
        id: `${S.version}/${seed}/${cursor.index}/${cursor.firstCell}/${cellCount}/${encounter}/${aperture ?? 'none'}`,
        cellCount, endDistance: (cursor.firstCell + cellCount) * F.cellSize, family, intensity, encounter,
        densityTarget: structure ? 3 * 100 / (cellCount * F.cellSize) : base.section.densityTarget,
        ...(aperture ? { aperture } : {}) });
      const next: FlowCursor = Object.freeze({ ...base.next, firstCell: cursor.firstCell + cellCount,
        ...(structure ? { lastFamilies: cursor.lastFamilies, coverageMask: cursor.coverageMask, lastCorner: cursor.lastCorner } : {}),
        flow: Object.freeze({ ordinary: structure ? 0 : history.ordinary + 1, apertureMask: mask, lastAperture: last }) });
      return { section, next };
    },
    candidate(section, committed = []) {
      const contentCells = section.cellCount - S.ownedTailCells;
      const extend = (payload: FieldTransaction): FieldTransaction => Object.freeze({ ...payload, cellCount: section.cellCount, endDistance: section.endDistance });
      const fallback = extend(new FieldGenerator(section.seed).propose(section.firstCell, contentCells));
      const proposal = section.encounter === 'station-wreck' ? undefined
        : buildSection({ ...section, cellCount: contentCells, endDistance: (section.firstCell + contentCells) * F.cellSize }, committed.filter(h => !isWreck(h)));
      const transaction = section.encounter === 'station-wreck' ? wreckTransaction(section.seed, section.firstCell, section.aperture!, 'mixed')
        : proposal?.transaction ? extend(proposal.transaction) : fallback;
      return { transaction, geometry: FLOW_GEOMETRY, publicationPolicy: 'root-aware-v1', fallback,
        ...(proposal?.rejection ? { generationReason: proposal.rejection } : {}) };
    },
  });
}
