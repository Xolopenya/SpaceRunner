type Result = { readonly decision: 'accept' | 'reject'; readonly reason?: string };
type OldResult = Result | { readonly decision: 'unavailable'; readonly reason?: string };

/** Describe the observed proofs, without turning a planner miss into impossibility. */
export function classifyFlowPublication(old: OldResult, fresh: Result, prefixCollision: boolean): string {
  if (prefixCollision) return 'unsafe-required-held-prefix';
  if (old.decision === 'accept') return fresh.decision === 'accept'
    ? 'publication-strategy-miss-existing-replay-safe' : 'fresh-search-miss-existing-replay-safe';
  if (fresh.decision === 'accept') return old.decision === 'reject' ? 'stale-witness' : 'preparation-miss-fresh-root-solved';
  if (['COMPUTATION_BUDGET_EXCEEDED', 'HORIZON_EXCEEDED'].includes(fresh.reason ?? '')) return 'budget-or-horizon';
  if (fresh.reason === 'STRUCTURAL_INVALID') return 'geometry-ownership-or-capacity';
  return 'not-solved-by-bounded-search';
}
