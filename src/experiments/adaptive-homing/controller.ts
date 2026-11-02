import { CONFIG } from '../../config.ts';
import type { AdaptiveHomingMotion, AdaptiveMineState, PlannedHazard } from '../../core/field-types.ts';

export function adaptivePhase(tick: number, motion: AdaptiveHomingMotion): AdaptiveMineState['phase'] {
  return tick < motion.warningTick ? 'waiting' : tick < motion.startTick ? 'warning'
    : tick < motion.startTick + motion.durationTicks ? 'pursuit' : 'coast';
}
export function initialAdaptiveState(h: PlannedHazard): Readonly<AdaptiveMineState> {
  if (h.motion?.version !== 'adaptive-homing-v1') throw new RangeError('Not an adaptive mine');
  const m = h.motion;
  return Object.freeze({ id: h.id, tick: m.capture.tick, x: h.x, y: h.y, vx: m.velocityX, vy: m.velocityY,
    ax: 0, ay: 0, targetX: m.capture.x, targetY: m.capture.y, phase: adaptivePhase(m.capture.tick, m) });
}

/** One120Hz kick/drift segment. Ship has ALREADY advanced to its endpoint.
 * Desired arrival velocity and steering acceleration are both bounded. No future
 * input, depth prediction, renderer clock, mutable branch state or cached path. */
export function stepAdaptiveMine(s: Readonly<AdaptiveMineState>, ship: Readonly<{ x: number; y: number }>,
  m: Readonly<AdaptiveHomingMotion>): Readonly<AdaptiveMineState> {
  if (!Number.isSafeInteger(s.tick) || s.tick < 0 || !(m.maxSpeed > 0 && m.maxSpeed <= 6 && m.maxAcceleration > 0 && m.maxAcceleration <= 8
    && m.responsiveness > 0 && m.responsiveness <= 3.2) || !Number.isFinite(s.x+s.y+s.vx+s.vy+ship.x+ship.y)) throw new RangeError('Invalid homing dynamics');
  const tick = s.tick + 1, phase = adaptivePhase(tick, m);
  let vx = s.vx, vy = s.vy, ax = 0, ay = 0;
  if (phase === 'pursuit') {
    let dx = (ship.x-s.x)*m.responsiveness, dy = (ship.y-s.y)*m.responsiveness;
    const desiredScale = Math.max(1, Math.hypot(dx,dy)/m.maxSpeed); dx /= desiredScale; dy /= desiredScale;
    ax = (dx-vx)*m.responsiveness; ay = (dy-vy)*m.responsiveness;
    const accelerationScale = Math.max(1,Math.hypot(ax,ay)/m.maxAcceleration); ax /= accelerationScale; ay /= accelerationScale;
    vx += ax*CONFIG.step; vy += ay*CONFIG.step;
    const speedScale = Math.max(1,Math.hypot(vx,vy)/m.maxSpeed); vx /= speedScale; vy /= speedScale;
  }
  const moving = phase === 'pursuit' || phase === 'coast';
  return Object.freeze({ id:s.id,tick,x:s.x+(moving?vx*CONFIG.step:0),y:s.y+(moving?vy*CONFIG.step:0),
    vx,vy,ax,ay,targetX:ship.x,targetY:ship.y,phase });
}
