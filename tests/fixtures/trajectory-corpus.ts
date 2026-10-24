import { FieldGenerator } from '../../src/core/field-generator.ts';
import { FlightPrediction } from '../../src/core/field-prediction.ts';
import type { FieldValidationContext } from '../../src/core/field-types.ts';

export const APPROVED_SEEDS = [0, 1, 2, 3, 7, 11, 23, 42, 64, 127, 255, 1024, 4096, 65535, 2147483647, 4294967295] as const;
export const POLICIES = ['neutral', 'transition', 'diagonal', 'oscillating', 'boundary'] as const;
export type Policy = typeof POLICIES[number];
export type Regime = 'normal' | 'late-existing' | 'late-candidate' | 'long-horizon';

export function generatorContext(seed: number, policy: Policy, regime: Regime = 'normal'): FieldValidationContext {
  const state = { x: 0, y: 0, vx: 0, vy: 0, elapsed: 118, distance: 0 }, prediction = new FlightPrediction();
  let input = { x: 0, y: 0 };
  for (let tick = 0; tick < 120; tick++) {
    input = policy === 'transition' ? { x: tick < 54 ? 1 : 0, y: 0 }
      : policy === 'diagonal' ? { x: .7, y: .7 }
        : policy === 'oscillating' ? { x: Math.floor(tick / 24) % 2 ? -1 : 1, y: Math.floor(tick / 36) % 2 ? 1 : -1 }
          : policy === 'boundary' ? { x: -1, y: 0 } : { x: 0, y: 0 };
    prediction.step(state, input);
  }
  const generator = new FieldGenerator(seed), first = Math.ceil((state.distance + 128) / 24);
  if (regime === 'long-horizon') return { player: { x: 0, y: 0, vx: 0, vy: 0 }, input: { x: 0, y: 0 }, elapsed: 0, distance: 0,
    committed: generator.propose(4, 2).hazards, candidate: generator.propose(6, 6) };
  const candidate = generator.propose(first, 4), committed = regime === 'late-candidate' ? [] : generator.propose(first - 2, 2).hazards;
  if (regime !== 'normal') {
    // Engineered late-root probes, not claims of realized human input history.
    const target = (regime === 'late-existing' ? committed : candidate.hazards)[0]!;
    state.x = target.x; state.y = target.y; state.distance = target.passDistance - 5;
  }
  return { player: { x: state.x, y: state.y, vx: state.vx, vy: state.vy }, input,
    elapsed: state.elapsed, distance: state.distance, committed, candidate };
}
