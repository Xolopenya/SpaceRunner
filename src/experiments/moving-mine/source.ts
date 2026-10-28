import { CONFIG, difficulty } from '../../config.ts';
import { Random } from '../../core/random.ts';
import { FieldGenerator } from '../../core/field-generator.ts';
import { DEFAULT_FIELD_SETTINGS, fieldSettingsKey } from '../../core/field-settings.ts';
import type { DirectorCursor } from '../../core/field-director.ts';
import type { FieldTransaction, PlannedHazard, StructuralResult } from '../../core/field-types.ts';
import type { SchedulerRoot } from '../../core/field-scheduler.ts';
import type { ValidationGeometry } from '../../core/field-validator-types.ts';
import type { RuntimeEncounterSource } from '../../debug/runtime-field.ts';
import { mixedFlowSource, FLOW_GEOMETRY } from '../mixed-flow/source.ts';
import { WRECK_GEOMETRY } from '../structure-variants/encounter.ts';
import { MINE as S, MINE_CONFIGURATIONS } from './settings.ts';
import type { MineConfiguration } from './settings.ts';
import { isMine, mineX, simulationTick, validMotion } from './motion.ts';
import { MinePrediction } from './collision.ts';

interface MineCursor extends DirectorCursor { readonly mine?: { readonly ordinary: number; readonly count: number } }
function random(seed: number, key: string): Random {
  let h = 2166136261; for (const c of `${S.version}/${seed}/${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return new Random(h >>> 0);
}
/** Exact forward clock; bounded to the existing planner horizon. No player input. */
export function passTick(root: SchedulerRoot, passDistance: number): number {
  let elapsed = root.elapsed, distance = root.distance;
  for (let t = 0; t <= 1800; t++) {
    if (distance >= passDistance) return simulationTick(root.elapsed) + t;
    elapsed += CONFIG.step; distance += difficulty(elapsed).speed * CONFIG.step;
  }
  throw new RangeError('Mine outside prediction horizon');
}
export function mineTransaction(seed: number, firstCell: number, startTick: number, configuration: MineConfiguration): FieldTransaction {
  if (!Number.isSafeInteger(startTick) || startTick < 0 || !MINE_CONFIGURATIONS.includes(configuration)) throw new RangeError('Invalid mine request');
  const speed = configuration.startsWith('slow') ? S.slow : S.moderate, direction = configuration.endsWith('ltr') ? 1 : -1;
  const provenance = Object.freeze({ version: S.version, seed, settingsKey: fieldSettingsKey(DEFAULT_FIELD_SETTINGS) });
  const passDistance = firstCell * 24 + S.offset, ownerCell = Math.floor(passDistance / 24);
  const mine: PlannedHazard = Object.freeze({ id: `${S.version}/${seed}/${firstCell}/${startTick}/${configuration}`, ownerCell, anchorCell: ownerCell,
    localIndex: 0, passDistance, x: -direction * S.startX, y: 0, radius: S.radius, kind: S.kind, visualVariant: S.visualVariant,
    collisionProfile: S.profile, spin: 0, phase: 0, orientation: 'euler-xyz-v1', provenance,
    motion: Object.freeze({ version: S.motion, startTick, durationTicks: Math.round(12 / speed / CONFIG.step), velocityX: direction * speed }) });
  // Complete original two-cell ambient payload, then a crossing, then reserved runway.
  const ambient = new FieldGenerator(seed).propose(firstCell, 2);
  return Object.freeze({ firstCell, cellCount: S.cellCount, startDistance: firstCell * 24, endDistance: (firstCell + S.cellCount) * 24,
    provenance, hazards: Object.freeze([...ambient.hazards, mine]) });
}
function canonical(h: PlannedHazard): boolean {
  if (!validMotion(h)) return false;
  try {
    const p = h.id.split('/'), expected = mineTransaction(h.provenance.seed, Number(p[2]), Number(p[3]), p[4] as MineConfiguration).hazards.at(-1)!;
    return JSON.stringify(h) === JSON.stringify(expected);
  } catch { return false; }
}
export const MINE_GEOMETRY: ValidationGeometry = Object.freeze({ ...FLOW_GEOMETRY, version: S.geometry,
  validHazard: (h: PlannedHazard) => isMine(h) ? canonical(h) : FLOW_GEOMETRY.validHazard(h),
  prediction: () => new MinePrediction(),
  goals: (h: PlannedHazard) => isMine(h) ? [{ x: 0, y: -2.8 }, { x: 0, y: 2.8 }] : FLOW_GEOMETRY.goals(h),
  goalsAt(hazards: readonly PlannedHazard[], distance: number) {
    const next = hazards.filter(h => h.passDistance + h.radius + .57 >= distance).sort((a, b) => a.passDistance - b.passDistance)[0];
    return next && isMine(next) ? [{ x: 0, y: -2.8 }, { x: 0, y: 2.8 }] : FLOW_GEOMETRY.goalsAt?.(hazards, distance);
  },
  inspect(candidate: FieldTransaction, committed: readonly PlannedHazard[]): StructuralResult {
    const all = [...committed, ...candidate.hazards], mines = all.filter(isMine);
    const invalid = (reason: 'capacity' | 'metadata' | 'incomplete' | 'separation'): StructuralResult => ({ status: 'invalid', reason });
    if (mines.length > 1) return invalid('capacity');
    if (mines.some(h => !canonical(h)) || all.some(h => !!h.motion !== isMine(h))) return invalid('metadata');
    const nativeCommitted = committed.filter(h => !isMine(h));
    let result: StructuralResult;
    if (candidate.provenance.version === S.version) {
      const mine = candidate.hazards.find(isMine); if (!mine) return invalid('incomplete');
      const p = mine.id.split('/'), expected = mineTransaction(candidate.provenance.seed, candidate.firstCell, Number(p[3]), p[4] as MineConfiguration);
      if (JSON.stringify(candidate) !== JSON.stringify(expected)) return invalid('incomplete');
      result = WRECK_GEOMETRY.inspect(new FieldGenerator(candidate.provenance.seed).propose(candidate.firstCell, 2), nativeCommitted);
    } else result = FLOW_GEOMETRY.inspect(candidate, nativeCommitted);
    if (result.status === 'invalid') return result;
    for (const mine of mines) for (const other of all) if (other !== mine
      && Math.abs(other.passDistance - mine.passDistance) < mine.radius + other.radius + .3) return invalid('separation');
    const total = all.reduce((n, h) => n + FLOW_GEOMETRY.queryCost(h), 0);
    if (total > 32) return invalid('capacity');
    return { status: 'valid', candidateCount: candidate.hazards.reduce((n, h) => n + FLOW_GEOMETRY.queryCost(h), 0), totalCount: total, aboveSoftLimit: total > 24 };
  },
});
export function movingMineSource(configuration?: MineConfiguration, first = false): RuntimeEncounterSource {
  const flow = mixedFlowSource();
  return Object.freeze<RuntimeEncounterSource>({ version: S.version, diagnostics: true,
    pose: (h, elapsed) => isMine(h) ? { x: mineX(h, elapsed), y: h.y } : h,
    next(seed, raw) {
      const cursor = raw as MineCursor, history = cursor.mine ?? { ordinary: 0, count: 0 }, base = flow.next(seed, cursor);
      const selected = (first && !history.count) || (base.section.encounter !== 'station-wreck' && history.ordinary >= S.minimumOrdinary
        && (history.ordinary >= S.maximumOrdinary || random(seed, `${cursor.index}/selection`).next() < S.chance));
      if (!selected) return { section: base.section, next: Object.freeze({ ...base.next, mine: { ...history, ordinary: history.ordinary + 1 } }) };
      const choice = configuration ?? MINE_CONFIGURATIONS[Math.floor(random(seed, `${cursor.index}/direction-speed`).next() * 4)]!;
      return { section: Object.freeze({ ...base.section, id: `${S.version}/${seed}/${cursor.index}/${choice}`, version: S.version,
        cellCount: S.cellCount, endDistance: (cursor.firstCell + S.cellCount) * 24, encounter: 'moving-mine', family: 'ambient', variation: MINE_CONFIGURATIONS.indexOf(choice) }),
        next: Object.freeze({ ...base.next, firstCell: cursor.firstCell + S.cellCount,
          lastFamilies: cursor.lastFamilies, coverageMask: cursor.coverageMask, lastCorner: cursor.lastCorner,
          mine: Object.freeze({ ordinary: 0, count: history.count + 1 }) }) };
    },
    candidate(section, committed = [], root) {
      if (section.encounter !== 'moving-mine') return { ...flow.candidate(section, committed.filter(h => !isMine(h))), geometry: MINE_GEOMETRY };
      if (!root) throw new Error('Mine requires actual proposal clock');
      const choice = MINE_CONFIGURATIONS[section.variation]!, speed = choice.startsWith('slow') ? S.slow : S.moderate;
      const start = Math.max(0, passTick(root, section.startDistance + S.offset) - Math.round(6 / speed / CONFIG.step));
      const payload = new FieldGenerator(section.seed).propose(section.firstCell, section.cellCount - 1);
      const fallback = Object.freeze({ ...payload, cellCount: section.cellCount, endDistance: section.endDistance });
      return { transaction: mineTransaction(section.seed, section.firstCell, start, choice), geometry: MINE_GEOMETRY,
        publicationPolicy: 'root-aware-v1', fallback };
    },
  });
}
