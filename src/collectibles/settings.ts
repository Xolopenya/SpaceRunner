/** Pickup forgiveness is independent of the thinner damage spheres. */
export const FRAGMENT = Object.freeze({
  version: 'energy-fragment-v1', capacity: 8, pickupRadius: .32,
  visualRadius: .54, clearance: .28, approachDepth: 8,
  boundaryInset: 1.1, naturalRouteOffset: 1.55, separation: 12,
  reactionSeconds: .65, maxCandidates: 8, burstSeconds: .42,
  pickupAssist: .405, wingPickupAssist: .1125, magnetSeconds: .14, coastClearance: .28,
  // Mean2.75 ordinary sections versus3.0 before; trails share a bounded budget.
  ordinaryCadence: Object.freeze([2,3,3,3]),
  trailCycle: 12, trailCount: 3, trailSpacing: 22, trailCurve: 2.4,
});
