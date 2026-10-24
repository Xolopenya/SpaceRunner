import { FieldGenerator } from './field-generator.ts';
import { Random } from './random.ts';
import { hazardVariant } from './hazard-profile.ts';
import { DEFAULT_FIELD_SETTINGS, FIELD_LIMITS, fieldSettingsKey } from './field-settings.ts';
import { PATTERN_FAMILIES, PATTERN_RULES, PATTERN_VERSION, patternCount, patternHazardId } from './field-pattern-source.ts';
import type { FieldSettings } from './field-settings.ts';
import type { FieldProfile, FieldTransaction, PatternFamily, PatternSource, PlannedHazard, StructuralResult } from './field-types.ts';

export interface PatternRequest {
  readonly family: PatternFamily;
  readonly firstCell: number;
  readonly cellCount?: number;
  readonly intensity: number;
  readonly variation?: number;
  readonly mirrorX?: boolean;
  readonly mirrorY?: boolean;
  readonly offsetX?: number;
  readonly offsetY?: number;
}
export type PatternProposal =
  | { readonly status: 'proposed'; readonly transaction: FieldTransaction; readonly structure: Extract<StructuralResult, { status: 'valid' }> }
  | { readonly status: 'rejected'; readonly reason: 'INVALID_REQUEST' | 'INSUFFICIENT_SPAN' | 'TRANSFORM_BOUNDS' | 'STRUCTURAL_INVALID';
      readonly transaction?: FieldTransaction; readonly structure?: Extract<StructuralResult, { status: 'invalid' }> };

const PROFILES: readonly FieldProfile[] = ['sphere-v1', 'sphere-v1', 'half-meteor-v1', 'barrel-v1', 'generator-v1'];
const GEOMETRY = Object.freeze({ halfX: 4.3, halfY: 2.3, pairHalfDepth: 1.45, minRadius: .7, maxRadius: 1.05 });
interface Point { x: number; y: number; depth: number }

/** RNG key only; stable IDs retain the full lossless source identity. */
function keyed(seed: number, family: PatternFamily, firstCell: number, variation: number, purpose: string): Random {
  let value = 2166136261;
  const key = `${PATTERN_VERSION}/${seed}/${family}/${firstCell}/${variation}/${purpose}`;
  for (let i = 0; i < key.length; i++) value = Math.imul(value ^ key.charCodeAt(i), 16777619);
  return new Random(value >>> 0);
}

function geometry(family: PatternFamily, intensity: number, span: number, count: number, random: Random): Point[] {
  const points: Point[] = [];
  if (family === 'scattered') {
    const depthSpread = .2 + .1 * intensity;
    for (let i = 0; i < count; i++) points.push({ x: random.between(-GEOMETRY.halfX, GEOMETRY.halfX),
      y: random.between(-GEOMETRY.halfY, GEOMETRY.halfY), depth: (i + .5 + random.between(-depthSpread, depthSpread)) * span / count });
    return points;
  }
  const groups = count / 2, tilt = random.between(-.22, .22), drift = random.between(-.6, .6);
  for (let group = 0; group < groups; group++) {
    const u = group / (groups - 1);
    const center = 9 + u * (span - 22) + random.between(-1, 1);
    for (let side = -1; side <= 1; side += 2) {
      let x: number, y: number;
      if (family === 'narrowing') {
        const width = 2.9 - u * (1.05 + .25 * intensity);
        x = drift * (u - .5) + side * width + random.between(-.08, .08);
        y = x * tilt + .35 * Math.sin(u * Math.PI) + random.between(-.15, .15);
      } else if (family === 'alternating') {
        x = (group % 2 ? -1 : 1) * (.65 + .2 * intensity) + random.between(-.12, .12);
        y = side * (.75 + .1 * intensity) + random.between(-.12, .12);
      } else {
        x = side * (.95 + .1 * intensity) + random.between(-.1, .1);
        y = (group % 2 ? -1 : 1) * (.55 + .15 * intensity) + random.between(-.08, .08);
      }
      points.push({ x, y, depth: center + side * GEOMETRY.pairHalfDepth + random.between(-.08, .08) });
    }
  }
  return points;
}

/** Test/research producer only. No retries, selection policy, history or world mutation. */
export class PatternGenerator {
  private seed: number;
  private readonly field: FieldGenerator;
  get settings(): Readonly<FieldSettings> { return this.field.settings; }

  constructor(seed: number, settings: Readonly<FieldSettings> = DEFAULT_FIELD_SETTINGS) {
    this.field = new FieldGenerator(seed, settings); this.seed = seed;
  }
  reset(seed: number): void { this.field.reset(seed); this.seed = seed; }

  propose(request: PatternRequest, committed: readonly PlannedHazard[] = []): PatternProposal {
    if (!request || !PATTERN_FAMILIES.includes(request.family) || !Number.isInteger(request.firstCell) || request.firstCell < 0
      || !Number.isFinite(request.intensity) || request.intensity < 0 || request.intensity > 1
      || !Number.isInteger(request.variation ?? 0) || (request.variation ?? 0) < 0 || (request.variation ?? 0) > 65535
      || (request.mirrorX !== undefined && typeof request.mirrorX !== 'boolean') || (request.mirrorY !== undefined && typeof request.mirrorY !== 'boolean')
      || (request.offsetX !== undefined && !Number.isFinite(request.offsetX)) || (request.offsetY !== undefined && !Number.isFinite(request.offsetY))) {
      return { status: 'rejected', reason: 'INVALID_REQUEST' };
    }
    const cellCount = request.cellCount ?? PATTERN_RULES[request.family].defaultCells;
    if (!Number.isInteger(cellCount) || cellCount < FIELD_LIMITS.minCells || cellCount > FIELD_LIMITS.maxCells
      || request.firstCell + cellCount - 1 > FIELD_LIMITS.maxCell) return { status: 'rejected', reason: 'INVALID_REQUEST' };
    if (cellCount < PATTERN_RULES[request.family].minCells) return { status: 'rejected', reason: 'INSUFFICIENT_SPAN' };
    const variation = request.variation ?? 0;
    const random = (purpose: string) => keyed(this.seed, request.family, request.firstCell, variation, purpose);
    const count = patternCount(request.family, request.intensity), span = cellCount * FIELD_LIMITS.cellSize;
    const base = geometry(request.family, request.intensity, span, count, random('geometry'));
    const transform = random('transform');
    const defaultMirrorX = transform.next() < .5, defaultMirrorY = transform.next() < .5;
    const shiftX = transform.next(), shiftY = transform.next();
    const mirrorX = request.mirrorX ?? defaultMirrorX, mirrorY = request.mirrorY ?? defaultMirrorY;
    const mirrored = base.map(p => ({ x: p.x * (mirrorX ? -1 : 1), y: p.y * (mirrorY ? -1 : 1), depth: p.depth }));
    const minX = Math.min(...mirrored.map(p => p.x)), maxX = Math.max(...mirrored.map(p => p.x));
    const minY = Math.min(...mirrored.map(p => p.y)), maxY = Math.max(...mirrored.map(p => p.y));
    const lowX = Math.max(-this.settings.halfX, -this.settings.halfX - minX), highX = Math.min(this.settings.halfX, this.settings.halfX - maxX);
    const lowY = Math.max(-this.settings.halfY, -this.settings.halfY - minY), highY = Math.min(this.settings.halfY, this.settings.halfY - maxY);
    if (lowX > highX || lowY > highY) return { status: 'rejected', reason: 'TRANSFORM_BOUNDS' };
    const offsetX = request.offsetX ?? lowX + shiftX * (highX - lowX), offsetY = request.offsetY ?? lowY + shiftY * (highY - lowY);
    if (offsetX < lowX || offsetX > highX || offsetY < lowY || offsetY > highY) return { status: 'rejected', reason: 'TRANSFORM_BOUNDS' };
    const source: Readonly<PatternSource> = Object.freeze({ family: request.family, firstCell: request.firstCell, cellCount,
      variation, intensity: request.intensity, mirrorX, mirrorY, offsetX, offsetY });
    const provenance = Object.freeze({ version: PATTERN_VERSION, seed: this.seed, settingsKey: fieldSettingsKey(this.settings), pattern: source });
    const hazards = mirrored.map((p, ordinal): PlannedHazard => {
      const pose = random(`pose/${ordinal}`), radius = pose.between(GEOMETRY.minRadius, GEOMETRY.maxRadius);
      const kind = request.family !== 'scattered' && ordinal % 2 === 0 ? 0 : Math.floor(pose.next() * 3);
      const spin = pose.between(-FIELD_LIMITS.maxSpin, FIELD_LIMITS.maxSpin), phase = pose.between(0, Math.PI * 2);
      const visualVariant = hazardVariant(kind, phase), passDistance = request.firstCell * FIELD_LIMITS.cellSize + p.depth;
      const ownerCell = Math.floor(passDistance / FIELD_LIMITS.cellSize);
      return Object.freeze({ id: patternHazardId(provenance, ownerCell, ordinal), ownerCell, localIndex: ordinal, anchorCell: ownerCell,
        passDistance, x: p.x + offsetX, y: p.y + offsetY, radius, kind, spin, phase, visualVariant,
        collisionProfile: PROFILES[visualVariant]!, orientation: 'euler-xyz-v1', provenance });
    });
    const transaction: FieldTransaction = Object.freeze({ firstCell: request.firstCell, cellCount, startDistance: request.firstCell * FIELD_LIMITS.cellSize,
      endDistance: (request.firstCell + cellCount) * FIELD_LIMITS.cellSize, provenance, hazards: Object.freeze(hazards) });
    const structure = this.field.inspect(transaction, committed);
    return structure.status === 'valid' ? { status: 'proposed', transaction, structure }
      : { status: 'rejected', reason: 'STRUCTURAL_INVALID', transaction, structure };
  }
}
