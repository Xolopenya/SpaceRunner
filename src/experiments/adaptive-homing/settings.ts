/** DEV research presets share ONE controller. No ship/fairness/work settings change. */
export const HOMING = Object.freeze({ version: 'adaptive-homing-v1', geometry: 'adaptive-homing-geometry-v1',
  pursuitLeadTicks: 360, warningTicks: 120, maximumPursuitTicks: 480, initialX: 4.5, initialY: 2.4,
  initialVelocityX: 0, initialVelocityY: 0, traceTicks: 960, escapeProposalTicks: 132,
} as const);
export const HOMING_PRESETS = Object.freeze({
  soft: Object.freeze({ maxSpeed: 5, maxAcceleration: 4, responsiveness: 1.6 }),
  balanced: Object.freeze({ maxSpeed: 5.5, maxAcceleration: 6, responsiveness: 2.4 }),
  aggressive: Object.freeze({ maxSpeed: 6, maxAcceleration: 8, responsiveness: 3.2 }),
});
export type HomingPreset = keyof typeof HOMING_PRESETS;
/** Proposal scoring only; does not tune live mine or Ship motion. */
export const HOMING_ROUTE_PROPOSAL=Object.freeze({halfX:5.2,halfY:2.8,mineLeadSeconds:.6,travelWeight:.08,reversalWeight:.05});
export function homingPreset(value: string | null): HomingPreset {
  if (value === null) return 'balanced';
  if (Object.hasOwn(HOMING_PRESETS, value)) return value as HomingPreset;
  throw new RangeError('Unknown adaptive homing preset');
}
