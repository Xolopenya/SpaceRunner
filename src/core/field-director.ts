import { Random } from './random.ts';
import { FIELD_LIMITS } from './field-settings.ts';
import { DIRECTOR_SETTINGS as S } from './field-director-settings.ts';
import { PATTERN_FAMILIES, PATTERN_RULES, patternCount } from './field-pattern-source.ts';
import type { PatternFamily } from './field-types.ts';

export type PacingState = 'regular' | 'rising' | 'high' | 'recovery';
export interface DirectorCursor {
  readonly index: number;
  readonly firstCell: number;
  readonly previous: PacingState | 'start';
  readonly regularStreak: number;
  readonly lastFamilies: readonly PatternFamily[];
  readonly coverageMask: number;
  readonly lastCorner: number;
}
export interface ScheduledSection {
  readonly id: string;
  readonly version: 'director-v1';
  readonly seed: number;
  readonly index: number;
  readonly firstCell: number;
  readonly cellCount: number;
  readonly startDistance: number;
  readonly endDistance: number;
  readonly pacing: PacingState;
  readonly family: PatternFamily | 'ambient';
  readonly progress: number;
  readonly intensity: number;
  readonly encounterProbability: number;
  readonly densityTarget: number;
  readonly variation: number;
  readonly placement: 'free' | 'corner-pressure-v1';
  readonly corner?: number;
}

export function contentProgress(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) throw new RangeError('Invalid progression distance');
  // Deliberate policy fixed point: expm1 differs by an ulp between tested V8 versions.
  // Actual ship states, obstacle coordinates and collision queries are never rounded.
  return policyValue(-Math.expm1(-Math.max(0, distance - S.firstCell * FIELD_LIMITS.cellSize) / S.progressionDistance));
}
const policyValue = (value: number): number => Math.round(value * S.policyPrecision) / S.policyPrecision;
function keyed(seed: number, cursor: DirectorCursor, purpose: string): Random {
  let hash = 2166136261;
  const key = `${S.version}/${seed}/${cursor.index}/${cursor.firstCell}/${purpose}`;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return new Random(hash >>> 0);
}

/** Pure replayable decisions. Cursor is bounded explicit history, never hidden RNG state. */
export class DifficultyDirector {
  readonly seed: number;
  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be uint32');
    this.seed = seed;
  }
  initial(firstCell: number = S.firstCell): DirectorCursor {
    if (!Number.isInteger(firstCell) || firstCell < 0 || firstCell > FIELD_LIMITS.maxCell - 5) throw new RangeError('Invalid initial cell');
    return Object.freeze({ index: 0, firstCell, previous: 'start', regularStreak: 0, lastFamilies: Object.freeze([]), coverageMask: 15, lastCorner: -1 });
  }
  next(cursor: DirectorCursor): { readonly section: ScheduledSection; readonly next: DirectorCursor } {
    if (!Number.isSafeInteger(cursor.index) || cursor.index < 0 || cursor.index === Number.MAX_SAFE_INTEGER
      || !Number.isInteger(cursor.firstCell) || cursor.firstCell < 0 || cursor.firstCell > FIELD_LIMITS.maxCell - 5
      || !['start', 'regular', 'rising', 'high', 'recovery'].includes(cursor.previous)
      || !Number.isInteger(cursor.regularStreak) || cursor.regularStreak < 0 || cursor.regularStreak > 2
      || cursor.lastFamilies.length > 2 || cursor.lastFamilies.some(f => !PATTERN_FAMILIES.includes(f))
      || !Number.isInteger(cursor.coverageMask) || cursor.coverageMask < 0 || cursor.coverageMask > 15
      || !Number.isInteger(cursor.lastCorner) || cursor.lastCorner < -1 || cursor.lastCorner > 3) throw new RangeError('Invalid director cursor');
    const random = (purpose: string) => keyed(this.seed, cursor, purpose);
    const startDistance = cursor.firstCell * FIELD_LIMITS.cellSize, progress = contentProgress(startDistance);
    const encounterProbability = policyValue(S.patternChanceStart + (S.patternChanceEnd - S.patternChanceStart) * progress);
    const choice = random('pacing').next();
    let pacing: PacingState;
    if (cursor.previous === 'start') pacing = 'regular';
    else if (cursor.previous === 'high') pacing = 'recovery';
    else if (cursor.previous === 'recovery') pacing = choice < .8 ? 'regular' : 'rising';
    else if (cursor.previous === 'rising') pacing = choice < .6 ? 'high' : 'regular';
    else if (cursor.regularStreak >= 2) pacing = choice < .5 ? 'rising' : 'high';
    else pacing = choice < .5 - .15 * progress ? 'regular' : choice < .8 ? 'rising' : 'high';
    let family: ScheduledSection['family'] = 'ambient';
    const familyChoice = random('family').next();
    if (pacing === 'high') {
      const eligible = (['narrowing', 'alternating', 'vertical-weave'] as const).filter(f => !cursor.lastFamilies.includes(f));
      family = eligible[Math.floor(familyChoice * eligible.length)]!;
    } else if (pacing !== 'recovery' && cursor.previous !== 'start' && familyChoice < encounterProbability) {
      const eligible = (pacing === 'rising' ? ['scattered', 'narrowing'] : ['scattered']) as PatternFamily[];
      const available = eligible.filter(f => !cursor.lastFamilies.includes(f));
      if (available.length) family = available[Math.floor(random('eligible-family').next() * available.length)]!;
    }
    const base = pacing === 'recovery' ? .05 + .1 * progress : pacing === 'regular' ? .15 + .4 * progress
      : pacing === 'rising' ? .4 + .3 * progress : .7 + .2 * progress;
    const intensity = policyValue(Math.max(S.minIntensity, Math.min(S.maxIntensity, base + random('intensity').between(-.02, .02))));
    const duration = random('duration').next();
    const cellCount = family === 'ambient' ? (pacing === 'recovery' ? 2 + Math.floor(duration * (3 - progress))
      : pacing === 'regular' ? 4 + Math.floor(duration * 3) : 3 + Math.floor(duration * 3))
      : Math.min(6, PATTERN_RULES[family].minCells + Math.floor(duration * (2.9 - 1.8 * progress)));
    const variation = (cursor.index % 32768) * 2;
    const placement = family !== 'ambient' && family !== 'scattered' ? 'corner-pressure-v1' : 'free';
    let coverageMask = cursor.coverageMask, lastCorner = cursor.lastCorner, corner: number | undefined;
    if (placement === 'corner-pressure-v1') {
      const mask = coverageMask || 15;
      const remaining = [0, 1, 2, 3].filter(c => (mask & (1 << c)) !== 0);
      const eligible = remaining.length > 1 ? remaining.filter(c => c !== lastCorner) : remaining;
      corner = eligible[Math.floor(random('coverage-corner').next() * eligible.length)]!;
      coverageMask = mask & ~(1 << corner); lastCorner = corner;
    }
    const section: ScheduledSection = Object.freeze({
      id: `${S.version}/${this.seed}/${cursor.index}/${cursor.firstCell}/${cellCount}/${pacing}/${family}/${intensity}/${variation}/${placement}/${corner ?? 'free'}`,
      version: S.version, seed: this.seed, index: cursor.index, firstCell: cursor.firstCell, cellCount,
      startDistance, endDistance: (cursor.firstCell + cellCount) * FIELD_LIMITS.cellSize,
      pacing, family, progress, intensity, encounterProbability, variation, placement, ...(corner === undefined ? {} : { corner }),
      densityTarget: family === 'ambient' ? 100 / FIELD_LIMITS.cellSize : patternCount(family, intensity) * 100 / (cellCount * FIELD_LIMITS.cellSize),
    });
    const lastFamilies = family === 'ambient' ? [...cursor.lastFamilies] : [...cursor.lastFamilies, family].slice(-2);
    const next: DirectorCursor = Object.freeze({ index: cursor.index + 1, firstCell: cursor.firstCell + cellCount,
      previous: pacing, regularStreak: pacing === 'regular' ? cursor.regularStreak + 1 : 0, lastFamilies: Object.freeze(lastFamilies), coverageMask, lastCorner });
    return Object.freeze({ section, next });
  }
}
