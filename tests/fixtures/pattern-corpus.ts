import { FieldGenerator } from '../../src/core/field-generator.ts';
import { PatternGenerator } from '../../src/core/field-patterns.ts';
import { PATTERN_FAMILIES } from '../../src/core/field-pattern-source.ts';
import type { PatternProposal } from '../../src/core/field-patterns.ts';
import type { FieldTransaction, FieldValidationContext, PatternFamily } from '../../src/core/field-types.ts';

export type PatternRoot = 'neutral' | 'horizontal' | 'vertical' | 'global-neutral' | 'late';
export function patternContext(candidate: FieldTransaction, root: PatternRoot, variation: number,
  committed: FieldValidationContext['committed'] = [], reference = candidate): FieldValidationContext {
  const p = reference.provenance.pattern, sign = variation % 2 ? -1 : 1;
  const first = candidate.hazards[0]!;
  const x = root === 'late' ? first.x : root === 'global-neutral' ? 0 : p?.offsetX ?? 0;
  const y = root === 'late' ? first.y : root === 'global-neutral' ? 0 : p?.offsetY ?? 0;
  return { player: { x, y, vx: root === 'horizontal' ? sign * 4 : 0, vy: root === 'vertical' ? sign * 4 : 0 },
    input: { x: root === 'horizontal' ? sign * .5 : 0, y: root === 'vertical' ? sign * .5 : 0 },
    elapsed: 120, distance: root === 'late' ? first.passDistance - 2 : 32, committed, candidate };
}
export function libraryCase(seed: number, family: PatternFamily, intensity: number, variation: number, root: PatternRoot) {
  const request = { family, firstCell: 4, intensity, variation };
  const proposal = new PatternGenerator(seed).propose(request);
  return { request, proposal, context: proposal.status === 'proposed' ? patternContext(proposal.transaction, root, variation) : undefined };
}
export const JOINT_CASES = ['ambient-pattern', 'pattern-ambient', 'pattern-pattern', 'horizontal-vertical'] as const;
export type JointCase = typeof JOINT_CASES[number];
export function jointCase(seed: number, type: JointCase, intensity: number) {
  const patterns = new PatternGenerator(seed), field = new FieldGenerator(seed);
  const family = type === 'horizontal-vertical' ? 'alternating' : PATTERN_FAMILIES[seed % 4]!;
  const first = patterns.propose({ family, firstCell: 4, intensity, variation: 0 });
  if (first.status !== 'proposed') return { proposal: first };
  const a = first.transaction, after = a.firstCell + a.cellCount;
  let proposal: PatternProposal = first, candidate = a, committed: FieldValidationContext['committed'];
  if (type === 'ambient-pattern') committed = field.propose(2, 2).hazards;
  else if (type === 'pattern-ambient') { committed = a.hazards; candidate = field.propose(after, 2); }
  else {
    proposal = patterns.propose({ family: type === 'horizontal-vertical' ? 'vertical-weave' : family,
      firstCell: after, intensity, variation: 1 }, a.hazards);
    if (proposal.status !== 'proposed') return { proposal };
    candidate = proposal.transaction; committed = a.hazards;
  }
  return { proposal, context: patternContext(candidate, intensity < .6 ? 'horizontal' : 'vertical', intensity < .6 ? 0 : 1, committed, a) };
}
