import { PatternGenerator } from '../core/field-patterns.ts';
import { DEFAULT_FIELD_SETTINGS as S } from '../core/field-settings.ts';
import type { FieldTransaction, PlannedHazard } from '../core/field-types.ts';
import type { SchedulerRoot } from '../core/field-scheduler.ts';

/** One whole canonical producer transform, before the normal safety pipeline.
 * Active geometry, ambient fallback, station apertures and pacing stay fixed. */
export function placePassivePressure(transaction: FieldTransaction, root: SchedulerRoot | undefined,
  known: readonly PlannedHazard[] = []): FieldTransaction {
  const source = transaction.provenance.pattern;
  if (!source || !root) return transaction;
  const anchor = transaction.hazards[0]!;
  const xs = transaction.hazards.map(h => h.x - source.offsetX), ys = transaction.hazards.map(h => h.y - source.offsetY);
  const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
  const offsetX = clamp(source.offsetX + root.player.x - anchor.x,
    Math.max(-S.halfX, -S.halfX - Math.min(...xs)), Math.min(S.halfX, S.halfX - Math.max(...xs)));
  const offsetY = clamp(source.offsetY + root.player.y - anchor.y,
    Math.max(-S.halfY, -S.halfY - Math.min(...ys)), Math.min(S.halfY, S.halfY - Math.max(...ys)));
  const proposal = new PatternGenerator(transaction.provenance.seed).propose({ ...source, offsetX, offsetY }, known);
  if (proposal.status !== 'proposed') return transaction;
  return Object.freeze({ ...proposal.transaction, cellCount: transaction.cellCount, endDistance: transaction.endDistance });
}
