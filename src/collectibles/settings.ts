/** World units. Logical fragment r=.32; production adds .26 assistance. */
export const FRAGMENT = Object.freeze({
  version: 'energy-fragment-v1', capacity: 8, pickupRadius: .32,
  visualRadius: .54, clearance: .28, approachDepth: 8,
  boundaryInset: 1.1, naturalRouteOffset: 1.55, separation: 12,
  reactionSeconds: .65, maxCandidates: 8, burstSeconds: .42,
  pickupAssist: .26, magnetSeconds: .14, coastClearance: .28,
});
