import { DEFAULT_FIELD_SETTINGS, FIELD_LIMITS } from './field-settings.ts';
import type { FieldProvenance, PatternFamily, PatternSource } from './field-types.ts';

export const PATTERN_VERSION = 'encounter-v1';
export const PATTERN_FAMILIES: readonly PatternFamily[] = Object.freeze(['scattered', 'narrowing', 'alternating', 'vertical-weave']);
export const PATTERN_RULES = Object.freeze({
  scattered: Object.freeze({ minCells: 2, defaultCells: 3 }), narrowing: Object.freeze({ minCells: 3, defaultCells: 4 }),
  alternating: Object.freeze({ minCells: 4, defaultCells: 5 }), 'vertical-weave': Object.freeze({ minCells: 4, defaultCells: 6 }),
});

export function patternCount(family: PatternFamily, intensity: number): number {
  return family === 'scattered' ? 3 + Math.floor(intensity * 2.999)
    : family === 'narrowing' ? (intensity >= .6 ? 8 : 6) : (intensity >= .6 ? 6 : 4);
}

export function validPatternSource(source: PatternSource | undefined): source is PatternSource {
  return !!source && PATTERN_FAMILIES.includes(source.family)
    && Number.isInteger(source.firstCell) && source.firstCell >= 0
    && Number.isInteger(source.cellCount) && source.cellCount >= PATTERN_RULES[source.family].minCells && source.cellCount <= FIELD_LIMITS.maxCells
    && source.firstCell + source.cellCount - 1 <= FIELD_LIMITS.maxCell
    && Number.isInteger(source.variation) && source.variation >= 0 && source.variation <= 65535
    && Number.isFinite(source.intensity) && source.intensity >= 0 && source.intensity <= 1
    && typeof source.mirrorX === 'boolean' && typeof source.mirrorY === 'boolean'
    && Number.isFinite(source.offsetX) && Math.abs(source.offsetX) <= DEFAULT_FIELD_SETTINGS.halfX
    && Number.isFinite(source.offsetY) && Math.abs(source.offsetY) <= DEFAULT_FIELD_SETTINGS.halfY;
}

/** Lossless source identity. No hash is used as an ownership address. */
export function patternKey(source: PatternSource): string {
  return [source.family, source.firstCell, source.cellCount, source.variation, source.intensity,
    +source.mirrorX, +source.mirrorY, source.offsetX, source.offsetY].join(':');
}

export function patternHazardId(provenance: FieldProvenance, ownerCell: number, ordinal: number): string {
  return `${PATTERN_VERSION}/${provenance.seed}/${provenance.settingsKey}/${patternKey(provenance.pattern!)}/${ownerCell}/${ordinal}`;
}
