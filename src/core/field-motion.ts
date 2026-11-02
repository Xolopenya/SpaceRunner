import type { HazardMotion } from './field-types.ts';

export function frozenMotion(m: HazardMotion): Readonly<HazardMotion> {
  return Object.freeze({ ...m, ...(m.version !== 'linear-crossing-v1' ? { capture: Object.freeze({ ...m.capture }) } : {}) });
}
export function sameMotion(a?: HazardMotion, b?: HazardMotion): boolean {
  if (!a || !b) return !a && !b;
  if (a.version !== b.version || a.startTick !== b.startTick || a.durationTicks !== b.durationTicks
    || a.velocityX !== b.velocityX || a.velocityY !== b.velocityY) return false;
  if (a.version === 'linear-crossing-v1' && b.version === 'linear-crossing-v1') return true;
  if (a.version === 'adaptive-homing-v1' || b.version === 'adaptive-homing-v1') return JSON.stringify(a)===JSON.stringify(b);
  if (a.version !== 'target-lock-v1' || b.version !== 'target-lock-v1') return false;
  if (!a.capture || !b.capture) return false;
  return a.acquisitionStartTick === b.acquisitionStartTick && a.passTick === b.passTick
    && a.minimumWarningTicks === b.minimumWarningTicks && a.attackSpeed === b.attackSpeed
    && a.targetX === b.targetX && a.targetY === b.targetY && a.originChoice === b.originChoice
    && a.capture.tick === b.capture.tick && a.capture.elapsed === b.capture.elapsed && a.capture.distance === b.capture.distance
    && a.capture.x === b.capture.x && a.capture.y === b.capture.y && a.capture.vx === b.capture.vx && a.capture.vy === b.capture.vy
    && a.capture.inputX === b.capture.inputX && a.capture.inputY === b.capture.inputY;
}
