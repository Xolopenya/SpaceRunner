// Deliberately overlapping geometry for R tests, NEVER generator proposals.
import { CONFIG, difficulty } from '../../src/config.ts';
import { hazardVariant } from '../../src/core/hazard-profile.ts';
import { VALIDATION_LIMITS as L } from '../../src/core/field-validator-types.ts';
import type { FieldValidationContext, PlannedHazard } from '../../src/core/field-types.ts';
import type { ControlRun } from '../../src/core/field-validator-types.ts';

const provenance = Object.freeze({ version: 'synthetic-r-v1', seed: 42, settingsKey: 'fixture-only' });
export const fixtureOptions = Object.freeze({ structuralPolicy: 'synthetic-fixture' as const });
export function obstacle(id: string, x: number, y: number, passDistance: number, extra: Partial<PlannedHazard> = {}): PlannedHazard {
  const h = { id, ownerCell: Math.floor(passDistance / 24), localIndex: 0, anchorCell: 0,
    x, y, passDistance, radius: 1.1, kind: 0, spin: 0, phase: 0, ...extra };
  const variant = hazardVariant(h.kind, h.phase);
  const profiles = ['sphere-v1', 'sphere-v1', 'half-meteor-v1', 'barrel-v1', 'generator-v1'] as const;
  return { ...h, visualVariant: variant, collisionProfile: profiles[variant]!, orientation: 'euler-xyz-v1', provenance };
}
export function context(hazards: readonly PlannedHazard[] = [], extra: Partial<FieldValidationContext> = {}): FieldValidationContext {
  return { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 120, distance: 0, committed: [],
    candidate: { firstCell: 0, cellCount: 6, startDistance: 0, endDistance: 144, provenance, hazards }, ...extra };
}
export function barrier(axis: 'x' | 'y', sign: number, pass: number, prefix = 'barrier'): PlannedHazard[] {
  const result: PlannedHazard[] = [];
  if (axis === 'x') for (const x of [0, 1.8, 3.6, 5.4]) for (const y of [-3.15, -1.05, 1.05, 3.15]) {
    result.push(obstacle(`${prefix}-${result.length}`, x * sign, y, pass));
  }
  // Seven X columns and two Y rows cover the upper or lower half:14 total.
  else for (const x of [-6, -4, -2, 0, 2, 4, 6]) for (const y of [0, 2.4]) {
    result.push(obstacle(`${prefix}-${result.length}`, x, y * sign, pass));
  }
  return result;
}
/** Independently constructs a FULL duration trace; only clocks, no search/collision flags. */
export function knownControls(c: FieldValidationContext, moves: readonly ControlRun[] = [], margin = .15): ControlRun[] {
  let elapsed = c.elapsed, distance = c.distance;
  let exit = c.distance;
  for (const h of [...c.committed, ...c.candidate.hazards]) {
    exit = Math.max(exit, h.passDistance + h.radius + CONFIG.ship.radius + margin);
  }
  let end = 0, tailStart = 0;
  for (let tick = 1; tick <= L.horizonTicks; tick++) {
    elapsed += CONFIG.step; distance += difficulty(elapsed).speed * CONFIG.step;
    if (!tailStart && tick >= L.reactionTicks && distance > exit) { tailStart = tick; end = tick + L.brakingTicks; }
    if (end && tick === end) break;
  }
  if (!end) throw new Error('Known trace exceeds horizon');
  const inputs = Array.from({ length: end }, (_, tick) => tick < L.reactionTicks ? c.input : { x: 0, y: 0 });
  let cursor = L.reactionTicks;
  for (const move of moves) for (let i = 0; i < move.ticks && cursor < tailStart && cursor < end; i++) inputs[cursor++] = move.input;
  const runs: { ticks: number; input: { x: number; y: number } }[] = [];
  for (const input of inputs) {
    const previous = runs.at(-1);
    if (previous && input.x === previous.input.x && input.y === previous.input.y) previous.ticks++;
    else runs.push({ ticks: 1, input });
  }
  return runs;
}
