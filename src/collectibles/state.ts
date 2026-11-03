import type { FragmentRun } from './run.ts';

/** Read-only presentation seam; no placement/planning imports in the entry chunk. */
export function fragmentsOf(model: object): FragmentRun | undefined {
  return 'fragments' in model ? model.fragments as FragmentRun : undefined;
}
