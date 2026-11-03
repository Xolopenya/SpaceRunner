import type { ReleaseModel } from '../../src/release/model.ts';
import type { FragmentProposal } from '../../src/collectibles/placement.ts';
import type { Axis } from '../../src/core/ship.ts';

export function certifiedInput(m: ReleaseModel): Axis {
  const w = m.field.certificate;
  let tick = w ? Math.round((m.elapsed - w.context.elapsed) * 120) : 0;
  for (const c of w?.controls ?? []) { if (tick < c.ticks) return c.input; tick -= c.ticks; }
  return { x: 0, y: 0 };
}
/** Automated pilot, not human playtest approval. Uses ordinary ship inputs. */
export function fragmentInput(m: ReleaseModel, p?: FragmentProposal): Axis {
  if (!p) return certifiedInput(m);
  return { x: Math.max(-1, Math.min(1, (p.x - m.ship.x) * 1.6 - m.ship.vx * .3)),
    y: Math.max(-1, Math.min(1, (p.y - m.ship.y) * 1.6 - m.ship.vy * .3)) };
}
