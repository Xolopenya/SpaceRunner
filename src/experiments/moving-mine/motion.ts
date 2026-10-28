import { CONFIG } from '../../config.ts';
import type { PlannedHazard } from '../../core/field-types.ts';
import { ALL_MINE_CONFIGURATIONS, MINE, motionVector } from './settings.ts';

export function isMine(h: { kind: number }): boolean { return h.kind === MINE.kind; }
export function simulationTick(elapsed: number): number { return Math.round(elapsed / CONFIG.step); }
/** No render clock or retained state. Start/end are integer tick boundaries. */
export function mineX(h: PlannedHazard, elapsed: number): number {
  const m = h.motion;
  if (!m) return h.x;
  const ticks = Math.max(0, Math.min(m.durationTicks, simulationTick(elapsed) - m.startTick));
  return h.x + m.velocityX * ticks * CONFIG.step;
}
export function mineY(h: PlannedHazard, elapsed: number): number {
  const m = h.motion;
  if (!m?.velocityY) return h.y;
  const ticks = Math.max(0, Math.min(m.durationTicks, simulationTick(elapsed) - m.startTick));
  return h.y + m.velocityY * ticks * CONFIG.step;
}
export function validMotion(h: PlannedHazard): boolean {
  const m = h.motion;
  return isMine(h) && !!m && m.version === MINE.motion && Number.isSafeInteger(m.startTick) && m.startTick >= 0
    && Number.isSafeInteger(m.durationTicks) && m.durationTicks > 0
    && ALL_MINE_CONFIGURATIONS.some(c => { const v = motionVector(c); return m.velocityX === v.x
      && (v.y ? m.velocityY === v.y && h.y === -v.y * MINE.startX / Math.abs(v.x) : m.velocityY === undefined && Math.abs(h.y) <= 1.6); })
    && Math.abs(h.x) === MINE.startX && Math.sign(h.x) === -Math.sign(m.velocityX)
    && m.durationTicks === Math.round(2 * MINE.startX / Math.abs(m.velocityX) / CONFIG.step)
    && h.radius === MINE.radius && h.spin === 0 && h.phase === 0
    && h.visualVariant === MINE.visualVariant && h.collisionProfile === MINE.profile && h.orientation === 'euler-xyz-v1';
}
