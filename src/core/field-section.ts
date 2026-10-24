import { FieldGenerator } from './field-generator.ts';
import { PatternGenerator } from './field-patterns.ts';
import { DEFAULT_FIELD_SETTINGS as B } from './field-settings.ts';
import { DIRECTOR_SETTINGS as S } from './field-director-settings.ts';
import type { ScheduledSection } from './field-director.ts';
import type { FieldTransaction, PlannedHazard } from './field-types.ts';

/** Two bounded producer passes for pressure placement, not safety retries.
 * The first obtains the real B-3 template bounds; the second requests a whole
 * mirrored/translated candidate with its own canonical B-3 provenance/IDs.
 */
export function buildSection(section: ScheduledSection, committed: readonly PlannedHazard[] = []): {
  readonly transaction?: FieldTransaction; readonly rejection?: string; readonly templatePasses: number;
} {
  if (section.family === 'ambient') return { transaction: new FieldGenerator(section.seed).propose(section.firstCell, section.cellCount), templatePasses: 0 };
  const generator = new PatternGenerator(section.seed), request = { family: section.family, firstCell: section.firstCell,
    cellCount: section.cellCount, intensity: section.intensity, variation: section.variation };
  if (section.placement === 'free') {
    const p = generator.propose(request, committed);
    return { transaction: p.transaction, rejection: p.status === 'rejected' ? p.reason : undefined, templatePasses: 0 };
  }
  if (!Number.isInteger(section.corner) || section.corner! < 0 || section.corner! > 3) return { rejection: 'INVALID_CORNER', templatePasses: 0 };
  const sx = section.corner! < 2 ? -1 : 1, sy = section.corner! % 2 ? 1 : -1;
  const mirrorX = section.family === 'alternating' ? sx < 0 : sx > 0;
  const template = generator.propose({ ...request, mirrorX, mirrorY: false, offsetX: 0, offsetY: 0 });
  if (!template.transaction || template.status !== 'proposed') return { rejection: template.status === 'rejected' ? template.reason : 'GENERATION', templatePasses: 1 };
  const hazards = template.transaction.hazards;
  const mirrorY = (hazards[0]!.y >= 0 ? 1 : -1) !== sy;
  const xs = hazards.map(h => h.x), ys = hazards.map(h => h.y * (mirrorY ? -1 : 1));
  const offsetX = sx > 0 ? B.halfX - S.coverageInset - Math.max(...xs) : -B.halfX + S.coverageInset - Math.min(...xs);
  const offsetY = sy > 0 ? B.halfY - S.coverageInset - Math.max(...ys) : -B.halfY + S.coverageInset - Math.min(...ys);
  const p = generator.propose({ ...request, mirrorX, mirrorY, offsetX, offsetY }, committed);
  return { transaction: p.transaction, rejection: p.status === 'rejected' ? p.reason : undefined, templatePasses: 1 };
}
