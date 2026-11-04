import { ReleaseModel } from '../release/model.ts';
import { RELEASE } from '../release/settings.ts';
import { placePassivePressure } from '../release/placement.ts';
import type { RuntimeEncounterSource } from '../debug/runtime-field.ts';
import type { FieldTransaction } from '../core/field-types.ts';
import { SHIP_COLLIDER } from '../core/ship-collider.ts';
import type { ValidationGeometry } from '../core/field-validator-types.ts';
import { AdaptiveSource } from '../experiments/adaptive-homing/source.ts';
import { ADAPTIVE_GEOMETRY } from '../experiments/adaptive-homing/transaction.ts';
import { IntegratedCollision, IntegratedPrediction } from './collision.ts';

export const INTEGRATED_GEOMETRY: ValidationGeometry = Object.freeze<ValidationGeometry>({
  ...ADAPTIVE_GEOMETRY, version: 'integrated-compound-homing-v1', shipProfile: SHIP_COLLIDER,
  compoundMotion: 'adaptive-homing-v1', prediction: context => new IntegratedPrediction(context),
  queryCost: h => ADAPTIVE_GEOMETRY.queryCost(h) * SHIP_COLLIDER.parts.length,
  inspect(candidate, known) {
    const result = ADAPTIVE_GEOMETRY.inspect(candidate, known);
    if (result.status !== 'invalid' || candidate.hazards.some(h => h.motion)) return result;
    // Preserve the release warm-up runway, without changing any hazard payload.
    return ADAPTIVE_GEOMETRY.inspect({ ...candidate, cellCount: candidate.cellCount - RELEASE.phase1ExtraCells,
      endDistance: candidate.endDistance - RELEASE.phase1ExtraCells * 24 }, known);
  },
});

export function integratedSource(homing: AdaptiveSource): RuntimeEncounterSource {
  let distance = 0, extra = 0, original: Parameters<RuntimeEncounterSource['candidate']>[0];
  return {
    version: 'integrated-playable-v1', diagnostics: true, planningFrame: homing.planningFrame,
    next(seed, cursor) {
      const decision = homing.next(seed, cursor); original = decision.section;
      extra = distance < RELEASE.phase2Distance && original.cellCount <= 4 ? RELEASE.phase1ExtraCells : 0;
      return { section: { ...original, cellCount: original.cellCount + extra, endDistance: original.endDistance + extra * 24 },
        next: { ...decision.next, firstCell: decision.next.firstCell + extra } };
    },
    candidate(_section, known, root) {
      const c = homing.candidate(original, known, root);
      const extend = (t: FieldTransaction) => ({ ...t, cellCount: t.cellCount + extra, endDistance: t.endDistance + extra * 24 });
      return { ...c, geometry: INTEGRATED_GEOMETRY,
        transaction: extend(original.encounter === 'moving-mine' ? c.transaction : placePassivePressure(c.transaction, root, known)),
        ...(c.fallback ? { fallback: extend(c.fallback) } : {}) };
    },
    advance(root) { distance = root.distance; homing.advance(root); },
    bindRoot: (root, known) => homing.bindRoot(root, known),
    published: (transaction, root) => homing.published(transaction, root),
    pose: (h, elapsed) => homing.pose(h, elapsed),
    reset() { distance = extra = 0; homing.reset(); },
    trace: () => homing.trace(),
  };
}

/** Ordinary Play on GAMEPLAY-005A. Historical ReleaseModel stays reproducible. */
export class IntegratedModel extends ReleaseModel {
  readonly homing: AdaptiveSource;
  protected override readonly collisions: IntegratedCollision;
  constructor() {
    const homing = new AdaptiveSource(false, 'balanced');
    super(integratedSource(homing));
    this.homing = homing; this.collisions = new IntegratedCollision(homing);
  }
  beginPlanningFrame(): void { this.homing.planningFrame.begin(); }
  finishPlanningFrame(dt: number): void { this.homing.planningFrame.finish(dt); }
  override dispose(): void { super.dispose(); this.homing.reset(); }
}
