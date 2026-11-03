import { CONFIG } from '../config.ts';

export interface ShipColliderPart {
  readonly id: 'body' | 'left-wing' | 'right-wing';
  readonly offsetX: number; readonly offsetY: number; readonly offsetZ: number; readonly radius: number;
}
export interface ShipColliderProfile {
  readonly version: string; readonly parts: readonly ShipColliderPart[];
  readonly axialExtent: number; readonly radialExtent: number; readonly enclosingRadius: number;
}
function profile(version: string, parts: ShipColliderPart[]): ShipColliderProfile {
  return Object.freeze({ version, parts: Object.freeze(parts.map(p => Object.freeze(p))),
    axialExtent: Math.max(...parts.map(p => Math.abs(p.offsetZ) + p.radius)),
    radialExtent: Math.max(...parts.map(p => Math.hypot(p.offsetX, p.offsetY) + p.radius)),
    enclosingRadius: Math.max(...parts.map(p => Math.hypot(p.offsetX, p.offsetY, p.offsetZ) + p.radius)) });
}
/** Gameplay axes, NOT frame-rate-dependent cosmetic banking. Measured on the
 * normalized Speeder A: wing-tip vertices x=±1.4, y=-.28…-.42, z=.49….91. */
export const SHIP_COLLIDER = profile('ship-body-wings-v1', [
  { id: 'body', offsetX: 0, offsetY: 0, offsetZ: 0, radius: CONFIG.ship.radius },
  { id: 'left-wing', offsetX: -1.02, offsetY: -.35, offsetZ: .7, radius: .28 },
  { id: 'right-wing', offsetX: 1.02, offsetY: -.35, offsetZ: .7, radius: .28 },
]);
/** Historical diagnostics keep their explicit single-sphere contract. */
export const BODY_COLLIDER = profile('ship-body-v1', [{ ...SHIP_COLLIDER.parts[0]! }]);
